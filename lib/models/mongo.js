/**
 * @module lib/models/mongo
 */
'use strict';

var ErrorCat = require('error-cat');
var assign = require('101/assign');
var clone = require('101/clone');
var find = require('101/find');
var hasProps = require('101/has-properties');
var isFunction = require('101/is-function');
var keypather = require('keypather')();
var mongoClient = require('mongodb').MongoClient;
var put = require('101/put');

var cache = require('cache');
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

  var self = this;

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

  // Fetch cached data if exists
  var cachedData = this._getCachedResults(elasticUrl, refererUrl);
  logData.cachedData = cachedData;
  if (cachedData) {
    log.trace(logData, 'fetchNaviEntry cachedData');
    // Arguments: {Boolean} shouldCacheResults, {Object} err, {Array} <NaviEntry>, cb
    this._fetchNaviEntryHandleCacheOrMongo(false, null, cachedData, elasticUrl, cb);
  } else {
    log.trace(logData, 'fetchNaviEntry !cachedData');
    this._naviEntriesCollection.find(query).toArray(function (err, response) {
      self._fetchNaviEntryHandleCacheOrMongo.call(self, true, err, response, elasticUrl, cb);
    });
  }
};

/**
 * Merge refererNaviEntry onto requestUrl NaviEntry document if present.
 * Invoked either asynchronously as mongo callback or synchronously with cached data
 * @param {Boolean} shouldCacheResults
 * @param {Object} err
 * @param {Object} response
 * @param {String} elasticUrl
 * @param {Function} cb
 * @return undefined
 */
Mongo.prototype._fetchNaviEntryHandleCacheOrMongo =
function (shouldCacheResults, err, response, elasticUrl, cb) {
  var logData = {
    tx: true
  };
  log.info(logData, 'Mongo.prototype._fetchNaviEntryHandleCacheOrMongo');

  if (err) {
    log.error(put({
      err: err
    }, logData), '_fetchNaviEntryHandleCacheOrMongo error');
    return cb(err);
  }

  assign(logData, {
    mongoResponse: response
  });
  log.trace(logData, '_fetchNaviEntryHandleCacheOrMongo success');

  var naviEntry;
  if (response.length === 1) {
    log.trace(logData, '_fetchNaviEntryHandleCacheOrMongo response length 1');
    naviEntry = response[0];
  } else if (response.length === 2) {
    log.trace(logData, '_fetchNaviEntryHandleCacheOrMongo response length 2');
    if (response[0].elasticUrl === elasticUrl) {
      naviEntry = response[0];
      naviEntry.refererNaviEntry = response[1];
    } else {
      naviEntry = response[1];
      naviEntry.refererNaviEntry = response[0];
    }
  } else {
    log.error(logData, '_fetchNaviEntryHandleCacheOrMongo response invalid length');
    return cb(ErrorCat.create(500, 'internal server error'));
  }

  if (shouldCacheResults) {
    log.trace(logData, '_fetchNaviEntryHandleCacheOrMongo cache')
    this._cacheResults(naviEntry);
  }

  cb(null, naviEntry);
};

/**
 * Check LRU cache if all required NaviEntry documents for a given request are cached
 * @param {String} elasticUrl
 * @param {String|Undefined} refererUrl
 * @return undefined || Array<Object>
 */
Mongo.prototype._getCachedResults = function (elasticUrl, refererUrl) {
  var logData = {
    tx: true,
    elasticUrl: elasticUrl,
    refererUrl: refererUrl
  };
  log.info(logData, 'Mongo.prototype._getCacheResults');
  if (!process.env.ENABLE_LRU_CACHE) {
    log.trace(logData, '_getCacheResults !ENABLE_LRU_CACHE');
    return;
  }
  var elasticUrlCache = cache.get(elasticUrl);
  var refererUrlCache = cache.get(refererUrl);
  if (refererUrl) {
    // check if we have the elastic AND the referer cached
    if (elasticUrlCache && refererUrlCache) {
      return [elasticUrlCache, refererUrlCache];
    }
  } else {
    // no referer, just check if we have the elastic cached
    if (elasticUrlCache) {
      return [elasticUrlCache];
    }
  }
};

/**
 * Cache elasticUrl and referer-elasticUrl navi documents
 * @param {Object} naviEntry
 * @return undefined
 */
Mongo.prototype._cacheResults = function (naviEntry) {
  var logData = {
    tx: true
  };
  log.info(logData, '_cacheResults');
  if(!process.env.ENABLE_LRU_CACHE) {
    // Don't fill up LRU cache if we're not using it
    log.trace(logData, '_cacheResults !ENABLE_LRU_CACHE');
    return;
  }
  if (naviEntry.refererNaviEntry) {
    var copyRefererNaviEntry = clone(naviEntry.refererNaviEntry);
    cache.set(naviEntry.refererNaviEntry.elasticUrl, copyRefererNaviEntry);

    var copyNaviEntry = clone(naviEntry);
    delete copyNaviEntry.refererNaviEntry; // Don't cache w/ attached refererNaviEntry
    cache.set(naviEntry.elasticUrl, copyNaviEntry);

  } else {
    cache.set(naviEntry.elasticUrl, clone(naviEntry));
  }
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
 * Find nested directUrl object and its key (shortHash on a naviEntry document that is a masterPod
 * branch
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
      return {
        directUrlShortHash: shortHashes[i],
        directUrlObj: directUrlObj
      };
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
