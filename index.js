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
var rollbar = require('rollbar');

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
  numWorkers: (process.env.ENABLE_CLUSTERING) ? (process.env.NUM_CLUSTER_WORKERS || numCPUs) : 0,
  killOnError: false,
  beforeExit: function (err, done) {
    if (err) {
      rollbar.handleErrorWithPayloadData(err, {level: 'fatal'}, null, function () {
        log.error({ err: err }, 'manager.beforeExit error');
        closeWorkerServer();
      })
    } else {
      log.info('manager.beforeExit');
      closeWorkerServer();
    }

    function closeWorkerServer () {
      WorkerServer.stop(function (err) {
        if (err) {
          log.error({ err: err }, 'manager.beforeExit WorkerServer stop error');
        }
        done();
      });
    }
  }
});

manager.start();
