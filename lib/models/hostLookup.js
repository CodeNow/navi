'use strict';

var Cookie = require('./cookie.js');
var Api = require('./api.js');
var error = require('../error.js');

module.exports = Lookup;

function Lookup () {
  // driver
  this.cookie = new Cookie();
  this.api = new Api();
}

/**
 * determines which host to route to
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function()
 */
Lookup.prototype.lookup = function (req, cb) {
  // if cookie return that
  if (this.cookie.shouldUse(req)) {
    this.cookie.getHost(req, cb);
  }

  if (this.api.shouldUse(req)) {
    this.api.getHost(req, cb);
  }

  cb(error.errorCaster(400, 'could not get host', req));
};