/**
 * @module test/unit/mongo
 */
'use strict';

require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;
var keypather = require('keypather')();
var mongodb = require('mongodb');
var put = require('101/put');
var sinon = require('sinon');

var mongo = require('models/mongo');
var naviEntryFixtures = require('../fixture/navi-entries');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
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

  describe('Mongo.prototype.fetchNaviEntry', function () {
    it('should callback mongo error', function (done) {
      keypather.set(mongo, '_naviEntriesCollection.find', sinon.spy(function () {
        return {
          toArray: function (cb) {
            cb(new Error('mongo error'));
          }
        };
      }));
      mongo.fetchNaviEntry('api-staging-codenow.runnableapp.com', null, function (err) {
        expect(mongo._naviEntriesCollection.find.callCount).to.equal(1);
        expect(err.message).to.equal('mongo error');
        done();
      });
    });

    it('should fetch one navientries document if !refererUrl', function (done) {
      var naviEntriesDocument = {};
      var elasticUrl = 'api-staging-codenow.runnableapp.com';
      keypather.set(mongo, '_naviEntriesCollection.find', sinon.spy(function (query) {
        expect(query).to.deep.equal({
          elasticUrl: elasticUrl
        });
        return {
          toArray: function (cb) {
            cb(null, [naviEntriesDocument]);
          }
        };
      }));
      mongo.fetchNaviEntry(elasticUrl, null, function (err, response) {
        expect(mongo._naviEntriesCollection.find.callCount).to.equal(1);
        expect(response).to.equal(naviEntriesDocument);
        expect(err).to.be.null();
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
      keypather.set(mongo, '_naviEntriesCollection.find', sinon.spy(function (query) {
        expect(query).to.deep.equal({
          $or: [{
            elasticUrl: elasticUrl
          }, {
            elasticUrl: refererUrl
          }]
        });
        return {
          toArray: function (cb) {
            cb(null, [naviEntriesDocument, naviEntriesDocumentReferer]);
          }
        };
      }));
      mongo.fetchNaviEntry(elasticUrl, refererUrl, function (err, response) {
        expect(mongo._naviEntriesCollection.find.callCount).to.equal(1);
        expect(response).to.equal(naviEntriesDocument);
        expect(response.refererNaviEntry).to.equal(naviEntriesDocumentReferer);
        expect(err).to.be.null();
        delete mongo._naviEntriesCollection;
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
      keypather.set(mongo, '_naviEntriesCollection.find', sinon.spy(function (query) {
        expect(query).to.deep.equal({
          $or: [{
            elasticUrl: elasticUrl
          }, {
            elasticUrl: refererUrl
          }]
        });
        return {
          toArray: function (cb) {
            cb(null, [naviEntriesDocument, naviEntriesDocumentReferer].reverse());
          }
        };
      }));
      mongo.fetchNaviEntry(elasticUrl, refererUrl, function (err, response) {
        expect(mongo._naviEntriesCollection.find.callCount).to.equal(1);
        expect(response).to.equal(naviEntriesDocument);
        expect(response.refererNaviEntry).to.equal(naviEntriesDocumentReferer);
        expect(err).to.be.null();
        delete mongo._naviEntriesCollection;
        done();
      });
    });

    it('should callback with error if no navientries found', function (done) {
      var elasticUrl = 'api-staging-codenow.runnableapp.com';
      var refererUrl = 'frontend-staging-codenow.runnableapp.com';
      keypather.set(mongo, '_naviEntriesCollection.find', sinon.spy(function (query) {
        expect(query).to.deep.equal({
          $or: [{
            elasticUrl: elasticUrl
          }, {
            elasticUrl: refererUrl
          }]
        });
        return {
          toArray: function (cb) {
            cb(null, []);
          }
        };
      }));
      mongo.fetchNaviEntry(elasticUrl, refererUrl, function (err) {
        expect(err.message).to.equal('internal server error');
        delete mongo._naviEntriesCollection;
        done();
      });
    });
  });

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
});
