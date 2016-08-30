'use strict';
require('loadenv.js');

var Lab = require('lab');
var sinon = require('sinon');
var url = require('url');

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

describe('data-fetch.js unit test', function () {
  var testReqHost = 'xyz-localhost';
  var testReqUrl = 'http://' + testReqHost + ':4242';
  describe('mw', function () {
    beforeEach(function (done) {
      sinon.stub(api, 'getUrlFromRequest').returns(testReqUrl);
      sinon.stub(dataFetch, 'getMongoEntry');
      sinon.stub(redis, 'lrange');
      done();
    });

    afterEach(function (done) {
      api.getUrlFromRequest.restore();
      dataFetch.getMongoEntry.restore();
      redis.lrange.restore();
      done();
    });

    it('should next lrange error', function (done) {
      var testReq = {
        headers: {}
      };
      var testErr = new Error('test');
      redis.lrange.yieldsAsync(testErr);
      dataFetch.middleware(testReq, {}, function (err) {
        expect(err).to.equal(testErr);
        sinon.assert.notCalled(dataFetch.getMongoEntry);
        done();
      });
    });

    it('should set refererUrl to origin', function (done) {
      var testReq = {
        headers: { origin: 'origin' }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.refererUrl).to.equal('origin');
        done();
      });
    });

    it('should set refererUrl to referer', function (done) {
      var testReq = {
        headers: { referer: 'referer' }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.refererUrl).to.equal('referer');
        done();
      });
    });

    it('should undefined refererUrl and refererUrlHostname if match', function (done) {
      var testReq = {
        headers: {
          referer: testReqUrl,
          host: testReqUrl
        }
      };
      redis.lrange.yieldsAsync(null, []);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.refererUrlHostname).to.be.undefined();
        expect(testReq.refererUrl).to.be.undefined();
        done();
      });
    });

    it('should not set isHttps if no header', function (done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.isHttps).to.be.false();
        done();
      });
    });

    it('should set isHttps true if x-forwarded-proto = https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.isHttps).to.be.true();
        done();
      });
    });

    it('should set isHttps false if x-forwarded-proto = http', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'http'
        }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.isHttps).to.be.false();
        done();
      });
    });


    it('should pass correct args to lrange', function (done) {
      var testReq = {
        headers: {}
      };
      redis.lrange.yieldsAsync(null, [1, 2]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(redis.lrange);
        sinon.assert.calledWith(redis.lrange, 'frontend:4242.xyz-localhost', 0, 1);
        done();
      });
    });

    it('should pass correct args to getMongoEntry', function (done) {
      var testReq = {
        headers: {}
      };
      var testRaw = 'raw';
      redis.lrange.yieldsAsync(null, testRaw);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(dataFetch.getMongoEntry);
        sinon.assert.calledWith(dataFetch.getMongoEntry, testReq, testRaw);
        done();
      });
    });

    it('should cb error if 2nd lrange failed', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      redis.lrange.onFirstCall().yieldsAsync(null, []);
      redis.lrange.onSecondCall().yieldsAsync('better_error');
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        expect(err).to.equal('better_error');
        sinon.assert.calledTwice(redis.lrange);
        sinon.assert.notCalled(dataFetch.getMongoEntry);
        done();
      });
    });

    it('should call lrange with port 80 if failed and https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      redis.lrange.onFirstCall().yieldsAsync(null, []);
      redis.lrange.onSecondCall().yieldsAsync(null, [1, 2]);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledTwice(redis.lrange);
        sinon.assert.calledWith(redis.lrange, 'frontend:80.xyz-localhost', 0, 1);
        done();
      });
    });

    it('should call getMongoEntry with port 80 if failed and https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      var testRaw = 'raw';
      redis.lrange.onFirstCall().yieldsAsync(null, []);
      redis.lrange.onSecondCall().yieldsAsync(null, testRaw);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(dataFetch.getMongoEntry);
        sinon.assert.calledWith(dataFetch.getMongoEntry, testReq, testRaw);
        done();
      });
    });

    it('should update reqUrl & parsedReqUrl with port 80 if failed and https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      var testRaw = 'raw';
      api.getUrlFromRequest.onFirstCall().returns('https://happygolucky.net:443');
      redis.lrange.onFirstCall().yieldsAsync(null, []);
      redis.lrange.onSecondCall().yieldsAsync(null, testRaw);
      dataFetch.getMongoEntry.yieldsAsync();
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        var uri = 'http://happygolucky.net:80';
        expect(testReq.reqUrl).to.equal(uri);
        expect(testReq.parsedReqUrl).to.deep.equal(url.parse(uri));
        done();
      });
    });
  }); // end mw

  describe('getMongoEntry', function () {
    var testReq;
    var testUrl = 'http://localhost:4242';
    beforeEach(function (done) {
      sinon.stub(resolveUrls, 'splitDirectUrlIntoShortHashAndElastic').returns({});
      sinon.stub(mongo, 'fetchNaviEntry');
      testReq = {
        isHttps: false,
        parsedReqUrl: url.parse(testUrl)
      };
      done();
    });

    afterEach(function (done) {
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.restore();
      mongo.fetchNaviEntry.restore();
      done();
    });

    it('should next lrange empty error', function (done) {
      dataFetch.getMongoEntry(testReq, [], function (err) {
        expect(err).to.be.instanceOf(Error);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should next lrange un parse error', function (done) {
      dataFetch.getMongoEntry(testReq, 'p', function (err) {
        expect(err).to.be.instanceOf(Error);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should add hipacheEntry to req', function (done) {
      var testEntry = { test: true };
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.getMongoEntry(testReq, [JSON.stringify(testEntry)], function (err) {
        if (err) { return done(err); }
        expect(testReq.hipacheEntry).to.deep.equal(testEntry);
        done();
      });
    });

    it('should next mongo err', function (done) {
      var testErr = new Error('test');
      mongo.fetchNaviEntry.yieldsAsync(testErr);
      dataFetch.getMongoEntry(testReq, [JSON.stringify({})], function (err) {
        expect(err).to.equal(testErr);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args no ref', function (done) {
      mongo.fetchNaviEntry.yieldsAsync();
      testReq.refererUrlHostname = undefined;
      dataFetch.getMongoEntry(testReq, [JSON.stringify({})], function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, url.parse(testUrl).hostname, undefined);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args ref', function (done) {
      testReq.refererUrlHostname = 'otherhost';
      mongo.fetchNaviEntry.yieldsAsync();
      dataFetch.getMongoEntry(testReq, [JSON.stringify({})], function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, url.parse(testUrl).hostname, 'otherhost');
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args when direct', function (done) {
      mongo.fetchNaviEntry.yieldsAsync();
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
        shortHash: 'short',
        elasticUrl: 'elasticUrl'
      });
      dataFetch.getMongoEntry(testReq, [JSON.stringify({direct: true})], function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'elasticUrl', undefined);
        sinon.assert.calledOnce(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        sinon.assert.calledWith(resolveUrls.splitDirectUrlIntoShortHashAndElastic, url.parse(testUrl).hostname);
        done();
      });
    });

    it('should add naviEntry to req', function (done) {
      var testEntry = { test: 'entry' };
      mongo.fetchNaviEntry.yieldsAsync(null, testEntry);
      dataFetch.getMongoEntry(testReq, [JSON.stringify({})], function (err) {
        if (err) { return done(err); }
        expect(testReq.naviEntry).to.deep.equal(testEntry);
        done();
      });
    });
  }); // end getMongoEntry
});
