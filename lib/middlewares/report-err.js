/**
 * @module lib/middlewares/report-err
 */
'use strict';

var ErrorCat = require('error-cat');
var assign = require('101/assign');
var keypather = require('keypather')();

var log = require('middlewares/logger')(__filename).log;

module.exports = function (err, req, res, next) {
  log.error({
    tx: true,
    req: req,
    err: err
  }, 'middlewares/report-err');
  if (!err.data) { err.data = {}; }
  assign(err.data, keypather.get(process, 'domain.runnableData') || {});
  ErrorCat.report(err, req);
  next(err);
};
