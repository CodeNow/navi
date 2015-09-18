'use strict';
require('loadenv.js');

// if (process.env.NEWRELIC_KEY) {
//   require('newrelic');
// }

var App = require('./lib/app.js');
var logger = require('middlewares/logger')(__filename);

var app = new App();
var log = logger.log;

app.start(function (err) {
  if (err) {
    log.error({
      err: err
    }, 'app failed to start');
    process.exit(1);
  }
});
