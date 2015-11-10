/**
 * @module lib/models/mongo
 */
'use strict';

var ErrorCat = require('error-cat');
var assign = require('101/assign');
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
  this._naviEntriesCollection.find(query, function (err, response) {
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
      log.trace('fetchNaviEntry length 1');
      naviEntry = response[0];
    } else if (response.length === 2) {
      log.trace('fetchNaviEntry length 2');
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
 * Find nested directUrl object on a naviEntry document that correlates to a specified branch
 * @param {String} branchName
 * @param {Object} naviEntry
 * @return Object
 */
Mongo.findBranch = function (branchName, naviEntry) {
  var logData = {
    tx: true,
    branchName: branchName,
    naviEntry: naviEntry.toJSON()
  };
  log.info(logData, 'Mongo.findBranch');
  var shortHashes = Object.keys(naviEntry.directUrls);
  for (var i = 0, len = shortHashes.length; i < len; i++) {
    var directUrlObj = naviEntry.directUrls[shortHashes[i]];
    if (directUrlObj.branch === branchName) {
      return directUrlObj;
    }
  }
  log.warn(logData, 'findBranch !match');
  return null;
};

module.exports = new Mongo();
