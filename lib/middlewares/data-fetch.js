/**
 * @module lib/middlewares/data-fetch
 */
'use strict';

var isEmpty = require('101/is-empty');
var keypather = require('keypather')();
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
    method: 'middlewares',
  });
  req.isHttps = keypather.get(req, 'headers.x-forwarded-proto') === 'https';
  // must be after isHttps is added to req
  req.reqUrl = api.getUrlFromRequest(req);
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

  log.trace({
    parsedRefererUrl: req.parsedRefererUrl,
    refererUrlHostname: req.refererUrlHostname,
    reqUrl: req.reqUrl,
    parsedReqUrl: req.parsedReqUrl,
    refererUrl: req.refererUrl,
    isHttps: req.isHttps
  }, 'parsed');

  module.exports.getMongoEntry(req, function (err) {
    if (err) {
      return next(err);
    }
    var naviEntry = req.naviEntry;
    var directModel = getDirectUrlModelFromNaviEntry(naviEntry, req.shortHash);
    // if https and entry does not exist, try port 80
    if (req.isHttps && directModel && !directModel.ports.contains(req.parsedReqUrl.port) && directModel.ports.contains(80)) {
      req.reqUrl = 'http://' + req.parsedReqUrl.hostname + ':80';
      req.parsedReqUrl = url.parse(req.reqUrl);
    }
    return next()
  });
};

function getDirectUrlModelFromNaviEntry (naviEntry, shortHash) {
  if (!shortHash) {
    return naviEntry.directUrls[Object.keys(naviEntry.directUrls).find(function (key) {
      return naviEntry.directUrls[ key ].masterPod;
    })]
  }
  return naviEntry.directUrls[ shortHash ]
}

module.exports.getMongoEntry = function (req, next) {
  var log = logger.child({
    tx: true,
    req: req,
    reqUrl: req.reqUrl,
    parsedReqUrl: req.parsedReqUrl,
    method: 'getMongoEntry'
  });

  var givenUrl = req.parsedReqUrl.hostname; // could still be a direct.  FetchNaviEntry will figure it out

  mongo.fetchNaviEntry(givenUrl, req.refererUrlHostname, function (err, naviEntry) {
    if (err) {
      log.error({ err: err }, 'mongo.fetchNaviEntry error');
    } else if (naviEntry) {
      req.naviEntry = naviEntry;
      // if the givenUrl we've been given matches the elasticUrl of the naviEntry, then we obviously
      // have an elastic
      req.isElastic = (naviEntry.elasticUrl === givenUrl);
      req.elasticUrl = naviEntry.elasticUrl;
      if (!req.isElastic) {
        var split = resolveUrls.splitDirectUrlIntoShortHashAndElastic(givenUrl);
        req.shortHash = split.shortHash;
      }

      log.trace({ shortHash: req.shortHash, givenUrl: givenUrl, isElastic: req.isElastic, naviEntry: naviEntry }, 'getMongoEntry');
    }
    return next(err);
  });
};
