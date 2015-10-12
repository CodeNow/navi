'use strict';
require('../loadenv.js');

var ErrorCat = require('error-cat');
var async = require('async');
var domain = require('domain');
var express = require('express');
var flow = require('middleware-flow');
var http = require('http');
var keypather = require('keypather')();
var uuid = require('node-uuid');

var ProxyServer = require('models/proxy.js');
var Session = require('models/session.js');
var api = require('models/api.js');
var browserCheck = require('middlewares/browser-check.js');
var corsForErr = require('middlewares/cors-for-err.js');
var logger = require('middlewares/logger')(__filename);
var reportErr = require('middlewares/report-err.js');

var log = logger.log;

module.exports = Server;
/**
 * responsible for constructing express app
 */
function Server () {
  this.proxy = new ProxyServer();
  this.session = new Session();
  this.app = express();
  this.server = http.createServer(this.app);
}
/**
 * Middleware to assign tid to all requests
 */
Server.prototype._setupDomainTid = function (req, res, next) {
  log.trace('_setupDomainTid');
  process.domain.runnableData = {
    tid: uuid.v4(),
    url: req.method.toLowerCase()+' '+req.url
  };
  // TODO sessionUser data...
  res.set(process.env.TID_RESPONSE_HEADER_KEY, keypather.get(req.domain, 'runnableData.tid'));
  log.trace({
    tx: true
  }, 'runnableData initialized');
  next();
};
/**
 * adds middleware to express router
 */
Server.prototype._setupMiddleware = function() {
  log.trace('_setupMiddlware');
  // NOTE: mw only works for non web socket request
  // to include middleware for ws add to _handleUserWsRequest
  this.app.use(require('express-domain-middleware'));
  this.app.use(this.session.handle());
  this.app.use(this._setupDomainTid);
  this.app.use(browserCheck);
  this.app.use(this._handleUserRequest());
  this.app.use(corsForErr);
  this.app.use(reportErr);
  this.app.use(ErrorCat.middleware);
  this.server.on('upgrade', this._handleUserWsRequest());
};
/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserRequest = function() {
  log.trace('_handleUserRequest');
  return flow.series(
    Session.getCookieFromToken,
    api.createClient,
    api.checkIfLoggedIn,
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
  log.trace('_handleUserWsRequest');
  var self = this;
  return function (req, socket, head) {
    var _domain = domain.create();
    _domain.on('error', function (err) {
      log.error({
        tx: true,
        err: err
      }, '_handleUserWsRequest error');
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
          api.createClient(req, null, cb);
        },
        function (cb) {
          api.checkIfLoggedIn(req, null, cb);
        },
        function closeIfRedirExist (cb) {
          var redirectUrl = req.redirectUrl;
          log.trace({
            tx: true,
            redirectUrl: redirectUrl
          }, 'closeIfRedirExist');
          // close socket if we have redir url
          if (redirectUrl) {
            return cb(ErrorCat.create(400, 'ws: user not logged in'));
          }
          cb();
        },
        function (cb) {
          api.getTargetHost(req, null, cb);
        }], function (err) {
          if (err) {
            log.error({
              tx: true,
              err: err
            }, 'closeIfRedirExist error');
            return socket.destroy();
          }
          self.proxy.proxyWsIfTargetHostExist(req, socket, head);
        }
      );
    });
  };
};
/**
 * start the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.start = function (cb) {
  var self = this;
  self._setupMiddleware();
  api.loginSuperUser(function (err) {
    if (err) { return cb(err); }
    self.server.listen(process.env.HTTP_PORT, cb);
  });
};
/**
 * stop the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.stop = function (cb) {
  this.server.close(cb);
};
