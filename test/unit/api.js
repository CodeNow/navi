'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var beforeEach = beforeEach;
var afterEach  = afterEach;
var expect = require('code').expect;

var sinon = require('sinon');

var api = require('../../lib/models/api.js');

describe('api.js unit test', function () {
  describe('login', function () {
    it('should login to github', function(done) {
      sinon.stub(api.user, 'githubLogin').yields();
      api.login(function() {
        expect(api.user.githubLogin
          .calledWith(process.env.HELLO_RUNNABLE_GITHUB_TOKEN))
          .to.be.true();
        api.user.githubLogin.restore();
        done();
      });
    });
  });
  describe('redirect', function () {
    it('should return middleware', function(done) {
      var testMw = api.redirect();
      expect(testMw).to.be.a.function();
      done();
    });
    it('should call api redirect', function(done) {
      var testRedir = 'http://runnable.com:80';
      var testReq = {
        headers: {
          host: 'runnable.com'
        }
      };
      var testRes = 'some res';
      sinon.stub(api.user, 'redirectForAuth').returns();
      var testMw = api.redirect();
      testMw(testReq, testRes);

      expect(api.user.redirectForAuth.calledWith(testRedir, testRes)).to.be.true();
      api.user.redirectForAuth.restore();
      done();
    });
  });
  describe('getHost', function () {
    var testBackend = 'testBackend';
    var testId = 'someId';
    beforeEach(function(done) {
      sinon.stub(api.user, 'fetchBackendForUrlWithUser').yields(null, testBackend);
      done();
    });
    afterEach(function(done) {
      api.user.fetchBackendForUrlWithUser.restore();
      done();
    });
    describe('no referer', function() {
      it('should get backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':1234';
        var testArgs = {
          headers: {
            host: host
          },
          session: {
            userId: testId
          }
        };
        api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(api.user.fetchBackendForUrlWithUser
            .calledWith(testId, 'http://'+host, undefined)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      it('should add 80 to host', function(done) {
        var host = 'localhost';
        var testArgs = {
          headers: {
            host: host
          },
          session: {
            userId: testId
          }
        };
        api.getHost(testArgs, function() {
          expect(api.user.fetchBackendForUrlWithUser
            .calledWith(testId, 'http://'+host+':80', undefined)).to.be.true();
          done();
        });
      });
    });
    describe('with referer', function() {
      var testRef = 'someRef';
      it('should get backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':1234';
        var testArgs = {
          headers: {
            host: host,
            referer: testRef
          },
          session: {
            userId: testId
          }
        };
        api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(api.user.fetchBackendForUrlWithUser
            .calledWith(testId, 'http://'+host, testRef)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      it('should get https backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':443';
        var testArgs = {
          headers: {
            host: host,
            referer: testRef
          },
          session: {
            userId: testId
          }
        };
        api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(api.user.fetchBackendForUrlWithUser
            .calledWith(testId, 'https://'+host, testRef)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      it('should add 80 to host', function(done) {
        var host = 'localhost';
        var testArgs = {
          headers: {
            host: host,
            referer: testRef
          },
          session: {
            userId: testId
          }
        };
        api.getHost(testArgs, function() {
          expect(api.user.fetchBackendForUrlWithUser
            .calledWith(testId, 'http://'+host+':80', testRef)).to.be.true();
          done();
        });
      });
    });
  });
});
