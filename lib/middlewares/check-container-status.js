'use strict';

var errorPage = require('models/error-page.js');
var url = require('url');
var find = require('101/find');

/**
 * Middleware to check if the container is running
 * @param req - Request Object
 *   Requires both targetNaviEntryInstance && targetShortHash to exist
 * @param res - Response Object
 * @param next - Next method
 */
module.exports = function checkContainerStatusMiddleware(req, res, next) {
  if (!req.targetNaviEntryInstance) {
    return next();
  }
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

module.exports._getUrlFromNaviEntryInstance = function _getUrlFromNaviEntryInstance(req) {
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

module.exports._getTargetShortHash = function _getShortHash(req) {
  var branchName = req.targetNaviEntryInstance.branch;
  return find(Object.keys(req.naviEntry.directUrls), function (key) {
    return req.naviEntry.directUrls[key].branch == branchName;
  });
};
