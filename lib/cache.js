/**
 * Shared LRU caching object used for redis & mongo lookups. Invalidated by rabbitmq tasks.
 * @module lib/cache
 */
'use strict';

var LRU = require('lru-cache');
var keypather = require('keypather')();
var monitor = require('monitor-dog')

var log = require('middlewares/logger')(__filename).log;

// Explanation of logic for max: 50,000
// https://github.com/CodeNow/navi/pull/97#discussion_r47985462
var cache = LRU({
  max: 50000,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
  dispose: function (key, item) {
    var elasticUrl = keypather.get(item, 'elasticUrl')
    log.trace({
      elasticUrl: elasticUrl
    },'LRU dispose');
    monitor.increment('navi.lru.dispose', {
      elasticUrl: elasticUrl
    })
  }
});

module.exports = cache;

// exposed for unit testing
module.exports._log = log;
