/**
 * @module lib/models/mongo
 */
'use strict';

const RouteError = require('error-cat/errors/route-error');
const assign = require('101/assign');
const clone = require('101/clone');
const find = require('101/find');
const hasProps = require('101/has-properties');
const isFunction = require('101/is-function');
const keypather = require('keypather')();
const mongoClient = require('mongodb').MongoClient;
const monitor = require('monitor-dog')
const put = require('101/put');

const cache = require('cache');
const logger = require('middlewares/logger')(__filename).log;
const resolveUrls = require('middlewares/resolve-urls');

function Mongo () {
  this._mongoClient = mongoClient;
  this._db = null;
  this._naviEntriesCollection = null;
}

Mongo.prototype.start = function (cb) {
  let log = logger.child({
    method: 'start'
  });
  log.info('called');
  this._mongoClient.connect(process.env.MONGO, (err, db) => {
    if (err) {
      log.error({
        err: err,
        url: process.env.MONGODB_URL
      }, 'connect error');
      return cb(err);
    }
    log.trace('connect success');
    this._db = db;
    this._naviEntriesCollection = db.collection('navientries');
    cb();
  });
};

Mongo.prototype.stop = function (cb) {
  let log = logger.child({
    method: 'stop'
  });
  log.info('called');
  if (!isFunction(keypather.get(this._db, 'close'))) {
    log.warn('!this.db');
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
  let log = logger.child({
    elasticUrl: elasticOrDirectUrl,
    refererUrl,
    method: 'fetchNaviEntry'
  });
  log.info('called');

  const query = {
    $and: []
  };
  const elasticSplit = resolveUrls.splitDirectUrlIntoShortHashAndElastic(elasticOrDirectUrl);
  function makeDirectUrlQuery (splitModel) {
    const elasticQuery = {
      elasticUrl: splitModel.elasticUrl
    };
    elasticQuery['directUrls.' + splitModel.shortHash] = { '$exists': true };
    return elasticQuery;
  }
  const elasticQuery = makeDirectUrlQuery(elasticSplit);
  const urlQuery = {
    $or: [ { elasticUrl: elasticOrDirectUrl } ]
  };
  if (elasticSplit.shortHash !== '') {
    // If the shorthash isn't empty, it's a directUrl
    urlQuery.$or.push(elasticQuery)
  }
  query.$and.push(urlQuery);
  if (refererUrl) {
    const refererSplit = resolveUrls.splitDirectUrlIntoShortHashAndElastic(refererUrl);
    const refererQuery = makeDirectUrlQuery(refererSplit);

    urlQuery.$or.push({
      elasticUrl: refererUrl
    });

    if (refererSplit.shortHash !== '') {
      urlQuery.$or.push(refererQuery)
    }
  }
  log = log.child({
    query
  });
  log.trace('query');

  // Fetch cached data if exists
  const cachedData = this._getCachedResults(elasticOrDirectUrl, refererUrl);
  log = log.child({
    cachedData
  });
  if (cachedData) {
    log.trace( 'cachedData');
    monitor.increment('navi.cache.hit');
    // Arguments: {Boolean} shouldCacheResults, {Object} err, {Array} <NaviEntry>, cb
    this._fetchNaviEntryHandleCacheOrMongo(false, null, cachedData, elasticOrDirectUrl, cb);
  } else {
    log.trace( '!cachedData');
    monitor.increment('navi.cache.miss');
    this._naviEntriesCollection.find(query).toArray((err, response) => {
      this._fetchNaviEntryHandleCacheOrMongo.call(this, true, err, response, elasticOrDirectUrl, cb);
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
  let log = logger.child({
    method: '_fetchNaviEntryHandleCacheOrMongo'
  });
  if (err) {
    log.error({
      err
    }, 'error')
    return cb(err);
  }
  log = log.child({
    id: response._id,
    elasticUrl: response.elasticUrl,
    ipWhitelist: response.ipWhitelist,
    ownerUsername: response.ownerUsername,
    ownerGithubId: response.ownerGithubId
  });

  let naviEntry;
  if (response.length === 1) {
    /**
     * response[0] is a naviEntry document for a requestUrl
     */
    log.trace('response length 1');
    naviEntry = response[0];
  } else if (response.length === 2) {
    /**
     * naviEntry documents found for requestUrl and refererUrl. Order not guaranteed, following
     * test determines which `response` array member is requestUrl & refererUrl.
     */
    log.trace('response length 2');
    if (response[0].elasticUrl === elasticUrl) {
      naviEntry = response[0];
      naviEntry.refererNaviEntry = response[1];
    } else {
      naviEntry = response[1];
      naviEntry.refererNaviEntry = response[0];
    }
  } else {
    log.error('response invalid length');
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
  let log = logger.child({
    elasticUrl,
    refererUrl,
    cacheKeys: cache.keys(),
    method: '_getCachedResults'
  });
  log.info('called');
  if (!process.env.ENABLE_LRU_CACHE) {
    log.trace('!ENABLE_LRU_CACHE');
    return;
  }
  const elasticUrlCache = cache.get(elasticUrl);
  const refererUrlCache = cache.get(refererUrl);

  log.trace({
    elasticUrlCache,
    refererUrlCache
  }, 'cached results');

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
  let log = logger.child({
    naviEntry,
    method: '_cacheResults'
  });
  log.info('called');
  if(!process.env.ENABLE_LRU_CACHE) {
    // Don't fill up LRU cache if we're not using it
    return;
  }
  if (naviEntry.refererNaviEntry) {
    const copyRefererNaviEntry = clone(naviEntry.refererNaviEntry);
    cache.set(naviEntry.refererNaviEntry.elasticUrl, copyRefererNaviEntry);
  }
  const copyNaviEntry = clone(naviEntry);
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
  const updateObj = {$set:{}};
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
  let log = logger.child({
    method: 'findMasterPodBranch',
    naviEntry
  })
  log.info('called');
  const shortHashes = Object.keys(naviEntry.directUrls);
  for (let i = 0, len = shortHashes.length; i < len; i++) {
    const directUrlObj = naviEntry.directUrls[shortHashes[i]];
    if (directUrlObj.masterPod) {
      return {
        directUrlShortHash: shortHashes[i],
        directUrlObj: directUrlObj
      };
    }
  }
  log.warn('!match');
};

/**
 * Search array for object mapping with matching elasticUrl
 * @param {Array<Object>} associations
 * @param {String} elasticUrl
 * @return {String | undefined}
 */
Mongo.findAssociationShortHashByElasticUrl = function (associations, elasticUrl) {
  const foundAssociation = find(associations, hasProps({ elasticUrl: elasticUrl }));
  if (foundAssociation) { return foundAssociation.isolatedMastersShortHash || foundAssociation.shortHash; }
};

module.exports = new Mongo();
