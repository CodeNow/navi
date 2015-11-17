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
Session.getSharedSessionDataFromStore = function (req, res, next) {
  var token = keypath.get(req, 'query.runnableappAccessToken');
  var logData = {
    tx: true,
    token: token
  };
  log.info(logData, 'Session.getSharedSessionDataFromStore');
  if (!shouldUse(req)) {
    log.trace(logData, 'Session.getSharedSessionDataFromStore !shouldUse(req)');
    return next();
  }
  redis.lpop(token, function (err, data) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'getSharedSessionDataFromStore redis.lpop error');
      return next(err);
    }
    if (!data) {
      log.warn(logData, 'getSharedSessionDataFromStore redis.lpop !data');
      return next();
    }
    try {
      data = JSON.parse(data);
    } catch (jsonErr) {
      log.error(put({
        err: jsonErr
      }, logData), 'getSharedSessionDataFromStore redis.lpop JSON.parse error');
      return next(jsonErr);
    }

    if (data.userId) {
      log.trace(put({
        data: data
      }, logData), 'getSharedSessionDataFromStore redis.lpop success data.userId');
      req.session.userId = data.userId;
    } else {
      log.trace(logData, 'getSharedSessionDataFromStore redis.lpop success !data.userId');
    }

    if (data.userGithubOrgs) {
      log.trace(put({
        data: data
      }, logData), 'getSharedSessionDataFromStore redis.lpop success data.cookie');
      req.session.userGithubOrgs = data.userGithubOrgs;
    } else {
      log.trace(logData, 'getSharedSessionDataFromStore redis.lpop success !data.userGithubOrgs');
    }

    // This redis key is checked by navi to verify the request session has an association api
    // session that is authenticated
    if (data.apiSessionRedisKey) {
      log.trace(put({
        data: data
      }, logData), 'getSharedSessionDataFromStore redis.lpop success data.apiSessionRedisKey');
      req.session.apiSessionRedisKey = data.apiSessionRedisKey;
    } else {
      log.trace(logData, 'getSharedSessionDataFromStore redis.lpop success '+
                         '!data.apiSessionRedisKey');
    }
    next();
  });
};
