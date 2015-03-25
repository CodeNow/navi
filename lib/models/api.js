'use strict';

// DNS Module

module.exports = Api;

function Api () {}

/**
 * determine if we should use this
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function()
 */
Api.prototype.shouldUse = function (req, cb) {
  //TODO
  return true;
};

/**
 * get host based on req
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err, host)
 *                         host is ip and port
 */
Api.prototype.getHost = function (req, cb) {
  cb(null, '1.1.1.1:80');
};
