/**
 * @module lib/middlewares/resolve-urls
 */
'use strict';

var find = require('101/find');
var keypather = require('keypather')();

module.exports = function (req, res, next) {
  req.resolvedHostId = resolveUrl(req, req.headers.host, req.naviEntry);
  req.resolvedReferrerId = resolveUrl(req, req.headers.referer, req.naviEntry.refererNaviEntry);
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

  // No direct obj, so return the master pod's id.
  return find(Object.keys(naviEntry.directUrls), function (key) {
    return naviEntry.directUrls[key].masterPod;
  })
}
