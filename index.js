'use strict';

var http = require('http');


var server = http.createServer(function(req) {
  console.log(req);
});
server.listen(8080);
