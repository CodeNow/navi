'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var httpProxy = require('http-proxy');

module.exports = Proxy;
/**
 * responsible for proxying request
 */
function Proxy () {
  this.proxy = httpProxy.createProxyServer({});
}
/**
 * check for host mapping and proxy request if exist
 * else next
 * @return {function} middleware
 */
Proxy.prototype.proxyIfTargetHostExist = function () {
  var self = this;
  return function (req, res, next) {
    var host = req.targetHost;
    debug('target host', host);
    // continue if we do not have a target host
    if (!host) { return next(); }

    self.proxy.web(req, res, { target: host });
  };
};
/**
 * proxy web socket request
 * @return {function} middleware
 */
Proxy.prototype.wsRequestHandler = function ()  {
  var self = this;
  return function (req, socket, head) {
    debug('head', head);
    self.proxy.ws(req, socket, head);
  };
};
