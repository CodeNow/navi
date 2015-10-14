/**
 * @module index
 */
'use strict';
require('loadenv.js');

if (process.env.NEWRELIC_KEY) {
  require('newrelic');
}

var App = require('./lib/app.js');
var log = require('middlewares/logger')(__filename).log;

var app = new App();

app.start(function (err) {
  if (err) {
    log.error({
      err: err
    }, 'app.start error');
    process.exit(1);
  }
  else {
    log.info('app.start success');
  }
});
