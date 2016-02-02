/**
 * Formerly communicated with API server to retrieve routing information. Now primarily retrieves
 * routing information from Redis and MongoDB.
 *
 * Redis fetch operations to be removed with userland-hipache
 *
 * @module lib/models/api
 */
'use strict';
require('loadenv.js');

var ErrorCat = require('error-cat');
var assign = require('101/assign');
var hasKeypaths = require('101/has-keypaths');
var keypather = require('keypather')();
var put = require('101/put');
var url = require('url');

var errorPage = require('models/error-page.js');
var log = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');
var redis = require('models/redis');
var whitelistedUsers = require('whitelisted-users');

module.exports = api;

/**
 * module used to make calls to runnable API as a specific user
 */
function api () {}

/**
 * Handle request if redis key does not indicate an authenticated user session
 */
api._handleUnauthenticated = function (req, res, next) {
  var reqUrl = api._getUrlFromRequest(req);
  var logData = {
    tx: true,
    req: req,
    reqUrl: reqUrl,
    session: req.session
  };
  // API session is unauthenticated
  log.info(logData, 'api._handleUnauthenticated');
  req.targetHost = errorPage.generateErrorUrl('signin', {
    redirectUrl: reqUrl
  });
  return next();
};

/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
api._getUrlFromRequest = function (req) {
  var host = req.headers.host;
  var split = host.split('.');
  var numSubDomains = 3;
  if (split.length > numSubDomains) {
    split.splice(0, split.length-numSubDomains);
  }
  host = split.join('.');
  var logData = {
    tx: true,
    req: req,
    host: host,
    split: split,
    numSubDomains: numSubDomains
  };
  log.info(logData, 'api._getUrlFromRequest');
  // append 80 if port not in url
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  // we only support https on port 443
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';
  log.info(put({
    returnVal: protocol + host
  }, logData), 'api._getUrlFromRequest final return');
  return protocol + host;
};

/**
 * Take information from req to navi and destination container to produce targetHost
 * @param {Object} req
 * @param {Object} targetNaviEntryInstance sub-document on naviEntry document of a specific instance
 * @return String in format of http(s)://DOCKER_HOST:MAPPED_PORT
 */
api._getDestinationProxyUrl = function (reqUrl, targetNaviEntryInstance) {
  // get port of req
  var parsedReqUrl = url.parse(reqUrl);
  // if invalid port mapping handle
  // Use incoming navi request port to find mapped container port of instance container
  var destinationPort = targetNaviEntryInstance.ports[parsedReqUrl.port];
  var destinationHost = targetNaviEntryInstance.dockerHost;
  return [parsedReqUrl.protocol, '//', destinationHost, ':', destinationPort].join('');
};

/**
 * Check if authentication should be bypassed
 * @param {Object} req
 * @return Boolean
 */
api._shouldBypassAuth = function (req) {
  var bypass = req.method.toLowerCase() === 'options' || !req.isBrowser;
  log.info({
    tx: true,
    method: req.method,
    isBrowser: req.isBrowser,
    bypass: bypass
  }, 'api._shouldBypassAuth');
  return bypass;
};

/**
 * Proxy request to detention if container is not running.
 * Proxy request to container is running
 * @param {Object} targetNaviEntryInstance
 * @param {String} shortHash
 * @param {String} reqUrl
 * @param {Object} req
 * @param {Function} next
 */
api._processTargetInstance = function (targetNaviEntryInstance, shortHash, reqUrl, req, next) {
  var logData = {
    tx: true,
    targetNaviEntryInstance: targetNaviEntryInstance,
    reqUrl: reqUrl,
    shortHash: shortHash
  };
  log.info(logData, 'api._processTargetInstance');

  if (!targetNaviEntryInstance) {
    log.error(logData, '_processTargetInstance !targetNaviEntryInstance');
    return next(ErrorCat.create(404, 'Not Found'));
  }

  // Adding these to req object to make values available in proxy module's error event handler.
  req.shortHash = shortHash;
  req.elasticUrl = reqUrl;

  // for error-page module if container is unresponsive
  req.targetBranch = targetNaviEntryInstance.branch;
  if (targetNaviEntryInstance.dockRemoved) {
    log.trace(logData, '_processTargetInstance dockRemoved');
    req.targetHost = errorPage.generateErrorUrl('dock_removed', {
      elasticUrl: reqUrl,
      shortHash: shortHash
    });
    return next();
  }

  if (!targetNaviEntryInstance.running) {
    log.trace(logData, '_processTargetInstance !running');
    req.targetHost = errorPage.generateErrorUrl('not_running', {
      elasticUrl: reqUrl,
      shortHash: shortHash
    });
    return next();
  }
  req.targetHost = api._getDestinationProxyUrl(reqUrl, targetNaviEntryInstance);
  log.trace(put({
    targetHost: req.targetHost
  }, logData), '_processTargetInstance req.targetHost');
  return next();
};

/**
 * Helper function to manage proxy target determination for elastic url requests
 * @param {Object} logData
 * @param {Object} req
 * @param {Function} next
 */
api._getTargetHostElastic = function (logData, req, next) {
  log.info(logData, 'api._getTargetHostElastic');

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
    log.trace(logData, '_getTargetHostElastic refererUrlHostanme === parsedReqUrl.hostname');
    // referer is self, ignore it
    refererUrlHostname = null;
    refererUrl = null;
  }

  mongo.fetchNaviEntry(parsedReqUrl.hostname, refererUrlHostname, function (err, naviEntry) {
    if (err) {
      log.error(put({
        err: err
      }, logData), '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry error');
      return next(err);
    }
    log.trace(logData, '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry success');
    var targetNaviEntryInstance;
    if (req.isBrowser) {
      log.trace(logData, '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry isBrowser');
      if (keypather.get(naviEntry, 'ipWhitelist.enabled')) {
        log.trace(logData, '_getTargetHostElastic ipWhitelist successful block');
        return next(ErrorCat.create(404, 'Not Found'));
      } else if (refererUrl && naviEntry.refererNaviEntry) {
        log.trace(logData,
                  '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry isBrowser refererUrl');
        return api._getTargetHostElasticReferer(logData, naviEntry, req, next);
      } else {
        // if no referer
          // proxy to user-mapped instance (or master if no user mapping)
        log.trace(logData,
                  '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry isBrowser !refererUrl');
        // document might not have a userMappings key yet
        var mappedInstanceShortHash = (naviEntry.userMappings) ?
          naviEntry.userMappings[req.session.userId] : null;
        if (!mappedInstanceShortHash) {
          log.trace(logData,
              '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry isBrowser !refererUrl '+
              '!mappedInstanceShortHash');
          // use master
          var findResult = mongo.constructor.findMasterPodBranch(naviEntry);
          targetNaviEntryInstance = findResult.directUrlObj;
          mappedInstanceShortHash = findResult.directUrlShortHash;
        } else {
          log.trace(put({
            mappedInstanceShortHash: mappedInstanceShortHash
          }, logData),
          '_getTargetHostElastic redis.lrange mongo.fetchNaviEntry isBrowser !refererUrl '+
          'mappedInstanceShortHash');
          targetNaviEntryInstance = naviEntry.directUrls[mappedInstanceShortHash];
        }
        return api._processTargetInstance(targetNaviEntryInstance, mappedInstanceShortHash,
                                          reqUrl, req, next);
      }
    } else {
      // if not browser, proxy to master
      log.trace(logData, 'getTargetHost redis.lrange mongo.fetchNaviEntry !isBrowser');
      var findResult = mongo.constructor.findMasterPodBranch(naviEntry);
      targetNaviEntryInstance = findResult.directUrlObj;
      return api._processTargetInstance(targetNaviEntryInstance,
                                        findResult.directUrlShortHash,
                                        reqUrl, req, next);
    }
  });
};

/**
 * Helper function for targetHost derivation of elastic url request to instance with a referer
 * header
 * @param {Object} logData
 */
api._getTargetHostElasticReferer = function (logData, naviEntry, req, next) {
  // if referer
    // proxy to association (or master if no association)
  log.info(logData, 'api._getTargetHostElasticReferer');

  var targetNaviEntryInstance;

  var reqUrl = api._getUrlFromRequest(req);
  var parsedReqUrl = url.parse(reqUrl);

  // example of determination of proxying for particular request
  // Ex: request to API from a frontend (frontend is referer)
  // 1. Grab both naviEntry documents, (requestUrl & refererUrl)
  // 2. Look at refererUrl naviEntry document (frontend), determine which frontend
  //    instance user is currently mapped to. (use master if user has no mapping)
  // 3. Look at associations of instance found in #2, see which fork of API instance the
  //    #2 instance is associated with. Find that API instance in the requestUrl naviEntry
  //    document and proxy to it. Use master if instance found in #2 doesn't have a
  //    defined association (system should not allow this state to occur)

  // 2.
  // document might not have a userMappings key yet
  var refererUserMappedInstanceId = (naviEntry.refererNaviEntry.userMappings) ?
    naviEntry.refererNaviEntry.userMappings[req.session.userId] : null;
  var refererNaviEntryInstance;

  if (refererUserMappedInstanceId) {
    refererNaviEntryInstance = naviEntry.refererNaviEntry.directUrls[refererUserMappedInstanceId];
    log.trace(put({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer redis.lrange mongo.fetchNaviEntry isBrowser '+
    'refererNaviEntryInstance');
  } else {
    // no user-mapping for current user and referer instance, use master
    var findResult = mongo.constructor.findMasterPodBranch(naviEntry.refererNaviEntry);
    refererNaviEntryInstance = keypather.get(findResult, 'directUrlObj');
    refererUserMappedInstanceId = keypather.get(findResult, 'directUrlShortHash');
    log.trace(put({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer redis.lrange mongo.fetchNaviEntry isBrowser '+
    '!refererNaviEntryInstance');
  }
  if (!refererNaviEntryInstance) {
    log.error(logData,
              '_getTargetHostElasticReferer redis.lrange mongo.fetchNaviEntry isBrowser '+
              '!refererNaviEntryInstance 404');
    return next(ErrorCat.create(404, 'Not Found'));
  }
  // 3.
  var instanceShortHash = mongo.constructor.findAssociationShortHashByElasticUrl(
    refererNaviEntryInstance.dependencies,
    parsedReqUrl.hostname);
  if (instanceShortHash) {
    log.trace(logData,
      'getTargetHost redis.lrange mongo.fetchNaviEntry isBrowser instanceShortHash');
    targetNaviEntryInstance = naviEntry.directUrls[instanceShortHash];
  } else {
    log.trace(logData,
      'getTargetHost redis.lrange mongo.fetchNaviEntry isBrowser !instanceShortHash');

    /**
     * Referer url is a valid runnable elasticUrl however there might be no defined DNS mappings.
     * Proxy to the masterPod instance if so.
     */
    //targetNaviEntryInstance = mongo.constructor.findMasterPodBranch(naviEntry);
    var findResult = mongo.constructor.findMasterPodBranch(naviEntry.refererNaviEntry);
    targetNaviEntryInstance = keypather.get(findResult, 'directUrlObj');
  }

  if (!targetNaviEntryInstance) {
    // instance that referer naviEntry document was associated with isn't present,
    // use master of requestUrl naviEntry masterPod instance
    log.trace(put({
      targetNaviEntryInstance: targetNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer redis.lrange mongo.fetchNaviEntry isBrowser !targetNaviEntryInstance '+
    'use master');

    var findResult = mongo.constructor.findMasterPodBranch(naviEntry);
    targetNaviEntryInstance = findResult.directUrlObj;
    return api._processTargetInstance(targetNaviEntryInstance,
                                      findResult.directUrlShortHash,
                                      reqUrl, req, next);

  }
  return api._processTargetInstance(targetNaviEntryInstance, instanceShortHash, reqUrl, req, next);
};

/**
 * Return true if instance was created by user or org of user.
 * Also return true if current user is on the whitelist
 * @param {Object} req
 * @param {Number} ownerGithub
 * @return Boolean
 */
api._isUserAuthorized = function (req, ownerGithub) {
  var reqGithubId = req.session.userId;
  var reqGithubOrgs = req.session.userGithubOrgs;
  var logData = {
    tx: true,
    reqGithubId: reqGithubId,
    reqGithubOrgs: reqGithubOrgs,
    whitelistedUsers: whitelistedUsers
  };
  log.info(logData, 'api._isUserAuthorized');
  if (~whitelistedUsers.indexOf(reqGithubId)) {
    log.trace(logData, '_isUserAuthorized whitelistedUser');
    return true;
  }
  return !!~reqGithubOrgs.indexOf(ownerGithub);
};

/**
 * Check value at API sessionID redis key to verify associated API session is authenticated
 * if not, redirect for authorization
 */
api.checkIfLoggedIn = function (req, res, next) {
  var logData = {
    tx: true,
    req: req,
    session: req.session
  };
  log.info(logData, 'api.checkIfLoggedIn');
  /**
   * Authentication check bypass
   */
  if (api._shouldBypassAuth(req)) {
    log.trace(put({
      method: req.method.toLowerCase(),
      isBrowser: req.isBrowser
    }, logData), 'checkIfLoggedIn bypass');
    return next();
  }
  if (!hasKeypaths(req.session, ['userId', 'apiSessionRedisKey', 'userGithubOrgs'])) {
    log.trace(logData, 'api.checkIfLoggedIn !req.session.apiSessionRedisKey');
    return api._handleUnauthenticated(req, res, next);
  }
  redis.get(req.session.apiSessionRedisKey, function (err, data) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'api.checkIfLoggedIn redis.get error');
      return next(err);
    }
    log.trace(put({
      data: data
    }, logData), 'api.checkIfLoggedIn redis.get success');
    try {
      data = JSON.parse(data);
    } catch (err1) {
      log.error(put({
        err: err
      }, logData), 'api.checkIfLoggedIn redis.get JSON.parse error');
      return next(err1);
    }
    if (!keypather.get(data, 'passport.user')) {
      log.trace(logData, 'api.checkIfLoggedIn redis.get !data.passport.user');
      return api._handleUnauthenticated(req, res, next);
    }
    log.trace(logData, 'api.checkIfLoggedIn redis.get final success');
    next();
  });
};

/**
 * Determine where to proxy or redirect request to according to rules truth table
 */
api.getTargetHost = function (req, res, next) {
  /*jshint maxdepth:4*/
  var reqUrl = api._getUrlFromRequest(req);
  var parsedReqUrl = url.parse(reqUrl);
  var refererUrl = req.headers.origin || req.headers.referer;
  var redisKey = [
    'frontend:',
    parsedReqUrl.port,
    '.',
    parsedReqUrl.hostname
  ].join('');

  // for error-page module if container is unresponsive
  req.elasticUrl = parsedReqUrl.hostname + ':' + parsedReqUrl.port;

  var logData = {
    tx: true,
    reqUrl: reqUrl,
    refererUrl: refererUrl,
    redisKey: redisKey
  };

  log.info(logData, 'api.getTargetHost');

  /**
   * Hipache sits in front of navi. Hipache uses these redis keys to route requests to navi.
   */
  redis.lrange(redisKey, 0, 1, function (err, response) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'getTargetHost redis.lrange error');
      return next(err);
    }

    var info = response[0];

    assign(logData, {
      info: info
    });
    log.trace(logData, 'getTargetHost redis.lrange success');

    try {
      info = JSON.parse(info);
    } catch (jsonParseErr) {
      log.error(put({
        err: jsonParseErr
      }, logData), 'getTargetHost redis.lrange json parse error');
      return next(jsonParseErr);
    }
    /**
     * Sample expected data:
     *
     * "{\"shortHash\":\"1mlnxe\",\"exposedPort\":[\"8000\"],\"branch\":\"b\",\"instanceName\":\"b-node-hello-world\",\"ownerUsername\":\"Myztiq\",\"ownerGithub\":495765,\"userContentDomain\":\"runnablecloud.com\",\"masterPod\":false,\"direct\":true}"
     */

    // 2. if found, check ownerGithub against current users' organizations for authentication
    // verification
    if (!api._shouldBypassAuth(req) &&
        !api._isUserAuthorized(req, info.ownerGithub)) {
      log.warn(put({
        session: req.session,
        info: info
      }, logData), 'getTargetHost info.ownerGithub not in userOrgs');
      return next(ErrorCat.create(404, 'Not Found'));
    }

    if (info.elastic) {
      log.trace(logData, 'getTargetHost redis.lrange info.elastic');
      return api._getTargetHostElastic(logData, req, next);
    } else {
      // DIRECT URL
      // first segment of url is short hash, remove and you have elastic url
      // query on elastic url update mapping and redirect user
      log.trace(logData, 'getTargetHost redis.lrange info.direct');
      var splitReqHostname = parsedReqUrl.hostname.split('-');
      var shortHash = splitReqHostname.shift();
      var elasticUrl = splitReqHostname.join('-');
      assign(logData, {
        shortHash: shortHash,
        elasticUrl: elasticUrl
      });
      mongo.setUserMapping(elasticUrl, req.session.userId, shortHash, function (err, result) {
        if (err) {
          log.error(put({
            err: err
          }, logData), 'getTargetHost redis.lrange info.direct mongo.setUserMapping error');
          return next(err);
        }
        log.trace(put({
          userMapping: result
        }, logData), 'getTargetHost redis.lrange info.direct mongo.setUserMapping success');

        req.redirectUrl = parsedReqUrl.protocol + '//' + elasticUrl + ':' + parsedReqUrl.port;
        next();
      });
    }
  });
};
