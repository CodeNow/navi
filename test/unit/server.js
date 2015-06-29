'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var expect = require('code').expect;
var sinon = require('sinon');

var redis = require('../../lib/models/redis.js');
var Server = require('../../lib/models/server.js');
var api = require('models/api.js');

describe('server.js unit test', function () {
  var proxyServer = new Server();
  beforeEach(function (done) {
    redis.removeAllListeners();
    done();
  });
  describe('start', function () {
    it('should start http server', function (done) {
      sinon.stub(proxyServer.server, 'listen').yieldsAsync();
      sinon.stub(api, 'loginSuperUser').yieldsAsync();
      proxyServer.start(function (err) {
        if (err) { return done(err); }
        expect(proxyServer.server.listen
          .withArgs(process.env.HTTP_PORT).calledOnce).to.be.true();
        expect(api.loginSuperUser.calledOnce).to.be.true();
        proxyServer.server.listen.restore();
        api.loginSuperUser.restore();
        done();
      });
    });
    it('should cb error if failed to login', function (done) {
      var testErr = 'attack by dementors';
      sinon.stub(api, 'loginSuperUser').yieldsAsync(testErr);
      proxyServer.start(function (err) {
        expect(err).to.equal(testErr);
        expect(api.loginSuperUser.calledOnce).to.be.true();
        api.loginSuperUser.restore();
        done();
      });
    });
  });
  describe('stop', function () {
    it('should close http server', function (done) {
      sinon.stub(proxyServer.server, 'close').yields();
      proxyServer.stop(function (err) {
        if (err) { return done(err); }
        expect(proxyServer.server.close.calledOnce).to.be.true();
        proxyServer.server.close.restore();
        done();
      });
    });
  });
  describe('_handleUserWsRequest', function () {
    var _handleUserWsRequest;
    beforeEach(function (done) {
      sinon.stub(proxyServer.session, 'handle');
      _handleUserWsRequest = proxyServer._handleUserWsRequest();
      done();
    });
    afterEach(function (done) {
      proxyServer.session.handle.restore();
      done();
    });
    describe('domain', function() {
      it('should destroy socket if something thrown', function(done) {
        proxyServer.session.handle.throws('fireball');
        _handleUserWsRequest({}, {
          destroy: done
        }, {});
      });
    });
    describe('valid client', function () {
      beforeEach(function(done) {
        sinon.stub(api, 'createClient').yields();
        proxyServer.session.handle.returns(function (req, res , cb) {
          cb();
        });
        done();
      });
      afterEach(function (done) {
        api.createClient.restore();
        done();
      });
      describe('not logged in', function() {
        beforeEach(function(done) {
          sinon.stub(api, 'checkIfLoggedIn', function (req, res, next) {
            req.redirectUrl = 'something';
            next();
          });
          done();
        });
        afterEach(function (done) {
          api.checkIfLoggedIn.restore();
          done();
        });
        it('should destroy socket', function(done) {
          _handleUserWsRequest({}, {
            destroy: done
          }, {});
        });
      });
      describe('logged in', function() {
        beforeEach(function(done) {
          sinon.stub(api, 'getTargetHost');
          sinon.stub(api, 'checkIfLoggedIn').yields();
          done();
        });
        afterEach(function (done) {
          api.getTargetHost.restore();
          api.checkIfLoggedIn.restore();
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
            var testReq = {};
            var testSocket = 'smelly';
            var testHead = 'small';
            sinon.stub(proxyServer.proxy, 'proxyWsIfTargetHostExist').returns();

            _handleUserWsRequest(testReq, testSocket, testHead);
            expect(proxyServer.proxy.proxyWsIfTargetHostExist
              .withArgs(testReq, testSocket, testHead).calledOnce)
              .to.be.true();
            done();
          });
        });
      });
    });
  });
});