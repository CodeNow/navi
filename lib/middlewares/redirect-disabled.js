/**
 * @module lib/middlewares/redirect-disabled
 */
'use strict'

var ErrorCat = require('error-cat');
var ProxyServer = require('models/proxy.js');
var proxy = new ProxyServer();
var find = require('101/find');
var url = require('url');

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
    return proxyRequest(getRequestedContainer(req), req, res, next)
  }
  if (isElastic) {
    if (isBrowser && hasReferrer) {
      // Look up Connections and proxy to the Connection's container
      return proxyRequest(getConnectionContainer(req), req, res, next)
    }
    if (!isBrowser && hasReferrer) {
      // Look up Connections and proxy to the Connection's container
      return proxyRequest(getConnectionContainer(req), req, res, next)
    }
    if (isBrowser && !hasReferrer) {
      // Proxy to master branch container
      return proxyRequest(getMasterBranchContainer(req), req, res, next)
    }
    if (!isBrowser && !hasReferrer) {
      // Proxy to master branch container
      return proxyRequest(getMasterBranchContainer(req), req, res, next)
    }
  }
}

function getMasterBranchContainer(req) {
  var masterId = find(Object.keys(req.naviEntry.directUrls), function (id) {
    return req.naviEntry.directUrls[id].masterPod;
  });
  return req.naviEntry.directUrls[masterId];
}

function getConnectionContainer(req) {
  // Look up the referrer, see if we have a match in the refererNaviEntry
  var referrerNaviEntry = req.naviEntry.refererNaviEntry;
  var targetContainerId = null;
  var elasticUrl = req.hipacheEntry.elastic;
  var sourceContainerId = req.resolvedReferrerId;

  // Check the source container if it has any mappings for our connection
  var dependency = find(referrerNaviEntry.directUrls[sourceContainerId].dependencies, function (dependency) {
    return dependency.elasticUrl === elasticUrl;
  });

  // If we found a dependency go to that target container
  if (dependency) {
    targetContainerId = dependency.shortHash;
  } else {
    targetContainerId = req.resolvedHostId;
  }
  return req.naviEntry.directUrls[targetContainerId];
}

function getRequestedContainer(req) {
  return req.naviEntry.directUrls[req.resolvedHostId];
}

function proxyRequest(container, req, res, next) {
  if (!container) {
    // Return 404 not found.
    return next(ErrorCat.create(404, 'Not Found'));
  }
  console.log('Going to container', container);
  var host = req.headers.host;
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';

  var parsedReqUrl = url.parse(protocol + host);
  req.targetHost = [
    parsedReqUrl.protocol, '//',
    container.dockerHost,
    ':', container.ports[parsedReqUrl.port]
  ].join('');

  proxy.proxyIfTargetHostExist()(req, res, next);
}
