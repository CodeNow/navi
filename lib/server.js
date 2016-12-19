'use strict';
require('loadenv')();

// Will only report to newrelic if
// process.env.NEW_RELIC_LICENSE_KEY
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

require('http').globalAgent.maxSockets = 10000;
require('https').globalAgent.maxSockets = 10000;

const log = require('logger').child({module: 'Server'});
const Promise = require('bluebird');
const rabbitMQ = require('models/rabbitmq');
const Server = require('./models/server.js');

module.exports = App;

function App () {
  this.server = new Server();
}

/**
 * starts required services for this application
 */
App.prototype.start = function () {
  log.info('App.prototype.start');
  return Promise.resolve(rabbitMQ.connect())
    .then(() => {
      return Promise.fromCallback((cb) => {
        this.server.start(cb);
      })
    })
};

/**
 * stops required services for this application
 */
App.prototype.stop = function () {
  log.info('App.prototype.stop');
  return Promise.all([
    rabbitMQ.disconnect(),
    Promise.fromCallback((cb) => {
      this.server.stop(cb);
    })
  ])
};
