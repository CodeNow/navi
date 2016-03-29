'use strict';

var errorPage = require('models/error-page.js');
var url = require('url');
var find = require('101/find');
var logger = require('middlewares/logger')(__filename).log;

/**
 * Middleware to check if the container is running
 * @param req - Request Object
 *   Requires both targetNaviEntryInstance && targetShortHash to exist
 * @param res - Response Object
 * @param next - Next method
 */
module.exports.middleware = function checkContainerStatusMiddleware(req, res, next) {
  var log = logger.child({ tx: true, req: req });
  if (!req.targetNaviEntryInstance) {
    return next();
  }
  log.info('middlewares/check-container-status');
  var reqUrl = module.exports._getUrlFromNaviEntryInstance(req);

  if (req.targetNaviEntryInstance.dockRemoved) {
    req.targetHost = errorPage.generateErrorUrl('dock_removed', {
      elasticUrl: reqUrl,
      shortHash: module.exports._getTargetShortHash(req)
    });
    return next();
  }

  if (!req.targetNaviEntryInstance.running) {
    req.targetHost = errorPage.generateErrorUrl('not_running', {
      elasticUrl: reqUrl,
      shortHash: module.exports._getTargetShortHash(req)
    });
    return next();
  }

  req.targetHost = reqUrl;
  next();
};

/**
 * Get the url for the navi entries instance.
 * @param req Request Object
 * @returns {string} Computed URL
 * @private
 */
module.exports._getUrlFromNaviEntryInstance = function _getUrlFromNaviEntryInstance(req) {
  var log = logger.child({ tx: true, req: req });
  log.info('middlewares/check-container-status _getUrlFromNaviEntryInstance');
  var host = req.headers.host;
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';

  var parsedReqUrl = url.parse(protocol + host);
  return [
    parsedReqUrl.protocol, '//',
    req.targetNaviEntryInstance.dockerHost,
    ':', req.targetNaviEntryInstance.ports[parsedReqUrl.port]
  ].join('');

};

/**
 * Get the short hash for the targetNaviEntry
 * @param req Request Object
 * @returns {String} Shorthash of the instance
 * @private
 */
module.exports._getTargetShortHash = function _getShortHash(req) {
  var log = logger.child({ tx: true, req: req });
  log.info('middlewares/check-container-status _getTargetShortHash');
  var branchName = req.targetNaviEntryInstance.branch;
  return find(Object.keys(req.naviEntry.directUrls), function (key) {
    return req.naviEntry.directUrls[key].branch == branchName;
  });
};
