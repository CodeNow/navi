'use strict';

require('./loadenv.js');
var Server = require('./models/server.js');
var api = require('./models/api.js');
var error = require('./error.js');
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
  var self = this;

  datadog.monitorStart();
  error.setup();
  api.login(function(err) {
    if (err) { return cb(err); }
    self.server.start(cb);
  });
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
