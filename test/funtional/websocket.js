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
var App = require('../../lib/app.js');
var redis = require('../../lib/models/redis.js');
var TestServer = require('../fixture/test-server-ws.js');
var Runnable = require('runnable');
var Primus = require('primus');
var Socket = Primus.createSocket();
var session = require('models/session.js');

describe('proxy to backend server', function () {
  var testIp = ip.address();
  var testText = 'I dreamed a dream of a stream going by';
  var testPort = 55555;
  var testUrl = 'http://'+testIp + ':' + testPort;
  var testServer;
  var app;
  before(function (done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  beforeEach(function (done) {
    redis.removeAllListeners();
    sinon.stub(session.prototype, 'handle', function() {
      return function (req, res, cb) {
        req.session = {
          apiCookie: 'iamatestcookie'
        };
        cb();
      };
    });
    app = new App();
    app.start(done);
  });
  afterEach(function (done) {
    session.prototype.handle.restore();
    app.stop(done);
  });
  after(function (done) {
    testServer.close(done);
  });
  describe('getTargetHost fails', function () {
    before(function(done) {
      sinon.stub(Runnable.prototype, 'getBackendFromUserMapping').yields('death');
      sinon.stub(Runnable.prototype, 'fetchBackendForUrl').yields('destruction');
      done();
    });
    after(function(done) {
      Runnable.prototype.getBackendFromUserMapping.restore();
      Runnable.prototype.fetchBackendForUrl.restore();
      done();
    });
    it('should error', function (done) {
      var primus = new Socket('http://localhost:'+process.env.HTTP_PORT, { strategy: false });
      primus.on('error', function(){
        primus.end();
        done();
      });
    });
  });
  describe('with session cookie', function () {
    describe('valid user mapping', function() {
      it('should redirect to correct server', function (done) {
        sinon.stub(Runnable.prototype, 'getBackendFromUserMapping').yields(null, testUrl);
        var primus = new Socket('http://localhost:'+process.env.HTTP_PORT,
          { strategy: false });
        primus.on('data', function (data) {
          expect(data.text).to.equal(testText);
        });
        primus.on('end', function () {
          Runnable.prototype.getBackendFromUserMapping.restore();
          done();
        });
      });
    });
    describe('valid from deps', function() {
      it('should redirect to correct server', function (done) {
        sinon.stub(Runnable.prototype, 'getBackendFromUserMapping').yields('prod-cowboys');
        sinon.stub(Runnable.prototype, 'fetchBackendForUrl').yields(null, testUrl);
        var primus = new Socket('http://localhost:'+process.env.HTTP_PORT,
          { strategy: false });
        primus.on('data', function (data) {
          expect(data.text).to.equal(testText);
        });
        primus.on('end', function () {
          Runnable.prototype.getBackendFromUserMapping.restore();
          Runnable.prototype.fetchBackendForUrl.restore();
          done();
        });
      });
    });
  });
});
