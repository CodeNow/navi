/**
 * @module lib/logger
 */
'use strict';
require('./loadenv.js');

var bunyan = require('bunyan');
var envIs = require('101/env-is');
var keypather = require('keypather')();
var put = require('101/put');

var serializers = put(bunyan.stdSerializers, {
  tx: function () {
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
  req: function (req) {
    return {
      method: req.method,
      url: req.url,
      secure: req.secure,
      encrypted: req.connection && req.connection.encrypted
    };
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
  src: !envIs('production'),
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV
});

module.exports._serializers = serializers;
