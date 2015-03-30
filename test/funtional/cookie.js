'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;
var before = lab.before;
var afterEach = lab.afterEach;
var after = lab.after;
var ip = require('ip');
var App = require('../../lib/app.js');
var testServer = require('../fixture/test-server.js');
var request = require('request');
var Redis = require('redis');
var redis = Redis.createClient(process.env.REDIS_PORT, process.env.REDIS_IPADDRESS);

var testIp = ip.address();
var ctx = {};
describe('proxy to host', function () {
  before(function(done) {
    ctx.textText = '1346tweyasdf3';
    ctx.testServer = testServer.create(55555, testIp,ctx.textText);
    done();
  });
  beforeEach(function(done) {
    ctx.app = new App();
    ctx.app.start(done);
  });
  afterEach(function(done) {
    ctx.app.stop(done);
  });
  after(function(done) {
    ctx.testServer.close(done);
  });
  describe('api method', function () {
    it('should err if not host in redis', function(done) {
      request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
        expect(res.statusCode).to.equal(400);
        body = JSON.parse(body);
        expect(body.message).to.equal('no application configured');
        done();
      });
    });
    describe('with valid redis host', function () {
      ctx.testName = 'testInstance';
      before(function(done) {
        redis.rpush('frontend:localhost', ctx.testName, done);
      });
      before(function(done) {
        redis.rpush('localhost', testIp, done);
      });
      after(function(done) {
        redis.del('frontend:localhost', done);
      });
      it('should route to test app', function(done) {
        request('http://localhost:'+process.env.HTTP_PORT, function (err, res, body) {
          body = JSON.parse(body);
          console.log(err, body);
          done();
        });
      });
    });
  });
});
