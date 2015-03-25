'use strict';
require('../loadenv.js');

var http = require('http');
var httpProxy = require('http-proxy');
var HostLookup = require('./hostLookup.js');

module.exports = Proxy;

function Proxy () {
  // driver
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
 * lookup host and proxy request
 * @param  {object} req  the request object
 * @param  {object} req  the response object
 */
Proxy.prototype.requestHandler = function (req, res) {
  var self = this;
  self.hostLookup.lookup(req, function(err, target) {
    if (err) { return self.handleError(res); }

    self.proxy.web(req, res, { target: target });
  });
};

/**
 * proxy ws request
 * @param  {object} req  the request object
 * @param  {object} req  the response object
 */
Proxy.prototype.wsRequestHandler = function (req, socket, head) {
  this.proxy.ws(req, socket, head);
};

/**
 * sends 500 error response
 * @param  {object} req  the response object
 */
Proxy.prototype.handleError = function (res) {
  res.writeHead(500, {'Content-Type': 'text/plain'});
  res.end('try again later');
};