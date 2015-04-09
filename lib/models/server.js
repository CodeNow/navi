'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var express = require('express');
var http = require('http');

var ProxyServer = require('./proxy.js');
var Session = require('./session.js');

module.exports = Server;

function Server () {
  this.proxy = new ProxyServer();
  this.app = express();
  this.server = http.createServer(this.app);
  this.session = new Session();
}
/**
 * adds middleware to express router
 */
Server.prototype._setupMiddleware = function() {
  var self = this;
  self.app.use(self.session.handle());
  self.app.use(function (req, res) {
    self.proxy.requestHandler(req, res);
  });
  self.server.on('upgrade', self.proxy.wsRequestHandler());
};
/**
 * start the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.start = function (cb) {
  debug('start');
  this._setupMiddleware();
  this.server.listen(process.env.HTTP_PORT, cb);
};
/**
 * stop the proxy server
 * @param  {Function} cb (err)
 */
Server.prototype.stop = function (cb) {
  debug('stop');
  this.server.close(cb);
};
