/**
 * @module lib/middlewares/resolve-urls
 */
'use strict';

var find = require('101/find');
var keypather = require('keypather')();
var logger = require('middlewares/logger')(__filename).log;
var url = require('url');

/**
 * Middleware to set resolveReferrerId and resolvedHostId for the rest of Navi to use
 * @param req - Request Object
 * @param res - Response Object
 * @param next - Next Callback
 */
module.exports.middleware = function resolveUrlMiddleware(req, res, next) {
  var log = logger.child({ tx: true, req: req });
  log.info('middlewares/resolve-urls middleware');
  // Order is important!
  var referer = req.headers.referer || req.headers.origin;
  if (referer) {
    req.resolvedReferrerId = module.exports.resolveUrl(req, url.parse(referer).hostname, req.naviEntry.refererNaviEntry);
  }
  req.resolvedHostId = module.exports.resolveUrl(req, req.headers.host, req.naviEntry);
  log.trace({
    resolvedReferrerId: req.resolvedReferrerId,
    resolvedHostId: req.resolvedHostId,
    headers: req.headers
  },'middlewares/resolve-urls resolved ids');
  next();
};

/**
 * Given the information we have, try to resolve the ID from the URL given
 * @param req - Request Object
 * @param requestedHost - Response OBject
 * @param naviEntry - Navi Entry
 * @returns {String} - The ID of the container that's been resolved
 */
module.exports.resolveUrl = function resolveUrl(req, requestedHost, naviEntry) {
  var log = logger.child({
    tx: true,
    req: req,
    requestedHost: requestedHost
  });
  if (!req || !requestedHost || !naviEntry) {
    return null
  }
  log.info('middlewares/resolve-urls resolveUrl');

  // Make request to API master from frontend master, and frontend master has mapping to API FB1
  // We should translate API master to API FB1

  // If we have a referrer entry let's use that to see if we should go to a different branch
  if (naviEntry.refererNaviEntry && req.resolvedReferrerId) {
    var matchingDep = find(naviEntry.refererNaviEntry.directUrls[req.resolvedReferrerId].dependencies, function (dependency) {
      return dependency.elasticUrl === requestedHost;
    });
    if (matchingDep) {
      log.trace({
        resolvedId: matchingDep.shortHash
      },'middlewares/resolve-urls found matching dependency');
      return matchingDep.shortHash;
    }
  }

  var resolvedId = null;

  // Is it an elastic url?
  if (naviEntry.elasticUrl === requestedHost) {
    // Is redirect enabled?
    if (naviEntry.redirectEnabled) {
      // It's elastic with redirection. Let's figure out what the user session has in it
      var directshortHash = keypather.get(req, 'session.directShortHash');
      log.trace({
        directShortHash: keypather.get(req, 'session.directShortHash'),
        requestedHost: requestedHost
      }, 'middlewares/resolve-urls trying to resolve instance id from user session');
      resolvedId = directshortHash ? directShortHash[requestedHost] : null;
    }
    // If redirect isn't enabled we'll just let the defaulting to master happen below
  } else {
    // Direct url, just use the id passed into the url
    resolvedId = requestedHost.split('-')[0]
  }

  log.trace({
    resolvedId: resolvedId
  }, 'middlewares/resolve-urls checking to see if ID exists in directUrl object');

  // Check that the resolvedId is valid
  var directObj = naviEntry.directUrls[resolvedId];
  if (directObj) {
    log.trace({
      resolvedId: resolvedId
    }, 'middlewares/resolve-urls resolved ID matches something');
    return resolvedId;
  }


  // No direct obj, so return the master pod's id.
  var masterId = find(Object.keys(naviEntry.directUrls), function (key) {
    return naviEntry.directUrls[key].masterPod;
  });

  log.trace({
    resolvedId: masterId
  }, 'middlewares/resolve-urls No direct object found, using master id');

  return masterId;
};

