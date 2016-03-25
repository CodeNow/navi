/**
 * @module lib/middlewares/redirect-disabled
 */
'use strict';

module.exports = function (req, res, next) {
  if (req.naviEntry.redirectEnabled === true) {
    return next();
  }
  // Redirection is not enabled. Let's find the right container to serve.
  makeDecision(req, res, next)
};

function makeDecision (req, res, next) {
  var isBrowser = req.isBrowser;
  // Yay referrer is spelled wrong in headers on purpose! Damn you specs.
  var hasReferrer = !!req.headers.referer;
  var isElastic = !!req.hipacheEntry.elastic;
  var isDirect = !isElastic;

  if (isDirect) {
    // This doesn't care (right now at least) if there is a referrer or if it's a browser
    // Proxy to the requested container
    return proxyRequest(getRequestedContainer(req), res, next)
  }
  if (isElastic) {
    if (isBrowser && hasReferrer) {
      // Look up Connections and proxy to the Connection's container
      return proxyRequest(getConnectionContainer(req), res, next)
    }
    if (!isBrowser && hasReferrer) {
      // Look up Connections and proxy to the Connection's container
      return proxyRequest(getConnectionContainer(req), res, next)
    }
    if (isBrowser && !hasReferrer) {
      // Proxy to master branch container
      return proxyRequest(getMasterBranchContainer(req), res, next)
    }
    if (!isBrowser && !hasReferrer) {
      // Proxy to master branch container
      return proxyRequest(getMasterBranchContainer(req), res, next)
    }
  }
}

function _getMasterBranchIdFromNaviEntry (naviEntry) {
  return Object.keys(naviEntry.directUrls).find(function (id) {
    return naviEntry.directUrls[id].masterPod;
  });
}

function getMasterBranchContainer(req) {
  var masterId = _getMasterBranchIdFromNaviEntry(req.naviEntry);
  return req.naviEntry.directUrls[masterId];
}
function getConnectionContainer(req) {
  // Look up the referrer, see if we have a match in the refererNaviEntry
  var referrer = req.headers.referer;
  var referrerNaviEntry = req.naviEntry.refererNaviEntry;
  var targetContainerId = null;
  var elasticUrl = req.hipacheEntry.elastic;
  var sourceContainerId = null;

  // We need to deal with elastic and direct referrers too.
  // First check if it's elastic (that's easier)
  if (referrerNaviEntry.elasticUrl === referrer) {
    // Great, we are coming from an elastic url
    // Now we need to check to see if THIS entry has redirection enabled.
    if (referrerNaviEntry.redirectEnabled) {
      // If it does, we need to figure out what container they are actually coming from.
      // This needs to check their user session
      req.session.doStuff()
    } else {
      // We know it must be the master, since that's all we serve on elastic urls when redirect is not enabled
      sourceContainerId = _getMasterBranchIdFromNaviEntry(referrerNaviEntry)
    }
  } else {
    var referredId = referrer.split('-')[0];
    // It's a direct url, let's find that entry.
    sourceContainerId = Object.keys(referrerNaviEntry.directUrls).find(function (key) {
      return key === referredId;
    })
  }

  // Check the source container if it has any mappings for our connection
  var dependency = referrerNaviEntry.directUrls[sourceContainerId].dependencies.find(function (dependency) {
    return dependency.elasticUrl === elasticUrl;
  });

  // If we found a dependency go to that target container
  if (dependency) {
    targetContainerId = dependency.shortHash;
  } else {
    targetContainerId = _getMasterBranchIdFromNaviEntry(req.naviEntry)
  }
  return req.naviEntry.directUrls[targetContainerId];
}

function getRequestedContainer(req) {
  var requestUrl = req.headers.host;
  var containerId = requestUrl.split('-')[0];
  return req.naviEntry.directUrls[containerId];
}

function proxyRequest(container, res, next) {
  console.log('Proxy request to container', container);
}
