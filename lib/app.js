'use strict';

require('./loadenv.js');
var ProxyServer = require('./models/proxy.js');
var api = require('./models/api-client.js');
var error = require('./error.js');
var datadog = require('./models/datadog.js');
var debug = require('auto-debug')();

module.exports = App;

function App () {
  debug.trace(arguments);
  this.proxy = new ProxyServer();
}

/**
 * starts required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.start = function (cb) {
  var self = this;

  debug.trace(arguments);
  datadog.monitorStart();
  error.setup();
  api.login(function(err) {
    if (err) { return cb(err); }
    self.proxy.start(cb);
  });
};

/**
 * stops required services for this application
 * @param  {Function} cb (err)
 */
App.prototype.stop = function (cb) {
  debug.trace(arguments);
  datadog.monitorStop();
  this.proxy.stop(cb);
};
