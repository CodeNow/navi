'use strict';
require('../loadenv.js');

var http = require('http');
var httpProxy = require('http-proxy');
var HostLookup = require('./host-lookup.js');
var error = require('../error.js');

module.exports = Proxy;

function Proxy () {
  this.proxy = httpProxy.createProxyServer({});
  this.hostLookup = new HostLookup();
  this.server = http.createServer(this.requestHandler);
  this.server.on('upgrade', this.wsRequestHandler);
}

/**
 * start the proxy server
 * @param  {Function} cb function(err)
 */
Proxy.prototype.start = function (cb) {
  this.server.listen(process.env.HTTP_PORT, cb);
};

/**
 * stop the proxy server
 * @param  {Function} cb function(err)
 */
Proxy.prototype.stop = function (cb) {
  this.server.close(cb);
};

/**
 * lookup host and proxy request
 * @param  {object} req  the request
 * @param  {object} res  the response
 */
Proxy.prototype.requestHandler = function (req, res) {
  var self = this;
  self.hostLookup.lookup(req, res, function(err, target) {
    if (err) { return error.errorResponder(err, res); }

    self.proxy.web(req, res, { target: target });
  });
};

/**
 * proxy ws request
 * @param  {object} req    the request
 * @param  {object} socket the socket
 * @param  {object} head   headers
 */
Proxy.prototype.wsRequestHandler = function (req, socket, head) {
  this.proxy.ws(req, socket, head);
};