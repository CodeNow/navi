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
  var session;
  var testToken = '2398475892374';
  var testReq = {
    query: {
      runnableappAccessToken: testToken
    }
  };
  beforeEach(function(done) {
    redis.removeAllListeners();
    session = new Session();
    done();
  });
  describe('shouldUse', function () {
    it('should use if token provided', function (done) {
      var use = session.shouldUse(testReq);
      expect(use).to.be.true();
      done();
    });
    it('should not use if no query', function (done) {
      var req = clone(testReq);
      delete req.query;
      var use = session.shouldUse(req);
      expect(use).to.be.false();
      done();
    });
    it('should not use if no token', function (done) {
      var req = clone(testReq);
      delete req.query.runnableappAccessToken;
      var use = session.shouldUse(req);
      expect(use).to.be.false();
      done();
    });
  });
  describe('handle', function () {
    it('should return session mw', function(done) {
      var sessionMw = session.handle();
      expect(sessionMw).to.exist();
      done();
    });
  });
  describe('getUserFromToken', function () {
    var testMw;
    before(function(done) {
      redis.flushall(done);
    });
    beforeEach(function(done) {
      testMw = session.getUserFromToken();
      done();
    });
    it('should next with error if redis failed', function(done) {
      var testErr = 'some err';
      sinon.stub(redis, 'lpop').yields(testErr);
      testMw(testReq, null, function(err) {
        expect(err).to.equal(testErr);
        redis.lpop.restore();
        done();
      });
    });
    it('should not set session if no redis key exist', function(done) {
      testMw(testReq, null, function() {
        expect(testReq.session).to.not.exist();
        done();
      });
    });
    describe('with session ID in redis', function() {
      var testUserId = '12837458927345';
      beforeEach(function(done) {
        redis.lpush(testToken, testUserId, done);
      });
      afterEach(function(done) {
        redis.flushall(done);
      });
      it('should set session if redis key exist', function(done) {
        var req = JSON.parse(JSON.stringify(testReq));
        req.session = {};
        testMw(req, null, function() {
          expect(req.session.userId).to.equal(testUserId);
          done();
        });
      });
    });
  });
});