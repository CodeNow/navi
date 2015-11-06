/**
 * @module index
 */
'use strict';
require('loadenv.js');

// leave this newrelic require up here!
if (process.env.NEWRELIC_KEY) {
  require('newrelic');
}

var App = require('./lib/app.js');
var ClusterManager = require('cluster-man');
var log = require('middlewares/logger')(__filename).log;
var numCPUs = require('os').cpus().length;

var manager = new ClusterManager({
  worker: function () {
    var app = new App();
    app.start(function (err) {
      if (err) {
        log.error({
          err: err
        }, 'app.start error');
        throw err;
      } else {
        log.info('app.start success');
      }
    });
  },
  master: function () {
    log.info('app.start master');
  },
  numWorkers: process.env.CLUSTER_WORKERS || numCPUs,
  killOnError: false,
  beforeExit: function (err, done) {
    if (err) {
      log.error({ err: err }, 'manager.beforeExit error');
    } else {
      log.info('manager.beforeExit');
    }
    done();
  }
});

manager.start();
