'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;
var sinon = require('sinon');
var pluck = require('101/pluck');
var clone = require('101/clone');
var keypather = require('keypather')();

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
      var testHost = 'http://somehost:123';
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
    it('should not proxy to error page twice', function(done) {
      // this test will fail with error done called twice if there was a failure
      var testReq = {
        targetInstance: 'some_inst'
      };
      var testRes = 'that-res';
      var testHost = 'http://somehost:123';
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
      proxyServer.proxy.emit('error', 'err', testReq, testRes);
    });
  });
  describe('proxyIfTargetHostExist', function () {
    var testHost = 'http://localhost:1234';
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
    it('should keep path info and append query', function(done) {
      var testHost = 'http://detention-staging-codenow.runnableapp.com:80';
      var testQuery = 'status=running&ports=3000&ports=80&type=ports';
      var testPath = '/some/path';
      var req = {
        targetHost: testHost + '?' + testQuery,
        headers: {},
        url: testPath
      };
      var expectedReq = {
        targetHost: testHost + '?' + testQuery,
        headers: {},
        url: testPath + '?' + testQuery
      };

      sinon.stub(proxyServer.proxy, 'web', function() {
        expect(proxyServer.proxy.web
          .withArgs(expectedReq, testRes, {target: testHost}).calledOnce).to.be.true();

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
  describe('_addHeadersToRes', function () {
    it('should add cors headers to all responses', function (done) {
      var proxyRes = {
        headers: {}
      };
      var req = {};
      keypather.set(req, 'headers.origin', 'http://referer.com');
      var instanceName = 'instanceName';
      var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');
      proxyServer._addHeadersToRes(proxyRes, req, instanceName);
      console.log(proxyRes, {
        'Access-Control-Allow-Origin' : 'http://referer.com',
        'Access-Control-Allow-Methods': methodsStr,
        'Access-Control-Allow-Headers': 'accept, content-type',
        'Access-Control-Allow-Credentials': 'true',
        'Runnable-Instance-Name': instanceName
      });
      expect(proxyRes.headers).to.deep.contain({
        'Access-Control-Allow-Origin' : 'http://referer.com',
        'Access-Control-Allow-Methods': methodsStr,
        'Access-Control-Allow-Headers': 'accept, content-type',
        'Access-Control-Allow-Credentials': 'true',
        'Runnable-Instance-Name': instanceName
      });
      done();
    });
    it('should override Access-Control-Allow-Origin if it is *', function (done) {
      var proxyRes = {
        headers: {
          'Access-Control-Allow-Origin' : '*',
        }
      };
      var instanceName = 'instanceName';
      var req = {};
      var origin = 'http://google.com';
      keypather.set(req, 'headers.origin', origin);
      keypather.set(req, 'cachedHeaders["Access-Control-Allow-Origin"]', 'http://google.com');
      proxyServer._addHeadersToRes(proxyRes, req, instanceName);
      expect(proxyRes.headers).to.deep.contain({
        'Access-Control-Allow-Origin': origin
      });
      done();
    });
    it('should use application\'s "origin", "methods", and "headers" when available', function(done) {
      var proxyRes = {
        headers: {
          'Access-Control-Allow-Origin' : 'http://google.com',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'accept'
        }
      };
      var cachedHeaders = clone(proxyRes.headers);
      var instanceName = 'instanceName';
      var req = {};
      keypather.set(req, 'headers.origin', null);
      proxyServer._addHeadersToRes(proxyRes, req, instanceName);
      expect(proxyRes.headers).to.deep.contain(cachedHeaders);
      done();
    });
  });
});
