/**
 * @module lib/loadenv
 */
'use strict';

var dotenv = require('dotenv');
var eson = require('eson');
var exists = require('101/exists');
var path = require('path');

var logger = require('middlewares/logger')(__filename);

var log = logger.log;

module.exports = load; // load is immediately invoked on require (see below)

function load () {
  var env = process.env.NODE_ENV;
  dotenv.config({path: path.resolve(__dirname, '../configs/env.'+env)});
  dotenv.config({path: path.resolve(__dirname, '../configs/env')});

  process.env = eson()
    .use(convertStringToNumeral)
    .parse(JSON.stringify(process.env));

  log.info({
    env: process.env
  }, 'environment loaded');

  var requiredKeys = [
    'ERROR_URL'
  ];

  requiredKeys.forEach(function (key) {
    if (!exists(process.env[key])) {
      throw new Error('process.env.'+key+' is required');
    }
  });

  function convertStringToNumeral(key, val) {
    if (!isNaN(val)) {
      return parseInt(val);
    } else {
      return val;
    }
  }
}

load();
