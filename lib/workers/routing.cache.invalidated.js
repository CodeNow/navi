/**
 * @module lib/workers/routing.cache.invalidated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')
const cache = require('cache')
const joi = require('joi')

module.exports = {
  jobSchema: joi.object({
    elasticUrl: joi.string().required()
  }).unknown().required(),
  
  queueOptions: {
    autoDelete: true
  },
  
  task (job) {
    return Promise.try(function () {
      cache.del(job.elasticUrl)
    })
  }
}
