'use strict';

require('loadenv')();

// leave this newrelic require up here!
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

const log = require('logger').child({module: 'Navi'});
const Server = require('server.js');
const workerServer = require('worker.js');

const httpServer = new Server()
const Navi = {};
Navi.start = () => {
  return Promise.all([
    workerServer.start(),
    httpServer.start()
  ])
    .then(() => {
      log.trace('Started Navi');
      process.on('SIGINT', Navi.stop);
      process.on('SIGTERM', Navi.stop);
    })
    .catch((e) => {
      log.fatal({error: e}, 'Error starting server');
      throw e;
    });
};

Navi.stop = () => {
  process.removeListener('SIGINT', Navi.stop);
  process.removeListener('SIGTERM', Navi.stop);
  return Promise.all([
    workerServer.stop(),
    httpServer.stop()
  ])
    .then(() => {
      log.trace('Stopped Navi');
    })
    .catch((e) => {
      log.fatal({error: e}, 'Error stopping server');
      throw e;
    });
};

process.on('uncaughtException', function (err) {
  log.fatal({
    err: err
  }, 'stopping app due too uncaughtException')
  Navi.stop()
});

Navi.start();
