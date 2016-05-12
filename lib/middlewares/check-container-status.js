'use strict';

var find = require('101/find');

var errorPage = require('models/error-page.js');
var logger = require('middlewares/logger')(__filename).log;

/**
 * Middleware to check if the container is running
 * @param {object} req - Request Object
 *   Requires both targetNaviEntryInstance && targetShortHash to exist
 * @param {object} res - Response Object
 * @param {function} next - Next method
 */
module.exports.middleware = function checkContainerStatusMiddleware(req, res, next) {
  var log = logger.child({
    tx: true,
    req: req,
    method: 'check-container-status',
    targetInstance: req.targetNaviEntryInstance
  });
  log.info('called');
  if (!req.targetNaviEntryInstance) {
    log.trace('No targetNaviEntryInstance skipping');
    return next();
  }
  var reqUrl = module.exports._getUrlFromNaviEntryInstance(req);
  log = log.child({targetHost: reqUrl});

  if (req.targetNaviEntryInstance.dockRemoved) {
    req.targetHost = errorPage.generateErrorUrl('dock_removed', {
      elasticUrl: reqUrl,
      shortHash: module.exports._getTargetShortHash(req)
    });
    log.trace('Dock is migrating');
    return next();
  }

  if (!req.targetNaviEntryInstance.running) {
    req.targetHost = errorPage.generateErrorUrl('not_running', {
      elasticUrl: reqUrl,
      shortHash: module.exports._getTargetShortHash(req)
    });
    log.trace('Container is not running');
    return next();
  }

  log.trace('set target host');
  req.targetHost = reqUrl;
  next();
};

/**
 * Get the url for the navi entries instance.
 * @param {object} req Request Object
 * @returns {string} Computed URL
 * @private
 */
module.exports._getUrlFromNaviEntryInstance = function _getUrlFromNaviEntryInstance(req) {
  var log = logger.child({ tx: true, req: req, method: '_getUrlFromNaviEntryInstance' });
  log.info('called');
  var newUrl =  [
    req.parsedReqUrl.protocol,
    '//',
    req.targetNaviEntryInstance.dockerHost,
    ':',
    req.targetNaviEntryInstance.ports[req.parsedReqUrl.port]
  ].join('');
  log.trace({
    returnValue: newUrl
  }, 'Returning new url');
  return newUrl;
};

/**
 * Get the short hash for the targetNaviEntry
 * @param {object} req Request Object
 * @returns {String} Shorthash of the instance
 * @private
 */
module.exports._getTargetShortHash = function _getShortHash(req) {
  var log = logger.child({ tx: true, req: req, method: '_getTargetShortHash'});
  log.info('called');
  var branchName = req.targetNaviEntryInstance.branch;
  var targetShortHash = find(Object.keys(req.naviEntry.directUrls), function (key) {
    return req.naviEntry.directUrls[key].branch == branchName;
  });
  log.trace({
    targetShortHash: targetShortHash
  },'Returning target shortHash');
  return targetShortHash;
};
