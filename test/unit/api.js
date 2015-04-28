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
api.client.checkAndSetIfDirectUrl = function() {};
console.log('TODO: create redirectToBoxSelection');
api.client.redirectToBoxSelection = function(){};

describe('api.js unit test', function () {
  describe('login', function () {
    it('should login to github', function(done) {
      sinon.stub(api.client, 'githubLogin').yields();
      api.login(function() {
        expect(api.client.githubLogin
          .calledWith(process.env.HELLO_RUNNABLE_GITHUB_TOKEN))
          .to.be.true();
        api.client.githubLogin.restore();
        done();
      });
    });
  });
  describe('redirectIfNoUserId', function () {
    var redirectIfNoUserId;
    beforeEach(function(done) {
      redirectIfNoUserId = api.redirectIfNoUserId();
      done();
    });
    it('should call api redirectForAuth when userId not set', function(done) {
      var testRedir = 'http://runnable.com:80';
      var testReq = {
        headers: {
          host: 'runnable.com'
        },
        session: {}
      };
      var testRes = 'some res';
      sinon.stub(api.client, 'redirectForAuth').returns();

      redirectIfNoUserId(testReq, testRes);
      expect(api.client.redirectForAuth.calledWith(testRedir, testRes)).to.be.true();
      api.client.redirectForAuth.restore();
      done();
    });
    it('should next if session includes userId', function(done) {
      redirectIfNoUserId({
        session: {
          userId: 'someId'
        }
      }, null, done);
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
      sinon.stub(api.client, 'checkAndSetIfDirectUrl').yields(null, {
        statusCode: 200
      });

      var testMw = api.checkForDirectUrl();
      testMw(testReq, testRes);

      expect(api.client.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
        .to.be.true();
      api.client.checkAndSetIfDirectUrl.restore();
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
      sinon.stub(api.client, 'checkAndSetIfDirectUrl').yields(testErr);

      var testMw = api.checkForDirectUrl();
      testMw(testReq, null, function (err) {
        expect(err).to.equal(testErr);
        expect(api.client.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
          .to.be.true();
        api.client.checkAndSetIfDirectUrl.restore();
        done();
      });
    });
    it('should redirect to box selection if checkAndSetIfDirectUrl 404', function(done) {
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
      var testRes = 'testres';
      sinon.stub(api.client, 'checkAndSetIfDirectUrl').yields(null, {
        statusCode: 404
      });
      sinon.stub(api.client, 'redirectToBoxSelection').returns();

      var testMw = api.checkForDirectUrl();
      testMw(testReq, testRes);
      expect(api.client.checkAndSetIfDirectUrl.calledWith(testId, testRedir))
        .to.be.true();
      expect(api.client.redirectToBoxSelection.calledWith(testRedir, testRes))
        .to.be.true();
      api.client.checkAndSetIfDirectUrl.restore();
      api.client.redirectToBoxSelection.restore();
      done();
    });
  });
  describe('getHost', function () {
    var testBackend = 'testBackend';
    var testId = 'someId';
    beforeEach(function(done) {
      sinon.stub(api.client, 'fetchBackendForUrlWithUser').yields(null, testBackend);
      done();
    });
    afterEach(function(done) {
      api.client.fetchBackendForUrlWithUser.restore();
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
          expect(api.client.fetchBackendForUrlWithUser
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
          expect(api.client.fetchBackendForUrlWithUser
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
          expect(api.client.fetchBackendForUrlWithUser
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
          expect(api.client.fetchBackendForUrlWithUser
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
          expect(api.client.fetchBackendForUrlWithUser
            .calledWith(testId, 'http://'+host+':80', testRef)).to.be.true();
          done();
        });
      });
    });
  });
});
