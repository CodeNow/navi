'use strict';
var http = require('http');

module.exports = http.createServer(function (req, res) {
  res.write('hello');
  res.end();
});
