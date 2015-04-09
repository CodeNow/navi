'use strict';
var redis = require('redis');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

module.exports = Session;

function Session () {
  this.store = new RedisStore({
    client: redis.createClient(process.env.REDIS_PORT, process.env.REDIS_IPADDRESS),
    ttl: process.env.TOKEN_EXPIRES,
    db: 0
  });
}
/**
 * middleware that adds session to req object
 * @return {object} middleware
 */
Session.prototype.handle = function() {
  return session({
    store: this.store,
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: true
  });
};