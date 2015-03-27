'use strict';
require('../loadenv.js');

var StatsD = require('node-dogstatsd').StatsD;
var child = require('child_process');

var Datadog = function () {
  this.client = new StatsD(process.env.DATADOG_HOST, process.env.DATADOG_PORT);
};

Datadog.prototype._captureSocketCount = function () {
  var self = this;
  var sockets = require('http').globalAgent.sockets;
  var request = require('http').globalAgent.requests;
  var key;

  for (key in sockets) {
    self.client.gauge('navi.sockets_open', sockets[key].length, 1,
      ['target:'+key, 'pid:'+process.pid]);
  }

  for (key in request) {
    self.client.gauge('navi.sockets_pending', request[key].length, 1,
      ['target:'+key, 'pid:'+process.pid]);
  }

  child.exec('lsof -p ' + process.pid + ' | wc -l', function (err, stdout) {
    if (err) { return; }
    self.client.gauge('navi.openFiles', parseInt(stdout), 1, ['pid:'+process.pid]);
  });
};

Datadog.prototype.monitorStart = function () {
  if (this.interval) { return; }
  this.interval = setInterval(this._captureSocketCount, process.env.MONITOR_INTERVAL);
};

Datadog.prototype.monitorStop = function () {
  if (this.interval) {
    clearInterval(this.interval);
    this.interval = null;
  }
};

module.exports = new Datadog();
