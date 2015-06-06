'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var ErrorCat = require('error-cat');
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
var querystring = require('querystring');
var url = require('url');

var chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';

describe('proxy to backend server', function () {
  var testIp = ip.address();
  var testText = '1346tweyasdf3';
  var testPort = 55555;
  var testServer;
  var app;
  before(function (done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  before(function (done) {
    redis.flushall(done);
  });
  beforeEach(function (done) {
    redis.removeAllListeners();
    app = new App();
    app.start(done);
  });
  afterEach(function (done) {
    app.stop(done);
  });
  after(function (done) {
    testServer.close(done);
  });
  describe('not logged in', function () {
    before(function(done) {
      sinon.stub(Runnable.prototype, 'fetch').yields({
        output: {
          statusCode: 401
        },
        data: {
          error: 'Unauthorized'
        }
       });
      done();
    });
    after(function(done) {
      Runnable.prototype.fetch.restore();
      done();
    });
    it('should redirect to api', function (done) {
      request({
        headers: {
          'user-agent' : chromeUserAgent
        },
        followRedirect: false,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(307);
        done();
      });
    });
    it('should redirect to api if token does not exist in db', function (done) {
      request({
        headers: {
          'user-agent' : chromeUserAgent
        },
        followRedirect: false,
        qs: {
          runnableappAccessToken: 'doesnotexist'
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(307);
        done();
      });
    });
    describe('with auth attempted before', function() {
      var j = request.jar();
      beforeEach(function(done) {
        request({
          jar: j,
          headers: {
            'user-agent' : chromeUserAgent
          },
          followRedirect: false,
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, done);
      });
      it('should redirect to api with force if second time', function (done) {
        request({
          jar: j,
          headers: {
            'user-agent' : chromeUserAgent
          },
          followRedirect: false,
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(307);
          var testUrl = url.parse(res.headers.location);
          var qs = querystring.parse(testUrl.query);
          expect(qs.forceLogin).to.exist();
          done();
        });
      });
    });
  });
  describe('error from navi', function () {
    var err;
    before(function(done) {
      err = ErrorCat.create(500, 'boom');
      sinon.stub(Runnable.prototype, 'fetch').yields(err);
      done();
    });
    after(function(done) {
      Runnable.prototype.fetch.restore();
      done();
    });
    it('should recieve the error', function (done) {
      request({
        headers: {
          'user-agent' : chromeUserAgent
        },
        followRedirect: false,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(500);
        done();
      });
    });
  });
});
