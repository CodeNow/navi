/**
 * @module lib/workers/routing.cache.invalidated
 */
'use strict';

var ErrorCat = require('error-cat');
var Promise = require('bluebird');
var TaskFatalError = require('ponos').TaskFatalError;
var error = new ErrorCat();
var hasKeypaths = require('101/has-keypaths');

var log = require('middlewares/logger')(__filename).log;
var cache = require('cache');

module.exports = function (job) {
  return Promise.resolve()
    .then(function validateArguments () {
      if (!hasKeypaths(job, ['elasticUrl'])) {
        throw new TaskFatalError('job missing elasticUrl field');
      }
    })
    .then(function invalidateCache () {
      cache.del(job.elasticUrl);
      log.trace({
        elasticUrl: job.elasticUrl
      }, 'routing.cache.invalidated cache invalidated');
    })
    .catch(function (err) {
      log.error({ err: err }, 'routing.cache.invalidated error');
      throw err;
    });
};
