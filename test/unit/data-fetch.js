'use strict';
require('loadenv.js');

var Lab = require('lab');
var sinon = require('sinon');

var api = require('models/api');
var dataFetch = require('middlewares/data-fetch.js');
var mongo = require('models/mongo');
var redis = require('models/redis');
var resolveUrls = require('middlewares/resolve-urls');

var lab = exports.lab = Lab.script();
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.test;

describe('data-fetch.js unit test', function() {
  describe('mw', function() {
    var testReqHost = 'xyz-localhost';
    var testReqUrl = 'http://' + testReqHost + ':4242';
    beforeEach(function(done) {
      sinon.stub(resolveUrls, 'splitDirectUrlIntoShortHashAndElastic').returns({});
      sinon.stub(api, '_getUrlFromRequest').returns(testReqUrl);
      sinon.stub(mongo, 'fetchNaviEntry');
      sinon.stub(redis, 'lrange');
      done();
    });

    afterEach(function (done) {
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.restore();
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
      dataFetch.middleware(testReq, {}, function (err) {
        expect(err).to.equal(testErr);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should next lrange parse error', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, ['not parseable']);
      dataFetch.middleware(testReq, {}, function (err) {
        expect(err).to.be.instanceOf(Error);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should pass correct args to lrange', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(redis.lrange);
        sinon.assert.calledWith(redis.lrange, 'frontend:4242.xyz-localhost', 0, 1);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.hipacheEntry).to.deep.equal(testEntry);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
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
      dataFetch.middleware(testReq, {}, function (err) {
        expect(err).to.equal(testErr)
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);;
        done();
      });
    });

    it('should call mongo with correct args no ref', function(done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', undefined);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', 'otherhost');
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', 'otherhost');
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'xyz-localhost', undefined);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args ref', function(done) {
      var testReq = {
        headers: {
          referer: 'http://otherhost:4242'
        }
      };
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
        elasticUrl: 'testHost'
      })
      redis.lrange.yieldsAsync(null, [JSON.stringify({direct: true})]);
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'testHost', 'otherhost');
        sinon.assert.calledOnce(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        sinon.assert.calledWith(resolveUrls.splitDirectUrlIntoShortHashAndElastic, testReqHost);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.naviEntry).to.deep.equal(testEntry);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });
  });
});
