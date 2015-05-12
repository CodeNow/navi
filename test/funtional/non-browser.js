'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var before = lab.before;
var afterEach = lab.afterEach;
var after = lab.after;
var ip = require('ip');

var App = require('../../lib/app.js');
var redis = require('../../lib/models/redis.js');
var TestServer = require('../fixture/test-server.js');
var request = require('request');
var Runnable = require('runnable');
var NaviEntry = require('navi-entry');
var keypath = require('keypather')();

describe('test non browser request', function () {
  var testIp = ip.address();
  var testText = '1346tweyasdf3';
  var testPort = 55555;
  var testUrl = 'http://'+testIp + ':' + testPort;
  var testServer;
  var app;
  // used to mock getContainerUrl function

  before(function(done) {
    redis.flushall(done);
  });
  before(function(done) {
   testServer = TestServer.create(testPort, testIp, testText, done);
  });
  beforeEach(function(done) {
    sinon.stub(NaviEntry.prototype, 'getInstanceName');
    sinon.stub(Runnable.prototype, 'fetchInstances');
    sinon.stub(Runnable.prototype, 'githubLogin', function (key, cb) {
      keypath.set(this, 'attrs.accounts.github.username', 'bear');
      cb();
    });
    sinon.stub(Runnable.prototype, 'getContainerUrl');
    sinon.stub(Runnable.prototype, 'newInstance').returnsThis();
    done();
  });
  beforeEach(function(done) {
    app = new App();
    app.start(done);
  });
  afterEach(function(done) {
    app.stop(done);
  });
  afterEach(function(done) {
    NaviEntry.prototype.getInstanceName.restore();
    Runnable.prototype.fetchInstances.restore();
    Runnable.prototype.githubLogin.restore();
    Runnable.prototype.newInstance.restore();
    done();
  });
  after(function(done) {
    testServer.close(done);
  });
  describe('with valid backend', function () {
    beforeEach(function(done) {
      NaviEntry.prototype.getInstanceName.yields();
      Runnable.prototype.getContainerUrl.yields(null, testUrl);
      Runnable.prototype.fetchInstances
        .returns({ models: [1] })
        .yieldsAsync();
      done();
    });
    it('should proxy correctly', function (done) {
      request({
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res, body) {
        if (err) { return done(err); }
        expect(body).to.equal(testText);
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });
});
