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
var keypather = require('keypather')();

var errorPage = require('models/error-page.js');
var logger = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');
var resolveUrls = require('middlewares/resolve-urls');

module.exports = api;

/**
 * module used to make calls to runnable API as a specific user
 */
function api () {}

/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
api.getUrlFromRequest = function (req) {
  var host = req.headers.host;
  var isHttps = req.isHttps;
  var protocol = isHttps ? 'https://' : 'http://';
  var split = host.split('.');
  var numSubDomains = 3;
  if (split.length > numSubDomains) {
    split.splice(0, split.length - numSubDomains);
  }
  host = split.join('.');
  var log = logger.child({
    tx: true,
    req: req,
    host: host,
    split: split,
    numSubDomains: numSubDomains,
    method: 'getUrlFromRequest'
  });
  log.info('called');
  // append port if not in url
  if (!~host.indexOf(':')) {
    host = host + (isHttps ? ':443' : ':80');
  }

  log.info({ returnVal: protocol + host }, 'final return');
  return protocol + host;
};

/**
 * Take information from req to navi and destination container to produce targetHost
 * If https is requested but port 443 is not exposed redir to 80 if exposed.
 * @param {Boolean} isHttps      true it request is https
 * @param {Object}  parsedReqUrl url parsed requested url
 * @param {Object}  targetNaviEntryInstance sub-document on naviEntry document of a specific instance
 * @return {String} in format of http(s)://DOCKER_HOST:MAPPED_PORT
 */
api.getTargetUrl = function (parsedReqUrl, targetNaviEntryInstance) {
  var log = logger.child({
    tx: true,
    parsedReqUrl: parsedReqUrl,
    targetNaviEntryInstance: targetNaviEntryInstance,
    method: 'getTargetUrl'
  });
  log.info('called');

  var targetUrl =  [
    parsedReqUrl.protocol,
    '//',
    targetNaviEntryInstance.dockerHost,
    ':',
    targetNaviEntryInstance.ports[parsedReqUrl.port]
  ].join('');

  log.trace({ targetUrl: targetUrl }, 'Returning new url');
  return targetUrl;
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
  var log = logger.child({
    method: '_processTargetInstance',
    tx: true,
    targetNaviEntryInstance: targetNaviEntryInstance,
    reqUrl: reqUrl,
    shortHash: shortHash
  });
  log.info('called');

  if (!targetNaviEntryInstance) {
    log.error('!targetNaviEntryInstance');
    return next(ErrorCat.create(404, 'Not Found'));
  }

  // Adding these to req object to make values available in proxy module's error event handler.
  req.shortHash = shortHash;
  req.elasticUrl = reqUrl;

  // for error-page module if container is unresponsive
  req.targetBranch = targetNaviEntryInstance.branch;
  if (targetNaviEntryInstance.dockRemoved) {
    log.trace('target has dockRemoved');
    req.targetHost = errorPage.generateErrorUrl('dock_removed', {
      elasticUrl: reqUrl,
      shortHash: shortHash
    });
    return next();
  }

  if (!targetNaviEntryInstance.running) {
    log.trace('target is not running');
    req.targetHost = errorPage.generateErrorUrl('not_running', {
      elasticUrl: reqUrl,
      shortHash: shortHash
    });
    return next();
  }
  req.targetHost = api.getTargetUrl(req.parsedReqUrl, targetNaviEntryInstance);
  return next();
};

/**
 * Helper function to manage proxy target determination for elastic url requests
 *
 * The session's directShortHash map is used to look up user mapping
 * @param {Object} logData
 * @param {Object} req
 * @param {Function} next
 */
api._getTargetHostElastic = function (log, req, next) {
  log = log.child({ method: 'api._getTargetHostElastic' });
  log.info('called');

  var reqUrl = req.reqUrl;
  var parsedReqUrl = req.parsedReqUrl;
  var refererUrl = req.refererUrl;
  var naviEntry = req.naviEntry;

  var targetNaviEntryInstance;
  if (req.isBrowser) {
    log.trace('isBrowser');
    if (refererUrl && naviEntry.refererNaviEntry) {
      return api._getTargetHostElasticReferer(log, naviEntry, req, next);
    } else {
      // if no referer
      // proxy to user-mapped instance (or master if no user mapping)
      // session may not have a mapping set for it.  If not, use master
      var mappedInstanceShortHash = (keypather.get(req, 'session.directShortHash')) ?
        req.session.directShortHash[parsedReqUrl.hostname] : null;
      log.trace({ mappedInstanceShortHash: mappedInstanceShortHash }, 'fetch usermapping');
      if (!mappedInstanceShortHash) {
        log.trace('isBrowser !refererUrl !mappedInstanceShortHash');
        // use master
        var masterPodBranch = mongo.constructor.findMasterPodBranch(naviEntry);
        targetNaviEntryInstance = masterPodBranch.directUrlObj;
        mappedInstanceShortHash = masterPodBranch.directUrlShortHash;
      } else {
        log.trace('isBrowser !refererUrl mappedInstanceShortHash');
        targetNaviEntryInstance = naviEntry.directUrls[mappedInstanceShortHash];
      }
      return api._processTargetInstance(targetNaviEntryInstance, mappedInstanceShortHash,
                                        reqUrl, req, next);
    }
  } else {
    // if not browser, proxy to master
    log.trace('!isBrowser');
    var foundMasterPodBranch = mongo.constructor.findMasterPodBranch(naviEntry);
    targetNaviEntryInstance = foundMasterPodBranch.directUrlObj;
    return api._processTargetInstance(targetNaviEntryInstance,
                                      foundMasterPodBranch.directUrlShortHash,
                                      reqUrl, req, next);
  }
};

/**
 * Helper function for targetHost derivation of elastic url request to instance with a referer
 * header
 * @param {Object} logData
 */
api._getTargetHostElasticReferer = function (log, naviEntry, req, next) {
  // if referer
  // proxy to association (or master if no association)
  log = log.child({ method: 'api._getTargetHostElasticReferer' });
  log.info('called');

  var targetNaviEntryInstance;

  var reqUrl = req.reqUrl;
  var parsedReqUrl = req.parsedReqUrl;

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
  // Session may not have a mapping saved on the session

  var refererUserMappedInstanceId = (keypather.get(req, 'session.directShortHash')) ?
      req.session.directShortHash[naviEntry.refererNaviEntry.elasticUrl] : null;
  log.trace({
    shortHash: refererUserMappedInstanceId,
    session: req.session
  }, 'fetch usermapping');
  var refererNaviEntryInstance;

  if (refererUserMappedInstanceId) {
    refererNaviEntryInstance = naviEntry.refererNaviEntry.directUrls[refererUserMappedInstanceId];
    log.trace({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, 'isBrowser refererNaviEntryInstance');
  } else {
    // if no mapping exists in the current user's session and no referer instance exists, use master
    var materPodBranch = mongo.constructor.findMasterPodBranch(naviEntry.refererNaviEntry);
    refererNaviEntryInstance = keypather.get(materPodBranch, 'directUrlObj');
    refererUserMappedInstanceId = keypather.get(materPodBranch, 'directUrlShortHash');
    log.trace({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, 'isBrowser !refererNaviEntryInstance');
  }
  if (!refererNaviEntryInstance) {
    log.error('isBrowser !refererNaviEntryInstance 404');
    return next(ErrorCat.create(404, 'Not Found'));
  }
  // 3.
  var instanceShortHash = mongo.constructor.findAssociationShortHashByElasticUrl(
    refererNaviEntryInstance.dependencies,
    parsedReqUrl.hostname);
  if (instanceShortHash) {
    log.trace('getTargetHost isBrowser instanceShortHash');
    targetNaviEntryInstance = naviEntry.directUrls[instanceShortHash];
  } else {
    log.trace('getTargetHost isBrowser !instanceShortHash');

    /**
     * Referer url is a valid runnable elasticUrl however there might be no defined DNS mappings.
     * Proxy to the masterPod instance if so.
     */
    var foundMasterPodBranch = mongo.constructor.findMasterPodBranch(naviEntry.refererNaviEntry);
    targetNaviEntryInstance = keypather.get(foundMasterPodBranch, 'directUrlObj');
  }

  if (!targetNaviEntryInstance) {
    // instance that referer naviEntry document was associated with isn't present,
    // use master of requestUrl naviEntry masterPod instance
    log.trace({
      targetNaviEntryInstance: targetNaviEntryInstance
    }, 'isBrowser !targetNaviEntryInstance use master');

    var foundMasterBranch = mongo.constructor.findMasterPodBranch(naviEntry);
    targetNaviEntryInstance = foundMasterBranch.directUrlObj;
    return api._processTargetInstance(targetNaviEntryInstance,
                                      foundMasterBranch.directUrlShortHash,
                                      reqUrl, req, next);

  }
  return api._processTargetInstance(targetNaviEntryInstance, instanceShortHash, reqUrl, req, next);
};

/**
 * Determine where to proxy or redirect request to according to rules truth table
 *
 * This is where the user mapping is saved on the session.
 */
api.getTargetHost = function (req, res, next) {
  var reqUrl = req.reqUrl;
  var parsedReqUrl = req.parsedReqUrl;
  var refererUrl = req.refererUrl;
  var info = req.hipacheEntry;

  // for error-page module if container is unresponsive
  req.elasticUrl = parsedReqUrl.hostname + ':' + parsedReqUrl.port;

  var log = logger.child({
    method: 'getTargetHost',
    tx: true,
    reqUrl: reqUrl,
    refererUrl: refererUrl,
    info: info,
    session: req.session
  });

  log.info('called');

  if (info.elastic) {
    log.trace('info.elastic');
    return api._getTargetHostElastic(log, req, next);
  } else {
    // DIRECT URL
    // first segment of url is short hash, remove and you have elastic url

    var splitReqHostname = resolveUrls.splitDirectUrlIntoShortHashAndElastic(parsedReqUrl.hostname);
    var shortHash = splitReqHostname.shortHash;
    var elasticUrl = splitReqHostname.elasticUrl;
    log = log.child({ shortHash: shortHash, elasticUrl: elasticUrl });

    // if we are not a browser, just proxy to container
    var target = req.naviEntry.directUrls[shortHash];

    if (!req.isBrowser) {
      log.trace('not browser, proxy to target');
      return api._processTargetInstance(target, shortHash, reqUrl, req, next);
    }
    // query on elastic url update mapping and redirect user
    var newRedirectUrl = parsedReqUrl.protocol + '//' + elasticUrl + ':' + parsedReqUrl.port;
    log.trace({ redirectUrl: newRedirectUrl }, 'going to redirect');
    if (!req.session.directShortHash) {
      req.session.directShortHash = {};
    }
    // The session is used to store the mapping, instead of using the database
    req.session.directShortHash[elasticUrl] = shortHash;
    req.redirectUrl = newRedirectUrl;
    req.session.save(function (err) {
      log.trace({ redirectUrl: newRedirectUrl }, 'anonymous session save finish');
      next(err);
    });
  }
};
