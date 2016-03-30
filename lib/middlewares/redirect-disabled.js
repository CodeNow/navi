/**
 * @module lib/middlewares/redirect-disabled
 */
'use strict'

var ErrorCat = require('error-cat');
var find = require('101/find');
var logger = require('middlewares/logger')(__filename).log;

/**
 * Middleware to handle when the user has redirection disabled
 * @param {object} req - Request Object
 * @param {object} res - Response Object
 * @param {function} next - Next method
 */
module.exports.middleware = function redirectDisabledMiddleware(req, res, next) {
  var log = logger.child({
    tx: true,
    req: req,
    method: 'middleware'
  });
  log.info('called');
  if (req.naviEntry.redirectEnabled === true) {
    log.info('redirect is enabled, skipping');
    return next();
  }
  // Redirection is not enabled. Let's find the right container to serve.
  module.exports._makeDecision(req, res, next)
};

/**
 * Make a decision about where to direct the user
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @private
 */
module.exports._makeDecision = function _makeDecision(req, res, next) {
  // Yay referrer is spelled wrong in headers on purpose! Damn you specs.
  var hasReferrer = !!(req.headers.referer || req.headers.origin);
  var isElastic = !!req.hipacheEntry.elastic;
  var isDirect = !isElastic;

  var log = logger.child({
    tx: true,
    req: req,
    hasReferrer: hasReferrer,
    isElastic: isElastic,
    isDirect: isDirect,
    method: '_makeDecision'
  });
  log.info('called');
  if (isDirect) {
    log.info('URL is direct, proxying the requested container');
    // This doesn't care (right now at least) if there is a referrer or if it's a browser
    // Proxy to the requested container
    return module.exports._proxyRequest(module.exports._getRequestedContainer(req), req, res, next)
  }
  // It's elastic.
  if (hasReferrer) {
    log.info('URL has referrer, proxying the connections container');
    // Look up Connections and proxy to the Connection's container
    return module.exports._proxyRequest(module.exports._getConnectionContainer(req), req, res, next)
  }

  log.info('URL has no referrer and is elastic, proxying the master container');
  // Proxy to master branch container
  return module.exports._proxyRequest(module.exports._getMasterBranchContainer(req), req, res, next)
};

/**
 * From the request object find the master branch container
 * @param {object} req - Request object
 * @returns {Object} Direct URL Object
 * @private
 */
module.exports._getMasterBranchContainer = function _getMasterBranchContainer(req) {
  var log = logger.child({ tx: true, req: req, method: '_getMasterBranchContainer' });
  log.info('called');
  var masterId = find(Object.keys(req.naviEntry.directUrls), function (id) {
    return req.naviEntry.directUrls[id].masterPod;
  });
  log.info({
    masterId: masterId
  }, 'Found masterpod ID');
  return req.naviEntry.directUrls[masterId];
};

/**
 * Given a request get the connections container. This looks up using the referer's navi entry.
 * @param {object} req - Request Object
 * @returns {Object} Direct URL Object
 * @private
 */
module.exports._getConnectionContainer = function _getConnectionContainer(req) {
  var log = logger.child({ tx: true, req: req, method: '_getConnectionContainer' });
  log.info('called');

  // Look up the referrer, see if we have a match in the refererNaviEntry
  var referrerNaviEntry = req.naviEntry.refererNaviEntry;

  // No referrer that we've been able to detect an entry for, so just render the requested container
  if (!referrerNaviEntry) {
    log.info('No referrer so render the requested container');
    return module.exports._getRequestedContainer(req);
  }

  var elasticUrl = req.hipacheEntry.elastic;
  var sourceContainerId = req.resolvedReferrerId;

  // By default go to the resolve host ID
  var targetContainerId = req.resolvedHostId;

  // Check the source container if it has any mappings for our connection
  var dependency = find(referrerNaviEntry.directUrls[sourceContainerId].dependencies, function (dependency) {
    return dependency.elasticUrl === elasticUrl;
  });

  // If we found a dependency go to that target container
  if (dependency) {
    targetContainerId = dependency.shortHash;
  }
  log.info({
    targetContainerId: targetContainerId
  }, 'Navigating to container that we found');
  return req.naviEntry.directUrls[targetContainerId];
};

/**
 * Get the container that people have requested
 * @param {object} req - Request Object
 * @returns {Objec} Direct URL Object
 * @private
 */
module.exports._getRequestedContainer = function _getRequestedContainer(req) {
  var log = logger.child({ tx: true, req: req, method: '_getRequestedContainer' });
  log.info('called');
  var requestedContainer = req.naviEntry.directUrls[req.resolvedHostId];
  log.info({
    requestedContainer: requestedContainer
  }, 'returning requested container');
  return requestedContainer;
};

/**
 * Setup everything we need to do to proxy the request to the user
 * @param container - The Direct URL Object for the container
 * @param {object} req - Request Object
 * @param {object} res - Response Object
 * @param {function} next - Next Method
 * @private
 */
module.exports._proxyRequest = function _proxyRequest(container, req, res, next) {
  var log = logger.child({
    tx: true,
    req: req,
    method: '_proxyRequest',
    targetNaviEntryInstance: container
  });
  log.info('called');
  if (!container) {
    // Return 404 not found.
    log.info('No container, returning 404 not found');
    return next(ErrorCat.create(404, 'Not Found'));
  }
  req.targetNaviEntryInstance = container;
  log.info({
    targetNaviEntryInstance: container
  }, 'set targetNaviEntryInstance');
  next();
};
