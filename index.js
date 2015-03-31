'use strict';
var debug = require('auto-debug')();

var App = require('./lib/app.js');
var app = new App();

app.start(function (err) {
  if (err) {
    debug('failed to start');
    process.exit(1);
  }
});
