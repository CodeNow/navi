'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var express = require('express');
var flow = require('middleware-flow');
var http = require('http');

var Api = require('./api.js');
var error = require('../error.js');
var ProxyServer = require('./proxy.js');
var Session = require('./session.js');

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
  this.app.use(this.handleRequest());
  this.app.use(error.errorResponder);
  this.server.on('upgrade', this.proxy.wsRequestHandler());
};
/**
 * handles every request
 * 3 types of request hit navi.
 *   no  user has token -> should finish auth and redirect
 *   no  user no  token -> should redirect to API
 *   has user           -> should redirect
 * @return {object} middleware request handler
 */
Server.prototype.handleRequest = function() {
  var self = this;
  return flow.series(
    flow.syncIf(self.session.shouldUse)
      .then(self.session.getUserFromToken),
    flow.syncIf(self.proxy.shouldUse)
      .then(self.proxy.requestHandler()),
    Api.redirect()
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
