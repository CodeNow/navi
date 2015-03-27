'use strict';
var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach  = lab.afterEach;
var expect = Code.expect;

var sinon = require('sinon');
var ApiClient = require('models/api-client');
var last = require('101/last');
var noop = require('101/noop');
var keypather = require('keypather')();
require('loadenv');
var mockContextId = '1234567890123456789001234'; // 24 hex

describe('api-client', function () {
  var ctx;

  beforeEach(function (done) {
    ctx = {};
    ctx.githubLoginSpy = sinon.stub(ApiClient.prototype, 'githubLogin');
    ctx.client = new ApiClient();
    ctx.login = ctx.githubLoginSpy.firstCall.args[1]; // login callback
    done();
  });
  afterEach(function (done) {
    ctx.githubLoginSpy.restore();
    done();
  });

  describe('constructor', function () {

    it('should initialize the api-client', function (done) {
      var client = ctx.client;
      var spy = ctx.githubLoginSpy;
      expect(client.host).to.equal(process.env.API_HOST);
      expect(client.loggedIn).to.be.false();
      expect(spy.calledOnce);
      expect(spy.firstCall.args[0]).to.equal(process.env.HELLO_RUNNABLE_GITHUB_TOKEN);
      // mock login
      ctx.login();
      expect(client.loggedIn).to.be.true();
      done();
    });
    describe('login error', function () {
      it('should throw an error', function (done) {
        var client = ctx.client;
        var spy = ctx.githubLoginSpy;
        expect(client.host).to.equal(process.env.API_HOST);
        expect(client.loggedIn).to.be.false();
        expect(spy.calledOnce);
        expect(spy.firstCall.args[0]).to.equal(process.env.HELLO_RUNNABLE_GITHUB_TOKEN);
        // mock login
        expect(ctx.login.bind(null, new Error())).to.throw(Error);
        expect(client.loggedIn).to.be.false();
        done();
      });
    });
  });

  describe('ensureAuth', function () {
    beforeEach(function (done) {
      ctx.methodsUsingEnsureAuth = [
        'fetchInstanceForUrl',
        'fetchInstanceDepWithContext'
      ];
      done();
    });

    it('should queue calls until login occurs', function (done) {
      var client = ctx.client;
      var methodKeys = ctx.methodsUsingEnsureAuth;
      methodKeys.forEach(function (key) {
        client[key]('foo','bar','qux');
      });
      // mock login
      methodKeys.forEach(function (key) { // mock all functions
        sinon.stub(client, key);
      });
      ctx.login();
      methodKeys.forEach(function (key) {
        var spy = client[key];
        expect(spy.calledOnce).to.be.true();
        expect(spy.firstCall).to.exist();
        expect(spy.firstCall.args).to.deep.equal(['foo','bar','qux']);
        spy.restore();
      });
      done();
    });
  });

  describe('loggedIn methods', function () {
    beforeEach(function (done) {
      ctx.login();
      ctx.fetchInstancesSpy = sinon.stub(ctx.client, 'fetchInstances');
      done();
    });

    describe('fetchInstanceForUrl', function () {

      it('should callback an error if the master instance is not found', function (done) {
        var url = 'http://api-codenow.runnableapp.com/auth/github';
        var name = 'api';
        var referer = 'http://web-codenow.runnableapp.com/auth/github';
        var fetchInstancesSpy = ctx.fetchInstancesSpy;
        var masterInstances = [];
        fetchInstancesSpy
          .onCall(0)
          .returns({ models: masterInstances });
        ctx.client.fetchInstanceForUrl(url, name, referer, function (err) {
          expect(err).to.exist();
          done();
        });
        expect(fetchInstancesSpy.calledOnce).to.be.true();
        expect(fetchInstancesSpy.firstCall.args[0]).to.exist();
        expect(fetchInstancesSpy.firstCall.args[0].url)
          .to.equal('http://api-codenow.runnableapp.com');
        var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
      });

      it('should callback masterInstance if referer not included', function (done) {
        var url = 'http://api-codenow.runnableapp.com/auth/github';
        var name = 'api';
        var referer = null;
        var fetchInstancesSpy = ctx.fetchInstancesSpy;
        var masterInstance = {};
        var masterInstances = [ masterInstance ];
        fetchInstancesSpy
          .onCall(0)
          .returns({ models: masterInstances });
        ctx.client.fetchInstanceForUrl(url, name, referer, function (err, instance) {
          expect(err).to.not.exist();
          expect(instance).to.equal(masterInstance);
          done();
        });
        expect(fetchInstancesSpy.calledOnce).to.be.true();
        expect(fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
          url: 'http://api-codenow.runnableapp.com',
          name: name
        });
        var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
      });

      it('should callback depInstance if it exists and referer is included', function (done) {
        var url = 'http://api-codenow.runnableapp.com/auth/github';
        var name = 'api';
        var referer = 'http://web-codenow.runnableapp.com/auth/github';
        var fetchInstancesSpy = ctx.fetchInstancesSpy;
        var masterInstance = {};
        keypather.set(masterInstance, 'attrs.contextVersion.context', 'contextId');
        keypather.set(masterInstance, 'attrs.owner.username', 'username');
        var depInstance = {};
        var masterInstances = [ masterInstance ];
        fetchInstancesSpy
          .onCall(0)
          .returns({ models: masterInstances });
        ctx.client.fetchInstanceForUrl(url, name, referer, function (err, instance) {
          expect(err).to.not.exist();
          expect(instance).to.equal(depInstance);
          done();
        });
        expect(fetchInstancesSpy.calledOnce).to.be.true();
        expect(fetchInstancesSpy.firstCall.args[0]).to.exist();
        expect(fetchInstancesSpy.firstCall.args[0].url)
          .to.equal('http://api-codenow.runnableapp.com');
        var fetchDepSpy = sinon.stub(ctx.client, 'fetchInstanceDepWithContext');
        var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepSpy.calledOnce).to.be.true();
        expect(fetchDepSpy.firstCall).to.exist();
        expect(fetchDepSpy.firstCall.args[0]).to.deep.equal({
          url: 'http://web-codenow.runnableapp.com',
          githubUsername: masterInstance.attrs.owner.username
        });
        var fetchDepSpyCb = last(fetchDepSpy.firstCall.args);
        fetchDepSpyCb(null, depInstance);
      });

      it('should callback depInstance if it exists and referer is included', function (done) {
        var url = 'http://api-codenow.runnableapp.com/auth/github';
        var name = 'api';
        var referer = 'http://web-codenow.runnableapp.com/auth/github';
        var fetchInstancesSpy = ctx.fetchInstancesSpy;
        var masterInstance = {};
        keypather.set(masterInstance, 'attrs.contextVersion.context', mockContextId);
        keypather.set(masterInstance, 'attrs.owner.username', 'username');
        var depInstance = null; // not found
        var masterInstances = [ masterInstance ];
        fetchInstancesSpy
          .onCall(0)
          .returns({ models: masterInstances });
        ctx.client.fetchInstanceForUrl(url, name, referer, function (err, instance) {
          expect(err).to.not.exist();
          expect(instance).to.equal(masterInstance);
          done();
        });
        expect(fetchInstancesSpy.calledOnce).to.be.true();
        expect(fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
          url: 'http://api-codenow.runnableapp.com',
          name: name
        });
        var fetchDepSpy = sinon.stub(ctx.client, 'fetchInstanceDepWithContext');
        var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepSpy.calledOnce).to.be.true();
        expect(fetchDepSpy.firstCall).to.exist();
        expect(fetchDepSpy.firstCall.args[0]).to.deep.equal({
          url: 'http://web-codenow.runnableapp.com',
          githubUsername: masterInstance.attrs.owner.username
        });
        var fetchDepSpyCb = last(fetchDepSpy.firstCall.args);
        fetchDepSpyCb(null, depInstance);
      });

      describe('fetch errors', function () {

        it('should callback error if fetchInstances errors', function (done) {
          var url = 'http://api-codenow.runnableapp.com/auth/github';
          var name = 'api';
          var referer = 'http://web-codenow.runnableapp.com/auth/github';
          var fetchInstancesSpy = ctx.fetchInstancesSpy;
          var masterInstances = [];
          var fetchErr = new Error();
          fetchInstancesSpy
            .onCall(0)
            .returns({ models: masterInstances });
          ctx.client.fetchInstanceForUrl(url, name, referer, function (err) {
            expect(err).to.equal(fetchErr);
            done();
          });
          expect(fetchInstancesSpy.calledOnce).to.be.true();
          expect(fetchInstancesSpy.firstCall.args[0]).to.exist();
          expect(fetchInstancesSpy.firstCall.args[0].url)
            .to.equal('http://api-codenow.runnableapp.com');
          var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
          fetchInstancesCb(fetchErr);
        });
        it('should callback error if fetchDependencies errors', function (done) {
          var url = 'http://api-codenow.runnableapp.com/auth/github';
          var name = 'api';
          var referer = 'http://web-codenow.runnableapp.com/auth/github';
          var fetchErr = new Error();
          var fetchInstancesSpy = ctx.fetchInstancesSpy;
          var masterInstance = {};
          keypather.set(masterInstance, 'attrs.contextVersion.context', mockContextId);
          keypather.set(masterInstance, 'attrs.owner.username', 'username');
          var masterInstances = [ masterInstance ];
          fetchInstancesSpy
            .onCall(0)
            .returns({ models: masterInstances });
          ctx.client.fetchInstanceForUrl(url, name, referer, function (err) {
            expect(err).to.equals(fetchErr);
            done();
          });
          expect(fetchInstancesSpy.calledOnce).to.be.true();
          expect(fetchInstancesSpy.firstCall.args[0]).to.deep.equal({
            url: 'http://api-codenow.runnableapp.com',
            name: name
          });
          var fetchDepSpy = sinon.stub(ctx.client, 'fetchInstanceDepWithContext');
          var fetchInstancesCb = last(fetchInstancesSpy.firstCall.args);
          fetchInstancesCb(null, []); // respond empty here.. use return value for expects
          expect(fetchDepSpy.calledOnce).to.be.true();
          expect(fetchDepSpy.firstCall).to.exist();
          expect(fetchDepSpy.firstCall.args[0]).to.deep.equal({
            url: 'http://web-codenow.runnableapp.com',
            githubUsername: masterInstance.attrs.owner.username
          });
          var fetchDepSpyCb = last(fetchDepSpy.firstCall.args);
          fetchDepSpyCb(fetchErr);
        });
      });
    });

    describe('fetchInstanceDepWithContext', function () {

      it('should callback error if fetchInstances errors', function (done) {
        var query = {};
        var context = mockContextId;
        var instance = { fetchDependencies: sinon.spy() };
        var instances = [ instance ];
        var fetchErr = new Error();
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.client.fetchInstanceDepWithContext(query, context, function (err) {
          expect(err).to.equals(fetchErr);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(fetchErr); // respond empty here.. use return value for expects
      });

      it('should callback undefined if instance not found', function (done) {
        var query = {};
        var context = mockContextId;
        var instances = [ ];
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.client.fetchInstanceDepWithContext(query, context, function (err, dependency) {
          expect(err).to.not.exist(err);
          expect(dependency).to.equal(undefined);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
      });

      it('should callback error if fetchDependencies errors', function (done) {
        var query = {};
        var context = mockContextId;
        var instance = { fetchDependencies: noop };
        var fetchDepsSpy = sinon.stub(instance, 'fetchDependencies');
        var instances = [ instance ];
        var fetchErr = new Error();
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: instances });
        ctx.client.fetchInstanceDepWithContext(query, context, function (err) {
          expect(err).to.equals(fetchErr);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        fetchDepsSpy
          .onCall(0)
          .returns({ models: [] });
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepsSpy.calledOnce).to.be.true();
        expect(fetchDepsSpy.firstCall.args[0]).to.deep.equal({
          'contextVersion.context': mockContextId
        });
        var fetchDependenciesCb = last(fetchDepsSpy.firstCall.args);
        fetchDependenciesCb(fetchErr);
      });

      it('should callback dep[0] from fetchDependencies', function (done) {
        var query = {};
        var context = mockContextId;
        var instance = { fetchDependencies: noop };
        var fetchDepsSpy = sinon.stub(instance, 'fetchDependencies');
        var dependency = {};
        ctx.fetchInstancesSpy
          .onCall(0)
          .returns({ models: [ instance ] });
        ctx.client.fetchInstanceDepWithContext(query, context, function (err, dep) {
          expect(err).to.not.exist();
          expect(dep).to.equal(dependency);
          done();
        });
        expect(ctx.fetchInstancesSpy.calledOnce).to.be.true();
        expect(ctx.fetchInstancesSpy.firstCall.args[0]).to.equal(query);
        fetchDepsSpy
          .onCall(0)
          .returns({ models: [ dependency ] });
        var fetchInstancesCb = last(ctx.fetchInstancesSpy.firstCall.args);
        fetchInstancesCb(null, []); // respond empty here.. use return value for expects
        expect(fetchDepsSpy.calledOnce).to.be.true();
        expect(fetchDepsSpy.firstCall.args[0]).to.deep.equal({
          'contextVersion.context': mockContextId
        });
        var fetchDependenciesCb = last(fetchDepsSpy.firstCall.args);
        fetchDependenciesCb(null, []); // respond empty here.. use return value for expects
      });
    });
  });
});