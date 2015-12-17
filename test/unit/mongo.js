/**
 * @module test/unit/mongo
 */
'use strict';

require('loadenv.js');

var Lab = require('lab');
var clone = require('101/clone');
var expect = require('code').expect;
var keypather = require('keypather')();
var mongodb = require('mongodb');
var put = require('101/put');
var sinon = require('sinon');

var cache = require('cache');
var mongo = require('models/mongo');
var naviEntryFixtures = require('../fixture/navi-entries');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

describe('lib/models/mongodb', function () {
  var mockDb = {
    collection: function () {}
  };
  beforeEach(function (done) {
    sinon.stub(mongodb.MongoClient, 'connect').yieldsAsync(null, mockDb);
    done();
  });
  afterEach(function (done) {
    mongodb.MongoClient.connect.restore();
    done();
  });
  describe('Mongo.prototype.start', function () {
    it('should attempt to connect to mongo server', function (done) {
      mongo.start(function (err) {
        expect(err).to.be.undefined();
        expect(mongodb.MongoClient.connect.callCount).to.equal(1);
        done();
      });
    });

    it('should callback mongo connection error', function (done) {
      mongodb.MongoClient.connect.restore();
      sinon.stub(mongodb.MongoClient, 'connect').yieldsAsync(new Error('mongo err'));
      mongo.start(function (err) {
        expect(err.message).to.equal('mongo err');
        expect(mongodb.MongoClient.connect.callCount).to.equal(1);
        done();
      });
    });
  });

  describe('Mongo.prototype.stop', function () {
    beforeEach(function (done) {
      mongo._db = {
        close: sinon.stub().yieldsAsync()
      };
      done();
    });
    it('should close mongo connection', function (done) {
      mongo.stop(function (err) {
        expect(err).to.be.undefined();
        expect(mongo._db.close.callCount).to.equal(1);
        delete mongo._db;
        done();
      });
    });
    it('should return if invoked before mongo connection', function (done) {
      delete mongo._db;
      mongo.stop(function (err) {
        expect(err).to.be.undefined();
        done();
      });
    });
  });

  describe('Mongo.prototype.fetchNaviEntry |', function () {
    var mongoError = new Error('mongo error');

    beforeEach(function (done) {
      sinon.stub(cache, 'set');
      keypather.set(mongo, '_naviEntriesCollection.find', function () {});
      sinon.stub(mongo._naviEntriesCollection, 'find').returns({
        toArray: sinon.stub().yieldsAsync(mongoError)
      });
      sinon.stub(mongo, '_fetchNaviEntryHandleCacheOrMongo').yields();
      done();
    });

    afterEach(function (done) {
      cache.set.restore();
      mongo._naviEntriesCollection.find.restore();
      mongo._fetchNaviEntryHandleCacheOrMongo.restore();
      done();
    });

    describe('no LRU cache |', function () {
      beforeEach(function (done) {
        delete process.env.ENABLE_LRU_CACHE;
        sinon.stub(mongo, '_getCachedResults').returns(undefined);
        done();
      });

      afterEach(function (done) {
        mongo._getCachedResults.restore();
        done();
      });

      it('should callback mongo error', function (done) {
        mongo._fetchNaviEntryHandleCacheOrMongo.yields(mongoError);
        mongo.fetchNaviEntry('api-staging-codenow.runnableapp.com', null, function (err) {
          expect(err).to.equal(mongoError);

          sinon.assert.calledOnce(mongo._getCachedResults);

          sinon.assert.calledOnce(mongo._naviEntriesCollection.find);
          sinon.assert.calledWith(mongo._naviEntriesCollection.find, sinon.match.object);

          sinon.assert.calledOnce(mongo._fetchNaviEntryHandleCacheOrMongo);
          sinon.assert.calledWith(mongo._fetchNaviEntryHandleCacheOrMongo,
            true, mongoError, undefined, 'api-staging-codenow.runnableapp.com',
            sinon.match.func);

          done();
        });
      });

      it('should fetch one navientries document if !refererUrl', function (done) {
        var naviEntriesDocument = {};
        var elasticUrl = 'api-staging-codenow.runnableapp.com';

        var mongoResponse = [naviEntriesDocument];
        var fetchNaviEntryHandleCacheOrMongoResponse = {};

        mongo._naviEntriesCollection.find.returns({
          toArray: sinon.stub().yieldsAsync(null, mongoResponse)
        });

        mongo._fetchNaviEntryHandleCacheOrMongo
          .yields(null, fetchNaviEntryHandleCacheOrMongoResponse);

        mongo.fetchNaviEntry(elasticUrl, null, function (err, response) {
          expect(err).to.be.null();

          sinon.assert.calledOnce(mongo._getCachedResults);

          sinon.assert.calledOnce(mongo._naviEntriesCollection.find);
          sinon.assert.calledWith(mongo._naviEntriesCollection.find,
            sinon.match.has('elasticUrl', elasticUrl));

          sinon.assert.calledOnce(mongo._fetchNaviEntryHandleCacheOrMongo);
          sinon.assert.calledWith(mongo._fetchNaviEntryHandleCacheOrMongo,
            true, null, mongoResponse, 'api-staging-codenow.runnableapp.com',
            sinon.match.func);

          expect(response).to.equal(fetchNaviEntryHandleCacheOrMongoResponse);
          done();
        });
      });

      it('should fetch two navientries documents if refererUrl', function (done) {
        var elasticUrl = 'api-staging-codenow.runnableapp.com';
        var refererUrl = 'frontend-staging-codenow.runnableapp.com';
        var naviEntriesDocument = {
          elasticUrl: elasticUrl
        };
        var naviEntriesDocumentReferer = {
          elasticUrl: refererUrl
        };
        var mongoResponse = [naviEntriesDocument, naviEntriesDocumentReferer];
        var fetchNaviEntryHandleCacheOrMongoResponse = {};

        mongo._naviEntriesCollection.find.returns({
          toArray: sinon.stub().yieldsAsync(null, mongoResponse)
        });

        mongo._fetchNaviEntryHandleCacheOrMongo
          .yields(null, fetchNaviEntryHandleCacheOrMongoResponse);

        mongo.fetchNaviEntry(elasticUrl, refererUrl, function (err, response) {
          expect(err).to.be.null();

          sinon.assert.calledOnce(mongo._getCachedResults);

          sinon.assert.calledOnce(mongo._naviEntriesCollection.find);
          sinon.assert.calledWith(mongo._naviEntriesCollection.find,
            sinon.match.has('$or', sinon.match.array));

          sinon.assert.calledOnce(mongo._fetchNaviEntryHandleCacheOrMongo);
          sinon.assert.calledWith(mongo._fetchNaviEntryHandleCacheOrMongo,
            true, null, mongoResponse, 'api-staging-codenow.runnableapp.com',
            sinon.match.func);

          expect(response).to.equal(fetchNaviEntryHandleCacheOrMongoResponse);

          done();
        });
      });

      it('should fetch two navientries documents if refererUrl (inverse possible response order)',
      function (done) {
        var elasticUrl = 'api-staging-codenow.runnableapp.com';
        var refererUrl = 'frontend-staging-codenow.runnableapp.com';
        var naviEntriesDocument = {
          elasticUrl: elasticUrl
        };
        var naviEntriesDocumentReferer = {
          elasticUrl: refererUrl
        };

        var mongoResponse = [naviEntriesDocument, naviEntriesDocumentReferer].reverse();
        var fetchNaviEntryHandleCacheOrMongoResponse = {};

        mongo._naviEntriesCollection.find.returns({
          toArray: sinon.stub().yieldsAsync(null, mongoResponse)
        });

        mongo._fetchNaviEntryHandleCacheOrMongo
          .yields(null, fetchNaviEntryHandleCacheOrMongoResponse);

        mongo.fetchNaviEntry(elasticUrl, refererUrl, function (err, response) {
          expect(err).to.be.null();

          sinon.assert.calledOnce(mongo._getCachedResults);

          sinon.assert.calledOnce(mongo._naviEntriesCollection.find);
          sinon.assert.calledWith(mongo._naviEntriesCollection.find,
            sinon.match.has('$or', sinon.match.array));

          expect(response).to.equal(fetchNaviEntryHandleCacheOrMongoResponse);
          done();
        });
      });
    }); // no LRU cache

    describe('LRU cache |', function () {
      var cachedData;
      var naviEntryFixture;
      beforeEach(function (done) {
        naviEntryFixture = clone(naviEntryFixtures);
        delete naviEntryFixture.refererNaviEntry;
        cachedData = [naviEntryFixture];

        sinon.stub(mongo, '_getCachedResults').returns(cachedData);
        mongo._fetchNaviEntryHandleCacheOrMongo.yields(null);

        done();
      });

      afterEach(function (done) {
        mongo._getCachedResults.restore();
        done();
      });

      it('should not re-cache cached data', function (done) {
        mongo.fetchNaviEntry('elastic-url-staging.runnableapp.com', null, function (err) {
          expect(err).to.be.null();

          sinon.assert.calledOnce(mongo._getCachedResults);
          sinon.assert.calledWith(mongo._getCachedResults,
            'elastic-url-staging.runnableapp.com', null);

          sinon.assert.notCalled(mongo._naviEntriesCollection.find)

          sinon.assert.calledOnce(mongo._fetchNaviEntryHandleCacheOrMongo);
          sinon.assert.calledWith(mongo._fetchNaviEntryHandleCacheOrMongo,
            false, null, cachedData, 'elastic-url-staging.runnableapp.com', sinon.match.func);
          done();
        });
      });
    }); // LRU cache
  }); // Mongo.prototype.fetchNaviEntry

  describe('Mongo.prototype._getCachedResults |', function () {
    var mockElasticUrl;
    var mockRefererElasticUrl;

    beforeEach(function (done) {
      mockElasticUrl = 'api-cached.runnableapp.com';
      mockRefererElasticUrl = 'frontend-cached.runnableapp.com';
      process.env.ENABLE_LRU_CACHE = true;
      done();
    });

    afterEach(function (done) {
      delete process.env.ENABLE_LRU_CACHE;
      done();
    });

    it('should return undefined if !process.env.ENABLE_LRU_CACHE', function (done) {
      delete process.env.ENABLE_LRU_CACHE;
      var result = mongo._getCachedResults(mockElasticUrl);
      expect(result).to.be.undefined();
      done();
    });

    describe('no referer', function () {
      var naviEntryFixture;

      beforeEach(function (done) {
        naviEntryFixture = clone(naviEntryFixtures);
        delete naviEntryFixture.refererNaviEntry;

        sinon.stub(cache, 'get');
        done();
      });

      afterEach(function (done) {
        cache.get.restore();
        done();
      });

      it('should return undefined if cache does not exist', function (done) {
        cache.get.returns(undefined);
        var result = mongo._getCachedResults(mockElasticUrl, null);
        expect(result).to.be.undefined();
        sinon.assert.calledTwice(cache.get);

        var firstCall = cache.get.getCall(0);
        var secondCall = cache.get.getCall(1);

        sinon.assert.calledWith(firstCall, mockElasticUrl);
        sinon.assert.calledWith(secondCall, null);
        done();
      });

      it('should return cache if cache exists', function (done) {

        cache.get.onFirstCall().returns(naviEntryFixture);
        cache.get.onSecondCall().returns(undefined);

        var result = mongo._getCachedResults(mockElasticUrl, null);

        expect(result).to.be.an.array();
        expect(result[0]).to.equal(naviEntryFixture)

        sinon.assert.calledTwice(cache.get);
        var firstCall = cache.get.getCall(0);
        var secondCall = cache.get.getCall(1);

        sinon.assert.calledWith(firstCall, mockElasticUrl);
        sinon.assert.calledWith(secondCall, null);

        done();
      });
    });

    describe('referer', function () {
      var naviEntryFixture;
      var refererNaviEntryFixture;

      beforeEach(function (done) {
        naviEntryFixture = put({}, naviEntryFixtures);
        refererNaviEntryFixture = naviEntryFixture.refererNaviEntry;
        delete naviEntryFixture.refererNaviEntry;

        sinon.stub(cache, 'get');
        done();
      });

      afterEach(function (done) {
        cache.get.restore();
        done();
      });

      it('should return undefined if cache for first object does not exist', function (done) {
        cache.get.onFirstCall().returns(naviEntryFixture);
        cache.get.onSecondCall().returns(undefined);
        var result = mongo._getCachedResults(mockElasticUrl, mockRefererElasticUrl);
        expect(result).to.be.undefined();

        sinon.assert.calledTwice(cache.get);
        var firstCall = cache.get.getCall(0);
        var secondCall = cache.get.getCall(1);

        sinon.assert.calledWith(firstCall, mockElasticUrl);
        sinon.assert.calledWith(secondCall, mockRefererElasticUrl);
        done();
      });

      it('should return undefined if cache for second object does not exist', function (done) {
        cache.get.onFirstCall().returns(undefined);
        cache.get.onSecondCall().returns(refererNaviEntryFixture);
        var result = mongo._getCachedResults(mockElasticUrl, mockRefererElasticUrl);
        expect(result).to.be.undefined();

        sinon.assert.calledTwice(cache.get);
        var firstCall = cache.get.getCall(0);
        var secondCall = cache.get.getCall(1);

        sinon.assert.calledWith(firstCall, mockElasticUrl);
        sinon.assert.calledWith(secondCall, mockRefererElasticUrl);
        done();
      });

      it('should return cached data if cache exists for both naviEntries', function (done) {
        cache.get.onFirstCall().returns(naviEntryFixture);
        cache.get.onSecondCall().returns(refererNaviEntryFixture);
        var result = mongo._getCachedResults(mockElasticUrl, mockRefererElasticUrl);
        expect(result).to.be.an.array();
        expect(result[0]).to.equal(naviEntryFixture);
        expect(result[1]).to.equal(refererNaviEntryFixture);

        sinon.assert.calledTwice(cache.get);
        var firstCall = cache.get.getCall(0);
        var secondCall = cache.get.getCall(1);

        sinon.assert.calledWith(firstCall, mockElasticUrl);
        sinon.assert.calledWith(secondCall, mockRefererElasticUrl);
        done();
      });
    });
  }); // end Mongo.prototype._getCachedResults

  describe('Mongo.prototype._cacheResults', function () {
    var naviEntryFixture;

    beforeEach(function (done) {
      process.env.ENABLE_LRU_CACHE = true;
      naviEntryFixture = put({}, naviEntryFixtures);
      sinon.stub(cache, 'set')
      done();
    });

    afterEach(function (done) {
      delete process.env.ENABLE_LRU_CACHE;
      cache.set.restore();
      done();
    });

    it('should handle naviEntry document with refererEntry property', function (done) {
      var elasticUrl = naviEntryFixture.elasticUrl;
      var refererElasticUrl = naviEntryFixture.refererNaviEntry.elasticUrl;

      mongo._cacheResults(naviEntryFixture);
      sinon.assert.calledTwice(cache.set);
      var firstCall = cache.set.getCall(0);
      var secondCall = cache.set.getCall(1);
      sinon.assert.calledWith(firstCall, refererElasticUrl, sinon.match.object);
      sinon.assert.calledWith(secondCall, elasticUrl, sinon.match.object);
      done();
    });

    it('should handle naviEntry document without refererEntry property', function (done) {
      var elasticUrl = naviEntryFixture.elasticUrl;
      delete naviEntryFixture.refererNaviEntry;

      mongo._cacheResults(naviEntryFixture);
      sinon.assert.calledOnce(cache.set);
      sinon.assert.calledWith(cache.set, elasticUrl, sinon.match.object);
      done();
    });
  }); // end Mongo.prototype._cacheResults

  describe('Mongo.prototype.setUserMapping', function () {
    it('should update a navientries document with a new user-mapping', function (done) {
      keypather.set(mongo, '_naviEntriesCollection.update', sinon.spy(function (query, obj, cb) {
        cb();
      }));
      mongo.setUserMapping('api-staging-codenow.runnableapp.com', 555, 'fk8fk8', function (err) {
        expect(err).to.be.undefined();
        expect(mongo._naviEntriesCollection.update.args[0][0]).to.deep.equal({
          elasticUrl: 'api-staging-codenow.runnableapp.com'
        });
        expect(mongo._naviEntriesCollection.update.args[0][1]).to.deep.equal({
          $set: {
            'userMappings.555': 'fk8fk8'
          }
        });
        done();
      });
    });
  });

  describe('Mongo.findMasterPodBranch', function () {
    it('should return directUrls object that has masterPod:true property/value', function (done) {
      var copy = put({}, naviEntryFixtures);
      copy.directUrls.e4rov2.masterPod = false;
      copy.directUrls.e4v7ve.masterPod = true;
      var findResult = mongo.constructor.findMasterPodBranch(copy);
      var masterPod = findResult.directUrlObj;
      expect(masterPod.masterPod).to.equal(true);
      expect(masterPod).to.equal(copy.directUrls.e4v7ve);
      done();
    });

    it('should return null if no masterPod:true directUrl obj', function (done) {
      var copy = put({}, naviEntryFixtures);
      copy.directUrls = {};
      var masterPod = mongo.constructor.findMasterPodBranch(copy);
      expect(masterPod).to.be.undefined();
      done();
    });
  });

  describe('Mongo.findAssociationShortHashByElasticUrl', function () {
    var associations = [{
      elasticUrl: 'A',
      shortHash: 'A1'
    }, {
      elasticUrl: 'B',
      shortHash: 'B1'
    }];

    it('should return associations object with matching elasticUrl', function (done) {
      var result = mongo.constructor.findAssociationShortHashByElasticUrl(associations, 'A');
      expect(result).to.equal(associations[0].shortHash);
      done();
    });

    it('should return null if no associations', function (done) {
      var result = mongo.constructor.findAssociationShortHashByElasticUrl([], 'A');
      expect(result).to.equal(undefined);
      done();
    });

    it('should return null if no matching associations', function (done) {
      var result = mongo.constructor.findAssociationShortHashByElasticUrl(associations, 'C');
      expect(result).to.equal(undefined);
      done();
    });
  });

  describe('Mongo.prototype._fetchNaviEntryHandleCacheOrMongo |', function () {
    var naviEntryFixture;
    var refererNaviEntryFixture;
    var elasticUrl = 'api-staging-codenow.runnableapp.com';

    beforeEach(function (done) {
      naviEntryFixture = clone(naviEntryFixtures);
      refererNaviEntryFixture = naviEntryFixture.refererNaviEntry;
      delete naviEntryFixture.refererNaviEntry;

      sinon.stub(mongo, '_cacheResults').returns(undefined);
      done();
    });

    afterEach(function (done) {
      mongo._cacheResults.restore();
      done();
    });

    it('should callback with error if passed an err', function (done) {
      var error = new Error('mongo error');
      var mongoResponse = undefined;
      mongo._fetchNaviEntryHandleCacheOrMongo(false, error, mongoResponse, elasticUrl,
      function (err) {
        expect(err).to.equal(error);
        sinon.assert.notCalled(mongo._cacheResults);
        done();
      });
    });

    it('should yield naviEntry without refererNaviEntry prop if response length is 1',
    function (done) {
      var mongoResponse = [naviEntryFixture];
      mongo._fetchNaviEntryHandleCacheOrMongo(true, null, mongoResponse, elasticUrl,
      function (err, naviEntry) {
        expect(err).to.be.null();

        sinon.assert.calledOnce(mongo._cacheResults);
        sinon.assert.calledWith(mongo._cacheResults, naviEntryFixture);

        expect(naviEntry).to.equal(naviEntryFixture);
        expect(naviEntry.refererNaviEntry).to.be.undefined();
        done();
      })
    });

    it('should yield naviEntry without refererNaviEntry prop if response length is 2',
    function (done) {
      var mongoResponse = [naviEntryFixture, refererNaviEntryFixture];
      mongo._fetchNaviEntryHandleCacheOrMongo(true, null, mongoResponse, elasticUrl,
      function (err, naviEntry) {
        expect(err).to.be.null();

        sinon.assert.calledOnce(mongo._cacheResults);
        sinon.assert.calledWith(mongo._cacheResults, naviEntryFixture);

        expect(naviEntry).to.equal(naviEntryFixture);
        expect(naviEntry.refererNaviEntry).to.equal(refererNaviEntryFixture);
        done();
      })
    });

    it('should yield naviEntry without refererNaviEntry prop if response length is 2 (rev order)',
    function (done) {
      var mongoResponse = [naviEntryFixture, refererNaviEntryFixture].reverse();
      mongo._fetchNaviEntryHandleCacheOrMongo(true, null, mongoResponse, elasticUrl,
      function (err, naviEntry) {
        expect(err).to.be.null();

        sinon.assert.calledOnce(mongo._cacheResults);
        sinon.assert.calledWith(mongo._cacheResults, naviEntryFixture);

        expect(naviEntry).to.equal(naviEntryFixture);
        expect(naviEntry.refererNaviEntry).to.equal(refererNaviEntryFixture);
        done();
      })
    });

    it('should not cache if first argument (shouldCacheResults) is false', function (done) {
      var mongoResponse = [naviEntryFixture, refererNaviEntryFixture];
      mongo._fetchNaviEntryHandleCacheOrMongo(false, null, mongoResponse, elasticUrl,
      function (err, naviEntry) {
        expect(err).to.be.null();

        sinon.assert.notCalled(mongo._cacheResults);

        expect(naviEntry).to.equal(naviEntryFixture);
        expect(naviEntry.refererNaviEntry).to.equal(refererNaviEntryFixture);
        done();
      })
    });
    it('should yield error if response length is 0', function (done) {
      var mongoResponse = [];
      mongo._fetchNaviEntryHandleCacheOrMongo(true, null, mongoResponse, elasticUrl,
      function (err, naviEntry) {
        expect(err.message).to.equal('internal server error');
        expect(naviEntry).to.be.undefined();
        sinon.assert.notCalled(mongo._cacheResults);
        done();
      })
    });
  });
});
