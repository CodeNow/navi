'use strict';
require('../loadenv.js');

var url = require('url');
var pluck = require('101/pluck');
var assign = require('101/assign');
var defaults = require('101/defaults');
var isString = require('101/is-string');
var httpProxy = require('http-proxy');
var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');
var url = require('url');
var keypather = require('keypather')();
var errorPage = require('models/error-page.js');
var logger = require('middlewares/logger')(__filename);

var log = logger.log;

module.exports = Proxy;
/**
 * responsible for proxying request
 */
function Proxy () {
  var self = this;
  this.proxy = httpProxy.createProxyServer({});
    // setup error handling
  this.proxy.on('error', function (err, req, res) {
    log.error({
      tx: true,
      err: err,
      req: req
    }, 'proxy.on error');
    if (!req.didError) {
      req.didError = true;
      var errorUrl = errorPage.generateErrorUrl('unresponsive', req.targetInstance);
      var targetHost = getHostAndAugmentReq(req, errorUrl);
      log.trace({
        tx: true,
        targetHost: targetHost,
        errorUrl: errorUrl
      }, 'error proxy target');
      self.proxy.web(req, res, { target: targetHost });
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
  log.trace({
    tx: true,
    req: req,
    targetHost: targetHost
  }, 'getHostAndAugmentReq');
  var parsedTarget = url.parse(targetHost);
  var host = parsedTarget.protocol + '//' + parsedTarget.host;
  if (parsedTarget.query) {
    req.url =  req.url + parsedTarget.search;
    log.trace({
      tx: true,
      url: req.url
    }, 'added queryString to url');
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
    log.trace({
      tx: true,
      targetHost: req.targetHost
    }, 'target host');
    // continue if we do not have a target host
    if (!req.targetHost) { return next(); }
    var targetHost = getHostAndAugmentReq(req, req.targetHost);
    log.trace({
      tx: true,
      targetHost: targetHost
    }, 'augmented req');
    self.proxy.web(req, res, { target: targetHost });
    self.proxy.on('proxyRes', function (proxyRes) {
      var targetInstanceName = keypather.get(req, 'targetInstance.attrs.name');
      self._addHeadersToRes(proxyRes, req, targetInstanceName);
    });
  };
};
/**
 * Add default cors and runnable headers to the response
 * @param {HttpResponse} res http response to add cors headers to
 * @param {Request} req incoming request
 * @param {String} targetInstanceName instance that handled the request
 */
Proxy.prototype._addHeadersToRes = function (proxyRes, req, targetInstanceName) {
  var origin = req.headers.origin;
  var headers = ['accept', 'content-type'].join(', ');
  log.trace({
    headers: proxyRes.headers
  }, '_addHeadersToRes: before proxyRes headers modification');
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
  log.trace({
    headers: proxyRes.headers
  }, '_addHeadersToRes: after proxyRes headers modification');
};
/**
 * proxy web socket request
 * @return {function} middleware
 */
Proxy.prototype.proxyWsIfTargetHostExist = function (req, socket, head) {
  var host = req.targetHost;
  log.trace({
    tx: true,
    host: host
  }, 'proxyWsIfTargetHostExist');
  // close socket if no host
  if (!host) {
    return socket.destroy();
  }
  var hostname = url.parse(host).hostname;
  var port = url.parse(host).port;

  log.trace({
    tx: true,
    hostname: hostname,
    port: port
  }, 'target host ws');

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
  log.trace({
    tx: true,
    redirectUrl: redirectUrl
  }, 'redirIfRedirectUrlExist');
  // continue if we do not have a redirectUrl
  if (!redirectUrl) { return next(); }

  res.redirect(307, redirectUrl);
};
