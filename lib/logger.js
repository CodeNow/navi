/**
 * @module lib/logger
 */
'use strict';
require('loadenv')();

var bunyan = require('bunyan');
var keypather = require('keypather')();
var put = require('101/put');

var serializers = put(bunyan.stdSerializers, {
  tx: () => {
    var runnableData = keypather.get(process.domain, 'runnableData');
    if (!runnableData) {
      runnableData = {};
    }
    var date = new Date();
    if (runnableData.txTimestamp) {
      // Save delta of time from previous log to this log
      runnableData.txMSDelta = date.valueOf() - runnableData.txTimestamp.valueOf();
    }
    runnableData.txTimestamp = date;
    if (runnableData.reqStart) {
      // Milliseconds from request start
      runnableData.txMSFromReqStart = runnableData.txTimestamp.valueOf() -
        runnableData.reqStart.valueOf();
    }
    return runnableData;
  },
  req: (req) => {
    return {
      host: keypather.get(req, 'headers.host'),
      method: req.method,
      url: req.url
    };
  },
  naviEntry: (naviEntry) => {
    return {
      id: naviEntry._id,
      elasticUrl: naviEntry.elasticUrl,
      ipWhitelist: naviEntry.ipWhitelist,
      ownerUsername: naviEntry.ownerUsername,
      ownerGithubId: naviEntry.ownerGithubId
    }
  }
});

module.exports = bunyan.createLogger({
  name: 'navi',
  streams: [{
    level: process.env.LOG_LEVEL_STDOUT,
    stream: process.stdout
  }],
  serializers: serializers,
  // DO NOT use src in prod, slow
  src: false,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV
}).child({tx: true})

module.exports._serializers = serializers;
