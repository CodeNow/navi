/**
 * @module rabbitmq
 */
'use strict';

var ip = require('ip');
var uuid = require('uuid');

var hermes = require('runnable-hermes').hermesSingletonFactory({
  // Clustering, each cluster process needs a unique queue. All cluster processes need to receive
  // cache invalidated jobs. The queues have TTL of 30 seconds so they will clean themselves up
  name: ip.address() + '-' + uuid.v4() + '-navi',
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  heartbeat: 10,
  persistent: true,
  prefetch: 10,
  subscribedEvents: [ // read from fanout exchanges
    'routing.cache.invalidated',
  ]
}); // connect handled by Ponos

module.exports = hermes;
