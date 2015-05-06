'use strict';

var http = require('http');
var Primus = require('primus');

module.exports.create = function (port, host, text, cb) {
  var server = http.createServer().listen(port, host, cb);
  var primus = new Primus(server);
  primus.on('connection', function (spark) {
    spark.write({
      text: text
    });
    spark.end();
  });
  return server;
};
