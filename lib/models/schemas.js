'use strict'

const joi = require('joi')

module.exports = {
  applicationUrlVisitedSchema: joi.object({
    elasticUrl: joi.string().required(),
    ownerGithubId: joi.number().required(),
    ownerUsername: joi.string().required(),
    referer: joi.string(),
    refererIsGithub: joi.boolean().required(),
    shortHash: joi.string().required(),
    targetHost: joi.string().required()
  }).unknown().required()
}
