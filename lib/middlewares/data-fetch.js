/**
 * @module lib/middlewares/data-fetch
 */
'use strict';

var url = require('url');

var api = require('models/api');
var logger = require('middlewares/logger')(__filename).log;
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
  var log = logger.child({
    tx: true,
    req: req,
    method: 'middlewares/data-fetch',
  });
  req.reqUrl = api._getUrlFromRequest(req);
  req.parsedReqUrl = url.parse(req.reqUrl);

  req.refererUrl = req.headers.origin || req.headers.referer;

  if (req.refererUrl) {
    req.parsedRefererUrl = url.parse(req.refererUrl);
    req.refererUrlHostname = req.parsedRefererUrl.hostname;
  }

  if (req.refererUrlHostname === req.parsedReqUrl.hostname) {
    log.trace('refererUrlHostanme === parsedReqUrl.hostname');
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

  log.trace({
    parsedRefererUrl: req.parsedRefererUrl,
    refererUrlHostname: req.refererUrlHostname,
    reqUrl: req.reqUrl,
    parsedReqUrl: req.parsedReqUrl,
    refererUrl: req.refererUrl,
    redisKey: redisKey
  }, 'parsed');

  /**
   * Sample expected data:
   *
   * "{\"shortHash\":\"1mlnxe\",\"exposedPort\":[\"8000\"],\"branch\":\"b\",\"instanceName\":\"b-node-hello-world\",\"ownerUsername\":\"Myztiq\",\"ownerGithub\":495765,\"userContentDomain\":\"runnablecloud.com\",\"masterPod\":false,\"direct\":true}"
   */
  redis.lrange(redisKey, 0, 1, function (err, rawHipacheEntry) {
    if (err) {
      log.error({ err: err }, 'data-fetch redis.lrange error');
      return next(err);
    }
    try {
      req.hipacheEntry = JSON.parse(rawHipacheEntry[0]);
    } catch (err) {
      log.error({ err: err, rawHipacheEntry: rawHipacheEntry }, 'json parse error');
      return next(err);
    }
    var elasticUrl = req.parsedReqUrl.hostname;
    if (req.hipacheEntry.direct) {
      var split = resolveUrls.splitDirectUrlIntoShortHashAndElastic(elasticUrl);
      var shortHash = split.shortHash;
      elasticUrl = split.elasticUrl;
      log.trace({ shortHash: shortHash }, 'direct url');
    }

    log.trace({ hipacheEntry: req.hipacheEntry, elasticUrl: elasticUrl }, 'hipacheEntry');
    mongo.fetchNaviEntry(elasticUrl, req.refererUrlHostname, function (err, naviEntry) {
      if (err) {
        log.error({ err: err }, 'mongo.fetchNaviEntry error');
        return next(err);
      }
      req.naviEntry = naviEntry;
      log.trace({ naviEntry: naviEntry }, 'naviEntry');
      return next();
    });
  });
};
