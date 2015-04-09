'use strict';
require('../loadenv.js');

var httpProxy = require('http-proxy');

var debug = require('auto-debug')();
var error = require('../error.js');
var HostLookup = require('./host-lookup.js');

module.exports = Proxy;

function Proxy () {
  this.proxy = httpProxy.createProxyServer({});
  this.hostLookup = new HostLookup();
}

/**
 * lookup host and proxy request
 * @param  {object} req  the request
 * @param  {object} res  the response
 */
Proxy.prototype.requestHandler = function (req, res) {
  debug();
  var self = this;
  self.hostLookup.lookup(req, res, function(err, target) {
    debug('requestHandler:err,target', err, target);
    if (err) { return error.errorResponder(err, res); }
    self.proxy.web(req, res, { target: target });
  });
};

/**
 * proxy web socket request
 * @return {function} web socket upgrade middleware
 */
Proxy.prototype.wsRequestHandler = function ()  {
  var self = this;
  return function (req, socket, head) {
    debug('head', head);
    self.proxy.ws(req, socket, head);
  };
};
