'use strict';
var keypather = require('keypather')();
var isAgentBrowser = require('user-agent-is-browser');
var debug = require('auto-debug')();

module.exports = browserCheck;
function browserCheck (req, res, next) {
  req.isBrowser = false;
  var userAgent = keypather.get(req, 'headers["user-agent"]');
  if (userAgent) {
    req.isBrowser = isAgentBrowser(userAgent);
  }
  debug('is request browser?', req.isBrowser);
  next();
}
