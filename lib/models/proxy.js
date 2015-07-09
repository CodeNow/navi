'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var httpProxy = require('http-proxy');
var url = require('url');
var errorPage = require('models/error-page.js');

module.exports = Proxy;
/**
 * responsible for proxying request
 */
function Proxy () {
  var self = this;
  this.proxy = httpProxy.createProxyServer({});
    // setup error handling
  this.proxy.on('error', function (err, req, res) {
    debug('proxy error', err);
    if (!req.didError) {
      req.didError = true;
      var errorUrl = errorPage.generateErrorUrl('unresponsive', req.targetInstance);
      var host = getHostAndAugmentReq(req, errorUrl);
      debug('error proxy target', host);
      self.proxy.web(req, res, { target: host });
	}
  });
}
/**
 * returns host to proxy to
 * modifies req url if proxy to error page
 * @param  {object} req        express req object
 * @param  {object} targetHost targetHost which includes qs
 * @return {string}            host to proxy to
 *                             format: <proto>://<host>:<port>
 */
function getHostAndAugmentReq (req, targetHost) {
  var parsedTarget = url.parse(targetHost);
  var host = parsedTarget.protocol + '//' + parsedTarget.host;
  if (parsedTarget.query) {
    req.url =  req.url + parsedTarget.search;
    debug('added querystring to url', req.url);
  }
  return host;
}
/**
 * check for host mapping and proxy request if exist else next
 * @param {String} req.targetHost  is required and must be a url
 * @return {function} middleware
 */
Proxy.prototype.proxyIfTargetHostExist = function () {
  var self = this;
  return function (req, res, next) {
    debug('target host', req.targetHost);
    // continue if we do not have a target host
    if (!req.targetHost) { return next(); }

    var host = getHostAndAugmentReq(req, req.targetHost);

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
/**
 * check for redirectUrl and 301 redirect request if exist else next
 * @param {String} req.redirectUrl is required and must be full url
 * @return {function} middleware
 */
Proxy.redirIfRedirectUrlExist = function (req, res, next) {
  var redirectUrl = req.redirectUrl;
  debug('target redirectUrl', redirectUrl);
  // continue if we do not have a redirectUrl
  if (!redirectUrl) { return next(); }

  res.redirect(307, redirectUrl);
};