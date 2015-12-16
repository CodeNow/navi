/**
 * @module lib/app
 */
'use strict';

// Will only report to newrelic if
// process.env.NEW_RELIC_LICENSE_KEY
require('newrelic');

require('http').globalAgent.maxSockets = 10000;
require('https').globalAgent.maxSockets = 10000;

require('./loadenv.js');
var Server = require('./models/server.js');
var datadog = require('./models/datadog.js');
var log = require('middlewares/logger')(__filename).log;

module.exports = App;

function App () {
  this.server = new Server();
}

/**
 * starts required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.start = function (cb) {
  log.info('App.prototype.start');
  datadog.monitorStart();
  this.server.start(cb);
};

/**
 * stops required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.stop = function (cb) {
  log.info('App.prototype.stop');
  datadog.monitorStop();
  this.server.stop(cb);
};
