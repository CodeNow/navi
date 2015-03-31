'use strict';

require('./loadenv.js');
var ProxyServer = require('./models/proxy.js');
var error = require('./error.js');
var datadog = require('./models/datadog.js');
var debug = require('auto-debug')();

module.exports = App;

function App () {
  debug.trace();
  this.proxy = new ProxyServer();
}

/**
 * starts required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.start = function (cb) {
  debug.trace();
  datadog.monitorStart();
  error.setup();
  this.proxy.start(cb);
};

/**
 * stops required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.stop = function (cb) {
  debug.trace();
  datadog.monitorStop();
  this.proxy.stop(cb);
};
