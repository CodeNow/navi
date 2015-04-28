'use strict';
require('../loadenv.js');

var debug = require('auto-debug')();
var httpProxy = require('http-proxy');
var keypath = require('keypather')();

var api = require('./api.js');

module.exports = Proxy;

function Proxy () {
  this.proxy = httpProxy.createProxyServer({});
}
/**
 * determine if we should use this
 * use proxy if we have a host header and userId
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if this driver can be used. else false
 */
Proxy.prototype._shouldUse = function (req) {
  debug('headers', req.headers, 'session', req.session);
  var host = keypath.get(req, 'headers.host');
  var userId = keypath.get(req, 'session.userId');
  if (!host || !userId) {
    return false;
  }
  return true;
};
/**
 * lookup host and proxy request
 * @param  {object} req  the request
 * @param  {object} res  the response
 */
Proxy.prototype.requestHandler = function () {
  var self = this;
  return function (req, res, next) {
    if (!self._shouldUse(req)) { return next(); }

    api.getHost(req, function (err, target) {
      debug('err', err, 'target', target);
      if (err) { return next(err); }
      // continue if we do not have a target
      if (!target) { return next(); }

      self.proxy.web(req, res, { target: target });
    });
  };
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
