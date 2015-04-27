'use strict';
require('./loadenv.js');

var envIs = require('101/env-is');
var noop = require('101/noop');
var rollbar = require('rollbar');
var debug = require('auto-debug')();
var Boom = require('boom');

/**
 * returns 500 to user. do not anything else or user might think it is from their app
 * @param  {object}   err  error which happed, used for logging
 * @param  {object}   res  response to use
 */
/* jslint unused:false */
function errorResponder (err, req, res, next) {
  var code = 500;
  var out = 'try again later';

  if (err.isBoom) {
    code = err.output.statusCode;
    out = err.output.payload;
  }
  res.writeHead(code, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(out));
}

/**
 * used to setup error module
 */
function setup () {
  if (process.env.ROLLBAR_KEY) {
    rollbar.init(process.env.ROLLBAR_KEY, {
      environment: process.env.NODE_ENV,
      branch: process.env.ROLLBAR_OPTIONS_BRANCH,
      codeVersion: process.env._VERSION_GIT_COMMIT,
      root: process.env.ROOT_DIR
    });
  }
}

/**
 * should log and report error
 * @param  {object} err error to log
 * @return {object}     error object logged
 */
function log (err) {
  debug(err);

  if (!envIs('test')) {
    report(err);
  }
  return err;
}

/**
 * reports error to rollbar
 * @param  {object} err error to report
 */
function report (err) {
  var custom = err.data || {};
  rollbar.handleErrorWithPayloadData(err, { custom: custom }, noop);
}

/**
 * create a new Boom error object
 * @param  {string} message describing error
 * @param  {mixed}  data    added data to add to error
 * @return {object}         created error object
 */
function create (code, message, data) {
  var err = Boom.create(code, message, data);
  return log(err);
}

module.exports.errorResponder = errorResponder;
module.exports.create = create;
module.exports.setup = setup;
module.exports.log = log;
