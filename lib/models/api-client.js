'use strict';
require('../loadenv.js');

var Runnable = require('runnable');
var debug = require('auto-debug')();

function ApiClient () {
  debug.trace();
  this.user = new Runnable(process.env.API_HOST);
}

/**
 * should call API and return backend to route to
 * @param  {[type]}   url     url requested <protocol>/<host>:<port>
 * @param  {[type]}   referer http header
 * @param  {Function} cb      (err, host)
 *                            host: <protocol>/<host>:<port>
 */
ApiClient.prototype.getBackend = function (url, referer, cb) {
  debug.trace();
  this.user.fetchBackendForUrl(url, referer, cb);
};

ApiClient.prototype.login = function (cb) {
  debug.trace();
  this.user.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};

module.exports = new ApiClient();
