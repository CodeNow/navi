'use strict';
require('../loadenv.js');

var fs = require('fs');
var path = require('path');
var url = require('url');
var pluck = require('101/pluck');
var assign = require('101/assign');
var defaults = require('101/defaults');
var httpProxy = require('http-proxy');
var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');
var url = require('url');
var keypather = require('keypather')();
var errorPage = require('models/error-page.js');
var logger = require('middlewares/logger')(__filename);
var createResStream = require('../create-res-stream.js');
var scriptInjectResStreamFactory = require('../script-inject-res-stream.js');
// note do not move this line; it is sync, it must be done on app init
var xhrPatchScript = fs.readFileSync(
  path.resolve(__dirname, '../templates/patch-xhr-with-credentials.js')
);

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

    // proxiedRes is created to buffer the response stream until
    // it is determined whether or not to transform the response
    var proxiedRes = createResStream();
    self.proxy.web(req, proxiedRes, { target: targetHost });

    self.proxy.on('proxyRes', function (proxyRes) {
      var targetInstanceName = keypather.get(req, 'targetInstance.attrs.name');
      self._addHeadersToRes(req, proxyRes, targetInstanceName);
      self._streamRes(proxyRes, proxiedRes, res);
    });
  };
};
/**
 * Pipe target response to the res, maybe after some transformations
 * @param  {HttpResponse}   targetRes  target response
 * @param  {ResponseStream} proxiedRes response used to buffer target response
 * @param  {HttpResponse}   res        actual response
 */
Proxy.prototype._streamRes = function (targetRes, proxiedRes, res) {
  var contentType = targetRes.headers['content-type'];
  var contentEncoding = targetRes.headers['content-encoding'];
  var resIsHtml = /^text\/html/i.test(contentType);
  var resIsGziped = /^gzip/i.test(contentEncoding);

  if (resIsHtml) {
    var scriptInjectStream = scriptInjectResStreamFactory.create(xhrPatchScript, resIsGziped);
    proxiedRes
      .pipe(scriptInjectStream.input);
    scriptInjectStream.output
      .pipe(res);
  }
  else {
    // if the response type is not html transformRes should not modify the response
    // finally pipe target response data to the real response
    proxiedRes.pipe(res);
  }
};
/**
 * Add default cors and runnable headers to the response
 * @param {Request} req incoming request
 * @param {HttpResponse} res http response to add cors headers to
 * @param {String} targetInstanceName instance that handled the request
 */
Proxy.prototype._addHeadersToRes = function (req, res, targetInstanceName) {
  var origin = req.headers.origin || req.headers.referer;
  var headers = ['accept', 'content-type'].join(', ');
  log.trace({
    headers: res.headers
  }, '_addHeadersToRes: before proxyRes headers modification');
  if (res.headers['access-control-allow-origin'] === '*') {
    // Runnable forces withCredentials, which does not work with '*' origin
    // delete, so it uses referer origin value below
    delete res.headers['access-control-allow-origin'];
  }
  // default cors headers to allow all-the-things
  defaults(res.headers, {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': methodsStr,
    'access-control-allow-headers': req.headers['access-control-request-headers'] || headers
  });
  // set cors-credentials and runnable headers
  assign(res.headers, {
    'access-control-allow-credentials': 'true',
    'runnable-instance-name': targetInstanceName
  });
  log.trace({
    headers: res.headers
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
