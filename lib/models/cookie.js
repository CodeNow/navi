'use strict';
require('../loadenv.js');

var cookie = require('cookie');
var setCookie = require('set-cookie');
var debug = require('auto-debug')();

module.exports = Cookie;

function Cookie () {}

/**
 * determine if we should use this
 *   check to see if there is a cookie with navi value
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if we can use this driver
 */
Cookie.prototype.shouldUse = function (req) {
  if(!process.env.ENABLE_COOKIE) { return false; }
  var headers = req.headers;
  debug('shouldUse:headers', headers);
  if (!headers || !headers.cookie) {
    return false;
  }

  var cookies = cookie.parse(headers.cookie);

  if (cookies[process.env.COOKIE_NAME]) {
    this.cookieValue = cookies[process.env.COOKIE_NAME];
    return true;
  }

  return false;
};

/**
 * get host based on cookie
 * @param  {object}   req  not used
 * @param  {Function} cb   function (err, host)
 *                         host format: <protocol>/<host>:<port>
 */
Cookie.prototype.getHost = function (req, cb) {
  debug('getHost:cookieValue', this.cookieValue);
  cb(null, this.cookieValue);
};

/**
 * save expected host into cookie of response
 * @param  {object}   res  the response object to save to
 * @param  {object}   host format: <protocol>/<host>:<port>
 */
Cookie.prototype.saveHost = function (res, host) {
  if(!process.env.ENABLE_COOKIE) { return; }
  debug('saveHost:host', host);
  setCookie(process.env.COOKIE_NAME, host, {
    domain: process.env.COOKIE_DOMAIN,
    maxAge: process.env.COOKIE_MAX_AGE_SECONDS,
    res: res
  });
};
