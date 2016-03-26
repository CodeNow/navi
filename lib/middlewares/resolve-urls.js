/**
 * @module lib/middlewares/resolve-urls
 */
'use strict';

var find = require('101/find');
var keypather = require('keypather')();

module.exports = function (req, res, next) {
  // Order is important!
  req.resolvedReferrerId = resolveUrl(req, req.headers.referer, req.naviEntry.refererNaviEntry);
  req.resolvedHostId = resolveUrl(req, req.headers.host, req.naviEntry);
  next();
};

function resolveUrl(req, url, naviEntry) {
  if (!req || !url || !naviEntry) {
    return null
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

  // No direct obj, so return the master pod's id.
  return find(Object.keys(naviEntry.directUrls), function (key) {
    return naviEntry.directUrls[key].masterPod;
  })
}
