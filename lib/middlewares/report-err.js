/**
 * @module lib/middlewares/report-err
 */
'use strict';

var ErrorCat = require('error-cat');

var log = require('middlewares/logger')(__filename).log;

module.exports = function (err, req, res, next) {
  log.error({
    tx: true,
    req: req,
    err: err
  }, 'middlewares/report-err');
  ErrorCat.report(err, req);
  next(err);
};
