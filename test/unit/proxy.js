'use strict';
require('loadenv');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var expect = require('code').expect;
var sinon = require('sinon');
var pluck = require('101/pluck');
var clone = require('101/clone');
var noop = require('101/noop');
var keypather = require('keypather')();
var createResStream = require('../../lib/create-res-stream.js');
var scriptInjectResStreamFactory = require('../../lib/script-inject-res-stream.js');
var orion = require('@runnable/orion')

var errorPage = require('models/error-page.js');
var ProxyServer = require('../../lib/models/proxy.js');

describe('proxy.js unit test', function () {
  var proxyServer;
  beforeEach(function(done) {
    sinon.stub(orion.users, 'create')
    proxyServer = new ProxyServer();
    done();
  });
  afterEach(function (done) {
    orion.users.create.restore()
    done();
  });
  describe('proxy error handler', function() {
    it('should proxy to error page if target unresponsive', function(done) {
      var testRes = {};
      var testReq = {
        targetInstance: 'some_inst',
        res: testRes
      };
      var testHost = 'http://somehost:123';
      sinon.stub(errorPage, 'generateErrorUrl').returns(testHost);
      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(proxyServer.proxy.web
          .withArgs(testReq, testRes, {target: testHost}).calledOnce).to.be.true();

        expect(errorPage.generateErrorUrl.args[0][0]).to.equal('unresponsive');
        proxyServer.proxy.web.restore();
        errorPage.generateErrorUrl.restore();
        done();
      });
      proxyServer.proxy.emit('error', 'err', testReq, testRes);
    });
    it('should not proxy to error page twice', function(done) {
      // this test will fail with error done called twice if there was a failure
      var testRes = {};
      var testReq = {
        targetInstance: 'some_inst',
        res: testRes
      };
      var testHost = 'http://somehost:123';
      sinon.stub(errorPage, 'generateErrorUrl').returns(testHost);
      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(proxyServer.proxy.web
          .withArgs(testReq, testRes, {target: testHost}).calledOnce).to.be.true();

        expect(errorPage.generateErrorUrl.args[0][0]).to.equal('unresponsive');
        proxyServer.proxy.web.restore();
        errorPage.generateErrorUrl.restore();
        done();
      });
      proxyServer.proxy.emit('error', 'err', testReq, testRes);
      proxyServer.proxy.emit('error', 'err', testReq, testRes);
    });
  });

  describe('proxyIfTargetHostExist', function () {
    var testHost = 'http://localhost:1234';
    var testRes = {};
    var testReq = {
      header: sinon.stub().returns(null),
      targetHost: testHost,
      res: testRes,
      naviEntry: {
        ownerUsername: 'testOwnerUsername'
      }
    };
    var testMw;
    beforeEach(function(done) {
      testMw = proxyServer.proxyIfTargetHostExist();
      done();
    });

    it('should next if no target', function(done) {
      testMw({}, null, done);
    });

    it('should proxy if target exist', function(done) {
      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(proxyServer.proxy.web
          .withArgs(testReq, sinon.match.any, { target: testHost, secure: false })
          .calledOnce).to.be.true();

        sinon.assert.calledOnce(orion.users.create);
        sinon.assert.calledWith(orion.users.create, {
          user_id: 'navi-testOwnerUsername',
          update_last_request_at: true,
          companies: [{
            company_id: 'testOwnerUsername'.toLowerCase(),
            name: 'testOwnerUsername'
          }]
        });

        proxyServer.proxy.web.restore();
        done();
      });
      testMw(testReq, testRes);
    });

    it('should not send data to intercom if the naviEntry.ownerUsername does not exist', function (done) {
      var newTestReq = clone(testReq);
      delete newTestReq.naviEntry.ownerUsername
      sinon.stub(proxyServer.proxy, 'web', function() {
        sinon.assert.notCalled(orion.users.create);
        proxyServer.proxy.web.restore();
        done();
      });
      testMw(newTestReq, testRes);
    });

    it('should not send data to intercom if the req.cookies.isModerating exists', function (done) {
      testReq.headers = {
        cookie: ' mp_mixpanel__c=0; mp_mixpanel__c3=0; mp_mixpanel__c4=0; mp_mixpanel__c5=0; ' +
        'isModerating=495765; CSRF-TOKEN=UsgVTrkm-Yde4wC1KP3t5lFJjLSQfY3QeArY; ajs'
      };
      sinon.stub(proxyServer.proxy, 'web', function() {
        sinon.assert.notCalled(orion.users.create);
        proxyServer.proxy.web.restore();
        done();
      });
      testMw(testReq, testRes);
    });

    it('should keep path info and append query', function(done) {
      var testHost = 'http://detention-staging-codenow.runnableapp.com:80';
      var testQuery = 'status=running&ports=3000&ports=80&type=ports';
      var testPath = '/some/path';
      var req = {
        header: sinon.stub().returns(null),
        targetHost: testHost + '?' + testQuery,
        headers: {},
        url: testPath,
        naviEntry: {
          ownerUsername: 'testOwnerUsername'
        }
      };
      var expectedReq = {
        header: sinon.match.func,
        targetHost: testHost + '?' + testQuery,
        headers: {},
        url: testPath + '?' + testQuery,
        naviEntry: {
          ownerUsername: 'testOwnerUsername'
        }
      };

      sinon.stub(proxyServer.proxy, 'web', function() {
        sinon.assert.calledOnce(proxyServer.proxy.web)
        sinon.assert.calledWith(proxyServer.proxy.web, expectedReq, sinon.match.any, { target: testHost, secure: false })
        proxyServer.proxy.web.restore();
        done();
      });
      testMw(req, testRes);
    });
  });

  describe('proxyWsIfTargetHostExist', function () {
    it('should destroy socket if no host and port', function(done) {
      proxyServer.proxyWsIfTargetHostExist({}, {
        destroy: done
      });
    });
    it('should proxy if host', function(done) {
      sinon.stub(proxyServer.proxy, 'ws');
      var testHostname = 'coolhost';
      var testPort = '1244';
      var testReq = {
        targetHost: 'ws://' + testHostname + ':' + testPort
      };
      var testSocket = 'somesock';
      var testHead = 'someoneshead';
      proxyServer.proxyWsIfTargetHostExist(testReq, testSocket, testHead);
      expect(proxyServer.proxy.ws.calledWith(testReq, testSocket, testHead, {
        target: {
          host: testHostname,
          port: testPort
        },
        secure: false
      })).to.be.true();
      proxyServer.proxy.ws.restore();
      done();
    });
  });
  describe('redirectIfRedirectUrlExists', function () {
    var testHost = 'localhost:1234';
    var testReq = {
      redirectUrl: testHost
    };
    it('should next if no target', function(done) {
      ProxyServer.redirectIfRedirectUrlExists({}, null, done);
    });
    it('should proxy if target exist', function(done) {
      var testRes = {
        writeHead: noop,
        set: sinon.spy(),
        redirect: function (code, url) {
          expect(code).to.equal(307);
          expect(url).to.equal(testHost);
          done();
        }
      };
      ProxyServer.redirectIfRedirectUrlExists(testReq, testRes);
    });
  });
  describe('_addHeadersToRes', function () {
    it('should add cors headers to all responses', function (done) {
      var proxyRes = {
        headers: {}
      };
      var req = {};
      keypather.set(req, 'headers.origin', 'http://referer.com');
      keypather.set(req, 'headers["access-control-request-headers"]', 'accept');
      var instanceName = 'instanceName';
      var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');
      proxyServer._addHeadersToRes(req, proxyRes, instanceName);
      expect(proxyRes.headers).to.deep.contain({
        'access-control-allow-origin' : 'http://referer.com',
        'access-control-allow-methods': methodsStr,
        'access-control-allow-headers': req.headers['access-control-request-headers'],
        'access-control-allow-credentials': 'true',
        'x-runnable-instance-name': instanceName
      });
      done();
    });
    it('should override "access-control-allow-origin" if it is *', function (done) {
      var proxyRes = {
        headers: {
          'access-control-allow-origin' : '*',
        }
      };
      var instanceName = 'instanceName';
      var req = {};
      var origin = 'http://google.com';
      keypather.set(req, 'headers.origin', origin);
      keypather.set(req, 'cachedHeaders["access-control-allow-origin"]', 'http://google.com');
      proxyServer._addHeadersToRes(req, proxyRes, instanceName);
      expect(proxyRes.headers).to.deep.contain({
        'access-control-allow-origin': origin
      });
      done();
    });
    it('should use application\'s "origin", "methods", and "headers" when available',
    function(done) {
      var proxyRes = {
        headers: {
          'access-control-allow-origin' : 'http://google.com',
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers': 'accept'
        }
      };
      var cachedHeaders = clone(proxyRes.headers);
      var instanceName = 'instanceName';
      var req = {};
      keypather.set(req, 'headers.origin', 'http://yahoo.com');
      proxyServer._addHeadersToRes(req, proxyRes, instanceName);
      expect(proxyRes.headers).to.deep.contain(cachedHeaders);
      done();
    });
  });
  describe('_streamRes', function() {
    var ctx = {};
    beforeEach(function (done) {
      ctx.scriptInjectResStream = {
        input: { pipe: sinon.stub().returnsArg(0) },
        output: { pipe: sinon.stub().returnsArg(0) }
      };
      sinon.stub(scriptInjectResStreamFactory, 'create').returns(ctx.scriptInjectResStream);
      done();
    });
    afterEach(function (done) {
      scriptInjectResStreamFactory.create.restore();
      done();
    });

    it('should pipe the target-response to the response', function (done) {
      var targetRes = {
        headers: {},
        pipe: sinon.stub().returnsArg(0)
      };
      var proxiedRes = {
        pipe: sinon.stub().returnsArg(0)
      };
      var res = createResStream(); // mock

      proxyServer._streamRes(targetRes, proxiedRes, res, false);
      sinon.assert.calledWith(proxiedRes.pipe, res);
      done();
    });

    describe('response is html', function() {
      it('should transform and pipe the target-response to the response', function (done) {
        var targetRes = {
          headers: {
            'content-type': 'text/html',
            'content-encoding': 'gzip'
          },
          pipe: sinon.stub().returnsArg(0)
        };
        var proxiedRes = {
          pipe: sinon.stub().returnsArg(0)
        };
        var res = createResStream(); // mock

        proxyServer._streamRes(targetRes, proxiedRes, res, true);
        sinon.assert.calledWith(proxiedRes.pipe, ctx.scriptInjectResStream.input);
        sinon.assert.calledWith(ctx.scriptInjectResStream.output.pipe, res);
        done();
      });
      it('should not add script if redirectEnabled is false', function (done) {
        var targetRes = {
          headers: {
            'content-type': 'text/html',
            'content-encoding': 'gzip'
          },
          pipe: sinon.stub().returnsArg(0)
        };
        var proxiedRes = {
          pipe: sinon.stub().returnsArg(0)
        };
        var res = createResStream(); // mock

        proxyServer._streamRes(targetRes, proxiedRes, res, false);
        sinon.assert.notCalled(ctx.scriptInjectResStream.output.pipe);
        sinon.assert.calledWith(proxiedRes.pipe, res);
        sinon.assert.calledOnce(proxiedRes.pipe);
        done();
      });
    });
  });
});
