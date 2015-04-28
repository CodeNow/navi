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

describe('proxy to backend server', function () {
  var testIp = ip.address();
  var testText = '1346tweyasdf3';
  var testPort = 55555;
  var testUrl = 'http://'+testIp + ':' + testPort;
  var testServer;
  var app;
  before(function (done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  before(function (done) {
    sinon.stub(Runnable.prototype, 'githubLogin').yields();
    done();
  });
  before(function (done) {
    redis.flushall(done);
  });
  after(function (done) {
    Runnable.prototype.githubLogin.restore();
    done();
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
    it('should redirect to api', function (done) {
      request({
        followRedirect: false,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(301);
        done();
      });
    });
  });
  describe('with token in header', function () {
    it('should redirect to api if token does not exist in db', function (done) {
      request({
        followRedirect: false,
        qs: {
          runnableappAccessToken: 'doesnotexist'
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(301);
        done();
      });
    });
    describe('with valid user id', function () {
      var testUserId = '2834750923457';
      var testToken  = '9438569827345';
      before(function (done) {
        sinon.stub(Runnable.prototype, 'fetchBackendForUrlWithUser')
          .yields(null, testUrl);
        done();
      });
      beforeEach(function(done) {
        redis.lpush(testToken, testUserId, done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      after(function (done) {
        Runnable.prototype.fetchBackendForUrlWithUser.restore();
        done();
      });
      it('should redirect to correct server', function (done) {
        request({
          qs: {
            runnableappAccessToken: testToken
          },
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
});
