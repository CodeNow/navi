'use strict';

var debug = require('auto-debug')();
var Runnable = require('runnable');

module.exports = new Api();

function Api () {
  this.client = new Runnable(process.env.API_HOST);
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

  this.client.fetchBackendForUrlWithUser(userId, url, referer, cb);
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
  this.client.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};
/**
 * check if userId is on session
 * if not redirect to api server for auth
 * @return  {Function} middleware
 */
Api.prototype.redirectIfNoUserId = function () {
  var self = this;
  return function (req, res, next) {
    debug('session', req.session);
    if (req.session.userId) { return next(); }

    var url = getUrlFromRequest(req);
    debug('user not logged in, url', url);
    self.client.redirectForAuth(url, res);
  };
};
/**
 * tries to set user mapping for this url
 * if that fails because it is not a direct url, redirect to box selection
 * @return  {Function} middleware
 */
Api.prototype.checkForDirectUrl = function () {
  var self = this;
  return function (req, res, next) {
    var url = getUrlFromRequest(req);
    var userId = req.session.userId;
    debug('userId', userId, 'url', url);
    self.client.checkAndSetIfDirectUrl(userId, url, function (err, apiRes) {
      debug('err', err);
      if (err) { return next(err); }
      if (apiRes.statusCode === 404) {
        // if we are here, redirect to box selection
        debug('redir to box selection url', url);
        return self.client.redirectToBoxSelection(url, res);
      }
      // mapping should be set now, redirect to self
      debug('mapping set, redirect to self');
      res.redirect(301, url);
    });
  };
};