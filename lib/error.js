'use strict';
require('./loadenv.js');

var envIs = require('101/env-is');
var pick = require('101/pick');
var noop = require('101/noop');
var rollbar = require('rollbar');
var debug = require('debug')('navi:errors');

if (process.env.ROLLBAR_KEY) {
  rollbar.init(process.env.ROLLBAR_KEY, {
    environment: process.env.NODE_ENV || 'development',
    branch: process.env.ROLLBAR_OPTIONS_BRANCH,
    codeVersion: process.env._VERSION_GIT_COMMIT,
    root: process.env.ROOT_DIR
  });
}

/**
 * returns 500 to user. do not anything else or user might think it is form their app
 * @param  {object}   err  error which happed, used for logging
 * @param  {object}   res  response to use
 */
function errorResponder(err, res) {
  res.writeHead(500, {'Content-Type': 'text/plain'});
  res.end('try again later');
  // log errors
  log(err, res);
}

/**
 * logs if there is an error
 * @param  {object} err error to log
 */
function logIfErr (err) {
  if (err) {
    log(err);
  }
}

function log (err) {
  if (!envIs('test')) {
    report(err);
  }
  debug(err.data);
}

function report (err) {
  var custom = err.data || {};
  if (custom.err) { // prevent sending circular
    var errKeys;
    try {
      errKeys = Object.keys(custom.err);
    }
    catch (err) {
      errKeys = [];
    }
    custom.err = pick(custom.err, ['message', 'stack']);
  }
  rollbar.handleErrorWithPayloadData(err, { custom: custom }, noop);
}

function create (message, data) {
  var err = new Error(message);
  err.data = data;
  log(err);
  return err;
}

module.exports.errorResponder = errorResponder;
module.exports.logIfErr = logIfErr;
module.exports.create = create;
module.exports.log = log;
