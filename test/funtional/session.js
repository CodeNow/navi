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
    redis.flushall(done);
  });
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
  after(function(done) {
    testServer.close(done);
  });
  after(function(done) {
    Runnable.prototype.fetchBackendForUrl.restore();
    Runnable.prototype.githubLogin.restore();
    done();
  });
  describe('with active session', function () {
    var testUserId = '2834750923457';
    var testToken  = '9438569827345';
    var j = request.jar();

    beforeEach(function(done) {
      redis.lpush(testToken, testUserId, done);
    });
    beforeEach(function(done) {
      var tokenHeader = {};
      tokenHeader[process.env.TOKEN_HEADER] = testToken;
      request({
        jar: j,
        headers: tokenHeader,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, done);
    });
    afterEach(function(done) {
      redis.flushall(done);
    });
    it('should use session to route', function (done) {
      request({
        jar: j,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res, body) {
        if (err) { return done(err); }
        expect(body).to.equal(testText);
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });
});
