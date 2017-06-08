'use strict'
require('loadenv')()
const monitor = require('monitor-dog')
const orion = require('@runnable/orion')
const Promise = require('bluebird')

const log = require('middlewares/logger')(__filename).log;
const schemas = require('../models/schemas.js')

module.exports = {
  jobSchema: schemas.applicationUrlVisitedSchema,
  maxNumRetries: 7,

  task (job) {
    return Promise.try(() => {
      const ownerUsername = job.ownerUsername
      const orgGithubId = job.ownerGithubId
      const refererIsGithub = job.refererIsGithub
      const orgName = ownerUsername.toLowerCase()
      const referer = job.referer

      log.trace({
        referer: referer,
        refererIsGithub: refererIsGithub,
        orgName
      }, 'Navi Hit Referrer for request')

      monitor.increment('navi.hit', {
        orgName,
        orgGithubId
      })

      var updates = {
        user_id: 'navi-' + ownerUsername,
        update_last_request_at: true,
        companies: [{
          company_id: orgName,
          name: ownerUsername
        }]
      }
      if (refererIsGithub) {
        updates.companies[0].custom_attributes = {
          has_visited_navi_url_from_github: true
        }
        monitor.increment('navi.hit.has-visited-from-github', {
          org: orgName
        })
      }

      orion.users.create(updates)
    })
  }
}
