/**
 * @module lib/modules/session
 */
'use strict';

var keypath = require('keypather')();
var put = require('101/put');
var session = require('express-session');

var log = require('middlewares/logger')(__filename).log;
var redis = require('models/redis.js');

var RedisStore = require('connect-redis')(session);

module.exports = Session;

/**
 * used handle user sessions and shared api sessions
 */
function Session () {
  log.info('Session constructor');
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
  log.info({
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
  log.info({
    tx: true
  }, 'Session.prototype.handle');
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
  var token = keypath.get(req, 'query.runnableappAccessToken');
  var logData = {
    tx: true,
    token: token
  };
  log.info(logData, 'Session.getCookieFromToken');
  if (!shouldUse(req)) {
    log.trace(logData, 'Session.getCookieFromToken !shouldUse(req)');
    return next();
  }
  redis.lpop(token, function (err, data) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'getCookieFromToken redis.lpop error');
      return next(err);
    }
    if (!data) {
      log.warn(logData, 'getCookieFromToken redis.lpop !data');
      return next();
    }
    try {
      data = JSON.parse(data);
    } catch (err1) {
      log.error(put({
        err: err1
      }, logData), 'getCookieFromToken redis.lpop JSON.parse error');
      return next(err1);
    }
    // if no cookie continue and redirect to API
    // To be removed after SAN 2911
    if (data.cookie) {
      log.trace(put({
        data: data
      }, logData), 'getCookieFromToken redis.lpop success data.cookie');
      req.session.apiCookie = data.cookie;
    } else {
      log.trace(logData, 'getCookieFromToken redis.lpop success !data.cookie');
    }
    // Used for authentication verification
    if (data.apiSessionRedisKey) {
      log.trace(put({
        data: data
      }, logData), 'getCookieFromToken redis.lpop success data.apiSessionRedisKey');
      req.session.apiSessionRedisKey = data.apiSessionRedisKey;
    } else {
      log.trace(logData, 'getCookieFromToken redis.lpop success !data.apiSessionRedisKey');
    }
    next();
  });
};
