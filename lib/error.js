'use strict';
require('./loadenv.js');

var envIs = require('101/env-is');
var pick = require('101/pick');
var noop = require('101/noop');
var rollbar = require('rollbar');
var Boom = require('boom');
var debug = require('debug')('sisqo:errors');

if (process.env.ROLLBAR_KEY) {
  rollbar.init(process.env.ROLLBAR_KEY, {
    environment: process.env.NODE_ENV || 'development',
    branch: process.env.ROLLBAR_OPTIONS_BRANCH,
    codeVersion: process.env._VERSION_GIT_COMMIT,
    root: process.env.ROOT_DIR
  });
}

function errorCaster(code, message, data) {
  return Boom.create(code, message, data);
}

function errorResponder(err, req, res, next) {
  if (!err.isBoom) {
    err = errorCaster(500, err.message || 'Unknown', { err: err });
  }
  err.reformat();
  // respond error
  res
    .status(err.output.statusCode)
    .json(err.output.payload);
  // log errors
  log(err, req);
}

function logIfErr (err) {
  if (err) {
    log(err);
  }
}

function log (err, req) {
  if (!err.isBoom) {
    err = errorCaster(500, err.message || 'Unknown', { err: err });
  }
  if (!req || !req.url || !req.method) {
    req = null;
  }
  err.reformat();
  var statusCode = err.output.statusCode;
  if (statusCode >= 500) {
    debug('Bad App Error: ',
      statusCode,
      req ? req.method : 'unknown url',
      req ? req.url : 'unknown method');
  }
  else {
    debug('Acceptable App Error: ',
      statusCode,
      req ? req.method : 'unknown url',
      req ? req.url : 'unknown method',
      err.message);
  }
  if (!envIs('test')) {
    report(err, req);
  }
  if (statusCode >= 500) {
    logDebug(err);
  }
}

function logDebug (err) {
  debug('--Boom Error--');
  debug(err.stack);
  if (err.data && err.data.err) {
    debug('--Original Error--');
    debug(err.data.err.stack);
  }
}

function report (err, req) {
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
  rollbar.handleErrorWithPayloadData(err, { custom: custom }, req, noop);
}

function create(message, data) {
  var err = new Error(message);
  err.data = data;
  log(err);
  return err;
}

module.exports.errorResponder = errorResponder;
module.exports.errorCaster = errorCaster;
module.exports.logIfErr = logIfErr;
module.exports.create = create;
module.exports.log = log;
