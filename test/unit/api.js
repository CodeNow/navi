/**
 * @module test/unit/api
 */
'use strict';
require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;
var put = require('101/put');
var sinon = require('sinon');

var lab = exports.lab = Lab.script();

//var errorPage = require('models/error-page.js');
var api = require('models/api.js');
var log = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');
var naviEntriesFixtures = require('../fixture/navi-entries');
var naviRedisEntriesFixture = require('../fixture/navi-redis-entries');
var redis = require('models/redis');
var errorPage = require('models/error-page.js');

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

  describe('api._isUserAuthorized', function () {
    it('should return true if user is in whitelistedUsers list', function (done) {
      var req = {
        session: {
          userId: 467885,
          userGithubOrgs: [467885]
        }
      };
      var result = api._isUserAuthorized(req, 9999);
      expect(result).to.equal(true);
      done();
    });
    describe('PUBLIC_ALLOWS_UNAUTH set to true ', function () {
      it('should return true no matter what', function (done) {
        var req = {
          session: {}
        };
        var result = api._isUserAuthorized(req, 9999);
        expect(result).to.equal(true);
        done();
      });
    });
    describe('PUBLIC_ALLOWS_UNAUTH set to false ', function () {
      var previousDisableAuthEnv;
      beforeEach(function (done) {
        previousDisableAuthEnv = process.env.PUBLIC_ALLOWS_UNAUTH;
        process.env.PUBLIC_ALLOWS_UNAUTH = false;
        done();
      });
      afterEach(function (done) {
        process.env.PUBLIC_ALLOWS_UNAUTH = previousDisableAuthEnv;
        done();
      });
      it('should return false if user is NOT in whitelistedUsers list', function (done) {
        var req = {
          session: {
            userId: 46788511111,
            userGithubOrgs: [46788511111]
          }
        };
        var result = api._isUserAuthorized(req, 9999);
        expect(result).to.equal(false);
        done();
      });
      it('should return true if user is in whitelistedUsers list', function (done) {
        var req = {
          session: {
            userId: 1085792,
            userGithubOrgs: [1085792]
          }
        };
        var result = api._isUserAuthorized(req, 9999);
        expect(result).to.equal(true);
        done();
      });
    });
  });

  describe('api.checkIfLoggedIn', function () {
    var req = {
      session: {
        authTried: false,
        apiSessionRedisKey: 'redis-session-key',
        userId: 555,
        userGithubOrgs: [555]
      },
      method: 'get',
    };
    it('should next if should bypass auth', function (done) {
      sinon.stub(api, '_shouldBypassAuth', function () { return true; });
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.equal(undefined);
        expect(api._shouldBypassAuth.callCount).to.equal(1);
        api._shouldBypassAuth.restore();
        done();
      });
    });

    it('should next with error if redis.get returns error', function (done) {
      sinon.stub(api, '_shouldBypassAuth', function () { return false; });
      sinon.stub(redis, 'get', function (key, cb) {
        expect(key).to.equal('redis-session-key');
        cb(new Error('redis error'));
      });
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err.message).to.equal('redis error');
        expect(api._shouldBypassAuth.callCount).to.equal(1);
        expect(redis.get.callCount).to.equal(1);
        api._shouldBypassAuth.restore();
        redis.get.restore();
        done();
      });
    });

    it('should next with error if redis.get return data is invalid json', function (done) {
      sinon.stub(api, '_shouldBypassAuth', function () { return false; });
      sinon.stub(redis, 'get', function (key, cb) {
        expect(key).to.equal('redis-session-key');
        cb(null, 'invalid-json');
      });
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.be.instanceOf(SyntaxError);
        expect(api._shouldBypassAuth.callCount).to.equal(1);
        expect(redis.get.callCount).to.equal(1);
        api._shouldBypassAuth.restore();
        redis.get.restore();
        done();
      });
    });

    it('should route to unathenticated helper if redis session data indicates user is unauth',
    function (done) {
      sinon.stub(api, '_shouldBypassAuth', function () { return false; });
      sinon.stub(redis, 'get', function (key, cb) {
        expect(key).to.equal('redis-session-key');
        cb(null, JSON.stringify({
          passport: {
            // no user
          }
        }));
      });
      sinon.stub(api, '_handleUnauthenticated', function (req, res, next) {
        next();
      });
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.be.undefined();
        expect(api._shouldBypassAuth.callCount).to.equal(1);
        expect(redis.get.callCount).to.equal(1);
        expect(api._handleUnauthenticated.callCount).to.equal(1);
        api._shouldBypassAuth.restore();
        api._handleUnauthenticated.restore();
        redis.get.restore();
        done();
      });
    });

    it('should route to unathenticated helper if redis session data indicates user is unauth',
      function (done) {
        sinon.stub(api, '_shouldBypassAuth', function () { return false; });
        sinon.stub(redis, 'get', function (key, cb) {
          expect(key).to.equal('redis-session-key');
          cb(null, JSON.stringify({
            passport: {
              user: {}
            }
          }));
        });
        sinon.stub(api, '_handleUnauthenticated', function (req, res, next) {
          next();
        });
        api.checkIfLoggedIn(req, {}, function (err) {
          expect(err).to.be.undefined();
          expect(api._shouldBypassAuth.callCount).to.equal(1);
          expect(redis.get.callCount).to.equal(1);
          expect(api._handleUnauthenticated.callCount).to.equal(0);
          api._shouldBypassAuth.restore();
          api._handleUnauthenticated.restore();
          redis.get.restore();
          done();
        });
      });
  });

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
  describe('api._shouldBypassAuth', function () {
    describe('PUBLIC_ALLOWS_UNAUTH set to true ', function () {
      it('should return true no matter what', function (done) {
        var result = api._shouldBypassAuth({
          isBrowser: true,
          method: 'get'
        });
        expect(result).to.equal(true);
        done();
      });
    });
    describe('PUBLIC_ALLOWS_UNAUTH set to false ', function () {
      var previousDisableAuthEnv;
      beforeEach(function (done) {
        previousDisableAuthEnv = process.env.PUBLIC_ALLOWS_UNAUTH;
        process.env.PUBLIC_ALLOWS_UNAUTH = false;
        done();
      });
      afterEach(function (done) {
        process.env.PUBLIC_ALLOWS_UNAUTH = previousDisableAuthEnv;
        done();
      });
      it('should return true if options request', function (done) {
        var result = api._shouldBypassAuth({
          method: 'options'
        });
        expect(result).to.equal(true);
        done();
      });

      it('should return true if !isBrowser request', function (done) {
        var result = api._shouldBypassAuth({
          isBrowser: false,
          method: 'get'
        });
        expect(result).to.equal(true);
        done();
      });

      it('should return false if should not bypass', function (done) {
        var result = api._shouldBypassAuth({
          isBrowser: true,
          method: 'get'
        });
        expect(result).to.equal(false);
        done();
      });
    });
  })

  describe('_processTargetInstance', function () {
    beforeEach(function (done) {
      sinon.stub(api, '_getDestinationProxyUrl');
      sinon.stub(errorPage, 'generateErrorUrl').returns('TestErrorHost')
      done();
    });

    afterEach(function (done) {
      api._getDestinationProxyUrl.restore();
      errorPage.generateErrorUrl.restore()
      done();
    });

    it('should next with error if !targetNaviEntryInstance', function (done) {
      api._processTargetInstance(null, '', '', {}, function (err) {
        expect(err.message).to.equal('Not Found');
        done();
      });
    });

    it('should set req.targetHost to error url if !running', function (done) {
      var req = {};
      var reqUrl = 'api-staging-codenow.runnableapp.com';
      api._processTargetInstance({
        running: false,
        branch: 'master'
      }, '55555', reqUrl, req, function (err) {
        expect(err).to.be.undefined();
        expect(req.targetHost).to.equal('TestErrorHost');
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'not_running', {
          elasticUrl: reqUrl,
          shortHash: '55555'
        })
        done();
      });
    });

    it('should set req.targetHost to container host & port if running', function (done) {
      api._getDestinationProxyUrl.returns('http://0.0.0.0:600');
      var req = {};
      var reqUrl = 'api-staging-codenow.runnableapp.com';
      api._processTargetInstance({
        running: true,
        branch: 'master'
      }, '55555', reqUrl, req, function (err) {
        expect(err).to.be.undefined();
        expect(req.targetHost).to.equal('http://0.0.0.0:600');
        done();
      });
    });

    it('should redirect to the dock_removed error page if the dock is removed', function (done) {
      var req = {};
      var reqUrl = 'api-staging-codenow.runnableapp.com';
      api._processTargetInstance({
        branch: 'master',
        dockRemoved: true
      }, '55555', reqUrl, req, function (err) {
        expect(err).to.be.undefined();
        expect(req.targetHost).to.equal('TestErrorHost');
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'dock_removed', {
          elasticUrl: reqUrl,
          shortHash: '55555'
        })
        done();
      });
    });
  });

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
      var base = 'api-staging-codenow.runnableapp.com';
      beforeEach(function (done) {
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
      describe('PUBLIC_ALLOWS_UNAUTH set to true ', function () {
        it('should next and not care about the auth', function (done) {
          var req = {
            method: 'get',
            isBrowser: true,
            session: {
              userGithubOrgs: [19495, 93722, 958321],
              userId: 19495
            },
            headers: {
              origin: 'http://frontend-staging-codenow.runnableapp.com',
              host: base + ':80'
            }
          };
          api.getTargetHost(req, {}, function (err) {
            expect(err).to.be.undefined();
            // feature-branch1 of API
            expect(req.targetHost).to.equal('http://0.0.0.2:39942');
            done();
          });
        });
      });
      describe('PUBLIC_ALLOWS_UNAUTH set to false ', function () {
        var previousDisableAuthEnv;
        beforeEach(function (done) {
          previousDisableAuthEnv = process.env.PUBLIC_ALLOWS_UNAUTH;
          process.env.PUBLIC_ALLOWS_UNAUTH = false;
          done();
        });
        afterEach(function (done) {
          process.env.PUBLIC_ALLOWS_UNAUTH = previousDisableAuthEnv;
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
            headers: {
              origin: 'http://frontend-staging-codenow.runnableapp.com',
              host: base + ':80'
            }
          };
          api.getTargetHost(req, {}, function (err) {
            expect(err.isBoom).to.equal(true);
            expect(err.output.payload.statusCode).to.equal(404);
            done();
          });
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

            sinon.stub(api, '_processTargetInstance').yields();
            sinon.stub(mongo.constructor, 'findAssociationShortHashByElasticUrl').returns(null);

            done();
          });

          afterEach(function (done) {
            api._getUrlFromRequest.restore();
            redis.lrange.restore();
            mongo.fetchNaviEntry.restore();
            if (api._processTargetInstance.restore) {
              api._processTargetInstance.restore();
            }
            if (mongo.constructor.findAssociationShortHashByElasticUrl.restore) {
              mongo.constructor.findAssociationShortHashByElasticUrl.restore();
            }
            done();
          });

          it('should should ignore referer if same as requestUrl', function (done) {
            api._processTargetInstance.restore();
            mongo.constructor.findAssociationShortHashByElasticUrl.restore();
            req.headers.origin = 'http://'+base;
            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              // feature-branch1 of API
              expect(req.targetHost).to.equal('http://0.0.0.0:39941');
              done();
            });
          });

          it('should proxy to instance mapped by referer naviEntry association', function (done) {
            api._processTargetInstance.restore();
            mongo.constructor.findAssociationShortHashByElasticUrl.restore();
            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              // feature-branch1 of API
              expect(req.targetHost).to.equal('http://0.0.0.0:39941');
              done();
            });
          });

          it('should handle navientires document with no user-mappings', function (done) {
            api._processTargetInstance.restore();
            mongo.constructor.findAssociationShortHashByElasticUrl.restore();

            var restore = put({}, naviEntriesFixtures.refererNaviEntry);
            delete naviEntriesFixtures.refererNaviEntry.userMappings;

            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              expect(req.targetHost).to.equal('http://0.0.0.2:39942');
              naviEntriesFixtures.refererNaviEntry = restore;
              done();
            });
          });

          it('should next with error if navientries document with no user-mappings and no '+
             'masterpod', function (done) {

            api._processTargetInstance.restore();
            mongo.constructor.findAssociationShortHashByElasticUrl.restore();

            var restore = put({}, naviEntriesFixtures.refererNaviEntry);
            delete naviEntriesFixtures.refererNaviEntry.userMappings;
            naviEntriesFixtures.refererNaviEntry.directUrls.aaaaa1.masterPod = false;

            api.getTargetHost(req, {}, function (err) {
              expect(err.message).to.equal('Not Found');
              naviEntriesFixtures.refererNaviEntry.userMappings = restore;
              naviEntriesFixtures.refererNaviEntry.directUrls.aaaaa1.masterPod = true;

              naviEntriesFixtures.refererNaviEntry = restore;

              done();
            });
          });

          it('should default to masterPod if !instanceShortHash', function (done) {
            var mockNaviEntry = {};

            sinon.stub(mongo.constructor, 'findMasterPodBranch').returns({
              directUrlObj: mockNaviEntry,
              directUrlShortHash: 'FFFF'
            });

            api.getTargetHost(req, {}, function (err) {
              expect(err).to.be.undefined();
              sinon.assert.calledWith(api._processTargetInstance, mockNaviEntry);
              expect(mongo.constructor.findAssociationShortHashByElasticUrl.callCount).to.equal(1);
              mongo.constructor.findMasterPodBranch.restore();
              done();
            });
          });

          it('should default to masterPod instance if no associations/dns-mappings defined',
            function (done) {

            sinon.stub(mongo.constructor, 'findMasterPodBranch');
            mongo.constructor.findMasterPodBranch.onFirstCall().returns({});
            mongo.constructor.findMasterPodBranch.onSecondCall().returns(undefined);
            mongo.constructor.findMasterPodBranch.onSecondCall().returns({
              directUrlObj: {
                masterPod: true
              }
            });

            api.getTargetHost(req, {}, function () {
              sinon.assert.calledWith(api._processTargetInstance, sinon.match({
                masterPod: true
              }));
              sinon.assert.calledWith(api._processTargetInstance)
              mongo.constructor.findMasterPodBranch.restore();
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
                userGithubOrgs: [495765, 847390, 958313],
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
              expect(req.targetHost).to.equal('http://0.0.0.0:39941');
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

          it('should use masterPod instance if document has no user-mappings',
          function (done) {
            sinon.stub(api, '_processTargetInstance', function (targetNaviEntryInstance) {
              expect(targetNaviEntryInstance.masterPod).to.equal(true);
              api._processTargetInstance.restore();
              done();
            });
            var copy = put({}, naviEntriesFixtures);
            delete copy.userMappings;
            mongo.fetchNaviEntry.restore();
            sinon.stub(mongo, 'fetchNaviEntry', function (reqUrl, refererUrl, cb) {
              cb(null, copy);
            });
            api.getTargetHost(req, {}, function () {});
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
              userGithubOrgs: [19495, 93722, 958321, 958313],
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
              userGithubOrgs: [495765, 958313],
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
      var base = '44444-repo-staging-codenow.runnableapp.com';
      var req;
      beforeEach(function (done) {
        req = {
          // no origin or referer
          method: 'get',
          isBrowser: true,
          session: {
            userGithubOrgs: [495765, 847390, 958313],
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
          cb(null, [naviRedisEntriesFixture.direct]);
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
      it('should next with error if mongo error', function (done) {
        sinon.stub(mongo, 'setUserMapping', function (elasticUrl, userId, shortHash, cb) {
          expect(userId).to.equal(847390);
          mongo.setUserMapping.restore();
          cb(new Error('mongo error'));
        });
        api.getTargetHost(req, {}, function (err) {
          expect(err.message).to.equal('mongo error');
          done();
        });
      });
    });
  });
});

