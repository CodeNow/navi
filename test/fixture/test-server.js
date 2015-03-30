'use strict';

var http = require('http');

module.exports.create = function (port, host, text, cb) {
  return http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(text);
  }).listen(port, host, cb);
};
