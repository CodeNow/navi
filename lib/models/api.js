'use strict';

var apiClient = require('./api-client.js');
var debug = require('auto-debug')();

module.exports = Api;

function Api () {
  this.apiClient = apiClient;
}

/**
 * determine if we should use this
 * we can use API driver if we have host header
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if this driver can be used. else false
 */
Api.prototype.shouldUse = function (req) {
  debug(arguments);
  var headers = req.headers;
  if (!headers || !headers.host) {
    return false;
  }
  return true;
};

/**
 * get host based on req headers
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err, host)
 *                         host: <protocol>/<host>:<port>
 */
Api.prototype.getHost = function (req, cb) {
  debug(arguments);
  var url = getUrlFromRequest(req);
  var referer = req.headers.referer;

  this.apiClient.getBackend(url, referer, cb);
};

/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
function getUrlFromRequest (req) {
  debug(arguments);
  var host = req.headers.host;
  // append 80 if port not in url
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  // we only support https on port 443
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';

  return protocol + host;
}
