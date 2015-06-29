'use strict';

var cors = require('cors');
var corsOptions = {
  origin: function(origin, cb){
    cb(null, true); // navi responds to everyone
  },
  preflightContinue: true // prevents cors mw from setting 204 statusCode
};

module.exports = function (err, req, res, next) {
  // if it made it this far there is an error
  cors(corsOptions)(req, res, function () {
    next(err); // original error
  });
};