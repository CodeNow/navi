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
var TestServer = require('../fixture/test-server.js');
var request = require('request');
var cookie = require('cookie');
var Runnable = require('runnable');

describe('proxy to backend server', function () {
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
    sinon.stub(Runnable.prototype, 'githubLogin').yields();
    done();
  });
  after(function(done) {
    Runnable.prototype.githubLogin.restore();
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
  // TODO: add all possible errors from API client
  describe('api method', function () {
    before(function(done) {
      sinon.stub(Runnable.prototype, 'fetchBackendForUrl')
        .yields(null, testUrl);
      done();
    });
    after(function(done) {
      Runnable.prototype.fetchBackendForUrl.restore();
      done();
    });
    it('should route to test app and set cookie', function(done) {
      request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
        expect(body).to.equal(testText);
        var testCookie = res.headers['set-cookie'][0];
        testCookie = cookie.parse(testCookie);
        expect(testCookie[process.env.COOKIE_NAME]).to
          .equal(testUrl);
        expect(testCookie['Max-Age']).to
          .equal(process.env.COOKIE_MAX_AGE_SECONDS+'');
        expect(testCookie.Domain).to
          .equal(process.env.COOKIE_DOMAIN);
        done();
      });
    });
  });
  // TODO: add malformed cookies
  describe('cookie method', function () {
    it('should use cookie to route', function(done) {
      var j = request.jar();
      var cookiej = request.cookie(process.env.COOKIE_NAME +
        '=' + testUrl);
      var url ='http://localhost:'+process.env.HTTP_PORT;
      j.setCookie(cookiej, url);

      request({
        url: url,
        jar: j
      }, function (err, res, body) {
        expect(body).to.equal(testText);
        done();
      });
    });
  });
});
