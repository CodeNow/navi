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

var App = require('../../lib/app.js');
var redis = require('../../lib/models/redis.js');
var request = require('request');
var Runnable = require('runnable');

describe('direct-url redirect', function () {
  var testUserId = '2834750923457';
  var testToken  = '9438569827345';
  var testTargetUrl = 'http://localhost:'+process.env.HTTP_PORT;
  var app;
  before(function(done) {
    redis.flushall(done);
  });
  before(function(done) {
    sinon.stub(Runnable.prototype, 'fetchBackendForUrl').yields();
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
    Runnable.prototype.fetchBackendForUrl.restore();
    Runnable.prototype.githubLogin.restore();
    done();
  });
  beforeEach(function(done) {
    redis.lpush(testToken, testUserId, done);
  });
  afterEach(function(done) {
    redis.flushall(done);
  });
  describe('direct-url exist', function () {
    beforeEach(function(done) {
      sinon.stub(Runnable.prototype, 'checkAndSetIfDirectUrl').yields(null, {});
      done();
    });
    afterEach(function(done) {
      Runnable.prototype.checkAndSetIfDirectUrl.restore();
      done();
    });
    it('should set user route mapping and redirect to self', function (done) {
      request({
        qs: {
          runnableappAccessToken: testToken
        },
        followRedirect: false,
        url: testTargetUrl
      }, function (err, res) {
        if (err) { return done(err); }
        expect(Runnable.prototype.checkAndSetIfDirectUrl.calledWith(testTargetUrl))
          .to.be.true();
        expect(res.headers.location).to.equal(testTargetUrl);
        expect(res.statusCode).to.equal(301);
        done();
      });
    });
  });
});
