'use strict';

var RedisStore = require('connect-redis')(session);
var keypath = require('keypather')();
var session = require('express-session');

var logger = require('middlewares/logger')(__filename);
var redis = require('./redis.js');

var log = logger.log;

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
  var token = keypath.get(req, 'query.runnableappAccessToken');
  log.trace({
    tx: true,
    query: req.query,
    token: token
  }, 'shouldUse');
  return !!token;
}
/**
 * middleware that adds session to req object
 * @return {object} middleware
 */
Session.prototype.handle = function () {
  log.trace({
    tx: true
  }, 'handle');
  return session({
    store: this.store,
    secret: process.env.COOKIE_SECRET,
    name: process.env.COOKIE_NAME + '.' +process.env.NODE_ENV,
    resave: false,
    saveUninitialized: true,
    cookie: {
      domain: process.env.COOKIE_DOMAIN
    }
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
  log.trace({
    tx: true,
    shouldUse: !shouldUse(req)
  }, 'getCookieFromToken');
  if (!shouldUse(req)) {
    return next();
  }
  var token = keypath.get(req, 'query.runnableappAccessToken');
  log.trace({
    tx: true,
    token: token
  }, 'runnableappAccessToken');
  redis.lpop(token, function (err, cookie) {
    if (err) {
      log.error({
        tx: true,
        err: err
      }, 'getCookieFromToken redis.lpop error');
      return next(err);
    }
    log.trace({
      tx: true,
      cookie: cookie
    }, 'getCookieFromToken');
    // if no cookie continue and redirect to API
    if (cookie) {
      req.session.apiCookie = cookie;
    }
    next();
  });
};
