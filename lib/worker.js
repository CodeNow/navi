'use strict'
require('loadenv')();
const ponos = require('ponos');

const log = require('logger').child({ module: 'WorkerServer' });

/**
 * The ponos server.
 * @type {ponos~Server}
 * @module navi/worker
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  enableErrorEvents: true,
  log: log,
  rabbitmq: {
    channel: {
      prefetch: process.env.WORKER_PREFETCH
    },
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD
  },
  tasks: {
    'routing.cache.invalidated': require('workers/routing.cache.invalidated')
  },
  events: {
  },
  redisRateLimiter: {
    host: process.env.REDIS_IPADDRESS,
    port: process.env.REDIS_PORT
  }
})
