/**
 * @module lib/models/mongo
 */
'use strict';

var ErrorCat = require('error-cat');
var assign = require('101/assign');
var find = require('101/find');
var hasProps = require('101/has-properties');
var isFunction = require('101/is-function');
var keypather = require('keypather')();
var mongoClient = require('mongodb').MongoClient;
var put = require('101/put');

var log = require('middlewares/logger')(__filename).log;

function Mongo () {
  this._mongoClient = mongoClient;
  this._db = null;
  this._naviEntriesCollection = null;
}

Mongo.prototype.start = function (cb) {
  log.info('Mongo.prototype.start');
  var self = this;
  this._mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) {
      log.error({
        err: err,
        url: process.env.MONGODB_URL
      }, 'start mongoClient connect error');
      return cb(err);
    }
    log.trace('start mongoClient connect success');
    self._db = db;
    self._naviEntriesCollection = db.collection('navientries');
    cb();
  });
};

Mongo.prototype.stop = function (cb) {
  log.info('Mongo.prototype.stop');
  if (!isFunction(keypather.get(this._db, 'close'))) {
    log.warn('mongo stop !this.db');
    return cb();
  }
  this._db.close(cb);
};

/**
 * Fetch navi entry document from database for a given elastic url
 * @param {String} elasticUrl
 * @param {Function} cb
 */
Mongo.prototype.fetchNaviEntry = function (elasticUrl, refererUrl, cb) {
  var logData = {
    tx: true,
    elasticUrl: elasticUrl,
    refererUrl: refererUrl
  };
  log.info(logData, 'Mongo.prototype.fetchNaviEntry');
  var query = {};
  if (refererUrl) {
    query.$or = [{
      elasticUrl: elasticUrl
    }, {
      elasticUrl: refererUrl
    }];
  } else {
    query.elasticUrl = elasticUrl;
  }
  assign(logData, {
    query: query
  });
  log.trace(logData, 'fetchNaviEntry query');
  this._naviEntriesCollection.find(query).toArray(function (err, response) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'fetchNaviEntry mongo error');
      return cb(err);
    }
    assign(logData, {
      response: response
    });
    log.trace(logData, 'fetchNaviEntry mongo success');

    var naviEntry;
    if (response.length === 1) {
      log.trace(logData, 'fetchNaviEntry length 1');
      naviEntry = response[0];
    } else if (response.length === 2) {
      log.trace(logData, 'fetchNaviEntry length 2');
      if (response[0].elasticUrl === elasticUrl) {
        naviEntry = response[0];
        naviEntry.refererNaviEntry = response[1];
      } else {
        naviEntry = response[1];
        naviEntry.refererNaviEntry = response[0];
      }
    } else {
      log.error(logData, 'fetchNaviEntry invalid length');
      return cb(ErrorCat.create(500, 'internal server error'));
    }
    cb(null, naviEntry);
  });
};

/**
 * Set a user mapping on an instance
 * @param {String} elasticUrl
 * @param {String} userId
 * @param {String} instanceShortHash
 * @param {Function} cb
 */
Mongo.prototype.setUserMapping = function (elasticUrl, userId, instanceShortHash, cb) {
  var updateObj = {$set:{}};
  updateObj.$set['userMappings.'+userId] = instanceShortHash;
  this._naviEntriesCollection.update({
    elasticUrl: elasticUrl
  }, updateObj, cb);
};

/**
 * Find nested directUrl object on a naviEntry document that is a masterPod branch
 * @param {String} branchName
 * @return {Object|undefined}
 */
Mongo.findMasterPodBranch = function (naviEntry) {
  var logData = {
    tx: true,
    naviEntry: naviEntry
  };
  log.info(logData, 'Mongo.findMasterPodBranch');
  var shortHashes = Object.keys(naviEntry.directUrls);
  for (var i = 0, len = shortHashes.length; i < len; i++) {
    var directUrlObj = naviEntry.directUrls[shortHashes[i]];
    if (directUrlObj.masterPod) {
      return directUrlObj;
    }
  }
  log.warn(logData, 'findMasterPodBranch !match');
};

/**
 * Search array for object mapping with matching elasticUrl
 * @param {Array<Object>} associations
 * @param {String} elasticUrl
 * @return {String | undefined}
 */
Mongo.findAssociationShortHashByElasticUrl = function (associations, elasticUrl) {
  var foundAssociation = find(associations, hasProps({ elasticUrl: elasticUrl }));
  if (foundAssociation) { return foundAssociation.shortHash; }
};

module.exports = new Mongo();
