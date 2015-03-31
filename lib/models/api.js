'use strict';

var HostMapping = require('./host-mapping.js');
var apiClient = require('./api-client.js');
var debug = require('auto-debug')();

module.exports = Api;

function Api () {
  this.hostMapping = new HostMapping();
  this.apiClient = apiClient;
}

/**
 * determine if we should use this
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if this driver can be used. else false
 */
Api.prototype.shouldUse = function (req) {
  debug.trace();
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
 *                         host is ip and port
 */
Api.prototype.getHost = function (req, cb) {
  debug.trace();
  var self = this;
  var host = formatHost(req.headers.host);
  var referer = req.headers.referer;
  var hostName = host.split(':')[0];

  self.hostMapping.getNameFromHost(hostName, function(err, name) {
    if (err) { return cb(err); }
    self.apiClient.getBackend(host, name, referer, cb);
  });
};

/**
 * host should be full url
 * @param  {string} host host to be formatted
 * @return {string}      formatted host to send to api
 */
function formatHost (host) {
  debug.trace();
  // append 80 if port not in url
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }

  return host;
}
