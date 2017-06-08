'use strict'
require('loadenv')()

const RabbitMQ = require('ponos/lib/rabbitmq')
const log = require('logger').child({module: 'rabbitmq'})

const schemas = require('./schemas.js')

/**
 * Rabbitmq internal singelton instance.
 * @type {rabbitmq}
 */
class Publisher extends RabbitMQ {
  constructor () {
    super({
      name: process.env.APP_NAME,
      hostname: process.env.RABBITMQ_HOSTNAME,
      port: process.env.RABBITMQ_PORT,
      username: process.env.RABBITMQ_USERNAME,
      password: process.env.RABBITMQ_PASSWORD,
      log: log.child({ module: 'publisher' }),
      tasks: [],
      events: [{
        name: 'application.url.visited',
        jobSchema: schemas.applicationUrlVisitedSchema
      }]
    })
  }

  /**
   * publish application.url.visited
   * @param {Object} data data to pass to job
   */
  publishApplicationUrlVisited (data) {
    log.info({ data: data }, 'publishApplicationUrlVisited')
    this.publishEvent('application.url.visited', data)
  }
}

module.exports = new Publisher()
