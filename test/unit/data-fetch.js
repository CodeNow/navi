'use strict';
require('loadenv.js');

var Lab = require('lab');
var sinon = require('sinon');

var api = require('models/api');
var dataFetch = require('middlewares/data-fetch.js');
var mongo = require('models/mongo');
var redis = require('models/redis');

var lab = exports.lab = Lab.script();
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.test;

describe('data-fetch.js unit test', function() {
  describe('mw', function() {
    var testReqUrl = 'http://xyz-localhost:4242';
    beforeEach(function(done) {
      sinon.stub(api, '_getUrlFromRequest').returns(testReqUrl);
      sinon.stub(mongo, 'fetchNaviEntry');
      sinon.stub(redis, 'lrange');
      done();
    });

    afterEach(function (done) {
      api._getUrlFromRequest.restore();
      mongo.fetchNaviEntry.restore();
      redis.lrange.restore();
      done();
    });

    it('should next lrange error', function(done) {
      var testReq = {
        headers: {}
      };
      var testErr = new Error('test');
      redis.lrange.yieldsAsync(testErr);
      dataFetch.mw(testReq, {}, function (err) {
        expect(err).to.equal(testErr);
        done();
      });
    });

    it('should next lrange parse error', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, ['not parseable']);
      dataFetch.mw(testReq, {}, function (err) {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });

    it('should pass correct args to lrange', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(redis.lrange);
        sinon.assert.calledWith(redis.lrange, 'frontend:4242.xyz-localhost', 0, 1);
        done();
      });
    });

    it('should add hipacheEntry to req', function(done) {
      var testReq = {
        headers: {}
      };
      var testEntry = { test: true };
      redis.lrange.yieldsAsync(null, [JSON.stringify(testEntry)]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.hipacheEntry).to.deep.equal(testEntry);
        done();
      });
    });

    it('should next mongo err', function(done) {
      var testReq = {
        headers: {}
      };
      var testErr = new Error('test');
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync(testErr);
      dataFetch.mw(testReq, {}, function (err) {
        expect(err).to.equal(testErr);
        done();
      });
    });

    it('should call mongo with correct args no ref', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', undefined);
        done();
      });
    });

    it('should call mongo with correct args ref', function(done) {
      var testReq = {
        headers: {
          origin: 'http://otherhost:4242'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', 'otherhost');
        done();
      });
    });

    it('should call mongo with correct args ref', function(done) {
      var testReq = {
        headers: {
          referer: 'http://otherhost:4242'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', 'otherhost');
        done();
      });
    });

    it('should call mongo with correct args ref', function(done) {
      var testReq = {
        headers: {
          referer: 'http://xyz-localhost:4242'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', undefined);
        done();
      });
    });

    it('should call mongo with correct args ref', function(done) {
      var testReq = {
        headers: {
          referer: 'http://otherhost:4242'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({direct: true})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'localhost', 'otherhost');
        done();
      });
    });

    it('should add naviEntry to req', function(done) {
      var testReq = {
        headers: {
          referer: 'http://otherhost:4242'
        }
      };
      var testEntry = { test: 'entry' };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync(null, testEntry);
      dataFetch.mw(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.naviEntry).to.deep.equal(testEntry);
        done();
      });
    });
  });
});