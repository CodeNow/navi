'use strict';

var debug = require('auto-debug')();
var isBrowser = require('user-agent-is-browser');
var keypath = require('keypather')();

module.exports = Whitelist;
/**
 * Used to maintain and check white list of allowed non browser users
 */
function Whitelist () {}
/**
 * checks to see if incoming request is a browser
 * adds isNotBrowser to req object if not a browser req
 * @param  {object} req  the request object to use as input
 */
Whitelist.isNotBrowser = function (req, res, next) {
  var userAgent = keypath.get(req, 'headers["user-agent"]');
  req.isNotBrowser = true;
  debug('user-agent', userAgent);
  if (!userAgent) {return next(); }
  var isBrowserAgent = isBrowser(userAgent);
  debug('isBrowser', isBrowser);
  if (!isBrowserAgent) { return next(); }
  delete req.isNotBrowser;
  next();
};
/**
 * ensures sender is on white list
 * if not error with 404 else next()
 * @param  {object}   req  express request
 * @param  {object}   res  express response
 * @param  {Function} next express next
 */
Whitelist.senderIsOnlist = function (req, res, next) {
  debug();
  // TODO: implement white list functionality
  // allow all for now
  // if we do not have a target 404
  // if (!onList) {
  //   return next(ErrorCat.create(404, 'mapped instance no longer exists'));
  // }
  next();
};