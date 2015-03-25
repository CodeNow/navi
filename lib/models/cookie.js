'use strict';

module.exports = Cookie;

function Cookie () {}

/**
 * determine if we should use this
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function()
 */
Cookie.prototype.shouldUse = function (req, cb) {
  //TODO
  return true;
};

/**
 * get host based on req
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err, host)
 *                         host is ip and port
 */
Cookie.prototype.getHost = function (req, cb) {
  cb(null, '1.1.1.1:80');
};

/**
 * save expected host into cookie
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err)
 */
Cookie.prototype.saveHost = function (req, cb) {
  cb(null, '1.1.1.1:80');
};
