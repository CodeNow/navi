'use strict';
require('../loadenv.js');

var Runnable = require('runnable');
var debug = require('auto-debug')();

function ApiClient () {
  this.user = new Runnable(process.env.API_HOST);
}

/**
 * should call API and return backend to route to
 * @param  {string}   url     url requested <protocol>/<host>:<port>
 * @param  {string}   referer http header
 * @param  {Function} cb      (err, host)
 *                            host: <protocol>/<host>:<port>
 */
ApiClient.prototype.getBackend = function (url, referer, cb) {
  debug.trace(arguments);
  this.user.fetchBackendForUrl(url, referer, cb);
};
/**
 * login to github
 * @param  {Function} cb (null)
 */
ApiClient.prototype.login = function (cb) {
  debug.trace(arguments);
  this.user.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};

module.exports = new ApiClient();
