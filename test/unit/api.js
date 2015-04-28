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
console.log('TODO: create checkAndSetIfDirectUrl');
api.user.checkAndSetIfDirectUrl = function() {};
console.log('TODO: create redirectToBoxSelection');
api.user.redirectToBoxSelection = function(){};

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
  describe('ensureUserLoggedIn', function () {
    it('should call api ensureUserLoggedIn when user not logged in', function(done) {
      var testRedir = 'http://runnable.com:80';
      var testReq = {
        headers: {
          host: 'runnable.com'
        }
      };
      var testRes = 'some res';
      sinon.stub(api.user, 'redirectForAuth').returns();
      sinon.stub(api.user, 'fetch').yields(null, {
        statusCode: 401
      });

      var testMw = api.ensureUserLoggedIn();
      testMw(testReq, testRes);

      expect(api.user.redirectForAuth.calledWith(testRedir, testRes)).to.be.true();
      api.user.fetch.restore();
      api.user.redirectForAuth.restore();
      done();
    });
    it('should next error if user fetch had error', function(done) {
      var testErr = 'iamagooderr';
      sinon.stub(api.user, 'fetch').yields(testErr);

      var testMw = api.ensureUserLoggedIn();
      testMw(null, null, function(err) {
        expect(err).to.equal(testErr);
        api.user.fetch.restore();
        done();
      });
    });
    it('should next if user logged in', function(done) {
      sinon.stub(api.user, 'fetch').yields(null, {
        someUser: 'data'
      });
      var testMw = api.ensureUserLoggedIn();
      testMw(null, null, function() {
        api.user.fetch.restore();
        done();
      });
    });
  });
  describe('checkForDirectUrl', function () {
    it('should redirect to self after successful mapping', function(done) {
      var testRedir = 'http://runnable.com:80';
      var testId = 'someId';
      var testReq = {
        headers: {
          host: 'runnable.com'
        },
        session: {
          userId: testId
        }
      };
      var testRes = {
        redirect: function (code, url) {
          expect(code).to.equal(301);
          expect(url).to.equal(testRedir);
          done();
        }
      };
      sinon.stub(api.user, 'checkAndSetIfDirectUrl').yields(null, {
        statusCode: 200
      });

      var testMw = api.checkForDirectUrl();
      testMw(testReq, testRes);

      expect(api.user.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
        .to.be.true();
      api.user.checkAndSetIfDirectUrl.restore();
    });
    it('should next err if checkAndSetIfDirectUrl had error', function(done) {
      var testErr = 'error';
      var testRedir = 'http://runnable.com:80';
      var testId = 'someId';
      var testReq = {
        headers: {
          host: 'runnable.com'
        },
        session: {
          userId: testId
        }
      };
      sinon.stub(api.user, 'checkAndSetIfDirectUrl').yields(testErr);

      var testMw = api.checkForDirectUrl();
      testMw(testReq, null, function (err) {
        expect(err).to.equal(testErr);
        expect(api.user.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
          .to.be.true();
        api.user.checkAndSetIfDirectUrl.restore();
        done();
      });
    });
    it('should redirect to box selection if checkAndSetIfDirectUrl 404', function(done) {
      var testErr = 'error';
      var testRedir = 'http://runnable.com:80';
      var testId = 'someId';
      var testReq = {
        headers: {
          host: 'runnable.com'
        },
        session: {
          userId: testId
        }
      };
      sinon.stub(api.user, 'checkAndSetIfDirectUrl').yields(null, {
        statusCode: 404
      });
      sinon.stub(api.user, 'redirectToBoxSelection').returns();

      var testMw = api.checkForDirectUrl();
      testMw(testReq, null);
      expect(api.user.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
        .to.be.true();
      expect(api.user.redirectToBoxSelection.calledWith(testReq))
        .to.be.true();
      api.user.checkAndSetIfDirectUrl.restore();
      api.user.redirectToBoxSelection.restore();
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
