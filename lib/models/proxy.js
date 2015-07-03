'use strict';
require('../loadenv.js');

var url = require('url');
var pluck = require('101/pluck');
var assign = require('101/assign');
var defaults = require('101/defaults');
var isString = require('101/is-string');
var debug = require('auto-debug')();
var httpProxy = require('http-proxy');
var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');

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
    var targetHost = req.targetHost;
    debug('target host', targetHost);
    // continue if we do not have a target host
    if (!targetHost) { return next(); }

    self.proxy.web(req, res, { target: targetHost });
    self.proxy.on('proxyRes', function (proxyRes) {
      self._addHeadersToRes(proxyRes, req.headers.referer, targetHost);
    });
  };
};
/**
 * Add default cors and runnable headers to the response
 * @param {HttpResponse} res http response to add cors headers to
 * @param {Url} reqReferer request referer header
 * @param {String} targetInstanceName instance that handled the request
 */
Proxy.prototype._addHeadersToRes = function (proxyRes, reqReferer, targetInstanceName) {
  var origin = getOrigin(reqReferer);
  var headers = ['accept', 'content-type'].join(', ');
  if (proxyRes.headers['Access-Control-Allow-Origin'] === '*') {
    // Runnable forces withCredentials, which does not work with '*' origin
    // delete, so it uses referer origin value below
    delete proxyRes.headers['Access-Control-Allow-Origin'];
  }
  // default cors headers to allow all-the-things
  defaults(proxyRes.headers, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methodsStr,
    'Access-Control-Allow-Headers': headers
  });
  // set cors-credentials and runnable headers
  assign(proxyRes.headers, {
    'Access-Control-Allow-Credentials': 'true',
    'Runnable-Instance-Name': targetInstanceName
  });
  function getOrigin (url) {
    if (!isString(url)) {
      return '*';
    }
    var parsed = url.parse(url);
    delete parsed.pathname;
    delete parsed.path;
    delete parsed.href;
    var origin = url.format(parsed);

    return  origin || '*';
  }
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