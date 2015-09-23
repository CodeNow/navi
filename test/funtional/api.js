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
  var testIp = '0.0.0.0';
  var testText = '1346tweyasdf3';
  var testErrorText = 'ididerror';
  var testPort = 55555;
  var testErrorPort = 55551;
  var testServer;
  var testErrorServer;
  var app;
  before(function (done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  before(function (done) {
   testErrorServer = TestServer.create(testErrorPort, testIp, testErrorText, done);
  });
  before(function (done) {
    redis.flushall(done);
  });
  beforeEach(function (done) {
    sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync();
    redis.removeAllListeners();
    app = new App();
    app.start(done);
  });
  afterEach(function (done) {
    Runnable.prototype.githubLogin.restore();
    app.stop(done);
  });
  after(function (done) {
    testServer.close(done);
  });
  after(function (done) {
    testErrorServer.close(done);
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
    it('should redirect to api for auth', function (done) {
      request({
        followRedirect: false,
        headers: {
          'user-agent' : chromeUserAgent
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        expect(res.statusCode).to.equal(307);
        expect(res.headers.location).to.contain(process.env.API_HOST);
        done();
      });
    });
    it('should redirect api if token does not exist in db', function (done) {
      request({
        followRedirect: false,
        headers: {
          'user-agent' : chromeUserAgent
        },
        qs: {
          runnableappAccessToken: 'doesnotexist'
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(307);
        expect(res.headers.location).to.contain(process.env.API_HOST);
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
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, done);
      });
      it('should proxy to error login page with force if second time', function (done) {
        request({
          jar: j,
          headers: {
            'user-agent' : chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res, body) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(200);
          var testTest = body.split(';')[0];
          var targetInfo = url.parse(body.split(';')[1]);
          expect(testTest).to.equal(testErrorText);
          var query = querystring.parse(targetInfo.query);
          expect(query.type).to.equal('signin');
          var testUrl = url.parse(query.redirectUrl);
          var query2 = querystring.parse(testUrl.query);
          expect(query2.forceLogin).to.exist();
          done();
        });
      });
    });
  });
  describe('auth error', function() {
    var resErr;
    beforeEach(function(done) {
      Runnable.prototype.githubLogin.yieldsAsync(resErr);
      done();
    });
    it('should redir to api', function (done) {
      var reqOpts = {
        followRedirect: false,
        method: 'OPTIONS',
        headers: {
          'user-agent' : chromeUserAgent
        },
        url: 'http://localhost:'+process.env.HTTP_PORT,
        json: true
      };
      request(reqOpts, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(307);
        expect(res.headers.location).to.contain(process.env.API_HOST);
        done();
      });
    });
    describe('getGithubAuthUrl throws', function() {
      beforeEach(function(done) {
        sinon.stub(Runnable.prototype, 'getGithubAuthUrl').throws();
        done();
      });
      afterEach(function(done) {
        Runnable.prototype.getGithubAuthUrl.restore();
        done();
      });
      it('should not fall over', function (done) {
        var reqOpts = {
          method: 'OPTIONS',
          headers: {
            'user-agent' : chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT,
          json: true
        };
        request(reqOpts, function (err, res) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(500);
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
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(500);
        done();
      });
    });
  });
});
