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
});
