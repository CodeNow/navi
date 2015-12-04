/**
 * @module lib/models/worker-server
 */
'use strict';

var ponos  = require('ponos');

var hermes = require('hermes');

module.exports = WorkerServer;

/**
 *
 */
function WorkerServer () {}

WorkerServer._server = null;

/**
 * Binds to RabbitMQ server and listens for tasks
 * @param {Function} cb
 */
WorkerServer.listen = function (cb) {
  log.info('WorkerServer.listen');

  var tasks = {
    'navi.cache.invalidated': require('workers/navi.cache.invalidated')
  };

  WorkerServer._server = new Ponos.server({
    hermes: hermes,
    queues: Object.keys(tasks)
  });

  WorkerServer._server.setAllTasks(tasks);

  WorkerServer._server
    .start()
    .then(function () {
      log.trace('worker server started');
      cb();
    })
    .catch(function (err) {
      log.error({ err: err}, 'worker server failed to start')
      cb(err);
    });
};

/**
 * Unbinds from rabbitMQ
 * @param {Function} cb
 */
WorkerServer.stop = function (cb) {
  log.info('WorkerServer.stop');

  WorkerServer._server
    .stop()
    .then(function () {
      log.trace('worker server stopped');
      cb();
    })
    catch(function (err) {
      log.error({ err: err }, 'worker server failed to stop');
      cb();
    });
};
