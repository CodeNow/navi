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
  redis.rpush('frontend:80.api-staging-codenow.runnableapp.com', seedData, count.inc().next);
  redis.rpush('frontend:8080.api-staging-codenow.runnableapp.com', seedData, count.inc().next);
  Object.keys(naviEntriesFixtures.directUrls).forEach(function (shortHash) {
    redis.rpush(
      'frontend:80.'+shortHash+'-api-staging-codenow.runnableapp.com',
      naviRedisEntriesFixtures.direct, count.inc().next);
    redis.rpush(
      'frontend:8080.'+shortHash+'-api-staging-codenow.runnableapp.com',
      naviRedisEntriesFixtures.direct, count.inc().next);
  });
  Object.keys(naviEntriesFixtures.refererNaviEntry.directUrls).forEach(function (shortHash) {
    redis.rpush(
      'frontend:80.'+shortHash+'-frontend-staging-codenow.runnableapp.com',
      naviRedisEntriesFixtures.direct, count.inc().next);
    redis.rpush(
      'frontend:8080.'+shortHash+'-frontend-staging-codenow.runnableapp.com',
      naviRedisEntriesFixtures.direct, count.inc().next);
  });
};

module.exports.clean = function (done) {
  var count = callbackCount(done);
  redis.del('frontend:80.api-staging-codenow.runnableapp.com', count.inc().next);
  redis.del('frontend:8080.api-staging-codenow.runnableapp.com', count.inc().next);
  Object.keys(naviEntriesFixtures.directUrls).forEach(function (shortHash) {
    redis.del(
      'frontend:80.'+shortHash+'-api-staging-codenow.runnableapp.com', count.inc().next);
    redis.del(
      'frontend:8080.'+shortHash+'-api-staging-codenow.runnableapp.com', count.inc().next);
  });
  Object.keys(naviEntriesFixtures.refererNaviEntry.directUrls).forEach(function (shortHash) {
    redis.del(
      'frontend:80.'+shortHash+'-frontend-staging-codenow.runnableapp.com', count.inc().next);
    redis.del(
      'frontend:8080.'+shortHash+'-frontend-staging-codenow.runnableapp.com', count.inc().next);
  });
};
