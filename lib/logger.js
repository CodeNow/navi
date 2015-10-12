/**
 * @module lib/logger
 */
'use strict';
require('./loadenv.js');

var bunyan = require('bunyan');
var keypather = require('keypather')();
var put = require('101/put');

var serializers = put(bunyan.stdSerializers, {
  tx: function () {
    return keypather.get(process.domain, 'runnableData');
    if (!runnableData) {
      runnableData = {};
    }
    runnableData.txTimestamp = new Date();
    return runnableData;
  },
  req: function (req) {
    return {
      method: req.method,
      url: req.url,
      isInternalRequest: req.isInternalRequest
    };
  },
  elapsedTimeSeconds: function (date) {
    return (new Date() - date) / 1000;
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
  src: !!process.env.LOG_SRC,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV
});
