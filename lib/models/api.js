'use strict';

var debug = require('auto-debug')();
var Runnable = require('runnable');

module.exports = new Api();

function Api () {
  this.user = new Runnable(process.env.API_HOST);
}
/**
 * get host based on req headers
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err, host)
 *                         host: <protocol>/<host>:<port>
 */
Api.prototype.getHost = function (req, cb) {
  var url = getUrlFromRequest(req);
  var userId = req.session.userId;
  var referer = req.headers.referer;
  debug('userId', userId, 'url', url, 'referer', referer);

  this.user.fetchBackendForUrlWithUser(userId, url, referer, cb);
};
/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
function getUrlFromRequest (req) {
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
/**
 * login to github
 * @param  {Function} cb (null)
 */
Api.prototype.login = function (cb) {
  debug('key', process.env.HELLO_RUNNABLE_GITHUB_TOKEN);
  this.user.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};
/**
 * redirect to api server for auth
 * @return  {Function} middleware
 */
Api.prototype.redirect = function () {
  var self = this;
  return function (req, res) {
    var redirectUrl = getUrlFromRequest(req);
    debug('redirectUrl', redirectUrl);
    self.user.redirectForAuth(redirectUrl, res);
  };
};
