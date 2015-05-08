'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var httpProxy = require('http-proxy');
var url = require('url');

module.exports = Proxy;
/**
 * responsible for proxying request
 */
function Proxy () {
  this.proxy = httpProxy.createProxyServer({});
}
/**
 * check for host mapping and proxy request if exist else next
 * @param {String} req.targetHost  is required and must be a url
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
Proxy.prototype.proxyWsIfTargetHostExist = function (req, socket, head) {
  var host = req.targetHost;
  // close socket if no host
  if (!host) {
    debug('closing socket, not host found', hostname, port);
    return socket.destroy();
  }
  var hostname = url.parse(host).hostname;
  var port = url.parse(host).port;

  debug('target host ws', hostname, port);

  this.proxy.ws(req, socket, head, {
    target: {
      host: hostname,
      port: port
    }
  });
};
