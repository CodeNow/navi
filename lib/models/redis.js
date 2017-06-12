'use strict'
require('loadenv')()

const fs = require('fs')
const redis = require('redis')

const log = require('../middlewares/logger')(__filename).log

var redisOpts = {
  host: process.env.REDIS_IPADDRESS,
  port: process.env.REDIS_PORT,
  retry_strategy: (err) => {
    log.fatal({ err }, 'redis disconnected')
    process.exit(1)
  }
}

// because we clear the require cache, this coverage check is lost
if (process.env.REDIS_CACERT) {
  try {
    var ca = fs.readFileSync(process.env.REDIS_CACERT, 'utf-8')
    redisOpts.tls = {
      rejectUnauthorized: true,
      ca: [ ca ]
    }
  } catch (err) {}
}

module.exports = redis.createClient(redisOpts)
