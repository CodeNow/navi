'use strict';

var http = require('http');

var cookie = require('cookie');
var setCookie = require('set-cookie');

var server = http.createServer(function(req, res) {
  console.log(cookie.parse(req.headers.cookie));
  setCookie('anand', 'the value of the cookie', {
    domain: '.localhost',
    res: res
  });
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
});
server.listen(8080);
