/**
 * Temporary module. Shared instance of Experiment to dark-launch/test the performance of our LRU
 * caching compared to our original, no-cache approach with our current production scale Navi usage
 * @module lib/lru-experiment
 */
'use strict';

var Experiment = require('node-scientist').Experiment;
var util = require('util');

var log = require('middlewares/logger')(__filename).log;

/**
 * Extension of Experiment class
 * @class
 */
function LRUExperiment () {
  Experiment.call(this, 'lru-experiment');
}

util.inherits(LRUExperiment, Experiment);

module.exports = LRUExperiment;

/**
 * Invoked upon control & candidate resolution. Sends statistics to datadog.
 */
LRUExperiment.prototype.publish = function () {
  var logData = {
    tx: true
  };
  log.info(logData, 'LRUExperiment.prototype.publish');
  console.log('publish', arguments);
};

