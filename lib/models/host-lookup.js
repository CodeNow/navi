'use strict';

var Api = require('./api.js');
var error = require('../error.js');
var debug = require('auto-debug')();

module.exports = Lookup;

function Lookup () {
  this.api = new Api();
}

/**
 * determines which host to route to
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function(err, host)
 *                         host format: <protocol>/<host>:<port>
 */
Lookup.prototype.lookup = function (req, res, cb) {
  var self = this;

  if (self.api.shouldUse(req)) {
    debug('using api');
    return self.api.getHost(req, cb);
  }

  cb(error.create(502, 'could not find host', req));
};
