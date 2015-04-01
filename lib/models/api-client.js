'use strict';
require('../loadenv.js');

var Runnable = require('runnable');
var debug = require('auto-debug')();

function ApiClient () {
  debug.trace();
  this.user = new Runnable(process.env.API_HOST);
}

ApiClient.prototype.getBackend = function (host, referer, cb) {
  debug.trace();
  this.user.fetchBackendForUrl(host, referer, cb);
};

ApiClient.prototype.login = function (cb) {
  debug.trace();
  this.user.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};

module.exports = new ApiClient();
