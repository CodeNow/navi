'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;
var sinon = require('sinon');
var clone = require('101/clone');

var ProxyServer = require('../../lib/models/proxy.js');
var Api = require('../../lib/models/api.js');

describe('proxy.js unit test', function () {
  var proxyServer;
  beforeEach(function(done) {
    proxyServer = new ProxyServer();
    done();
  });
  describe('shouldUse', function () {
    var testArgs = {
      headers: {
        host: 'localhost:1234',
      },
      session: {
        userId: '24578932745842'
      }
    };
    it('should use if host and userId provided', function (done) {
      var use = proxyServer.shouldUse(testArgs);
      expect(use).to.be.true();
      done();
    });
    it('should be false for no host', function (done) {
      var args = clone(testArgs);
      delete args.headers.host;
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
    it('should be false for no headers', function (done) {
      var args = clone(testArgs);
      delete args.headers;
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
    it('should be false for no session', function (done) {
      var args = clone(testArgs);
      delete args.session;
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
    it('should be false for no userId', function (done) {
      var args = clone(testArgs);
      delete args.session.userId;
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
    it('should be false for no host or no userId', function (done) {
      var args = clone(testArgs);
      delete args.session.userId;
      delete args.headers.host;
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
    it('should be false for no headers or no session', function (done) {
      var args = {};
      var use = proxyServer.shouldUse(args);
      expect(use).to.be.false();
      done();
    });
  });
  describe('requestHandler', function () {
    var testReq = {check: 'something'};
    var testRes = {test: 'tester'};
    var testMw;
    beforeEach(function(done) {
      testMw = proxyServer.requestHandler();
      done();
    });
    it('should getHost and proxy request', function(done) {
      var testTarget = 'someTarget';
      sinon.stub(Api, 'getHost').yields(null, testTarget);
      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(Api.getHost
          .withArgs(testReq).calledOnce).to.be.true();
        expect(proxyServer.proxy.web
          .withArgs(testReq, testRes, {target: testTarget}).calledOnce).to.be.true();

        Api.getHost.restore();
        proxyServer.proxy.web.restore();
        done();
      });
      testMw(testReq, testRes);
    });
    it('should next error if getHost fails', function(done) {
      var testErr = 'some error';
      sinon.stub(Api, 'getHost').yields(testErr);

      function next (err) {
        expect(err).to.equal(testErr);
        expect(Api.getHost
          .withArgs(testReq).calledOnce).to.be.true();
        Api.getHost.restore();
        done();
      }
      testMw(testReq, testRes, next);
    });
    it('should next with no error if getHost returns no target', function(done) {
      sinon.stub(Api, 'getHost').yields();
      testMw(testReq, testRes, done);
    });
  });
  describe('wsRequestHandler', function () {
    it('should return middleware', function(done) {
      var test = proxyServer.wsRequestHandler();
      expect(test).to.exist();
      done();
    });
    it('should should proxy mw', function(done) {
     sinon.stub(proxyServer.proxy, 'ws');
      var test = proxyServer.wsRequestHandler();
      test();
      expect(proxyServer.proxy.ws.calledOnce).to.be.true();
      proxyServer.proxy.ws.restore();
      done();
    });
  });
});
