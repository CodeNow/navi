/**
 * @module test/fixture/redis
 */
'use strict';

var redis = require('models/redis');

var naviRedisEntriesFixtures = require('./navi-redis-entries');
var seedData = naviRedisEntriesFixtures.elastic;

module.exports.seed = function (done) {
  redis.rpush('frontend:80.api-staging-codenow.runnableapp.com', seedData, done);
};

module.exports.clean = function (done) {
  redis.del('frontend:80.api-staging-codenow.runnableapp.com', done);
};
