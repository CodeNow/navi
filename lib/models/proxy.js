/**
 * @module lib/models/proxy
 */
'use strict';
require('../loadenv.js');

var assign = require('101/assign');
var defaults = require('101/defaults');
var fs = require('fs');
var httpProxy = require('http-proxy');
var keypather = require('keypather')();
var path = require('path');
var pluck = require('101/pluck');
var put = require('101/put');
var url = require('url');

var createResStream = require('create-res-stream.js');
var errorPage = require('models/error-page.js');
var log = require('middlewares/logger')(__filename).log;
var scriptInjectResStreamFactory = require('script-inject-res-stream.js');

var methodsStr = require('methods').map(pluck('toUpperCase()')).join(',');

// note do not move this line; it is sync, it must be done on app init
var xhrPatchScript = fs.readFileSync(
  path.resolve(__dirname, '../templates/patch-xhr-with-credentials.js')
  , 'utf8');
xhrPatchScript.replace('{{DOMAIN}}', process.env.COOKIE_DOMAIN);
module.exports = Proxy;

/**
 * responsible for proxying request
 */
function Proxy () {
  log.info('Proxy constructor');
  var self = this;
  this.proxy = httpProxy.createProxyServer({});
    // setup error handling
  this.proxy.on('error', function (err, req/*, proxiedRes */) {
    var res = req.res;
    var logData = {
      tx: true,
      err: err,
      req: req
    };
    log.error(logData, 'proxy.on error');
    if (!req.didError) {
      req.didError = true;
      var errorUrl = errorPage.generateErrorUrl('unresponsive', {
        elasticUrl: '',
        targetBranch: ''
      });
      var targetHost = getHostAndAugmentReq(req, errorUrl);
      log.trace(put({
        targetHost: targetHost,
        errorUrl: errorUrl
      }, logData), 'proxy.on error !req.didError');
      self.proxy.web(req, res, { target: targetHost });
  	} else {
      log.trace(logData, 'proxy.on error req.didError');
    }
  });

  /**
   * Listen to proxy events for timing logs
   */
  this.proxy.on('proxyReq', function () {
    log.trace({
      tx: true
    }, 'proxy.on proxyReq');
  });

  this.proxy.on('proxyRes', function (proxyRes, req, proxiedRes) {
    var res = req.res;
    var targetInstanceName = keypather.get(req, 'targetInstance.attrs.name');
    log.trace({
      tx: true,
      targetInstanceName: targetInstanceName,
      res: res
    }, 'proxy.on proxyRes');
    self._addHeadersToRes(req, proxyRes, targetInstanceName);
    self._streamRes(proxyRes, proxiedRes, res);
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
  var logData = {
    tx: true,
    req: req,
    targetHost: targetHost,
    host: host,
    parsedTarget: parsedTarget
  };
  log.info(logData, 'getHostAndAugmentReq');
  if (parsedTarget.query) {
    req.url =  req.url + parsedTarget.search;
    logData.url = req.url;
    log.trace(logData, 'getHostAndAugmentReq parsedTarget.query');
  } else {
    log.trace(logData, 'getHostAndAugmentReq !parsedTarget.query');
  }
  return host;
}

/**
 * check for host mapping and proxy request if exist else next
 * @param {String} req.targetHost is required and must be a url
 * @return {function} middleware
 */
Proxy.prototype.proxyIfTargetHostExist = function () {
  log.info({ tx: true }, 'Proxy.prototype.proxyIfTargetHostExist');
  var self = this;
  return function (req, res, next) {
    var logData = {
      tx: true,
      targetHost: req.targetHost
    };
    log.trace(logData, 'proxyIfTargetHostExist');
    // continue if we do not have a target host
    if (!req.targetHost) {
      log.trace(logData, 'proxyIfTargetHostExist !req.targetHost');
      return next();
    }
    var targetHost = getHostAndAugmentReq(req, req.targetHost);
    log.trace(put({
      augmentedTargetHost: targetHost
    }, logData), 'proxyIfTargetHostExist augmentedTargetHost');
    // proxiedRes is created to buffer the response stream until
    // it is determined whether or not to transform the response
    var proxiedRes = createResStream();
    self.proxy.web(req, proxiedRes, { target: targetHost });
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
  var logData = {
    tx: true,
    contentType: contentType,
    contentEcoding: contentEncoding,
    resIsHtml: resIsHtml,
    resIsGziped: resIsGziped
  };
  log.info(logData, 'Proxy.prototype._streamRes');
  if (resIsHtml) {
    log.trace(logData, '_streamRes resIsHtml');
    delete targetRes.headers['content-length'];
    var scriptInjectStream = scriptInjectResStreamFactory.create(xhrPatchScript, resIsGziped);
    proxiedRes
      .pipe(scriptInjectStream.input);
    scriptInjectStream.output
      .pipe(res);
  }
  else {
    log.trace(logData, '_streamRes !resIsHtml');
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
  var logData = {
    tx: true,
    origin: origin,
    headers: headers
  };
  log.info(logData, 'Proxy.prototype._addHeadersToRes');
  if (res.headers['access-control-allow-origin'] === '*') {
    log.trace(logData, '_addHeadersToRes');
    // Runnable forces withCredentials, which does not work with '*' origin
    // delete, so it uses referer origin value below
    delete res.headers['access-control-allow-origin'];
  }
  // default cors headers to allow all-the-things
  var extendHeaders = {
    'access-control-allow-methods': methodsStr,
    'access-control-allow-headers': req.headers['access-control-request-headers'] || headers
  };
  if (origin) { extendHeaders['access-control-allow-origin'] = origin; }
  defaults(res.headers, extendHeaders);
  // set cors-credentials and runnable headers
  assign(res.headers, {
    'access-control-allow-credentials': 'true',
    'runnable-instance-name': targetInstanceName
  });
  log.trace(put({
    modifiedHeaders: res.headers
  }, logData), '_addHeadersToRes modifiedHeaders');
};

/**
 * proxy web socket request
 * @return {function} middleware
 */
Proxy.prototype.proxyWsIfTargetHostExist = function (req, socket, head) {
  var host = req.targetHost;
  var logData = {
    tx: true,
    host: host
  };
  log.info(logData, 'Proxy.prototype.proxyWsIfTargetHostExist');
  // close socket if no host
  if (!host) {
    log.trace(logData, 'proxyWsIfTargetHostExist !host');
    return socket.destroy();
  }
  var hostname = url.parse(host).hostname;
  var port = url.parse(host).port;
  logData.hostname = hostname;
  logData.port = port;
  log.trace(logData, 'proxyWsIfTargetHostExist host');
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
Proxy.redirectIfRedirectUrlExists = function (req, res, next) {
  var redirectUrl = req.redirectUrl;
  var logData = {
    tx: true,
    redirectUrl: redirectUrl
  };
  log.info(logData, 'Proxy.redirectIfRedirectUrlExists');
  // continue if we do not have a redirectUrl
  if (!redirectUrl) {
    log.trace(logData, 'Proxy.redirectIfRedirectUrlExists !redirectUrl');
    return next();
  }
  log.trace(logData, 'Proxy.redirectIfRedirectUrlExists redirectUrl');
  res.redirect(307, redirectUrl);
};
