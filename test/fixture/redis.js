/**
 * @module test/fixture/redis
 */
'use strict';

var redis = require('models/redis');
var callbackCount = require('callback-count');

var naviRedisEntriesFixtures = require('./navi-redis-entries');
var naviEntriesFixtures = require('./navi-entries');

var seedData = naviRedisEntriesFixtures.elastic;

module.exports.seed = function (done) {
  var count = callbackCount(done);
  Object.keys(naviEntriesFixtures).forEach(function (key) {
    var entry = naviEntriesFixtures[key];
    redis.rpush('frontend:80.' + entry.elasticUrl, seedData, count.inc().next);
    redis.rpush('frontend:8080.' + entry.elasticUrl, seedData, count.inc().next);
    Object.keys(entry.directUrls).forEach(function (shortHash) {
      var hyphenSeparator = (entry.directUrls[shortHash].isolated) ? '--' : '-';
      redis.rpush(
        'frontend:80.' + shortHash + hyphenSeparator + entry.elasticUrl,
        naviRedisEntriesFixtures.direct, count.inc().next);
      redis.rpush(
        'frontend:8080.' + shortHash + hyphenSeparator + entry.elasticUrl,
        naviRedisEntriesFixtures.direct, count.inc().next);
    });
  });
};

module.exports.clean = function (done) {
  var count = callbackCount(done);
  Object.keys(naviEntriesFixtures).forEach(function (key) {
    var entry = naviEntriesFixtures[key];
    redis.del('frontend:80.' + entry.elastic, count.inc().next);
    redis.del('frontend:8080.' + entry.elastic, count.inc().next);
    Object.keys(entry.directUrls).forEach(function (shortHash) {
      var hyphenSeparator = (entry.directUrls[shortHash].isolated) ? '--' : '-';
      redis.del(
        'frontend:80.' + shortHash + hyphenSeparator + entry.elasticUrl, count.inc().next);
      redis.del(
        'frontend:8080.' + shortHash + hyphenSeparator + entry.elasticUrl, count.inc().next);
    });
  });
};
