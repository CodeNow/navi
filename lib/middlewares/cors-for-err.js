/**
 * @module lib/middlewares/cors-for-err
 */
'use strict';

var cors = require('cors');

var log = require('middlewares/logger')(__filename).log;

var corsOptions = {
  origin: function(origin, cb){
    cb(null, true); // navi responds to everyone
  },
  preflightContinue: true // prevents cors mw from setting 204 statusCode
};

module.exports = function (err, req, res, next) {
  var logData = {
    tx: true,
    err: err,
    req: req
  };
  log.info(logData, 'middlwares/cors-for-err');
  // if it made it this far there is an error
  cors(corsOptions)(req, res, function () {
    log.trace(logData, 'middlwares/cors-for-err corsOptions');
    next(err); // original error
  });
};
