/**
 * @module index
 */
'use strict';
require('loadenv.js');

// leave this newrelic require up here!
if (process.env.NEWRELIC_KEY) {
  require('newrelic');
}

var ClusterManager = require('cluster-man');
var numCPUs = require('os').cpus().length;

var App = require('app');
var WorkerServer = require('models/worker-server');
var log = require('middlewares/logger')(__filename).log;

var manager = new ClusterManager({
  worker: function () {
    var app = new App();
    WorkerServer.listen(function (err) {
      if (err) {
        log.error({
          err: err
        }, 'WorkerServer.listen error');
        throw err;
      }
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
    WorkerServer.stop(function (err) {
      if (err) {
        log.error({ err: err }, 'manager.beforeExit WorkerServer stop error');
      }
      done();
    });
  }
});

manager.start();
