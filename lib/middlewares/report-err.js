'use strict';

var ErrorCat = require('error-cat');

module.exports = function (err, req, res, next) {
  ErrorCat.report(err, req);
  next(err);
};