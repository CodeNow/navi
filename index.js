'use strict';
var debug = require('auto-debug')();

var app = require('./lib/app.js');

app.start(function (err) {
  if (err) {
    debug.error('failed to start');
    process.exit(1);
  }
});
