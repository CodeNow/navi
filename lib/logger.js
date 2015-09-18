/**
 * @module lib/logger
 */
'use strict';

var bunyan = require('bunyan');
var keypather = require('keypather')();
var put = require('101/put');

var _streams = [];

function _initializeStreams () {
  _streams.push({
    level: process.env.LOG_LEVEL_STDOUT,
    stream: process.stdout
  });
}

_initializeStreams();

var serializers = put(bunyan.stdSerializers, {
  tx: function () {
    return keypather.get(process.domain, 'runnableData');
  },
  req: function (req) {
    return {
      method: req.method,
      url: req.url,
      isInternalRequest: req.isInternalRequest
    };
  }
});

module.exports = bunyan.createLogger({
  name: 'navi',
  streams: _streams,
  serializers: serializers,
  // DO NOT use src in prod, slow
  src: !!process.env.LOG_SRC,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV
});

module.exports._initializeStreams = _initializeStreams;
module.exports._streams = _streams;
