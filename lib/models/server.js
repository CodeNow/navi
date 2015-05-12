'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var express = require('express');
var flow = require('middleware-flow');
var mw = require('dat-middleware');
var http = require('http');
var async = require('async');
var ErrorCat = require('error-cat');

var api = require('models/api.js');
var ProxyServer = require('models/proxy.js');
var Session = require('models/session.js');
var Whitelist = require('models/whitelist.js');

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
 * adds middleware to express router
 */
Server.prototype._setupMiddleware = function() {
  this.app.use(require('express-domain-middleware'));
  this.app.use(this._handleNonBrowserRequest());
  this.app.use(this.session.handle());
  this.app.use(this._handleUserRequest());
  this.app.use(ErrorCat.middleware);
  this.server.on('upgrade', this._handleUserWsRequest());
};
/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserRequest = function() {
  return flow.series(
    Session.getCookieFromToken,
    api.createClient,
    api.redirectIfNotLoggedIn,
    api.getTargetHost,
    this.proxy.proxyIfTargetHostExist(),
    ProxyServer.redirIfRedirectUrlExist
  );
};
/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleNonBrowserRequest = function() {
  return flow.series(
      Whitelist.isNotBrowser,
      mw.req('isNotBrowser').require()
        .then(
          Whitelist.senderIsOnlist,
          mw.req().set('apiSuperUser', 'true'),
          api.createClient,
          api.getContainerUrlForRequest,
          this.proxy.proxyIfTargetHostExist()
        )
    );
};
/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserWsRequest = function () {
  var self = this;
  return function (req, socket, head) {
    async.series([
      function (cb) {
        self.session.handle()(req, {}, cb);
      },
      function (cb) {
        if (!req.session.apiCookie) {
          return cb(ErrorCat.create(400, 'no cookie found'));
        }
        api.createClient(req, null, cb);
      },
      function (cb) {
        api.getTargetHost(req, null, cb);
      }], function (err) {
        if (err) {
          debug('closing socket due to error', err);
          return socket.destroy();
        }
        self.proxy.proxyWsIfTargetHostExist(req, socket, head);
      }
    );
  };
};
/**
 * start the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.start = function (cb) {
  debug();
  this._setupMiddleware();
  this.server.listen(process.env.HTTP_PORT, cb);
};
/**
 * stop the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.stop = function (cb) {
  debug();
  this.server.close(cb);
};
