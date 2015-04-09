'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var before = lab.before;
var afterEach = lab.afterEach;
var after = lab.after;
var ip = require('ip');

var ProxyServer = require('../../lib/models/proxy.js');
var App = require('../../lib/app.js');
var redisM = require('redis');
var redis = redisM.createClient(process.env.REDIS_PORT, process.env.REDIS_IPADDRESS);
var TestServer = require('../fixture/test-server.js');
var request = require('request');
var Runnable = require('runnable');

describe('test sessions', function () {
  var testIp = ip.address();
  var testText = '1346tweyasdf3';
  var testPort = 55555;
  var testUrl = 'http://'+testIp + ':' + testPort;
  var testServer;
  var app;
  before(function(done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  before(function(done) {
    sinon.stub(Runnable.prototype, 'fetchBackendForUrl')
      .yields(null, testUrl);
    sinon.stub(Runnable.prototype, 'githubLogin').yields();
    done();
  });
  beforeEach(function(done) {
    app = new App();
    app.start(done);
  });
  afterEach(function(done) {
    app.stop(done);
  });
  afterEach(function(done) {
    redis.flushall(done);
  });
  after(function(done) {
    testServer.close(done);
  });
  after(function(done) {
    Runnable.prototype.fetchBackendForUrl.restore();
    Runnable.prototype.githubLogin.restore();
    done();
  });
  describe('no previous session', function () {
    it('should create a session', function(done) {
      sinon.spy(ProxyServer.prototype, 'requestHandler');
      request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
        if (err) { return done(err); }
        expect(ProxyServer.prototype.requestHandler.args[0][0].session)
          .to.exist();
        expect(body).to.equal(testText);
        ProxyServer.prototype.requestHandler.restore();
        done();
      });
    });
  });
  describe('with previous session', function () {
    beforeEach(function(done) {
      request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
        if (err) { return done(err); }
        expect(body).to.equal(testText);
        done();
      });
    });
    it('should use previous session', function(done) {
      sinon.spy(ProxyServer.prototype, 'requestHandler');
      request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
        if (err) { return done(err); }
        expect(ProxyServer.prototype.requestHandler.args[0][0].session)
          .to.exist();
        expect(body).to.equal(testText);
        ProxyServer.prototype.requestHandler.restore();
        done();
      });
    });
  });
});
