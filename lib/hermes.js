/**
 * @module rabbitmq
 */
'use strict';

var ip = require('ip');

var hermes = require('runnable-hermes').hermesSingletonFactory({
  name: ip.address() + '-navi',
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  heartbeat: 10,
  persistent: true,
  prefetch: 10,
  publishedEvents: [
    'routing.cache.invalidated',
  ],
  subscribedEvents: [ // read from fanout exchanges
    'routing.cache.invalidated',
  ]
}); // connect handled by Ponos

module.exports = hermes;
