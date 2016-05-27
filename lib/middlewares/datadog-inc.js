'use strict';

var monitor = require('monitor-dog');

module.exports = datadogInc;

/**
 * track url hits
 */
function datadogInc (req, res, next) {
  req.startTime = new Date();
  monitor.increment('navi.url-hit.count', {
    isBrowser: req.isBrowser
  });
  next();
}
