'use strict';

var debug = require('auto-debug')();
var Runnable = require('runnable');

module.exports = Api;
/**
 * module used to make calls to runnable API as a specific user
 * @param {string} cookie should be the same cookie runnable.io uses
 */
function Api () {}
/**
 * creates runnable api client and appends to request
 * @return {object} middleware
 */
Api.createClient = function (req, res, next) {
  var cookie = req.session.apiCookie;
  debug('cookie', cookie);
  var runnableOpts = {
    requestDefaults: {
      headers: {
        'user-agent': 'navi',
        'Cookie': cookie
      },
    },
  };
  req.apiClient = new Runnable(process.env.API_HOST, runnableOpts);
  next();
};
/**
 * looks for host to proxy to based on user selected mappings
 * @param  {object}   req  the request object to use as input
 * @param  {Function} cb   function (err, host)
 *                         host: <protocol>/<host>:<port>
 */
Api.getBackendFromUserMapping = function (req, res, next) {
  var url = getUrlFromRequest(req);
  debug('url', url);
  req.apiClient.getBackendFromUserMapping(url, function (err, host) {
    if (err) { return next(err); }
    req.targetHost = host;
    next();
  });
};
/**
 * looks for host to proxy to based on referer and dependencies
 */
Api.getBackendFromDeps = function (req, res, next) {
  var url = getUrlFromRequest(req);
  var referer = req.headers.referer;
  debug('url', url, 'referer', referer);
  // if we errored attempt to find backend for user instead
  req.apiClient.fetchBackendForUrl(url, referer, function (err, host) {
    if (err) { return next(err); }
    req.targetHost = host;
    next();
  });
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
 * make a request for self to check if authorized
 * if not, redirect for authorization
 * @return  {Function} middleware
 */
Api.redirectIfNotLoggedIn = function (req, res, next) {
  req.apiClient.fetch('me', function (err) {
    if (err) {
      debug('error while fetching', err);
      if (isUnauthorizedErr(err)) {
        var url = getUrlFromRequest(req);
        debug('user not logged in, url', url);
        return req.apiClient.redirectForAuth(url, res);
      }
      return next(err);
    }
    next();
  });
};
/**
 * check to see if error is due to user not authorized
 * @param  {[type]}  err returned from api client
 * @return {Boolean}     true if not logged in, else false
 */
function isUnauthorizedErr (err) {
  if (err.output.statusCode === 401 &&
    err.data.error === 'Unauthorized') {
    return true;
  }
  return false;
}
/**
 * tries to set user mapping for this url
 * if that fails because it is not a direct url, redirect to box selection
 */
Api.checkForDirectUrl = function (req, res, next) {
  var url = getUrlFromRequest(req);
  debug('url', url);
  req.apiClient.checkAndSetIfDirectUrl(url, function (err, apiRes) {
    debug('err', err);
    if (err) { return next(err); }
    if (apiRes.statusCode === 404) {
      // if we are here, redirect to box selection
      debug('redir to box selection url', url);
      return req.apiClient.redirectToBoxSelection(url, res);
    }
    // mapping should be set now, redirect to self
    debug('mapping set, redirect to self');
    res.redirect(301, url);
  });
};
