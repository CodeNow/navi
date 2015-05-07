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
        followRedirect: false,
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(301);
        done();
      });
    });
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
  });
  describe('logged in', function () {
    before(function(done) {
      sinon.stub(Runnable.prototype, 'fetch').yields();
      done();
    });
    after(function(done) {
      Runnable.prototype.fetch.restore();
      done();
    });
    describe('with token in header', function () {
      var testCookie = 'session-id=2938457;';
      var testToken  = '9438569827345';
      before(function (done) {
        done();
      });
      beforeEach(function(done) {
        redis.lpush(testToken, testCookie, done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      after(function (done) {
        done();
      });
      describe('valid user mapping', function() {
        it('should redirect to correct server', function (done) {
          sinon.stub(Runnable.prototype, 'getBackendFromUserMapping').yields(null, testUrl);
          request({
            qs: {
              runnableappAccessToken: testToken
            },
            url: 'http://localhost:'+process.env.HTTP_PORT
          }, function (err, res, body) {
            if (err) { return done(err); }
            expect(body).to.equal(testText);
            expect(res.statusCode).to.equal(200);
            Runnable.prototype.getBackendFromUserMapping.restore();
            done();
          });
        });
      });
      describe('no user mapping', function() {
        before(function(done) {
          sinon.stub(Runnable.prototype, 'getBackendFromUserMapping').yields('error');
          done();
        });
        after(function(done) {
          Runnable.prototype.getBackendFromUserMapping.restore();
          done();
        });
        describe('valid dep mapping', function() {
          before(function(done) {
            sinon.stub(Runnable.prototype, 'fetchBackendForUrl').yields(null, testUrl);
            done();
          });
          after(function(done) {
            Runnable.prototype.fetchBackendForUrl.restore();
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
          it('should redirect to correct if options', function (done) {
            sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync();
            request({
              method: 'OPTIONS',
              qs: {
                runnableappAccessToken: testToken
              },
              url: 'http://localhost:'+process.env.HTTP_PORT
            }, function (err, res, body) {
              if (err) { return done(err); }
              Runnable.prototype.githubLogin.restore();
              expect(body).to.equal(testText);
              expect(res.statusCode).to.equal(200);
              done();
            });
          });
        });
        describe('no dep mapping', function() {
          before(function(done) {
            sinon.stub(Runnable.prototype, 'fetchBackendForUrl').yields();
            done();
          });
          after(function(done) {
            Runnable.prototype.fetchBackendForUrl.restore();
            done();
          });
          it('should redir to box selection if not direct url', function (done) {
            sinon.stub(Runnable.prototype, 'checkAndSetIfDirectUrl').yields(null, {
              statusCode: 404
            });
            request({
              followRedirect: false,
              qs: {
                runnableappAccessToken: testToken
              },
              url: 'http://localhost:'+process.env.HTTP_PORT
            }, function (err, res) {
              if (err) { return done(err); }
              expect(res.statusCode).to.equal(301);
              Runnable.prototype.checkAndSetIfDirectUrl.restore();
              done();
            });
          });
          it('should redir to self if box direct-url', function (done) {
            sinon.stub(Runnable.prototype, 'checkAndSetIfDirectUrl').yields(null, {
              statusCode: 200
            });
            request({
              followRedirect: false,
              qs: {
                runnableappAccessToken: testToken
              },
              url: 'http://localhost:'+process.env.HTTP_PORT
            }, function (err, res) {
              if (err) { return done(err); }
              expect(res.headers.location).to.equal('http://localhost:'+process.env.HTTP_PORT);
              expect(res.statusCode).to.equal(301);
              Runnable.prototype.checkAndSetIfDirectUrl.restore();
              done();
            });
          });
        });
      });
    });
  });
});
