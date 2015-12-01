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
var mongo = require('models/mongo');
var naviEntriesFixtures = require('../fixture/navi-entries');
var naviRedisEntriesFixture = require('../fixture/navi-redis-entries');
var redis = require('models/redis');

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
    beforeEach(function (done) {
      sinon.stub(api, '_shouldBypassAuth');
      sinon.stub(api, '_handleUnauthenticated').yieldsAsync();
      sinon.stub(redis, 'get');
      done();
    });
    afterEach(function (done) {
      api._shouldBypassAuth.restore();
      api._handleUnauthenticated.restore();
      redis.get.restore();
      done();
    });

    it('should next if should bypass auth', function (done) {
      api._shouldBypassAuth.returns(true);
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.equal(undefined);
        sinon.assert.calledOnce(api._shouldBypassAuth);
        done();
      });
    });

    it('should next with error if redis.get returns error', function (done) {
      api._shouldBypassAuth.returns(false);
      redis.get.yieldsAsync(new Error('redis error'));
      api.checkIfLoggedIn(req, {}, function (err) {
        sinon.assert.calledOnce(redis.get);
        sinon.assert.calledWith(redis.get, 'redis-session-key');
        sinon.assert.calledOnce(api._shouldBypassAuth);
        expect(err.message).to.equal('redis error');
        done();
      });
    });

    it('should next with error if redis.get return data is invalid json', function (done) {
      api._shouldBypassAuth.returns(false);
      redis.get.yieldsAsync(null, 'invalid-json');
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.be.instanceOf(SyntaxError);
        sinon.assert.calledOnce(redis.get);
        sinon.assert.calledWith(redis.get, 'redis-session-key');
        sinon.assert.calledOnce(api._shouldBypassAuth);
        done();
      });
    });

    it('should route to unathenticated helper if redis session data indicates user is unauth',
    function (done) {
      api._shouldBypassAuth.returns(false);
      redis.get.yieldsAsync(null, JSON.stringify({
          passport: {
            // no user
          }
        })
      );
      api.checkIfLoggedIn(req, {}, function (err) {
        expect(err).to.be.undefined();
        sinon.assert.calledOnce(redis.get);
        sinon.assert.calledOnce(api._shouldBypassAuth);
        sinon.assert.calledOnce(api._handleUnauthenticated);
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

  describe('_processTargetInstance', function () {
    it('should next with error if !targetNaviEntryInstance', function (done) {
      api._processTargetInstance(null, '', {}, function (err) {
        expect(err.message).to.equal('Not Found');
        done();
      });
    });

    it('should set req.targetHost if !running', function (done) {
      var req = {};
      var reqUrl = 'api-staging-codenow.runnableapp.com';
      api._processTargetInstance({
        running: false,
        branch: 'master'
      }, reqUrl, req, function (err) {
        expect(err).to.be.undefined();
        expect(req.targetHost).to.equal('http://localhost:55551?type=not_running&elasticUrl='+
                                        reqUrl+'&targetBranch=master');
        done();
      });
    });
  });

  describe('api._getTargetHostElasticReferer', function () {
    it('should call _processTargetInstance with proxy information for the referrer');
    it('should handle when we can\'t find the masterPodBranch and we can\'t find the user mappings for the current elastic url');
  });

  describe('api._getTargetHostElastic', function () {
    it('should call _processTargetInstance with proxy information for the elastic url');
  });

  describe('api.getTargetHost', function () {
    beforeEach(function (done) {
      sinon.stub(api, '_getUrlFromRequest').returns('');
      sinon.stub(api, '_shouldBypassAuth').returns(true);
      sinon.stub(api, '_isUserAuthorized').returns(true);
      sinon.stub(api, '_getTargetHostElastic').yieldsAsync();
      sinon.stub(redis, 'lrange').yieldsAsync(null, [naviRedisEntriesFixture.elastic]);
      sinon.stub(mongo, 'setUserMapping').yieldsAsync();
      done();
    });
    afterEach(function (done) {
      api._getUrlFromRequest.restore();
      api._shouldBypassAuth.restore();
      api._isUserAuthorized.restore();
      api._getTargetHostElastic.restore();
      redis.lrange.restore();
      mongo.setUserMapping.restore();
      done();
    });

    describe('redis error', function () {
      beforeEach(function (done) {
        redis.lrange.yieldsAsync(new Error('redis error'));
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
        redis.lrange.yieldsAsync(null, ['not valid JSON string']);
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
        api._shouldBypassAuth.returns(false);
        api._isUserAuthorized.returns(false);
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
          sinon.assert.calledOnce(api._shouldBypassAuth);
          sinon.assert.calledWith(api._shouldBypassAuth, req);
          sinon.assert.calledOnce(api._isUserAuthorized);
          sinon.assert.calledWith(api._isUserAuthorized, req, JSON.parse(naviRedisEntriesFixture.elastic).ownerGithub);
          expect(err.isBoom).to.equal(true);
          expect(err.output.payload.statusCode).to.equal(404);
          done();
        });
      });
    });

    describe('elastic url incoming request', function () {
      beforeEach(function (done) {
        api._shouldBypassAuth.returns(true);
        api._isUserAuthorized.returns(true);
        done();
      });
      it('should call _getTargetHostElastic with the request', function (done) {
        var req = {
          method: 'get',
          isBrowser: true,
          session: {
            userGithubOrgs: [495765, 958313],
            userId: 958313
          },
          headers: {}
        };
        api.getTargetHost(req, {}, function () {
          sinon.assert.calledOnce(api._getTargetHostElastic);
          sinon.assert.calledWith(api._getTargetHostElastic, sinon.match.object, req, sinon.match.func);
          done();
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
        api._shouldBypassAuth.returns(true);
        api._isUserAuthorized.returns(true);
        redis.lrange.yieldsAsync(null, [naviRedisEntriesFixture.direct]);
        api._getUrlFromRequest.returns('http://0.0.0.0:80');
        done();
      });
      it('should next with error if mongo error', function (done) {
        mongo.setUserMapping.yieldsAsync(new Error('mongo error'));
        api.getTargetHost(req, {}, function (err) {
          expect(err.message).to.equal('mongo error');
          done();
        });
      });
    });
  });
});

