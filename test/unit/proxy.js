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

var ctx = {};
describe('proxy.js unit test', function () {
  beforeEach(function(done) {
    ctx.proxyServer = new ProxyServer();
    done();
  });
  describe('start', function () {
    it('should start http server', function(done) {
      sinon.stub(ctx.proxyServer.server, 'listen').yields();
      ctx.proxyServer.start(function(err) {
        if (err) { return done(err); }
          expect(ctx.proxyServer.server.listen
            .withArgs(process.env.HTTP_PORT).calledOnce).to.be.true();

        ctx.proxyServer.server.listen.restore();
        done();
      });
    });
  });
  describe('stop', function () {
    it('should close http server', function(done) {
      sinon.stub(ctx.proxyServer.server, 'close').yields();
      ctx.proxyServer.stop(function(err) {
        if (err) { return done(err); }
        expect(ctx.proxyServer.server.close.calledOnce).to.be.true();
        ctx.proxyServer.server.close.restore();
        done();
      });
    });
  });
  describe('requestHandler', function () {
    it('should lookup and proxy request', function(done) {
      var req = {check: 'something'};
      var res = {test: 'tester'};
      sinon.stub(ctx.proxyServer.hostLookup, 'lookup').yields();
      sinon.stub(ctx.proxyServer.proxy, 'web', function() {

        expect(ctx.proxyServer.hostLookup.lookup
          .withArgs(req, res).calledOnce).to.be.true();

        expect(ctx.proxyServer.proxy.web
          .withArgs(req, res).calledOnce).to.be.true();

        ctx.proxyServer.hostLookup.lookup.restore();
        ctx.proxyServer.proxy.web.restore();
        done();
      });
      ctx.proxyServer.requestHandler(req, res);
    });
    it('should call respond error if lookup errors', function(done) {
      var req = {check: 'something'};
      var res = {test: 'tester'};
      sinon.stub(ctx.proxyServer.hostLookup, 'lookup').yields('some error');
      var error = require('../../lib/error.js');

      sinon.stub(error, 'errorResponder', function() {
        expect(ctx.proxyServer.hostLookup.lookup
          .withArgs(req, res).calledOnce).to.be.true();

        ctx.proxyServer.hostLookup.lookup.restore();
        error.errorResponder.restore();
        done();
      });
      ctx.proxyServer.requestHandler(req, res);
    });
  });
  describe('wsRequestHandler', function () {
    it('should proxy ws', function(done) {
     sinon.stub(ctx.proxyServer.proxy, 'ws', function() {
        ctx.proxyServer.proxy.ws.restore();
        done();
      });
      ctx.proxyServer.wsRequestHandler();
    });
  });
});
