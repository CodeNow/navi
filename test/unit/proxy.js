'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;
var sinon = require('sinon');

var errorPage = require('models/error-page.js');
var ProxyServer = require('../../lib/models/proxy.js');

describe('proxy.js unit test', function () {
  var proxyServer;
  beforeEach(function(done) {
    proxyServer = new ProxyServer();
    done();
  });
  describe('proxy error handler', function() {
    it('should proxy to error page if target unresponsive', function(done) {
      var testReq = {
        targetInstance: 'some_inst'
      };
      var testRes = 'that-res';
      var testHost = 'somehost';
      sinon.stub(errorPage, 'generateErrorUrl').returns(testHost);
      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(proxyServer.proxy.web
          .withArgs(testReq, testRes, {target: testHost}).calledOnce).to.be.true();

        expect(errorPage.generateErrorUrl
          .withArgs('unresponsive', 'some_inst').calledOnce).to.be.true();
        proxyServer.proxy.web.restore();
        errorPage.generateErrorUrl.restore();
        done();
      });
      proxyServer.proxy.emit('error', 'err', testReq, testRes);
    });

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
        }
      })).to.be.true();
      proxyServer.proxy.ws.restore();
      done();
    });
  });
  describe('redirIfRedirectUrlExist', function () {
    var testHost = 'localhost:1234';
    var testReq = {
      redirectUrl: testHost
    };
    it('should next if no target', function(done) {
      ProxyServer.redirIfRedirectUrlExist({}, null, done);
    });
    it('should proxy if target exist', function(done) {
      var testRes = {
        redirect: function (code, url) {
          expect(code).to.equal(307);
          expect(url).to.equal(testHost);
          done();
        }
      };
      ProxyServer.redirIfRedirectUrlExist(testReq, testRes);
    });
  });
});
