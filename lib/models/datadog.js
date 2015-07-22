'use strict';
require('../loadenv.js');

var StatsD = require('node-dogstatsd').StatsD;
var child = require('child_process');
var logger = require('middlewares/logger')(__filename);

var log = logger.log;

var Datadog = function () {
  this.client = new StatsD(process.env.DATADOG_HOST, process.env.DATADOG_PORT);
};

Datadog.prototype._captureSocketCount = function () {
  var self = this;
  var sockets = require('http').globalAgent.sockets;
  var requests = require('http').globalAgent.requests;
  var key;

  for (key in sockets) {
    log.info('navi.sockets_open', key, sockets[key].length);
    self.client.gauge('navi.sockets_open', sockets[key].length, 1,
      ['target:'+key, 'pid:'+process.pid]);
  }

  for (key in requests) {
    log.info('navi.sockets_pending', key, requests[key].length);
    self.client.gauge('navi.sockets_pending', requests[key].length, 1,
      ['target:'+key, 'pid:'+process.pid]);
  }

  child.exec('lsof -p ' + process.pid + ' | wc -l', function (err, stdout) {
    if (err) { return; }
    log.info('navi.openFiles', parseInt(stdout));
    self.client.gauge('navi.openFiles', parseInt(stdout), 1, ['pid:'+process.pid]);
  });
};

Datadog.prototype.monitorStart = function () {
  if (this.interval) { return; }
  this.interval = setInterval(this._captureSocketCount.bind(this), process.env.MONITOR_INTERVAL);
};

Datadog.prototype.monitorStop = function () {
  if (this.interval) {
    clearInterval(this.interval);
    this.interval = null;
  }
};

module.exports = new Datadog();
