'use strict';

require('loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

var expect = require('code').expect;
var fs = require('fs');
var sinon = require('sinon');
var redis = require('redis');

require('models/redis');
var redisPath = require('path').join(__dirname, '../../lib/models/redis.js');

describe('redis client', function () {
  beforeEach(function (done) {
    delete require.cache[redisPath];
    var readFileSync = fs.readFileSync;
    sinon.stub(fs, 'readFileSync', function (name, encoding) {
      if (name === 'foo') { return 'bar'; }
      return readFileSync(name, encoding);
    });
    sinon.stub(redis, 'createClient');
    done();
  });

  afterEach(function (done) {
    fs.readFileSync.restore();
    redis.createClient.restore();
    done();
  });

  describe('with redis CA', function () {
    var prevCACert = process.env.REDIS_CACERT;

    beforeEach(function (done) {
      process.env.REDIS_CACERT = 'foo';
      done();
    });

    afterEach(function (done) {
      process.env.REDIS_CACERT = prevCACert;
      done();
    });

    it('should have tls options', function (done) {
      var client = require('models/redis');
      sinon.assert.calledWithExactly(
        fs.readFileSync,
        'foo',
        'utf-8'
      );
      sinon.assert.calledWith(
        redis.createClient,
        {
          host: process.env.REDIS_IPADDRESS,
          port: process.env.REDIS_PORT,
          connect_timeout: 5000,
          tls: {
            rejectUnauthorized: true,
            ca: [ 'bar' ]
          }
        }
      );
      done();
    });
  });

  it('should create a client', function (done) {
    var client = require('models/redis');
    sinon.assert.calledWith(
      redis.createClient,
      {
        host: process.env.REDIS_IPADDRESS,
        port: process.env.REDIS_PORT,
        connect_timeout: 5000
      }
    );
    done();
  });
});
