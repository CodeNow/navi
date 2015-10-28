'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var before = lab.before;

var clone = require('101/clone');
var expect = require('code').expect;
var sinon = require('sinon');

var redis = require('../../lib/models/redis.js');
var Session = require('../../lib/models/session.js');

describe('session.js unit test', function () {
  var testToken = '2398475892374';
  var testReq = {
    query: {
      runnableappAccessToken: testToken
    }
  };
  describe('handle', function () {
    var session;
    beforeEach(function(done) {
      redis.removeAllListeners();
      session = new Session();
      done();
    });
    it('should return session mw', function(done) {
      var sessionMw = session.handle();
      expect(sessionMw).to.exist();
      done();
    });
  });
  describe('getCookieFromToken', function () {
    before(function(done) {
      redis.flushall(done);
    });
    describe('invalid args', function () {
      it('should not use if no query', function (done) {
        var req = clone(testReq);
        delete req.query;
        Session.getCookieFromToken(req, null, function (err) {
          expect(err).to.not.exist();
          done();
        });
      });
      it('should not use if no token', function (done) {
        var req = clone(testReq);
        delete req.query.runnableappAccessToken;
        Session.getCookieFromToken(req, null, function (err) {
          expect(err).to.not.exist();
          done();
        });
      });
    });
    it('should next with error if redis failed', function(done) {
      var testErr = 'some err';
      sinon.stub(redis, 'lpop').yields(testErr);
      Session.getCookieFromToken(testReq, null, function(err) {
        expect(err).to.equal(testErr);
        redis.lpop.restore();
        done();
      });
    });
    it('should not set session if no redis key exist', function(done) {
      Session.getCookieFromToken(testReq, null, function() {
        expect(testReq.session).to.not.exist();
        done();
      });
    });
    describe('with invalid data in redis', function() {
      beforeEach(function(done) {
        redis.lpush(testToken, 'invalid-data', done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      it('should next with error if JSON.parse failed', function(done) {
        Session.getCookieFromToken(testReq, null, function(err) {
          expect(err).to.be.an.instanceOf(SyntaxError);
          done();
        });
      });
    });
    describe('without required data in redis', function() {
      beforeEach(function(done) {
        redis.lpush(testToken, JSON.stringify({}), done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      it('should next with error if JSON.parse failed', function(done) {
        var req = JSON.parse(JSON.stringify(testReq));
        req.session = {};
        Session.getCookieFromToken(req, null, function() {
          expect(req.session.apiCookie).to.equal(undefined);
          expect(req.session.apiSessionRedisKey).to.equal(undefined);
          done();
        });
      });
    });
    describe('with session ID in redis', function() {
      var testUserId = '12837458927345';
      beforeEach(function(done) {
        redis.lpush(testToken, JSON.stringify({
          cookie: testUserId,
          apiSessionRedisKey: 12345
        }), done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      it('should set apiCookie if redis key exist', function(done) {
        var req = JSON.parse(JSON.stringify(testReq));
        req.session = {};
        Session.getCookieFromToken(req, null, function() {
          expect(req.session.apiCookie).to.equal(testUserId);
          expect(req.session.apiSessionRedisKey).to.equal(12345);
          done();
        });
      });
    });
  });
});
