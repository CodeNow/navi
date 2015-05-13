'use strict';
require('loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var expect = require('code').expect;

var NaviEntry = require('navi-entry');
var keypather = require('keypather')();
var sinon = require('sinon');
var Runnable = require('runnable');
var createMockInstance = require('../fixture/create-mock-instance');
var createMockApiClient = require('../fixture/create-mock-api-client');
var url = require('url');

var api = require('../../lib/models/api.js');

describe('api.js unit test', function () {
  var ctx;
  beforeEach(function (done) {
    ctx = {};
    done();
  });

  describe('_getUrlFromRequest', function () {
    var base = 'repo-staging-codenow.runnableapp.com';
    var result = 'http://repo-staging-codenow.runnableapp.com:80';
    it('should add 80', function (done) {
      var test = api._getUrlFromRequest({
        headers: {
          host: base
        }
      });
      expect(test).to.equal(result);
      done();
    });
    it('should add https', function (done) {
      var test = api._getUrlFromRequest({
        headers: {
          host: base+':443'
        }
      });
      expect(test).to.equal('https://'+ base +':443');
      done();
    });
    it('should add 80 to subdomain', function (done) {
      var test = api._getUrlFromRequest({
        headers: {
          host: 'dat.sub.domain.' + base
        }
      });
      expect(test).to.equal(result);
      done();
    });
    it('should add https to subdomain', function (done) {
      var test = api._getUrlFromRequest({
        headers: {
          host: 'dat.sub.domain.' + base + ':443'
        }
      });
      expect(test).to.equal('https://'+ base +':443');
      done();
    });
    it('should be valid for correct hostname', function (done) {
      var test = api._getUrlFromRequest({
        headers: {
          host: base + ':100'
        }
      });
      expect(test).to.equal('http://'+ base +':100');
      done();
    });
  });
  describe('createClient', function () {
    it('should not add cookie if it does not exist', function (done) {
      var testReq = {
        session: {},
        method: 'post'
      };
      api.createClient(testReq, {}, function () {
        expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
          .to.equal('navi');
        expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
          .to.not.exist();
        done();
      });
    });
    it('should login with super user if options request', function (done) {
      var testReq = {
        session: {},
        method: 'OPTIONS'
      };
      sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync();
      api.createClient(testReq, {}, function () {
        expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
          .to.equal('navi');
        expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
          .to.not.exist();
        expect(testReq.apiClient.githubLogin
          .calledWith(process.env.HELLO_RUNNABLE_GITHUB_TOKEN))
          .to.be.true();
        Runnable.prototype.githubLogin.restore();
        done();
      });
    });
    it('should add runnable client with cookie', function (done) {
      var testCookie = 'sid:longcookie;';
      var testReq = {
        session: {
          apiCookie: testCookie
        },
        method: 'post'
      };
      api.createClient(testReq, {}, function () {
        expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
          .to.equal('navi');
        expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
          .to.equal(testCookie);
        done();
      });
    });
  });
  describe('with logged in user', function () {
    var hostName = 'localhost';
    var port = ':1234';
    var host = hostName + port;
    var testReq = {
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

    describe('redirectIfNotLoggedIn', function () {
      beforeEach(function (done) {
        sinon.stub(testReq.apiClient, 'fetch');
        done();
      });
      afterEach(function (done) {
        testReq.apiClient.fetch.restore();
        done();
      });

      it('should next the error if api errors', function (done) {
        var testErr = {
          output: {
            statusCode: 500
          },
          data: 'dude this just happed'
        };
        testReq.apiClient.fetch.yieldsAsync(testErr);
        api.redirectIfNotLoggedIn(testReq, {}, function (err) {
          expect(err).to.equal(testErr);
          done();
        });
      });

      it('should redir if not logged in', function (done) {
        var testErr = {
          output: {
            statusCode: 401
          },
          data: {
            error: 'Unauthorized'
          }
        };
        var testRes = 'that res';
        testReq.apiClient.fetch.yieldsAsync(testErr);
        sinon.stub(testReq.apiClient, 'redirectForAuth', function (url, res) {
          expect(url).to.equal('http://'+host);
          expect(res).to.equal(testRes);
          done();
        });
        api.redirectIfNotLoggedIn(testReq, testRes, function () {
          done(new Error('should not get called'));
        });
      });

      it('should next if logged in', function (done) {
        testReq.apiClient.fetch.yieldsAsync();
        api.redirectIfNotLoggedIn(testReq, {}, done);
      });
    });

    describe('getTargetHost', function () {
      beforeEach(function (done) {
        var apiClient = ctx.apiClient = createMockApiClient();
        ctx.username = 'tjmehta';
        keypather.set(apiClient, 'attrs.accounts.github', {
          id: 101,
          username: ctx.username
        });
        done();
      });

      beforeEach(function (done) {
        var branch = 'branch';
        ctx.containerUrl = 'http://1.1.1.1:3000';
        ctx.mockInstance = createMockInstance({
          _id: '000011110000111100001111',
          name: 'instanceName',
          owner: {
            id: 101,
            username: ctx.apiClient.attrs.accounts.github.username
          }
        }, branch, ctx.containerUrl);
        ctx.apiClient.fetchInstances
          .returns({ models: [ ctx.mockInstance ] })
          .yieldsAsync();
        ctx.apiClient.createRoute.yieldsAsync();
        done();
      });
      afterEach(function (done) {
        ctx.naviEntry.del(done);
      });

      describe('for a non-masterPod instance', function () {
        beforeEach(function (done) {
          ctx.mockInstance.attrs.masterPod = false;
          done();
        });
        beforeEach(createNaviEntry);
        beforeEach(createDirectReq);

        it('should redirect to the master url', expectRedirectToMasterUrl);
      });

      describe('for masterPod instances', function () {
        beforeEach(function (done) {
          ctx.mockInstance.attrs.masterPod = true;
          done();
        });
        beforeEach(createNaviEntry);

        describe('for a direct url', function() {
          beforeEach(createDirectReq);

          it('should redirect to a master url', expectRedirectToMasterUrl);
        });

        describe('for an elastic url', function() {
          beforeEach(createElasticReq);
          afterEach(function (done) {
            api._handleElasticUrl.restore();
            done();
          });

          describe('success', function () {
            beforeEach(function (done) {
              ctx.targetHost = 'http://google.com';
              sinon.stub(api, '_handleElasticUrl').yieldsAsync(null, ctx.targetHost);
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
          beforeEach(createDirectReq);
          beforeEach(function (done) {
            ctx.err = new Error('boom');
            done();
          });

          describe('getInstanceName error', function () {
            beforeEach(function (done) {
              sinon.stub(NaviEntry.prototype, 'getInstanceName').yieldsAsync(ctx.err);
              done();
            });
            afterEach(function (done) {
              NaviEntry.prototype.getInstanceName.restore();
              done();
            });

            it('should error if getInstanceName errors', expectErr);
          });

          describe('fetchInstances error', function () {
            beforeEach(function (done) {
              ctx.apiClient.fetchInstances.yieldsAsync(ctx.err);
              done();
            });

            it('should error if getInstanceName errors', expectErr);
          });

          describe('fetchInstances 404', function() {
            beforeEach(function (done) {
              ctx.apiClient.fetchInstances
                .returns({ models: [] })
                .yieldsAsync();
              done();
            });

            it('should error if getInstanceName errors', function (done) {
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
          id: 101,
          username: ctx.username
        });
        ctx.containerUrl = 'http://2.2.2.2:3000';
        ctx.mockInstance = createMockInstance({
          _id: '000022220000222200002222',
          name: 'instanceName',
          owner: {
            id: 101,
            username: ctx.apiClient.attrs.accounts.github.username
          }
        }, 'branch', ctx.containerUrl);
        ctx.elasticUrl = 'http://api-staging-codenow.runnable.app.com:800';
        done();
      });

      describe('req does not have a referer', function() {
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

        describe('referer is a user content domain', function () {
          beforeEach(function (done) {
            ctx.refererUrl = 'http://web-staging-codenow.runnable.app.com';
            sinon.stub(NaviEntry, 'createFromUrl', function (url) {
              expect(url).to.equal(ctx.refererUrl);
              return { exists: sinon.stub().yieldsAsync(null, true) };
            });

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

          describe('referer has no associations', function () {
            beforeEach(function (done) {
              var refInstanceId = '000066660000666600006666';
              ctx.refInstance = createMockInstance({
                _id: refInstanceId,
                name: 'instanceName',
                owner: {
                  id: 101,
                  username: ctx.apiClient.attrs.accounts.github.username
                }
              }, 'branch', ctx.refererUrl);
              ctx.apiClient.newInstance
                .withArgs(ctx.refInstance.attrs._id)
                .returns(ctx.refInstance);
              ctx.refInstance.fetchDependencies.yieldsAsync(null, []);
              done();
            });

            describe('referer has no mapping', function() {

              descMapping();
            });

            describe('referer has mapping', function() {
              beforeEach(function (done) {
                ctx.userMappings = [{
                  srcHostname: url.parse(ctx.refererUrl).hostname,
                  destInstanceId: ctx.refInstance.attrs._id
                }];
                done();
              });

              descMapping();
            });
          });

          describe('referer has associations', function() {
            beforeEach(function (done) {
              var refInstanceId = '000066660000666600006666';
              ctx.refInstance = createMockInstance({
                _id: refInstanceId,
                name: 'instanceName',
                owner: {
                  id: 101,
                  username: ctx.apiClient.attrs.accounts.github.username
                }
              }, 'branch', ctx.refererUrl);
              ctx.apiClient.fetchRoutes.yieldsAsync(null, [{
                srcHostname: url.parse(ctx.refererUrl).hostname,
                destInstanceId: refInstanceId
              }]);
              ctx.apiClient.newInstance
                .withArgs(ctx.refInstance.attrs._id)
                .returns(ctx.refInstance);
              ctx.assocContainerUrl = 'http://3.3.3.3:3000';
              var assocInstanceId = '000033330000333300003333';
              ctx.assocInstance = createMockInstance({
                _id: assocInstanceId,
                name: 'instanceName',
                owner: {
                  id: 101,
                  username: ctx.apiClient.attrs.accounts.github.username
                }
              }, 'branch', ctx.assocContainerUrl);
              ctx.refInstance.fetchDependencies.yieldsAsync(null, [{ _id: assocInstanceId }]);
              ctx.apiClient.fetchInstance
                .withArgs(assocInstanceId)
                .returns(ctx.assocInstance).yieldsAsync();
              done();
            });

            it('should yield the associated instance containerUrl', function (done) {
              api._handleElasticUrl(
                ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
                function (err, targetUrl) {
                  if (err) { return done(err); }
                  expect(targetUrl).to.equal(ctx.assocContainerUrl);
                  done();
                });
            });
          });
        });
      });


      function descMapping () {

        describe('reqUrl has no mapping', function() {
          beforeEach(function (done) {
            ctx.apiClient.fetchRoutes.yieldsAsync(null, ctx.userMappings || []);
            done();
          });

          it('should yield masterInstance containerUrl as target url', expectMasterTarget);
        });

        describe('reqUrl has mapping', function () {
          beforeEach(function (done) {
            ctx.destContainerUrl = 'http://5.5.5.5:3000';
            var destInstanceId = '000055550000555500005555';
            ctx.destInstance = createMockInstance({
              _id: destInstanceId,
              name: 'instanceName',
              owner: {
                id: 101,
                username: ctx.apiClient.attrs.accounts.github.username
              }
            }, 'branch', ctx.destContainerUrl);
            ctx.userMappings = ctx.userMappings || [];
            ctx.userMappings.push({
              srcHostname: url.parse(ctx.elasticUrl).hostname,
              destInstanceId: destInstanceId
            });
            ctx.apiClient.fetchRoutes.yieldsAsync(null, ctx.userMappings);
            ctx.apiClient.fetchInstance
              .withArgs(ctx.destInstance.attrs._id)
              .returns(ctx.destInstance).yieldsAsync();
            done();
          });

          it('should yield the mapping instance containerUrl', expectMappingTarget);
        });
      }
      function expectMasterTarget (done) {
        api._handleElasticUrl(
          ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
          function (err, targetUrl) {
            if (err) { return done(err); }
            expect(targetUrl).to.equal(ctx.containerUrl);
            done();
          });
      }
      function expectMappingTarget (done) {
        api._handleElasticUrl(
          ctx.apiClient, ctx.elasticUrl, ctx.refererUrl, ctx.mockInstance,
          function (err, targetUrl) {
            if (err) { return done(err); }
            expect(targetUrl).to.equal(ctx.destContainerUrl);
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
    });
  });

  // helpers
  function createNaviEntry (done) {
    ctx.exposedPort = '800';
    ctx.naviEntryOpts = {
      exposedPort: ctx.exposedPort,
      instance: ctx.mockInstance.toJSON(),
      branch: ctx.mockInstance.getBranchName(),
      masterPod: ctx.mockInstance.attrs.masterPod,
      ownerUsername: ctx.mockInstance.attrs.owner.username,
      userContentDomain: 'runnableapp.com'
    };
    var naviEntry = ctx.naviEntry = new NaviEntry(ctx.naviEntryOpts);
    naviEntry.setBackend(ctx.containerUrl, done);
  }
  function createDirectReq (done) {
    ctx.mockReq = {
      session: {},
      headers: {
        host: ctx.naviEntry.getDirectHostname() + ':' + ctx.exposedPort
      },
      method: 'post',
      apiClient: ctx.apiClient
    };
    done();
  }
  function createElasticReq (done) {
    ctx.mockReq = {
      session: {},
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
    api.getTargetHost(ctx.mockReq, mockRes);
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
});
