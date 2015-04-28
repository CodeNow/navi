'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var express = require('express');
var flow = require('middleware-flow');
var http = require('http');

var error = require('error.js');
var ProxyServer = require('models/proxy.js');
var Session = require('models/session.js');
var api = require('models/api.js');

module.exports = Server;

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
  this.app.use(this.session.handle());
  this.app.use(this._handleUserRequest());
  this.app.use(error.errorResponder);
  this.server.on('upgrade', this.proxy.wsRequestHandler());
};
/**
 * handles every request in order
 * each mw should just next() if it does not need to handle the request
 * @return {object} middleware request handler
 */
Server.prototype._handleUserRequest = function() {
  return flow.series(
    api.ensureUserLoggedIn,
    this.session.getUserFromToken,
    this.proxy.requestHandler(),
    api.checkForDirectUrl()
  );
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
