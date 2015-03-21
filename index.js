'use strict';

require('./lib/loadenv.js');
var debug = require('debug')('navi:index.js');

if (process.env.NEWRELIC_KEY) {
  require('newrelic');
}

var dd = require('./lib/models/datadog.js');
dd.monitorStart();

var app = require('./lib/app.js');
app.listen(process.env.PORT);
debug('running on port ' + process.env.PORT);
