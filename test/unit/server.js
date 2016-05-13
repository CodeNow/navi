/**
 * @module test/unit/server
 */
'use strict';
require('loadenv');

var Lab = require('lab');
var expect = require('code').expect;
var mongodb = require('mongodb');
var sinon = require('sinon');
var http = require('http');
var https = require('https');

var Server = require('models/server');
var api = require('models/api');
var redis = require('models/redis');
var dataFetch = require('middlewares/data-fetch');
var resolveUrls = require('middlewares/resolve-urls');
var redirectDisabled = require('middlewares/redirect-disabled');
var checkContainerStatus = require('middlewares/check-container-status');
var Intercom = require('intercom-client');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

var chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';

describe('server.js unit test', function () {
  var proxyServer;
  beforeEach(function (done) {
    sinon.stub(Intercom, 'Client');
    sinon.stub(resolveUrls, 'middleware').yields();
    sinon.stub(redirectDisabled, 'middleware').yields();
    sinon.stub(checkContainerStatus, 'middleware').yields();
    proxyServer = new Server();
    done();
  });
  afterEach(function (done) {
    Intercom.Client.restore();
    resolveUrls.middleware.restore();
    redirectDisabled.middleware.restore();
    checkContainerStatus.middleware.restore();
    done();
  });
  beforeEach(function (done) {
    redis.removeAllListeners();
    done();
  });

  describe('start', function () {
    beforeEach(function (done) {
      sinon.stub(proxyServer.httpServer, 'listen');
      sinon.stub(proxyServer.httpsServer, 'listen');
      sinon.stub(mongodb.MongoClient, 'connect');
      done();
    });

    it('should start http server', function (done) {
      proxyServer.httpServer.listen.yieldsAsync();
      proxyServer.httpsServer.listen.yieldsAsync();

      proxyServer.start(function (err) {
        if (err) { return done(err); }
        expect(proxyServer.httpServer.listen
          .withArgs(process.env.HTTP_PORT).calledOnce).to.be.true();
        proxyServer.httpServer.listen.restore();
        done();
      });
    });

    it('should start https server', function (done) {
      proxyServer.httpServer.listen.yieldsAsync();
      proxyServer.httpsServer.listen.yieldsAsync();

      proxyServer.start(function (err) {
        if (err) { return done(err); }
        expect(proxyServer.httpServer.listen
          .withArgs(process.env.HTTP_PORT).calledOnce).to.be.true();
        proxyServer.httpServer.listen.restore();
        done();
      });
    });

    it('should error if http listen fails', function (done) {
      var mongoErr = new Error('mongo err');
      proxyServer.httpServer.listen.yieldsAsync(mongoErr);

      proxyServer.start(function (err) {
        expect(err.message).to.equal('mongo err');
        expect(proxyServer.httpServer.listen.callCount).to.equal(0);
        proxyServer.httpServer.listen.restore();
        mongodb.MongoClient.connect.restore();
        done();
      });
    });

    it('should error if mongo connect fails', function (done) {
      var mongoErr = new Error('mongo err');
      mongodb.MongoClient.connect.yieldsAsync(mongoErr);

      proxyServer.start(function (err) {
        expect(err.message).to.equal('mongo err');
        expect(proxyServer.httpServer.listen.callCount).to.equal(0);
        proxyServer.httpServer.listen.restore();
        mongodb.MongoClient.connect.restore();
        done();
      });
    });
  });
  describe('stop', function () {
    it('should close http server', function (done) {
      sinon.stub(proxyServer.httpServer, 'close').yields();
      proxyServer.stop(function (err) {
        if (err) { return done(err); }
        expect(proxyServer.httpServer.close.calledOnce).to.be.true();
        proxyServer.httpServer.close.restore();
        done();
      });
    });
  });
  describe('_handleUserWsRequest', function () {
    var _handleUserWsRequest;
    beforeEach(function (done) {
      sinon.stub(proxyServer.session, 'handle');
      sinon.stub(dataFetch, 'middleware').yieldsAsync();
      _handleUserWsRequest = proxyServer._handleUserWsRequest();
      done();
    });
    afterEach(function (done) {
      proxyServer.session.handle.restore();
      dataFetch.middleware.restore();
      done();
    });
    describe('domain', function() {
      it('should destroy socket if something thrown', function(done) {
        process.domain.runnableData= {}; // just for coverage of logs
        proxyServer.session.handle.throws('fireball');
        _handleUserWsRequest({}, {
          destroy: done
        }, {});
      });
    });
    describe('valid client', function () {
      beforeEach(function(done) {
        proxyServer.session.handle.returns(function (req, res , cb) {
          cb();
        });
        done();
        sinon.stub(api, 'getTargetHost');
      });
      afterEach(function (done) {
        api.getTargetHost.restore();
        done();
      });

      describe('found no target', function() {
        beforeEach(function(done) {
          api.getTargetHost.yields();
          done();
        });
        it('should destroy socket no target', function (done) {
          _handleUserWsRequest({}, {
            destroy: done
          }, {});
        });

        it('should call dataFetch', function (done) {
          _handleUserWsRequest({}, {
            destroy: function () {
              sinon.assert.calledOnce(dataFetch.middleware);
              done();
            }
          }, {});
        });
      });
      describe('founding target created err', function() {
        beforeEach(function(done) {
          api.getTargetHost.yields('sky if falling down');
          done();
        });
        it('should destroy socket no target', function (done) {
          _handleUserWsRequest({}, {
            destroy: done
          }, {});
        });
      });
      describe('founding target returns', function() {
        beforeEach(function(done) {
          api.getTargetHost.yields();
          done();
        });
        it('should call proxy', function (done) {
          var testReq = {
            headers: {}
          };
          testReq.headers['user-agent'] = chromeUserAgent;
          var testSocket = 'smelly';
          var testHead = 'small';
          sinon.stub(proxyServer.proxy, 'proxyWsIfTargetHostExist', function (req, socket, head) {
            expect(req).to.contain(testReq);
            expect(socket).to.equal(testSocket);
            expect(head).to.equal(testHead);
            done();
          });

          _handleUserWsRequest(testReq, testSocket, testHead);
        });
      });
    });
  });
});
