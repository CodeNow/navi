'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;
var sinon = require('sinon');

var redis = require('../../lib/models/redis.js');
var Server = require('../../lib/models/server.js');

var ctx = {};
describe('server.js unit test', function () {
  beforeEach(function(done) {
    redis.removeAllListeners();
    ctx.proxyServer = new Server();
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
});