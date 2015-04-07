'use strict';

var Cookie = require('./cookie.js');
var Api = require('./api.js');
var error = require('../error.js');
var debug = require('auto-debug')();

module.exports = Lookup;

function Lookup () {
  this.cookie = new Cookie();
  this.api = new Api();
}

/**
 * determines which host to route to
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function(err, host)
 *                         host format: <protocol>/<host>:<port>
 */
Lookup.prototype.lookup = function (req, res, cb) {
  debug('lookup');
  var self = this;
  // if cookie return that
  if (self.cookie.shouldUse(req)) {
    debug('lookup:using cookie');
    return self.cookie.getHost(req, cb);
  }

  if (self.api.shouldUse(req)) {
    debug('lookup:using api');
    return self.api.getHost(req, function(err, host) {
      if (err) { return cb(err); }
      self.cookie.saveHost(res, host);
      cb(null, host);
    });
  }

  cb(error.create(502, 'could not find host', req));
};
