'use strict';
require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;

var lab = exports.lab = Lab.script();

var redis = require('models/redis');
var sinon = require('sinon');

var api = require('../../lib/models/api.js');
//var errorPage = require('models/error-page.js');
var mongo = require('models/mongo');
var naviEntriesFixtures = require('../fixture/navi-entries');
var naviRedisEntriesFixture = require('../fixture/navi-redis-entries');
var redis = require('../../lib/models/redis.js');

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

describe('api.js unit test', function () {
  var ctx;
  beforeEach(function (done) {
    ctx = {};
    done();
  });

  describe('api.checkIfLoggedIn', function () {

  });

  describe('api._getGithubAuthUrl', function () {});

  describe('api._handleUnauthenticated', function () {});

  describe('api._getUrlFromRequest', function () {
    var base = 'repo-staging-codenow.runnableapp.com';
    var result = 'http://repo-staging-codenow.runnableapp.com:80';
    it('should add 80', function (done) {
      var test = api._getUrlFromRequest({
        isBrowser: true,
        headers: {
          host: base
        }
      });
      expect(test).to.equal(result);
      done();
    });
    it('should add https', function (done) {
      var test = api._getUrlFromRequest({
        isBrowser: true,
        headers: {
          host: base+':443'
        }
      });
      expect(test).to.equal('https://'+ base +':443');
      done();
    });
    it('should add 80 to subdomain', function (done) {
      var test = api._getUrlFromRequest({
        isBrowser: true,
        headers: {
          host: 'dat.sub.domain.' + base
        }
      });
      expect(test).to.equal(result);
      done();
    });
    it('should add https to subdomain', function (done) {
      var test = api._getUrlFromRequest({
        isBrowser: true,
        headers: {
          host: 'dat.sub.domain.' + base + ':443'
        }
      });
      expect(test).to.equal('https://'+ base +':443');
      done();
    });
    it('should be valid for correct hostname', function (done) {
      var test = api._getUrlFromRequest({
        isBrowser: true,
        headers: {
          host: base + ':100'
        }
      });
      expect(test).to.equal('http://'+ base +':100');
      done();
    });
  });

  describe('api._getDestinationProxyUrl', function () {});

  describe('api.getTargetHost', function () {

    describe('redis error', function () {
      beforeEach(function (done) {
        sinon.stub(api, '_getUrlFromRequest', function () {
          return '';
        });
        sinon.stub(redis, 'lrange', function (key, i, n, cb) {
          cb(new Error('redis error'));
        });
        done();
      });
      afterEach(function (done) {
        api._getUrlFromRequest.restore();
        redis.lrange.restore();
        done();
      });
      it('should next error', function (done) {
        var req = {
          headers: {}
        };
        api.getTargetHost(req, {}, function (err) {
          expect(err.message).to.equal('redis error');
          done();
        });
      });
    });

    describe('redis url entry parse error', function () {
      beforeEach(function (done) {
        sinon.stub(api, '_getUrlFromRequest', function () {
          return '';
        });
        sinon.stub(redis, 'lrange', function (key, i, n, cb) {
          cb(null, ['not valid JSON string']);
        });
        done();
      });
      afterEach(function (done) {
        api._getUrlFromRequest.restore();
        redis.lrange.restore();
        done();
      });
      it('should next error', function (done) {
        var req = {
          headers: {}
        };
        api.getTargetHost(req, {}, function (err) {
          expect(err).to.be.an.instanceOf(SyntaxError);
          done();
        });
      });
    });

    describe('target owner not member of authenticated users orgs', function () {
      beforeEach(function (done) {
        sinon.stub(api, '_getUrlFromRequest', function () {
          return '';
        });
        sinon.stub(redis, 'lrange', function (key, i, n, cb) {
          // ownerGithub === 495765
          cb(null, [naviRedisEntriesFixture.elastic]);
        });
        done();
      });
      afterEach(function (done) {
        api._getUrlFromRequest.restore();
        redis.lrange.restore();
        done();
      });
      it('should next an error object', function (done) {
        var req = {
          method: 'get',
          isBrowser: true,
          session: {
            userGithubOrgs: [19495, 93722, 958321],
            userId: 19495
          },
          headers: {}
        };
        api.getTargetHost(req, {}, function (err) {
          expect(err.isBoom).to.equal(true);
          expect(err.output.payload.statusCode).to.equal(404);
          done();
        });
      });
    });

    describe('elastic url incoming request', function () {

      describe('mongo fetchNaviEntry error', function () {
        beforeEach(function (done) {
          sinon.stub(api, '_getUrlFromRequest', function () {
            return '';
          });
          sinon.stub(redis, 'lrange', function (key, i, n, cb) {
            // ownerGithub === 495765
            cb(null, [naviRedisEntriesFixture.elastic]);
          });
          sinon.stub(mongo, 'fetchNaviEntry', function (reqUrl, refererUrl, cb) {
            cb(new Error('mongo error'));
          });
          done();
        });
        afterEach(function (done) {
          api._getUrlFromRequest.restore();
          redis.lrange.restore();
          mongo.fetchNaviEntry.restore();
          done();
        });
        it('should next error', function (done) {
          var req = {
            method: 'get',
            isBrowser: true,
            session: {
              userGithubOrgs: [495765, 958313],
              userId: 958313
            },
            headers: {}
          };
          api.getTargetHost(req, {}, function (err) {
            expect(err.message).to.equal('mongo error');
            done();
          });
        });
      });

      describe('is browser', function () {
        describe('referer', function () {
          var base = 'api-staging-codenow.runnableapp.com';
          var req;
          beforeEach(function (done) {
            req = {
              method: 'get',
              isBrowser: true,
              session: {
                userGithubOrgs: [495765, 847390, 958313],
                userId: 847390
              },
              headers: {
                origin: 'http://frontend-staging-codenow.runnableapp.com',
                host: base + ':80'
              }
            };
            sinon.stub(api, '_getUrlFromRequest', function () {
              return 'http://' + base + ':80';
            });
            sinon.stub(redis, 'lrange', function (key, i, n, cb) {
              // ownerGithub === 495765
              cb(null, [naviRedisEntriesFixture.elastic]);
            });
            sinon.stub(mongo, 'fetchNaviEntry', function (reqUrl, refererUrl, cb) {
              cb(null, naviEntriesFixtures);
            });
            done();
          });
          afterEach(function (done) {
            api._getUrlFromRequest.restore();
            redis.lrange.restore();
            mongo.fetchNaviEntry.restore();
            done();
          });

          it('should proxy to instance mapped by referer naviEntry association', function (done) {
            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              // feature-branch1 of API
              expect(req.targetHost).to.equal('http://0.0.0.0:39941');
              done();
            });
          });
        });

        describe('no referer', function () {
          var base = 'repo-staging-codenow.runnableapp.com';
          var req;
          beforeEach(function (done) {
            req = {
              // no origin or referer
              method: 'get',
              isBrowser: true,
              session: {
                userGithubOrgs: [495765, 847390],
                userId: 847390
              },
              headers: {
                host: base + ':80'
              }
            };
            sinon.stub(api, '_getUrlFromRequest', function () {
              return 'http://0.0.0.0:80';
            });
            sinon.stub(redis, 'lrange', function (key, i, n, cb) {
              // ownerGithub === 495765
              cb(null, [naviRedisEntriesFixture.elastic]);
            });
            sinon.stub(mongo, 'fetchNaviEntry', function (reqUrl, refererUrl, cb) {
              cb(null, naviEntriesFixtures);
            });
            done();
          });
          afterEach(function (done) {
            api._getUrlFromRequest.restore();
            redis.lrange.restore();
            mongo.fetchNaviEntry.restore();
            done();
          });

          it('should proxy to instance mapped by current user user-mapping', function (done) {
            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              expect(req.targetHost).to.equal('http://0.0.0.1:39941');
              done();
            });
          });

          it('should proxy to master instance if no user mapping for current user', 
          function (done) {
            req.session.userId = 555; // no user mapping for this user exists
            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              expect(req.targetHost).to.equal('http://0.0.0.0:39940');
              done();
            });
          });
        });
      });

      describe('is not browser', function () {
        beforeEach(function (done) {
          sinon.stub(api, '_getUrlFromRequest', function () {
            return 'http://0.0.0.0:80';
          });
          sinon.stub(redis, 'lrange', function (key, i, n, cb) {
            // ownerGithub === 495765
            cb(null, [naviRedisEntriesFixture.elastic]);
          });
          sinon.stub(mongo, 'fetchNaviEntry', function (reqUrl, refererUrl, cb) {
            cb(null, naviEntriesFixtures);
          });
          done();
        });
        afterEach(function (done) {
          api._getUrlFromRequest.restore();
          redis.lrange.restore();
          mongo.fetchNaviEntry.restore();
          done();
        });

        /*
         * Currently, hipache only forwards requests to navi if the requests are to valid containers
         * on actually exposed ports. These tests will have to be implemented if we decide to remove
         * hipache in the future and have Navi handle proxying to custom error pages.
        it('should proxy to error page if target does not exist', function (done) {
          done();
        });
        it('should proxy to error page if port is not exposed by target', function (done) {
          done();
        });
        */

        it('should proxy to error page if target does not belong to users github orgs',
        function (done) {
          var req = {
            method: 'get',
            isBrowser: true,
            session: {
              userGithubOrgs: [19495, 93722, 958321],
              userId: 958321
            },
            headers: {
              host: ''
            }
          };
          api.getTargetHost(req, {}, function () {
            done();
          });
        });

        it('should proxy to master instance', function (done) {
          var base = 'repo-staging-codenow.runnableapp.com';
          var req = {
            method: 'get',
            isBrowser: true,
            session: {
              userGithubOrgs: [495765],
              userId: 495765
            },
            headers: {
              host: base + ':80'
            }
          };
          api.getTargetHost(req, {}, function (err) {
            expect(err).to.be.undefined();
            expect(req.targetHost).to.equal('http://0.0.0.0:39940'); // host and port of master
            done();
          });
        });
      });
    });

    describe('direct url incoming request', function () {
    });
  });
});

