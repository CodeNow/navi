'use strict';
require('../loadenv.js');

var redis = require('redis');

module.exports = HostMapping;

function HostMapping () {
  this.redis = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_IPADDRESS);
}

/**
 * finds instance name from redis based on url
 * @param  {string}   host used to lookup instance name
 * @param  {Function} cb   (err, name)
 */
HostMapping.prototype.getNameFromHost = function (host, cb) {
  var key = 'frontend:' + host;
  // first key is always name
  this.redis.lrange(key, 0, 0, function(err, items) {
    if (err) { return cb(err); }
    cb(null, items[0]);
  });
};