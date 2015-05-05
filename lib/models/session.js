'use strict';
var debug = require('auto-debug')();
var keypath = require('keypather')();
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var redis = require('./redis.js');

module.exports = Session;
/**
 * used handle user sessions and shared api sessions
 */
function Session () {
  this.store = new RedisStore({
    client: redis,
    ttl: process.env.TOKEN_EXPIRES,
    db: 0
  });
}
/**
 * determine if we should use this
 * a runnable token query is required to use session driver
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if this driver can be used. else false
 */
function shouldUse (req) {
  debug('query', req.query);
  var token = keypath.get(req, 'query.runnableappAccessToken');

  return !!token;
}
/**
 * middleware that adds session to req object
 * @return {object} middleware
 */
Session.prototype.handle = function () {
  return session({
    store: this.store,
    secret: process.env.COOKIE_SECRET,
    name: process.env.COOKIE_NAME,
    resave: false,
    saveUninitialized: true
  });
};
/**
 * get session cookie from token header based on key from redis
 * expects token to be found in header
 * @param  {object}   req  express req
 * @param  {object}   res  express res
 * @param  {Function} next express next
 */
Session.getCookieFromToken = function (req, res, next) {
  if (!shouldUse(req)) { return next(); }

  var token = keypath.get(req, 'query.runnableappAccessToken');
  debug('runnableappAccessToken', token);
  redis.lpop(token, function (err, cookie) {
    if (err) { return next(err); }
    debug('cookie', cookie);
    // if no cookie continue and redirect to API
    if (cookie) {
      req.session.apiCookie = cookie;
    }
    next();
  });
};
