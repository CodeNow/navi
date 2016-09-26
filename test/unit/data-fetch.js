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
  var testMongoEntryWith80;
  describe('mw', function () {
    beforeEach(function (done) {
      testMongoEntryWith80 = {
        directUrls: {
          'asdasw': {
            masterPod: true,
            ports: {
              '80': '7633'
            }
          }
        }
      }
      sinon.stub(api, 'getUrlFromRequest').returns(testReqUrl);
      sinon.stub(dataFetch, 'getMongoEntry').yieldsAsync(null, testMongoEntryWith80);
      sinon.stub(redis, 'lrange');
      done();
    });

    afterEach(function (done) {
      api.getUrlFromRequest.restore();
      dataFetch.getMongoEntry.restore();
      redis.lrange.restore();
      done();
    });

    it('should set refererUrl to origin', function (done) {
      var testReq = {
        headers: { origin: 'origin' }
      };
      redis.lrange.yieldsAsync(null, [JSON.stringify({})]);
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
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        expect(testReq.isHttps).to.be.false();
        done();
      });
    });

    it('should pass correct args to getMongoEntry', function (done) {
      var testReq = {
        headers: {}
      };
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(dataFetch.getMongoEntry);
        sinon.assert.calledWith(dataFetch.getMongoEntry, testReq);
        done();
      });
    });

    it('should call getMongoEntry with port 80 if the entry has the port and https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      dataFetch.getMongoEntry.yieldsAsync(null, testMongoEntryWith80);
      dataFetch.middleware(testReq, {}, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(dataFetch.getMongoEntry);
        sinon.assert.calledWith(dataFetch.getMongoEntry, testReq);
        done();
      });
    });

    it('should update reqUrl & parsedReqUrl with port 80 if failed and https', function (done) {
      var testReq = {
        headers: {
          'x-forwarded-proto': 'https'
        }
      };
      api.getUrlFromRequest.onFirstCall().returns('https://happygolucky.net:443');
      dataFetch.getMongoEntry.yieldsAsync(null, testMongoEntryWith80);
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
    var shortHashAndElastic;
    var testUrl = 'http://localhost:4242';
    beforeEach(function (done) {
      shortHashAndElastic = {};
      sinon.stub(resolveUrls, 'splitDirectUrlIntoShortHashAndElastic').returns(shortHashAndElastic);
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


    it('should add isElastic to req', function (done) {
      mongo.fetchNaviEntry.yieldsAsync(null, {
        elasticUrl: 'localhost'
      });
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        expect(testReq.isElastic).to.deep.equal(true);
        done();
      });
    });

    it('should add elasticUrl to req', function (done) {
      shortHashAndElastic.elasticUrl = 'fdsfasdfasdfsadfsadf';
      mongo.fetchNaviEntry.yieldsAsync(null, {
        elasticUrl: 'fdsfasdfasdfsadfsadf'
      });
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        expect(testReq.elasticUrl).to.deep.equal(shortHashAndElastic.elasticUrl);
        done();
      });
    });

    it('should call mongo with correct args no ref', function (done) {
      mongo.fetchNaviEntry.yieldsAsync(null, {
        elasticUrl: 'localhost'
      });
      testReq.refererUrlHostname = undefined;
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
        shortHash: '',
        elasticUrl: 'localhost'
      });
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, url.parse(testUrl).hostname, undefined);
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args ref', function (done) {
      testReq.refererUrlHostname = 'otherhost';
      mongo.fetchNaviEntry.yieldsAsync(null, {
        elasticUrl: 'localhost'
      });
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
        shortHash: '',
        elasticUrl: 'localhost'
      });
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, url.parse(testUrl).hostname, 'otherhost');
        sinon.assert.notCalled(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        done();
      });
    });

    it('should call mongo with correct args when direct', function (done) {
      mongo.fetchNaviEntry.yieldsAsync(null, {
        elasticUrl: 'elasticUrl'
      });
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
        shortHash: 'short',
        elasticUrl: 'elasticUrl'
      });
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        sinon.assert.calledOnce(mongo.fetchNaviEntry);
        sinon.assert.calledWith(mongo.fetchNaviEntry, 'localhost');
        sinon.assert.calledOnce(resolveUrls.splitDirectUrlIntoShortHashAndElastic);
        sinon.assert.calledWith(resolveUrls.splitDirectUrlIntoShortHashAndElastic, url.parse(testUrl).hostname);
        done();
      });
    });

    it('should add naviEntry to req', function (done) {
      var testEntry = { test: 'entry' };
      mongo.fetchNaviEntry.yieldsAsync(null, testEntry);
      dataFetch.getMongoEntry(testReq, function (err) {
        if (err) { return done(err); }
        expect(testReq.naviEntry).to.deep.equal(testEntry);
        done();
      });
    });
  }); // end getMongoEntry
});
