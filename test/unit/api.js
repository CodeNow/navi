/**
 * @module test/unit/api
 */
'use strict';
require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;
var put = require('101/put');
var sinon = require('sinon');
var noop = require('101/noop');

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
        });
        done();
      });
    });
  });

  describe('api.getTargetHost', function () {
    describe('target owner not member of authenticated users orgs', function () {
      var base = 'api-staging-codenow.runnableapp.com';
      beforeEach(function (done) {
        sinon.stub(api, '_getUrlFromRequest');
        sinon.stub(api, '_getTargetHostElastic');
        sinon.stub(api, '_processTargetInstance');
        done();
      });

      afterEach(function (done) {
        api._getUrlFromRequest.restore();
        api._getTargetHostElastic.restore();
        api._processTargetInstance.restore();
        done();
      });

      it('should call _getTargetHostElastic if elastic', function (done) {
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
          },
          hipacheEntry: JSON.parse(naviRedisEntriesFixture.elastic),
          naviEntry: naviEntriesFixtures.refererNaviEntry
        };
        api._getUrlFromRequest.returns('http://' + base + ':80');
        api._getTargetHostElastic.yieldsAsync();
        api.getTargetHost(req, {}, function (err) {
          if (err) { return done(err); }
          sinon.assert.calledOnce(api._getTargetHostElastic);
          done();
        });
      });

      it('should call _processTargetInstance if direct and not isBrowser', function (done) {
        var req = {
          method: 'get',
          isBrowser: false,
          session: {
            userGithubOrgs: [19495, 93722, 958321],
            userId: 19495
          },
          headers: {
            origin: 'http://frontend-staging-codenow.runnableapp.com',
            host: base + ':80'
          },
          hipacheEntry: naviRedisEntriesFixture.direct,
          naviEntry: naviEntriesFixtures.refererNaviEntry
        };
        api._getUrlFromRequest.returns('http://' + base + ':80');
        api._processTargetInstance.yieldsAsync();
        api.getTargetHost(req, {}, function (err) {
          if (err) { return done(err); }
          sinon.assert.calledOnce(api._processTargetInstance);
          done();
        });
      });

      it('should save session', function (done) {
        var req = {
          method: 'get',
          isBrowser: true ,
          session: {
            userGithubOrgs: [19495, 93722, 958321],
            userId: 19495,
            save: sinon.stub().yieldsAsync(),
          },
          headers: {
            origin: 'http://frontend-staging-codenow.runnableapp.com',
            host: base + ':80'
          },
          hipacheEntry: naviRedisEntriesFixture.direct,
          naviEntry: naviEntriesFixtures.refererNaviEntry
        };
        api._getUrlFromRequest.returns('http://' + base + ':80');

        api.getTargetHost(req, {}, function (err) {
          if (err) { return done(err); }
          sinon.assert.calledOnce(req.session.save);
          done();
        });
      });
    });
  });
});

