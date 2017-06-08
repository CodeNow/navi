/**
 * @module lib/models/mongo
 */
'use strict';

const RouteError = require('error-cat/errors/route-error');
var assign = require('101/assign');
var clone = require('101/clone');
var find = require('101/find');
var hasProps = require('101/has-properties');
var isFunction = require('101/is-function');
var keypather = require('keypather')();
var mongoClient = require('mongodb').MongoClient;
var monitor = require('monitor-dog')
var put = require('101/put');

var cache = require('cache');
var log = require('middlewares/logger')(__filename).log;
var resolveUrls = require('middlewares/resolve-urls');

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
 *
 * @param {String} elasticOrDirectUrl - the url from the request. At this point, we don't know if it's an elastic or
 *                                        direct url
 * @param {Function} cb
 */
Mongo.prototype.fetchNaviEntry = function (elasticOrDirectUrl, refererUrl, cb) {
  var logData = {
    tx: true,
    elasticUrl: elasticOrDirectUrl,
    refererUrl: refererUrl
  };
  log.info(logData, 'Mongo.prototype.fetchNaviEntry');

  var self = this;

  var query = {
    $and: []
  };
  var elasticSplit = resolveUrls.splitDirectUrlIntoShortHashAndElastic(elasticOrDirectUrl);
  function makeDirectUrlQuery (splitModel) {
    var elasticQuery = {
      elasticUrl: splitModel.elasticUrl
    };
    elasticQuery['directUrls.' + splitModel.shortHash] = { '$exists': true };
    return elasticQuery;
  }
  var elasticQuery = makeDirectUrlQuery(elasticSplit);
  var urlQuery = {
    $or: [ { elasticUrl: elasticOrDirectUrl } ]
  };
  if (elasticSplit.shortHash !== '') {
    // If the shorthash isn't empty, it's a directUrl
    urlQuery.$or.push(elasticQuery)
  }
  query.$and.push(urlQuery);
  if (refererUrl) {
    var refererSplit = resolveUrls.splitDirectUrlIntoShortHashAndElastic(refererUrl);
    var refererQuery = makeDirectUrlQuery(refererSplit);

    urlQuery.$or.push({
      elasticUrl: refererUrl
    });

    if (refererSplit.shortHash !== '') {
      urlQuery.$or.push(refererQuery)
    }
  }

  assign(logData, {
    query: query
  });
  log.trace(logData, 'fetchNaviEntry query');

  // Fetch cached data if exists
  var cachedData = this._getCachedResults(elasticOrDirectUrl, refererUrl);
  logData.cachedData = cachedData;
  if (cachedData) {
    log.trace(logData, 'fetchNaviEntry cachedData');
    monitor.increment('navi.cache.hit');
    // Arguments: {Boolean} shouldCacheResults, {Object} err, {Array} <NaviEntry>, cb
    this._fetchNaviEntryHandleCacheOrMongo(false, null, cachedData, elasticOrDirectUrl, cb);
  } else {
    log.trace(logData, 'fetchNaviEntry !cachedData');
    monitor.increment('navi.cache.miss');
    this._naviEntriesCollection.find(query).toArray(function (err, response) {
      self._fetchNaviEntryHandleCacheOrMongo.call(self, true, err, response, elasticOrDirectUrl, cb);
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
Mongo.prototype._fetchNaviEntryHandleCacheOrMongo = function (shouldCacheResults, err, response, elasticUrl, cb) {
  if (err) {
    log.error({
      err
    }, '_fetchNaviEntryHandleCacheOrMongo error');
    return cb(err);
  }
  const logData = {
    tx: true,
    id: response._id,
    elasticUrl: response.elasticUrl,
    ipWhitelist: response.ipWhitelist,
    ownerUsername: response.ownerUsername,
    ownerGithubId: response.ownerGithubId
  };

  var naviEntry;
  if (response.length === 1) {
    /**
     * response[0] is a naviEntry document for a requestUrl
     */
    log.trace(logData, '_fetchNaviEntryHandleCacheOrMongo response length 1');
    naviEntry = response[0];
  } else if (response.length === 2) {
    /**
     * naviEntry documents found for requestUrl and refererUrl. Order not guaranteed, following
     * test determines which `response` array member is requestUrl & refererUrl.
     */
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
    return cb(new RouteError('Not Found', 404));
  }

  if (shouldCacheResults) {
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
    refererUrl: refererUrl,
    cacheKeys: cache.keys()
  };
  log.info(logData, 'Mongo.prototype._getCachedResults');
  if (!process.env.ENABLE_LRU_CACHE) {
    log.trace(logData, '_getCachedResults !ENABLE_LRU_CACHE');
    return;
  }
  var elasticUrlCache = cache.get(elasticUrl);
  var refererUrlCache = cache.get(refererUrl);
  logData.elasticUrlCache = elasticUrlCache
  logData.refererUrlCache = refererUrlCache

  if (elasticUrlCache) {
    log.trace(logData, '_getCachedResults elasticUrlCache')
  } else {
    log.trace(logData, '_getCachedResults !elasticUrlCache')
  }

  if (refererUrlCache) {
    log.trace(logData, '_getCachedResults refererUrlCache')
  } else {
    log.trace(logData, '_getCachedResults !refererUrlCache')
  }

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
 * @param {Object} naviEntry - base object contains naviEntry mongodb document with masterPod and
 *   fork instance hosts&ports. If `refererNaviEntry` key present, value will be a nested naviEntry
 *   document representing the refererUrl
 * @return undefined
 */
Mongo.prototype._cacheResults = function (naviEntry) {
  var logData = {
    tx: true,
    naviEntry
  };
  log.info(logData, '_cacheResults');
  if(!process.env.ENABLE_LRU_CACHE) {
    // Don't fill up LRU cache if we're not using it
    return;
  }
  if (naviEntry.refererNaviEntry) {
    var copyRefererNaviEntry = clone(naviEntry.refererNaviEntry);
    cache.set(naviEntry.refererNaviEntry.elasticUrl, copyRefererNaviEntry);
  }
  var copyNaviEntry = clone(naviEntry);
  delete copyNaviEntry.refererNaviEntry; // Don't cache w/ attached refererNaviEntry
  cache.set(naviEntry.elasticUrl, copyNaviEntry);
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
    naviEntry
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
  if (foundAssociation) { return foundAssociation.isolatedMastersShortHash || foundAssociation.shortHash; }
};

module.exports = new Mongo();
