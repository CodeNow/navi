'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;
var sinon = require('sinon');

var ProxyServer = require('../../lib/models/proxy.js');

describe('proxy.js unit test', function () {
  var proxyServer;
  beforeEach(function(done) {
    proxyServer = new ProxyServer();
    done();
  });
  describe('proxyIfTargetHostExist', function () {
    var testHost = 'localhost:1234';
    var testReq = {
      targetHost: testHost
    };
    var testRes = 'res again';
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
          .withArgs(testReq, testRes, {target: testHost}).calledOnce).to.be.true();

        proxyServer.proxy.web.restore();
        done();
      });
      testMw(testReq, testRes);
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
