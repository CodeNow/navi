/**
 * @module lib/middlewares/data-fetch
 */
'use strict';

var put = require('101/put');
var url = require('url');

var api = require('models/api');
var log = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');
var redis = require('models/redis');
var resolveUrls = require('middlewares/resolve-urls');

/**
 * adds relevent data to the request
 * @param  {Object}   req  request
 * @param  {Object}   res  response
 * @param  {Function} next next middleware
 * data that is added to req:
 * @param  {String}   req.reqUrl             formated requested url
 * @param  {Object}   req.parsedReqUrl       parsed reqUrl
 * @param  {String}   req.refererUrl         normalized referer Url
 * @param  {Object}   req.parsedRefererUrl   parsed refererUrl
 * @param  {String}   req.refererUrlHostname referer hostname
 * @param  {Object}   req.hipacheEntry       hipache entry for reqUrl
 * @param  {Object}   req.naviEntry          navi entry for reqUrl
 */
module.exports.middleware = function (req, res, next) {
  var logData = {
    tx: true,
    req: req
  };
  log.info(logData, 'middlewares/data-fetch');
  req.reqUrl = api._getUrlFromRequest(req);
  req.parsedReqUrl = url.parse(req.reqUrl);

  req.refererUrl = req.headers.origin || req.headers.referer;

  if (req.refererUrl) {
    req.parsedRefererUrl = url.parse(req.refererUrl);
    req.refererUrlHostname = req.parsedRefererUrl.hostname;
  }

  if (req.refererUrlHostname === req.parsedReqUrl.hostname) {
    log.trace(logData, 'data-fetch refererUrlHostanme === parsedReqUrl.hostname');
    // referer is self, ignore it
    req.refererUrlHostname = undefined;
    req.refererUrl = undefined;
  }

  /**
   * Hipache sits in front of navi. Hipache uses these redis keys to route requests to navi.
   */
  var redisKey = [
    'frontend:',
    req.parsedReqUrl.port,
    '.',
    req.parsedReqUrl.hostname
  ].join('');

  log.trace(put({
    parsedRefererUrl: req.parsedRefererUrl,
    refererUrlHostname: req.refererUrlHostname,
    reqUrl: req.reqUrl,
    parsedReqUrl: req.parsedReqUrl,
    refererUrl: req.refererUrl,
    redisKey: redisKey
  }, logData), 'middlewares/data-fetch parsed');

  /**
   * Sample expected data:
   *
   * "{\"shortHash\":\"1mlnxe\",\"exposedPort\":[\"8000\"],\"branch\":\"b\",\"instanceName\":\"b-node-hello-world\",\"ownerUsername\":\"Myztiq\",\"ownerGithub\":495765,\"userContentDomain\":\"runnablecloud.com\",\"masterPod\":false,\"direct\":true}"
   */
  redis.lrange(redisKey, 0, 1, function (err, rawHipacheEntry) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'data-fetch redis.lrange error');
      return next(err);
    }
    try {
      req.hipacheEntry = JSON.parse(rawHipacheEntry[0]);
    } catch (err) {
      log.error(put({
        err: err,
        rawHipacheEntry: rawHipacheEntry
      }, logData), 'data-fetch: json parse error');
      return next(err);
    }
    var elasticUrl = req.parsedReqUrl.hostname;
    if (req.hipacheEntry.direct) {
      var split = resolveUrls.splitDirectUrlIntoShortHashAndElastic(elasticUrl);
      var shortHash = split.shortHash;
      elasticUrl = split.elasticUrl;
      log.trace(put({ shortHash: shortHash }, logData), 'data-fetch: direct url');
    }

    log.trace(put({
      hipacheEntry: req.hipacheEntry,
      elasticUrl: elasticUrl
    }, logData), 'data-fetch: hipacheEntry');
    mongo.fetchNaviEntry(elasticUrl, req.refererUrlHostname, function (err, naviEntry) {
      if (err) {
        log.error(put({
          err: err
        }, logData), 'data-fetch: mongo.fetchNaviEntry error');
        return next(err);
      }
      req.naviEntry = naviEntry;
      log.trace({ naviEntry: naviEntry }, 'data-fetch: naviEntry');
      return next();
    });
  });
};
