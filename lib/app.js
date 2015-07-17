'use strict';

require('http').globalAgent.maxSockets = 10000;
require('https').globalAgent.maxSockets = 10000;

require('./loadenv.js');
var Server = require('./models/server.js');
var datadog = require('./models/datadog.js');
var debug = require('auto-debug')();

module.exports = App;

function App () {
  this.server = new Server();
}

/**
 * starts required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.start = function (cb) {
  debug('start');
  datadog.monitorStart();
  this.server.start(cb);
};

/**
 * stops required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.stop = function (cb) {
  debug('stop');
  datadog.monitorStop();
  this.server.stop(cb);
};
