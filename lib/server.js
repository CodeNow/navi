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
const rabbitMQ = require('models/rabbitmq')
const Server = require('./models/server.js');

module.exports = App;

function App () {
  this.server = new Server();
}

/**
 * starts required services for this application
 */
App.prototype.start = function () {
  return Promise.fromCallback((cb) => {
    log.info('App.prototype.start');
    this.server.start(cb);
  })
    .then(rabbitMQ.connect)
};

/**
 * stops required services for this application
 */
App.prototype.stop = function () {
  return Promise.fromCallback((cb) => {
    log.info('App.prototype.stop');
    this.server.stop(cb);
  })
    .then(rabbitMQ.disconnect)
};
