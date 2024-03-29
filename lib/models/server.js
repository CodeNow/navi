/**
 * @module lib/models/server
 */
'use strict';
require('loadenv')();

var async = require('async');
var domain = require('domain');
var ErrorCat = require('error-cat');
const RouteError = require('error-cat/errors/route-error');

var express = require('express');
var flow = require('middleware-flow');
var http = require('http');
var keypather = require('keypather')();
var put = require('101/put');
var uuid = require('uuid');

var Session = require('models/session.js');
var api = require('models/api.js');
var browserCheck = require('middlewares/browser-check.js');
var dataFetch = require('middlewares/data-fetch.js');
var corsForErr = require('middlewares/cors-for-err.js');
var log = require('middlewares/logger')(__filename).log;
var mongo = require('models/mongo');
var reportErr = require('middlewares/report-err.js');
var resolveUrls = require('middlewares/resolve-urls');
var redirectDisabled = require('middlewares/redirect-disabled');
var checkContainerStatus = require('middlewares/check-container-status');
var ProxyServer = require('models/proxy.js');

module.exports = Server;

/**
 * responsible for constructing express app
 */
function Server () {
  log.info('Server constructor');
  this.proxy = new ProxyServer();
  this.session = new Session();
  this.app = express();
  this.httpServer = http.createServer(this.app);
}

/**
 * start the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.start = function (cb) {
  var logData = {
    tx: true
  };
  log.info(logData, 'Server.prototype.start');
  var self = this;
  self._setupMiddleware();

  mongo.start(function (err) {
    if (err) {
      log.error({
        err: err
      }, 'start monogo.start error');
      return cb(err);
    }
    log.trace('start mongo.start success');
    self.httpServer.listen(process.env.HTTP_PORT, cb);
  });
};

/**
 * stop the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.stop = function (cb) {
  log.info({
    tx: true
  }, 'Server.prototype.stop');
  var self = this;
  mongo.stop(function () {
    self.httpServer.close(cb);
  });
};

/**
 * Middleware to assign tid to all requests
 */
Server.prototype._setupDomainTid = function (req, res, next) {
  log.info('Server.prototype._setupDomainTid');
  process.domain.runnableData = {
    tid: uuid.v4(),
    url: req.method.toLowerCase()+' '+req.url,
    // each log message will report how much time has passed since this Date object initialized
    // and its invocation
    reqStart: new Date()
  };
  // TODO sessionUser data...
  res.set(process.env.TID_RESPONSE_HEADER_KEY, keypather.get(req.domain, 'runnableData.tid'));
  log.trace({
    tx: true
  }, '_setupDomainTid initialized');
  next();
};

/**
 * adds middleware to express router
 */
Server.prototype._setupMiddleware = function () {
  log.info('Server.prototype._setupMiddlware');
  this.app.get('/robots.txt', this.serveRobots);
  this.app.use('/health-610f09d0-8502-11e6-8cce-e3c360b6e938', (req, res) => {
    res.status(200).send()
  })
  // NOTE: mw only works for non web socket request
  // to include middleware for ws add to _handleUserWsRequest
  this.app.use(require('express-domain-middleware'));
  this.app.use(this._setupDomainTid);
  this.app.use(this.session.handle());
  this.app.use(browserCheck);
  this.app.use(dataFetch.middleware);
  this.app.use(resolveUrls.middleware);
  this.app.use(redirectDisabled.middleware);
  this.app.use(checkContainerStatus.middleware);
  this.app.use(this.proxy.proxyIfTargetHostExist());
  this.app.use(this._handleUserRequest());
  this.app.use(corsForErr);
  this.app.use(reportErr);
  this.app.use(ErrorCat.middleware);
  this.app.enable('trust proxy')
  /* jslint unused:false */
  this.app.use((err, req, res, next) => {
    res.writeHead(
      err.isBoom ? err.output.statusCode : 500,
      {'Content-Type': 'application/json'}
    );
    res.end(JSON.stringify(
      err.isBoom ? err.output.payload : 'Internal Server Error'
    ));
  });
  this.httpServer.on('upgrade', this._handleUserWsRequest());
};

/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserRequest = function() {
  log.info({
    tx: true
  }, 'Server.prototype._handleUserRequest');
  return flow.series(
    Session.getSharedSessionDataFromStore,
    this.proxy.proxyIfTargetHostExist(),
    ProxyServer.redirectIfRedirectUrlExists,
    api.getTargetHost,
    this.proxy.proxyIfTargetHostExist(),
    ProxyServer.redirectIfRedirectUrlExists
  );
};

/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserWsRequest = function () {
  var logData = {
    tx: true
  };
  log.info(logData, 'Server.prototype._handleUserWsRequest');
  var self = this;
  return function (req, socket, head) {
    var _domain = domain.create();
    if (keypather.get(process, 'domain.runnableData')) {
      _domain.runnableData = process.domain.runnableData;
    }
    _domain.on('error', function (err) {
      log.error(put({
        err: err
      }, logData), '_handleUserWsRequest error');
      return socket.destroy();
    });
    _domain.run(function () {
      async.series([
        function (cb) {
          browserCheck(req, null, cb);
        },
        function (cb) {
          self.session.handle()(req, {}, cb);
        },
        function (cb) {
          dataFetch.middleware(req, null, cb);
        },
        function (cb) {
          resolveUrls.middleware(req, null, cb);
        },
        function (cb) {
          redirectDisabled.middleware(req, null, cb);
        },
        function (cb) {
          checkContainerStatus.middleware(req, null, cb);
        },
        function (cb) {
          if (req.targetHost) {
            self.proxy.proxyWsIfTargetHostExist(req, socket, head);
          } else {
            cb();
          }
        },
        function closeIfRedirExist (cb) {
          var redirectUrl = req.redirectUrl;
          log.trace(put({
            redirectUrl: redirectUrl
          }, logData), '_handleUserWsRequest closeIfRedirExist');
          // close socket if we have redir url
          if (redirectUrl) {
            return cb(new RouteError('ws: user not logged in', 400));
          }
          cb();
        },
        function (cb) {
          api.getTargetHost(req, null, cb);
        }], function (err) {
          if (err) {
            log.error(put({
              err: err
            }, logData), '_handleUserWsRequest closeIfRedirExist error');
            return socket.destroy();
          }
          log.trace(logData, '_handleUserWsRequest success');
          self.proxy.proxyWsIfTargetHostExist(req, socket, head);
        }
      );
    });
  };
};

/**
 * Serve the robots.txt file
 * @param {Object} req - Express request obj
 * @param {Object} res - Express response obj
 */
Server.prototype.serveRobots = function (req, res) {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /');
};
