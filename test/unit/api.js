'use strict';
require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;

var lab = exports.lab = Lab.script();

var Boom = require('boom');
var ErrorCat = require('error-cat');
var clone = require('101/clone');
var keypather = require('keypather')();
var redis = require('models/redis');
var sinon = require('sinon');
var url = require('url');

var api = require('../../lib/models/api.js');
var errorPage = require('models/error-page.js');
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

  describe('api.checkIfLoggedIn', function () {});

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
            userGithubOrgs: ["19495", "93722", "958321"]
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
              userGithubOrgs: ["495765"]
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
        //TODO
        describe('referer', function () {
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
                userGithubOrgs: ['495765', '847390'],
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

          it('should proxy to master instance if no user mapping for current user', function (done) {
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
              userGithubOrgs: ["19495", "93722", "958321"]
            },
            headers: {
              host: ''
            }
          };
          api.getTargetHost(req, {}, function () {
            done();
          });
        });

        it('should set req.targetHost to proxy to master instance', function (done) {
          var base = 'repo-staging-codenow.runnableapp.com';
          var req = {
            method: 'get',
            isBrowser: true,
            session: {
              userGithubOrgs: ['495765']
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

  /*
  describe('with logged in user', function () {
    var hostName = 'localhost';
    var port = ':1234';
    var host = hostName + port;
    var testReq = {
      isBrowser: true,
      headers: {
        host: host
      },
      method: 'post'
    };
    beforeEach(function (done) {
      testReq.session = {
        apiCookie: 'cookie'
      };
      api.createClient(testReq, {}, done);
    });


    describe('checkIfLoggedIn', function () {
      it('should redir if not logged in', function (done) {
        var req = clone(testReq);
        // This session key set in auth dance
        expect(req.session.apiSessionRedisKey).to.be.undefined();
        sinon.stub(api, '_handleUnauthenticated', function (req, res, next) {
          next();
        });
        api.checkIfLoggedIn(req, {}, function () {
          expect(api._handleUnauthenticated.callCount).to.equal(1);
          api._handleUnauthenticated.restore();
          done();
        });
      });

      it('should redir with force if not logged in twice', function (done) {
        var testRedir = 'into.your.heart';
        var fullTestUrl = errorPage.generateErrorUrl('signin', {
          redirectUrl: testRedir
        });
        var req = clone(testReq);
        req.session = {
          authTried: true
        };
        sinon.stub(req.apiClient, 'getGithubAuthUrl')
          .withArgs('http://'+host, true)
          .returns(testRedir);
        api._handleUnauthenticated(req, {}, function () {
          expect(req.targetHost).to.equal(fullTestUrl);
          expect(req.redirectUrl).to.be.undefined();
          done();
        });
      });

      it('should next if logged in', function (done) {
        var req = clone(testReq);
        sinon.stub(redis, 'get', function (token, cb) {
          expect(token).to.equal('12345');
          cb(null, JSON.stringify({
            passport: {
              user: '123'
            }
          }));
        });
        req.session.apiSessionRedisKey = '12345';
        api.checkIfLoggedIn(req, {}, function () {
          expect(req.targetHost).to.be.undefined();
          expect(req.redirectUrl).to.be.undefined();
          redis.get.restore();
          done();
        });
      });

      it('should next redis error', function (done) {
        var req = clone(testReq);
        sinon.stub(redis, 'get', function (token, cb) {
          expect(token).to.equal('12345');
          cb(new Error('redis error'));
        });
        req.session.apiSessionRedisKey = '12345';
        api.checkIfLoggedIn(req, {}, function (err) {
          expect(err.message).to.equal('redis error');
          redis.get.restore();
          done();
        });
      });

      it('should next json.parse error', function (done) {
        var req = clone(testReq);
        sinon.stub(redis, 'get', function (token, cb) {
          expect(token).to.equal('12345');
          cb(null, 'invalid json');
        });
        req.session.apiSessionRedisKey = '12345';
        api.checkIfLoggedIn(req, {}, function (err) {
          expect(err).to.be.an.instanceOf(SyntaxError);
          redis.get.restore();
          done();
        });
      });

      it('should next if OPTIONS request', function (done) {
        var req = clone(testReq);
        req.method = 'options';
        api.checkIfLoggedIn(req, {}, function (err) {
          expect(err).to.be.undefined();
          done();
        });
      });

      it('should next if non-browser', function (done) {
        var req = clone(testReq);
        req.isBrowser = false;
        api.checkIfLoggedIn(req, {}, function (err) {
          expect(err).to.be.undefined();
          done();
        });
      });
    });
*/




























/*
    describe('getTargetHost', function () {
      beforeEach(function (done) {
        var apiClient = ctx.apiClient = createMockApiClient();
        ctx.username = 'tjmehta';
        keypather.set(apiClient, 'attrs.accounts.github', {
          github: 101,
          username: ctx.username
        });
        done();
      });

      beforeEach(function (done) {
        var branch = 'branch';
        ctx.containerUrl = 'http://1.1.1.1:3000';
        ctx.mockInstance = createMockInstance({
          _id: '000011110000111100001111',
          shortHash: '111111',
          name: 'instanceName',
          owner: {
            github: 101,
            username: ctx.apiClient.attrs.accounts.github.username
          }
        }, branch, ctx.containerUrl);
        ctx.apiClient.fetchInstances
          .returns({ models: [ ctx.mockInstance ] })
          .yieldsAsync();
        ctx.apiClient.createRoute.yieldsAsync();
        ctx.mockInstance.status.returns('running');
        done();
      });
      afterEach(function (done) {
        ctx.naviEntry.del(done);
      });

      describe('for a non-masterPod instance', function () {
        beforeEach(function (done) {
          ctx.mockInstance.attrs.masterPod = false;
          ctx.mockInstance.attrs.name =
            ctx.mockInstance.getBranchName() + '-' + ctx.mockInstance.attrs.name;
          done();
        });
        beforeEach(createNaviEntry);
        beforeEach(createDirectReq);

        it('should redirect to the master url', expectRedirectToMasterUrl);
      });

      describe('for a non-masterPod instance with origin', function () {
        beforeEach(function (done) {
          ctx.mockInstance.attrs.masterPod = false;
          ctx.mockInstance.attrs.name =
            ctx.mockInstance.getBranchName() + '-' + ctx.mockInstance.attrs.name;
          done();
        });
        beforeEach(createNaviEntry);
        beforeEach(createDirectReq);
        beforeEach(function(done) {
          ctx.mockReq.headers.origin = 'http://origin.com';
          done();
        });
        it('should redirect to the master url', expectRedirectToMasterUrl);
      });

      describe('for masterPod instances', function () {
        beforeEach(function (done) {
          ctx.mockInstance.attrs.masterPod = true;
          done();
        });

        describe('for a direct url', function () {
          beforeEach(function (done) {
            ctx.direct = true;
            ctx.elastic = false;
            done();
          });
          beforeEach(createNaviEntry);
          beforeEach(createDirectReq);
          describe('with browser agent', function() {
            it('should redirect to a master url', expectRedirectToMasterUrl);
          });
          describe('with non-browser agent', function() {
            it('should redirect to a master url',  function (done) {
              ctx.mockReq.isBrowser = false;
              api.getTargetHost(ctx.mockReq, {}, function () {
                expect(ctx.mockReq.targetHost).to.equal(ctx.containerUrl);
                expect(ctx.mockReq.targetInstance.attrs._id)
                  .to.equal(ctx.mockInstance.attrs._id);
                done();
              });
            });
          });
        });

        describe('for an elastic url', function () {
          beforeEach(function (done) {
            ctx.direct = false;
            ctx.elastic = true;
            done();
          });
          beforeEach(createNaviEntry);
          beforeEach(createElasticReq);
          afterEach(function (done) {
            api._handleElasticUrl.restore();
            done();
          });

          describe('success', function () {
            beforeEach(function (done) {
              ctx.targetHost = 'http://google.com';
              sinon.stub(api, '_handleElasticUrl')
                .yieldsAsync(null, ctx.targetHost, ctx.mockInstance);
              done();
            });

            it('should call _handleElasticUrl', function (done) {
              api.getTargetHost(ctx.mockReq, {}, function () {
                expect(api._handleElasticUrl.calledOnce).to.be.true();
                expect(api._handleElasticUrl.firstCall.args[0]).to.equal(ctx.apiClient);
                expect(api._handleElasticUrl.firstCall.args[1])
                  .to.equal('http://'+ctx.mockReq.headers.host);
                expect(api._handleElasticUrl.firstCall.args[2]).to.equal(undefined); // referer
                expect(api._handleElasticUrl.firstCall.args[3]).to.equal(ctx.mockInstance);
                expect(ctx.mockReq.targetHost).to.equal(ctx.targetHost);
                expect(ctx.mockReq.targetInstance).to.deep.equal(ctx.mockInstance);
                done();
              });
            });
          });

          describe('error', function () {
            beforeEach(function (done) {
              ctx.err = new Error('err');
              ctx.targetHost = 'http://google.com';
              sinon.stub(api, '_handleElasticUrl').yieldsAsync(ctx.err);
              done();
            });

            it('should call _handleElasticUrl', expectErr);
          });
        });

        describe('errors', function () {
          beforeEach(createNaviEntry);
          beforeEach(createDirectReq);
          beforeEach(function (done) {
            ctx.err = new Error('boom');
            done();
          });

          describe('getInfo error', function () {
            beforeEach(function (done) {
              sinon.stub(NaviEntry.prototype, 'getInfo').yieldsAsync(ctx.err);
              done();
            });
            afterEach(function (done) {
              NaviEntry.prototype.getInfo.restore();
              done();
            });

            it('should error if getInfo errors', expectErr);
          });

          describe('fetchInstances error', function () {
            beforeEach(function (done) {
              ctx.apiClient.fetchInstances.yieldsAsync(ctx.err);
              done();
            });

            it('should error if getInfo errors', expectErr);
          });

          describe('fetchInstances 404', function () {
            beforeEach(function (done) {
              ctx.apiClient.fetchInstances
                .returns({ models: [] })
                .yieldsAsync();
              done();
            });

            it('should error if getInfo errors', function (done) {
              api.getTargetHost(ctx.mockReq, {}, function (err) {
                expect(err).to.exist();
                expect(err.message).to.match(/instance no longer exists/);
                done();
              });
            });
          });

          describe('_handleDirectUrl err', function () {
            beforeEach(function (done) {
              sinon.stub(api, '_handleDirectUrl').yieldsAsync(ctx.err);
              done();
            });
            afterEach(function (done) {
              api._handleDirectUrl.restore();
              done();
            });

            it('should error if _handleDirectUrl errors', expectErr);
          });

          describe('hello runnable error', function() {
            beforeEach(function (done) {
              ctx.err = ErrorCat.create(400, 'hello runnable cant set its routes');
              ctx.apiClient.createRoute.yieldsAsync(ctx.err);
              done();
            });

            it('should ignore the error in _handleDirectUrl', expectRedirectToMasterUrl);
          });
        });
      });


      function expectErr (done) {
        api.getTargetHost(ctx.mockReq, {}, function (err) {
          expect(err).to.equal(ctx.err);
          done();
        });
      }
    });

    describe('_handleElasticUrl', function () {
      beforeEach(function (done) {
        var apiClient = ctx.apiClient = createMockApiClient();
        ctx.username = 'tjmehta';
        keypather.set(apiClient, 'attrs.accounts.github', {
          github: 101,
          username: ctx.username
        });
        ctx.containerUrl = 'http://2.2.2.2:3000';
        ctx.mockInstance = createMockInstance({
          _id: '000022220000222200002222',
          shortHash: '222222',
          name: 'instanceName',
          owner: {
            github: 101,
            username: ctx.apiClient.attrs.accounts.github.username
          }
        }, 'branch', ctx.containerUrl);
        ctx.mockInstance.status.returns('running');
        ctx.elasticUrl = 'http://api-staging-codenow.runnable.app.com:800';
        done();
      });

      describe('req does not have a referer', function () {
        beforeEach(function (done) {
          ctx.refererUrl = null;
          done();
        });

        descMapping();
      });

      describe('req has a referer', function () {

        describe('referer is external', function () {
          beforeEach(function (done) {
            ctx.refererUrl = 'http://google.com';
            sinon.stub(NaviEntry, 'createFromUrl', function (url) {
              expect(url).to.equal(ctx.refererUrl);
              return { exists: sinon.stub().yieldsAsync(null, false) };
            });
            done();
          });
          afterEach(function (done) {
            NaviEntry.createFromUrl.restore();
            done();
          });

          descMapping();
        });

        describe('referer is localhost', function () {
          beforeEach(function (done) {
            ctx.refererUrl = 'http://localhost:3000';
            done();
          });

          descMapping();
        });

        describe('referer is self', function () {
          beforeEach(function (done) {
            ctx.refererUrl = ctx.elasticUrl;
            done();
          });

          descMapping();

          describe('referer is self diff casing', function () {

            describe('upper reqUrl', function() {
              beforeEach(function (done) {
                ctx.refererUrl = ctx.elasticUrl.toLowerCase();
                ctx.elasticUrl = ctx.elasticUrl.toUpperCase();
                done();
              });

              descMapping();
            });

            describe('upper refUrl', function() {
              beforeEach(function (done) {
                ctx.refererUrl = ctx.elasticUrl.toUpperCase();
                ctx.elasticUrl = ctx.elasticUrl.toLowerCase();
                done();
              });

              descMapping();
            });
          });
        });

        describe('referer is a user content domain', function () {
          beforeEach(function (done) {
            ctx.refererUrl = 'http://web-staging-codenow.runnable.app.com';
            sinon.stub(NaviEntry, 'createFromUrl', function (url) {
              expect(url).to.equal(ctx.refererUrl);
              return { exists: sinon.stub().yieldsAsync(null, true) };
            });
            var refInstanceId = '000066660000666600006666';
            ctx.refInstance = createMockInstance({
              _id: refInstanceId,
              shortHash: '666666',
              name: 'instanceName',
              owner: {
                github: 101,
                username: ctx.apiClient.attrs.accounts.github.username
              }
            }, 'branch', ctx.refererUrl);
            ctx.refInstance.status.returns('running');
            ctx.apiClient.fetchRoutes.yieldsAsync(null, [{
              srcHostname: url.parse(ctx.refererUrl).hostname,
              destInstanceId: refInstanceId
            }]);
            ctx.apiClient.newInstance
              .withArgs(ctx.refInstance.attrs._id)
              .returns(ctx.refInstance);
            done();
          });
          afterEach(function (done) {
            NaviEntry.createFromUrl.restore();
            done();
          });

          describe('refererEntry exists errors', function () {
            beforeEach(function (done) {
              ctx.err = new Error('boom');
              NaviEntry.createFromUrl.restore();
              sinon.stub(NaviEntry, 'createFromUrl', function (url) {
                expect(url).to.equal(ctx.refererUrl);
                return { exists: sinon.stub().yieldsAsync(ctx.err) };
              });
              done();
            });

            it('should callback error', expectErr);
          });

          describe('referer associations errors', function () {
            beforeEach(function (done) {
              ctx.err = new Error('boom');
              ctx.refInstance.fetchDependencies.yieldsAsync(ctx.err);
              done();
            });

            it('should callback the error', expectErr);
          });

          describe('referer has no associations', function () {
            beforeEach(function (done) {
              ctx.refInstance.fetchDependencies.yieldsAsync(null, []);
              done();
            });

            describe('referer has no mapping', function () {
              descMapping();
            });

            describe('referer has mapping', function () {
              beforeEach(function (done) {
                ctx.userMappings = [{
                  srcHostname: url.parse(ctx.refererUrl).hostname,
                  destInstanceId: ctx.refInstance.attrs._id
                }];
                done();
              });

              descMapping(true);
            });
          });

          describe('referer has associations', function () {
            beforeEach(function (done) {
              ctx.assocContainerUrl = 'http://3.3.3.3:3000';
              var assocInstanceId = '000033330000333300003333';
              ctx.assocInstance = createMockInstance({
                _id: assocInstanceId,
                shortHash: '333333',
                name: 'instanceName',
                owner: {
                  github: 101,
                  username: ctx.apiClient.attrs.accounts.github.username
                }
              }, 'branch', ctx.assocContainerUrl);
              ctx.assocInstance.status.returns('running');
              ctx.refInstance.fetchDependencies.yieldsAsync(null, [{ id: assocInstanceId }]);
              ctx.apiClient.fetchInstance
                .withArgs(assocInstanceId)
                .returns(ctx.assocInstance).yieldsAsync();
              done();
            });

            it('should yield the associated instance containerUrl', function (done) {
              api._handleElasticUrl(
                ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
                function (err, targetUrl, targetInstance) {
                  if (err) { return done(err); }
                  expect(targetUrl).to.equal(ctx.assocContainerUrl);
                  expect(targetInstance).to.deep.equal(ctx.assocInstance);
                  done();
                });
            });

            describe('fetchInstance errors', function () {
              beforeEach(function (done) {
                ctx.err = new Error('boom');
                ctx.apiClient.fetchInstance
                  .withArgs(ctx.assocInstance.attrs._id)
                  .yieldsAsync(ctx.err);
                done();
              });

              it('should callback the error', expectErr);
            });
          });
        });
      });


      function descMapping (dontUseUserMapping) {

        describe('reqUrl has no mapping', function () {
          beforeEach(function (done) {
            ctx.apiClient.fetchRoutes.yieldsAsync(null, ctx.userMappings || []);
            done();
          });

          it('should yield masterInstance containerUrl as target url', expectMasterTarget);
        });

        describe('container errors', function () {
          beforeEach(function (done) {
            ctx.apiClient.fetchRoutes.yieldsAsync(null, ctx.userMappings || []);
            sinon.stub(errorPage, 'generateErrorUrl').returns();
            done();
          });
          afterEach(function (done) {
            errorPage.generateErrorUrl.restore();
            done();
          });
          describe('container is not running', function () {
            beforeEach(function (done) {
              ctx.mockInstance.status.returns('stopped');
              done();
            });

            it('should yield dead error page as target url', expectErrPage('dead'));
          });
          describe('container is crashed', function () {
            beforeEach(function (done) {
              ctx.mockInstance.status.returns('crashed');
              done();
            });

            it('should yield dead error page as target url', expectErrPage('dead'));
          });

          describe('getContainerUrl returned  504 error', function () {
            beforeEach(function (done) {
              ctx.mockInstance.getContainerUrl.yieldsAsync(Boom.create(504));
              ctx.mockInstance.status.returns('running');
              done();
            });

            it('should yield dead error page as target url', expectErrPage('dead'));
          });
          describe('getContainerUrl returned  503 error', function () {
            beforeEach(function (done) {
              ctx.mockInstance.getContainerUrl.yieldsAsync(Boom.create(503));
              ctx.mockInstance.status.returns('running');
              done();
            });

            it('should yield dead error page as target url', expectErrPage('dead'));
          });
          describe('getContainerUrl returned 400 error', function () {
            beforeEach(function (done) {
              ctx.mockInstance.getContainerUrl.yieldsAsync(Boom.create(400));
              ctx.mockInstance.status.returns('running');
              done();
            });

            it('should yield port error page as target url', expectErrPage('ports'));
          });
          describe('getContainerUrl returned unexpected error', function () {
            beforeEach(function (done) {
              ctx.err = new Error('crash');
              ctx.mockInstance.getContainerUrl.yieldsAsync(ctx.err);
              ctx.mockInstance.status.returns('running');
              done();
            });

            it('should yield port error page as target url', expectErr);
          });
          describe('getContainerUrl returned unexpected boom error', function () {
            beforeEach(function (done) {
              ctx.err = Boom.unsupportedMediaType();
              ctx.mockInstance.getContainerUrl.yieldsAsync(ctx.err);
              ctx.mockInstance.status.returns('running');
              done();
            });

            it('should yield port error page as target url', expectErr);
          });
        });

        describe('reqUrl has mapping error', function () {
          beforeEach(function (done) {
            ctx.err = new Error('boom');
            ctx.apiClient.fetchRoutes.yieldsAsync(ctx.err);
            done();
          });

          it('should callback the error', expectErr);
        });

        describe('reqUrl has mapping', function () {
          beforeEach(function (done) {
            ctx.destContainerUrl = 'http://5.5.5.5:3000';
            var destInstanceId = '000055550000555500005555';
            ctx.destInstance = createMockInstance({
              _id: destInstanceId,
              shortHash: '555555',
              name: 'instanceName',
              owner: {
                github: 101,
                username: ctx.apiClient.attrs.accounts.github.username
              }
            }, 'branch', ctx.destContainerUrl);
            ctx.destInstance.status.returns('running');
            ctx.userMappings = ctx.userMappings || [];
            ctx.userMappings.push({
              srcHostname: url.parse(ctx.elasticUrl).hostname,
              destInstanceId: destInstanceId
            });
            ctx.apiClient.fetchRoutes.yieldsAsync(null, ctx.userMappings);
            done();
          });

          describe('fetchInstance error', function() {
            beforeEach(function (done) {
              ctx.err = new Error('boom');
              ctx.apiClient.fetchInstance
                .withArgs(ctx.destInstance.attrs._id)
                .returns(ctx.destInstance).yieldsAsync(ctx.err);
              done();
            });
            if (!dontUseUserMapping) {
              it('should callback the error', expectErr);
            }
          });

          describe('fetchInstance success', function() {
            beforeEach(function (done) {
              ctx.apiClient.fetchInstance
                .withArgs(ctx.destInstance.attrs._id)
                .returns(ctx.destInstance).yieldsAsync();
              done();
            });
            if (dontUseUserMapping) {

              it('should yield masterInstance containerUrl as target url', expectMasterTarget);
            }
            else {

              it('should yield the mapping instance containerUrl', expectMappingTarget);
            }
          });
        });
      }
      function expectMasterTarget (done) {
        api._handleElasticUrl(
          ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
          function (err, targetUrl, targetInstance) {
            if (err) { return done(err); }
            expect(targetUrl).to.equal(ctx.containerUrl);
            expect(targetInstance).to.equal(ctx.mockInstance);
            done();
          });
      }
      function expectMappingTarget (done) {
        api._handleElasticUrl(
          ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
          function (err, targetUrl, targetInstance) {
            if (err) { return done(err); }
            expect(targetUrl).to.equal(ctx.destContainerUrl);
            expect(targetInstance).to.equal(ctx.destInstance);
            done();
          });
      }
      function expectErr (done) {
        api._handleElasticUrl(
          ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
          function (err) {
            expect(err).to.equal(ctx.err);
            done();
          });
      }
      function expectErrPage (type) {
        return function (done) {
          api._handleElasticUrl(
            ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
              function (err, targetUrl) {
                expect(errorPage.generateErrorUrl
                  .withArgs(type, ctx.mockInstance).calledOnce).to.be.true();
                expect(targetUrl).to.equal(ctx.errorPageUrl);
                done();
            });
        };
      }
    });
  });

  // helpers
  function createNaviEntry (done) {
    ctx.exposedPort = '800';
    ctx.naviEntryOpts = {
      exposedPort: ctx.exposedPort,
      shortHash: ctx.mockInstance.attrs.shortHash,
      instanceName: ctx.mockInstance.attrs.name,
      branch: ctx.mockInstance.getBranchName(),
      masterPod: ctx.mockInstance.attrs.masterPod,
      ownerUsername: ctx.mockInstance.attrs.owner.username,
      ownerGithub: ctx.mockInstance.attrs.owner.github,
      elastic: ctx.elastic,
      direct: ctx.direct,
      userContentDomain: 'runnableapp.com'
    };
    var naviEntry = ctx.naviEntry = new NaviEntry(ctx.naviEntryOpts);
    naviEntry.setBackend(ctx.containerUrl, done);
  }
  function createDirectReq (done) {
    ctx.mockReq = {
      session: {},
      isBrowser: true,
      headers: {
        host: ctx.naviEntry.getDirectHostname() + ':' + ctx.exposedPort,
        referer: 'http://referer.com'
      },
      method: 'post',
      apiClient: ctx.apiClient
    };
    done();
  }
  function createElasticReq (done) {
    ctx.mockReq = {
      session: {},
      isBrowser: true,
      headers: {
        host: ctx.naviEntry.getElasticHostname() + ':' + ctx.exposedPort
      },
      method: 'post',
      apiClient: ctx.apiClient
    };
    done();
  }
  function expectRedirectToMasterUrl (done) {
    var mockRes = {
      redirect: redirect
    };
    api.getTargetHost(ctx.mockReq, mockRes, done);
    function redirect (url) {
      var elasticHostname = ctx.naviEntry.getElasticHostname(ctx.branch);
      expect(url.toLowerCase())
        .to.equal([
          'http://', elasticHostname, ':'+ctx.exposedPort+'/'
        ].join('').toLowerCase());
      expect(ctx.apiClient.createRoute.calledOnce).to.be.true();
      expect(ctx.apiClient.createRoute.firstCall.args[0]).to.exist();
      expect(ctx.apiClient.createRoute.firstCall.args[0]).to.deep.equal({
        srcHostname: elasticHostname,
        destInstanceId: ctx.mockInstance.attrs._id
      });
      done();
    }
  }
*/
});

