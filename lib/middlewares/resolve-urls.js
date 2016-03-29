/**
 * @module lib/middlewares/resolve-urls
 */
'use strict';

var find = require('101/find');
var keypather = require('keypather')();

/**
 * Middleware to set resolveReferrerId and resolvedHostId for the rest of Navi to use
 * @param req - Request Object
 * @param res - Response Object
 * @param next - Next Callback
 */
module.exports.middleware = function resolveUrlMiddleware(req, res, next) {
  // Order is important!
  req.resolvedReferrerId = module.exports.resolveUrl(req, (req.headers.referer || req.headers.origin), req.naviEntry.refererNaviEntry);
  req.resolvedHostId = module.exports.resolveUrl(req, req.headers.host, req.naviEntry);
  next();
};

/**
 * Given the information we have, try to resolve the ID from the URL given
 * @param req - Request Object
 * @param url - Response OBject
 * @param naviEntry - Navi Entry
 * @returns {String} - The ID of the container that's been resolved
 */
module.exports.resolveUrl = function resolveUrl(req, url, naviEntry) {
  if (!req || !url || !naviEntry) {
    return null
  }

  // Make request to API master from frontend master, and frontend master has mapping to API FB1
  // We should translate API master to API FB1

  // If we have a referrer entry let's use that to see if we should go to a different branch
  if (naviEntry.refererNaviEntry && req.resolvedReferrerId) {
    var matchingDep = find(naviEntry.refererNaviEntry.directUrls[req.resolvedReferrerId].dependencies, function (dependency) {
      return dependency.elasticUrl === url;
    });
    if (matchingDep) {
      return matchingDep.shortHash;
    }
  }

  var resolvedId = null;

  // Is it an elastic url?
  if (naviEntry.elasticUrl === url) {
    // Is redirect enabled?
    if (naviEntry.redirectEnabled) {
      // It's elastic with redirection. Let's figure out what the user session has in it
      resolvedId = (keypather.get(req, 'session.directShortHash')) ?
        req.session.directShortHash[url] : null;
    }
    // If redirect isn't enabled we'll just let the defaulting to master happen below
  } else {
    // Direct url, just use the id passed into the url
    resolvedId = url.split('-')[0]
  }

  // Check that the resolvedId is valid
  var directObj = naviEntry.directUrls[resolvedId];
  if (directObj) {
    return resolvedId;
  }

  // No direct obj, so return the master pod's id.
  return find(Object.keys(naviEntry.directUrls), function (key) {
    return naviEntry.directUrls[key].masterPod;
  })
};

