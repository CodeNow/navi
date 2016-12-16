'use strict'
require('loadenv')()
const joi = require('joi')
const Publisher = require('ponos/lib/rabbitmq')

const log = require('logger').child({
  module: 'rabbitmq:publisher'
})

/**
 * Module in charge of rabbitmq connection
 *  client and pubSub are singletons
 */
function RabbitMQ () {}

/**
 * Initiate connection to publisher server
 * must have requires here to remove cyclic deps
 * @returns {Promise}
 * @resolves when connected to rabbit
 * @throws {Error} If Publisher received invalid args
 */
RabbitMQ.prototype.connect = function () {
  log.info('RabbitMQ.connect')
  this._publisher = new Publisher({
    name: process.env.APP_NAME,
    log: log,
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
    // We should really not have any tasks here as navi doesn't want to do any REAL work in workers
    tasks: [],
    events: [{
      name: 'navi.url.hit',
      jobSchema: joi.object({
        elasticUrl: joi.string().required(),
        refererIsGithub: joi.string().required(),
        ownerUsername: joi.string().required(),
        referer: joi.string(),
        shortHash: joi.string().required(),
        targetHost: joi.string().required()
      }).unknown().required()
    }]
  })

  return this._publisher.connect()
}

/**
 * disconnect connection to rabbit
 * @returns {Promise}
 * @resolves when disconnected to rabbit
 */
RabbitMQ.prototype.disconnect = function () {
  log.info('RabbitMQ.disconnect')
  return this._publisher.disconnect()
}

RabbitMQ.prototype.publishNaviUrlHit = function (data) {
  this._publisher.publishEvent('navi.url.hit', data)
}

module.exports = new RabbitMQ()
