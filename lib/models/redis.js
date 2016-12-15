/**
 * @module lib/models/redis
 */
'use strict';
require('loadenv')();

var fs = require('fs');
var redis = require('redis');

var redisOpts = {
  host: process.env.REDIS_IPADDRESS,
  port: process.env.REDIS_PORT,
  connect_timeout: 5000 // 5 seconds
};

// because we clear the require cache, this coverage check is lost
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
