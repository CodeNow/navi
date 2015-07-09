'use strict';

var ErrorCat = require('error-cat');

module.exports = function (err, req, res, next) {
  console.log('XXXX ERR', err);
  ErrorCat.report(err, req);
  next(err);
};