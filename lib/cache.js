/**
 * Shared LRU caching object used for redis & mongo lookups. Invalidated by rabbitmq tasks.
 * @module lib/cache
 */
'use strict';

var LRU = require('lru-cache');
var keypather = require('keypather')();

var log = require('middlewares/logger')(__filename).log;

var cache = LRU({
  max: 1000,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
  dispose: function (key, item) {
    log.trace({
      elasticUrl: keypather.get(item, 'elasticUrl')
    },'LRU dispose');
  }
});

module.exports = cache;

// exposed for unit testing
module.exports._log = log;
