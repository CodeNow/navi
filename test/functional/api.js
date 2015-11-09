'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');

var lab = exports.lab = Lab.script();

var expect = require('code').expect;
var hostile = require('hostile');
var querystring = require('querystring');
var request = require('request');
var sinon = require('sinon');
var url = require('url');

var App = require('../../lib/app.js');
var TestServer = require('../fixture/test-server.js');
var redis = require('../../lib/models/redis.js');
var seedMongo = require('../fixture/mongo/seed-mongo.js');

var after = lab.after;
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

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
  after(function (done) {
    testErrorServer.close(done);
  });
  describe('not logged in', function () {
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
    it('should redirect to api if shared token/key does not exist in redis', function (done) {
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
    describe('token exists', function () {
      beforeEach(function (done) {
        sinon.stub(redis, 'lpop', function (token, cb) {
          expect(token).to.equal('validAccessToken');
          cb(null, JSON.stringify({
            cookie: 'cookie',
            apiSessionRedisKey: 'apiSessionRedisKey'
          }));
        });
        sinon.stub(redis, 'get', function (key, cb) {
          expect(key).to.equal('apiSessionRedisKey');
          cb(null, JSON.stringify({})); // no 'user' key === unauthenticated
        });
        done();
      });
      afterEach(function(done) {
        redis.lpop.restore();
        redis.get.restore();
        done();
      });
      it('should redirect to api if token\'s apiSessionRedisKey redis value does not contain an ' +
         'authenticated session', function(done) {
        request({
          followRedirect: false,
          headers: {
            'user-agent' : chromeUserAgent
          },
          qs: {
            runnableappAccessToken: 'validAccessToken'
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) { return done(err); }
          expect(redis.lpop.callCount).to.equal(1);
          expect(redis.get.callCount).to.equal(1);
          expect(res.statusCode).to.equal(307);
          expect(res.headers.location).to.contain(process.env.API_HOST);
          done();
        });
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

  describe('error in system', function () {
    var j = request.jar();
    beforeEach(function (done) {
      sinon.stub(redis, 'get', function (token, cb) {
        cb(new Error('redis-error'));
      });
      done();
    });
    afterEach(function (done) {
      redis.get.restore();
      done();
    });
    it('should return', function (done) {
      request({
        jar: j,
        headers: {
          'user-agent' : chromeUserAgent
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        expect(res.statusCode).to.equal(500);
        done();
      });
    });
  });
});
