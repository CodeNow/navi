/**
 * @module lib/models/redis
 */
'use strict';
require('../loadenv.js');

var fs = require('fs');
var redis = require('redis');

var redisOpts = {
  host: process.env.REDIS_IPADDRESS,
  port: process.env.REDIS_PORT,
  connect_timeout: 5000 // 5 seconds
};

if (process.env.REDIS_CACERT) {
  try {
    var ca = fs.readFileSync(process.env.REDIS_CACERT, 'utf-8');
    redisOpts.tls = {
      rejectUnauthorized: true,
      ca: [ ca ]
    };
  } catch (err) {}
}

module.exports = redis.createClient(redisOpts);
