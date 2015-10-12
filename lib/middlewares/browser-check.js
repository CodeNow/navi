/**
 * @module lib/middlewares/browser-check
 */
'use strict';

var keypather = require('keypather')();
var put = require('101/put');

var isAgentBrowser = require('user-agent-is-browser');
var log = require('middlewares/logger')(__filename).log;

module.exports = browserCheck;

/**
 * Determine if request created by a browser based on HTTP headers
 */
function browserCheck (req, res, next) {
  var userAgent = keypather.get(req, 'headers["user-agent"]');
  var logData = {
    tx: true,
    req: req,
    userAgent: userAgent
  };
  log.info(logData, 'browserCheck');
  req.isBrowser = false;
  if (userAgent) {
    req.isBrowser = isAgentBrowser(userAgent);
    log.trace(put({
      isBrowser: req.isBrowser
    }, logData), 'browserCheck userAgent');
  } else {
    log.trace(logData, 'browserCheck !userAgent');
  }
  next();
}
