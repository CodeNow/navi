'use strict';
var debug = require('auto-debug')();
var keypath = require('keypather')();
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var redis = require('./redis.js');

module.exports = Session;

function Session () {
  this.store = new RedisStore({
    client: redis,
    ttl: process.env.TOKEN_EXPIRES,
    db: 0
  });
}
/**
 * determine if we should use this
 * a runnable token header is required to use session driver
 * @param  {object}   req  the request object to use as input
 * @return {bool}     true if this driver can be used. else false
 */
Session.prototype.shouldUse = function (req) {
  var token = keypath.get(req, 'headers[\''+process.env.RUNNABLE_TOKEN_HEADER+'\']');
  if (typeof token === 'string') {
    return true;
  }
  return false;
};
/**
 * middleware that adds session to req object
 * @return {object} middleware
 */
Session.prototype.handle = function () {
  return session({
    store: this.store,
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: true
  });
};
/**
 * get userId from token header based on key from redis
 * expects token to be found in header
 * @returns {function} middleware
 */
Session.prototype.getUserFromToken = function () {
  return function (req, res, next) {
    var token = req.headers[process.env.RUNNABLE_TOKEN_HEADER];
    debug('token', token);
    redis.lpop(token, function (err, userId) {
      if (err) { return next(err); }
      debug('userId returned', userId);
      // if invalid token do not set userId, continue and redirect to API
      if (userId) {
        req.session.userId = userId;
      }
      next();
    });
  };
};