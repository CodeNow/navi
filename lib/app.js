'use strict';
require('./loadenv.js');

var http = require('http');
var https = require('https');
var httpProxy = require('http-proxy');

var options = {
  // Disable the http Agent of the http-proxy library so we force
  // the proxy to close the connection after each request to the backend
  agent: false
};


var proxy = httpProxy.createProxyServer(options);
// set both of these to max because we want accept all user request
http.globalAgent.maxSockets = Number.MAX_VALUE;
https.globalAgent.maxSockets = Number.MAX_VALUE;

