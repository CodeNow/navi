'use strict';

var debug = require('auto-debug')();
var Runnable = require('runnable');
var ErrorCat = require('error-cat');

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
  var runnableOpts = {
    requestDefaults: {
      headers: {
        'user-agent': 'navi'
      },
    },
  };
  var cookie = req.session.apiCookie;
  debug('cookie', cookie);
  if (cookie) {
    runnableOpts.requestDefaults.headers.Cookie = cookie;
  }
  req.apiClient = new Runnable(process.env.API_HOST, runnableOpts);
  next();
};
/**
 * attempts to find a backend host to route request too
 * first checks user mapping then checks dependencies
 * and sets req.targetHost if host found
 * @param  {object}   req  express request
 * @param  {object}   res  express response
 * @param  {Function} next express next
 */
Api.getTargetHost = function (req, res, next) {
  var url = getUrlFromRequest(req);
  var client = req.apiClient;
  var referer = req.headers.referer;
  debug('url', url, 'referer', referer);
  client.getBackendFromUserMapping(url, function (err, host) {
    ErrorCat.log(err);
    if (host) {
      req.targetHost = host;
      debug('host from user mapping', host);
      return next();
    }
    client.fetchBackendForUrl(url, referer, function(err, host) {
      ErrorCat.log(err);
      if (host) {
        req.targetHost = host;
        debug('host from deps', host);
      }
      next();
    });
  });
};
/**
 * check if url is direct
 * if it is, then set mapping and redirect back to self
 * if not, direct to box selection
 * @param  {object}   req  express request
 * @param  {object}   res  express response
 * @param  {Function} next express next
 */
Api.handleDirectUrl = function (req, res, next) {
  // next if host already found
  if (req.targetHost) { return next(); }
  var url = getUrlFromRequest(req);
  var client = req.apiClient;
  client.checkAndSetIfDirectUrl(url, function (err, apiRes) {
    debug('err', err);
    if (err) { return next(err); }
    if (apiRes.statusCode === 404) {
      // if we are here, redirect to box selection
      debug('redir to box selection url', url);
      return client.redirectToBoxSelection(url, res);
    }
    // mapping should be set now, redirect to self
    debug('mapping set, redirect to self');
    res.redirect(301, url);
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
  var split = host.split('.');
  var numSubDomains = 3;
  if (split.length > numSubDomains) {
    split.splice(0, split.length-numSubDomains);
  }
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
