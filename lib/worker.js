'use strict'
require('loadenv')()
const ip = require('ip')
const log = require('logger').child({ module: 'WorkerServer' })
const ponos = require('ponos')
const uuid = require('uuid')

/**
 * The ponos server.
 * @type {ponos~Server}
 * @module navi/worker
 */
module.exports = new ponos.Server({
  name: `${ip.address()}-${uuid.v4()}-${process.env.APP_NAME}`,
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
  tasks: { },
  events: {
    'routing.cache.invalidated': {
      task: require('workers/routing.cache.invalidated'),
      queueOptions: {
        autoDelete: true
      }
    }
  }
})
