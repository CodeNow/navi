'use strict';

var keypather = require('keypather')();

var isAgentBrowser = require('user-agent-is-browser');
var logger = require('middlewares/logger')(__filename);

var log = logger.log;

module.exports = browserCheck;
function browserCheck (req, res, next) {
  req.isBrowser = false;
  var userAgent = keypather.get(req, 'headers["user-agent"]');
  if (userAgent) {
    req.isBrowser = isAgentBrowser(userAgent);
  }
  log.trace({
    tx: true,
    isBrowser: req.isBrowser
  }, 'browserCheck');
  next();
}
