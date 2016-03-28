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

module.exports.middleware = function (req, res, next) {
  var reqUrl = api._getUrlFromRequest(req);
  var parsedReqUrl = url.parse(reqUrl);

  var parsedRefererUrl;
  var refererUrl = req.headers.origin || req.headers.referer;
  var refererUrlHostname;

  if (refererUrl) {
    parsedRefererUrl = url.parse(refererUrl);
    refererUrlHostname = parsedRefererUrl.hostname;
  }

  if (refererUrlHostname === parsedReqUrl.hostname) {
    log.trace(logData, 'data-fetch refererUrlHostanme === parsedReqUrl.hostname');
    // referer is self, ignore it
    refererUrlHostname = undefined;
    refererUrl = undefined;
  }

  /**
   * Hipache sits in front of navi. Hipache uses these redis keys to route requests to navi.
   */
  var redisKey = [
    'frontend:',
    parsedReqUrl.port,
    '.',
    parsedReqUrl.hostname
  ].join('');

  var logData = {
    tx: true,
    req: req,
    parsedRefererUrl: parsedRefererUrl,
    refererUrlHostname: refererUrlHostname,
    reqUrl: reqUrl,
    parsedReqUrl: parsedReqUrl,
    refererUrl: refererUrl,
    redisKey: redisKey
  };
  log.info(logData, 'middlewares/data-fetch');

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
    var elasticUrl = parsedReqUrl.hostname;
    if (req.hipacheEntry.direct) {
      var split = elasticUrl.split('-');
      var shortHash = split.shift();
      elasticUrl = split.join('-');
      log.trace(put({ shortHash: shortHash }, logData), 'data-fetch: direct url')
    }

    log.trace(put({
      hipacheEntry: req.hipacheEntry,
      elasticUrl: elasticUrl
    }, logData), 'data-fetch: hipacheEntry');
    mongo.fetchNaviEntry(elasticUrl, refererUrlHostname, function (err, naviEntry) {
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
