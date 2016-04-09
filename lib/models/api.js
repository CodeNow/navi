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
var keypather = require('keypather')();
var put = require('101/put');
var url = require('url');

var errorPage = require('models/error-page.js');
var log = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');

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
 *
 * The session's directShortHash map is used to look up user mapping
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
    // referer is self, ignore it
    refererUrl = null;
  }
  var naviEntry = req.naviEntry;

  var targetNaviEntryInstance;
  if (req.isBrowser) {
    log.trace(logData, '_getTargetHostElastic: isBrowser');
    if (refererUrl && naviEntry.refererNaviEntry) {
      return api._getTargetHostElasticReferer(logData, naviEntry, req, next);
    } else {
      // if no referer
      // proxy to user-mapped instance (or master if no user mapping)
      // session may not have a mapping set for it.  If not, use master
      var mappedInstanceShortHash = (keypather.get(req, 'session.directShortHash')) ?
        req.session.directShortHash[parsedReqUrl.hostname] : null;
      log.trace(logData, '_getTargetHostElastic fetch usermapping');
      if (!mappedInstanceShortHash) {
        log.trace(logData,
          '_getTargetHostElastic: isBrowser !refererUrl !mappedInstanceShortHash');
        // use master
        var masterPodBranch = mongo.constructor.findMasterPodBranch(naviEntry);
        targetNaviEntryInstance = masterPodBranch.directUrlObj;
        mappedInstanceShortHash = masterPodBranch.directUrlShortHash;
      } else {
        log.trace(logData,
          '_getTargetHostElastic: isBrowser !refererUrl mappedInstanceShortHash');
        targetNaviEntryInstance = naviEntry.directUrls[mappedInstanceShortHash];
      }
      return api._processTargetInstance(targetNaviEntryInstance, mappedInstanceShortHash,
                                        reqUrl, req, next);
    }
  } else {
    // if not browser, proxy to master
    log.trace(logData, '_getTargetHostElastic: !isBrowser');
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
  // Session may not have a mapping saved on the session

  var refererUserMappedInstanceId = (keypather.get(req, 'session.directShortHash')) ?
      req.session.directShortHash[naviEntry.refererNaviEntry.elasticUrl] : null;
  log.trace(put({
    shortHash: refererUserMappedInstanceId,
    session: req.session
  }, logData), '_getTargetHostElasticReferer fetch usermapping');
  var refererNaviEntryInstance;

  if (refererUserMappedInstanceId) {
    refererNaviEntryInstance = naviEntry.refererNaviEntry.directUrls[refererUserMappedInstanceId];
    log.trace(put({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer isBrowser '+
    'refererNaviEntryInstance');
  } else {
    // if no mapping exists in the current user's session and no referer instance exists, use master
    var materPodBranch = mongo.constructor.findMasterPodBranch(naviEntry.refererNaviEntry);
    refererNaviEntryInstance = keypather.get(materPodBranch, 'directUrlObj');
    refererUserMappedInstanceId = keypather.get(materPodBranch, 'directUrlShortHash');
    log.trace(put({
      refererUserMappedInstanceId: refererUserMappedInstanceId,
      refererNaviEntryInstance: refererNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer isBrowser '+
    '!refererNaviEntryInstance');
  }
  if (!refererNaviEntryInstance) {
    log.error(logData,
              '_getTargetHostElasticReferer isBrowser '+
              '!refererNaviEntryInstance 404');
    return next(ErrorCat.create(404, 'Not Found'));
  }
  // 3.
  var instanceShortHash = mongo.constructor.findAssociationShortHashByElasticUrl(
    refererNaviEntryInstance.dependencies,
    parsedReqUrl.hostname);
  if (instanceShortHash) {
    log.trace(logData,
      'getTargetHost isBrowser instanceShortHash');
    targetNaviEntryInstance = naviEntry.directUrls[instanceShortHash];
  } else {
    log.trace(logData,
      'getTargetHost isBrowser !instanceShortHash');

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
    log.trace(put({
      targetNaviEntryInstance: targetNaviEntryInstance
    }, logData),
    '_getTargetHostElasticReferer isBrowser !targetNaviEntryInstance ' +
    'use master');

    var foundMasterBranch = mongo.constructor.findMasterPodBranch(naviEntry);
    targetNaviEntryInstance = foundMasterBranch.directUrlObj;
    return api._processTargetInstance(targetNaviEntryInstance,
                                      foundMasterBranch.directUrlShortHash,
                                      reqUrl, req, next);

  }
  return api._processTargetInstance(targetNaviEntryInstance, instanceShortHash, reqUrl, req, next);
};

// -{1,2} because - is normal direct urls, while -- is isolated
var regexForRemovingShorthashFromDirectUrls = /^([A-z0-9]*-{1,2})(.*)/;

function splitDirectUrlIntoShorthashAndElastic (logData, directUrl) {
  var matchingArray = regexForRemovingShorthashFromDirectUrls.exec(directUrl);
  if (matchingArray.length) {
    // We want the 2nd and 3rd item in the array (1st is the original value (if it matched))
    return matchingArray.slice(1, 3);
  }
  assign(logData, {
    directUrl: directUrl
  });
  log.error(logData, 'splitDirectUrlIntoShorthashAndElastic got a direct url');
  return ['', directUrl];
}
/**
 * Determine where to proxy or redirect request to according to rules truth table
 *
 * This is where the user mapping is saved on the session.
 */
api.getTargetHost = function (req, res, next) {
  var reqUrl = api._getUrlFromRequest(req);
  var parsedReqUrl = url.parse(reqUrl);
  var refererUrl = req.headers.origin || req.headers.referer;
  var info = req.hipacheEntry;

  // for error-page module if container is unresponsive
  req.elasticUrl = parsedReqUrl.hostname + ':' + parsedReqUrl.port;

  var logData = {
    tx: true,
    reqUrl: reqUrl,
    refererUrl: refererUrl,
    info: info,
    session: req.session
  };

  log.info(logData, 'api.getTargetHost');

  if (info.elastic) {
    log.trace(logData, 'getTargetHost info.elastic');
    return api._getTargetHostElastic(logData, req, next);
  } else {
    // DIRECT URL
    // first segment of url is short hash, remove and you have elastic url

    var splitReqHostname = splitDirectUrlIntoShorthashAndElastic(logData, parsedReqUrl);
    var shortHash = splitReqHostname[0];
    var elasticUrl = splitReqHostname[1];
    assign(logData, {
      shortHash: shortHash,
      elasticUrl: elasticUrl
    });

    // if we are not a browser, just proxy to container
    var target = req.naviEntry.directUrls[shortHash];

    if (!req.isBrowser) {
      log.trace(logData, 'getTargetHost not browser, proxy to target');
      return api._processTargetInstance(target, shortHash, reqUrl, req, next);
    }
    // query on elastic url update mapping and redirect user
    var newRedirectUrl = parsedReqUrl.protocol + '//' + elasticUrl + ':' + parsedReqUrl.port;
    log.trace(put({
      redirectUrl: newRedirectUrl
    }, logData), 'getTargetHost: going to redirect');
    if (!req.session.directShortHash) {
      req.session.directShortHash = {};
    }
    // The session is used to store the mapping, instead of using the database
    req.session.directShortHash[elasticUrl] = shortHash;
    req.redirectUrl = newRedirectUrl;
    req.session.save(function (err) {
      log.trace(put({
        redirectUrl: newRedirectUrl
      }, logData), 'getTargetHost anonymous session save finish');
      next(err);
    });
  }
};
