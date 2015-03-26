'use strict';
var cookie = require('cookie');
var setCookie = require('set-cookie');

module.exports = Cookie;

function Cookie () {}

/**
 * determine if we should use this
 *   check to see if there is a cookie with navi value
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if we can use this driver
 */
Cookie.prototype.shouldUse = function (req) {
  var headers = req.headers;
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
 *                         host is ip and port
 */
Cookie.prototype.getHost = function (req, cb) {
  cb(null, this.cookieValue);
};

/**
 * save expected host into cookie of respose
 * @param  {object}   res  the response object to save to
 * @param  {object}   res  cookie
 */
Cookie.prototype.saveHost = function (res, host) {
  setCookie(process.env.COOKIE_NAME, host, {
    domain: process.env.COOKIE_DOMAIN,
    maxAge: process.env.COOKIE_MAX_AGE_SECONDS,
    res: res
  });
};
