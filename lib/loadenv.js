'use strict';

var dotenv = require('dotenv');
var eson = require('eson');
var path = require('path');
var debug = require('debug')('sisqo:config');
var env = process.env.NODE_ENV;

dotenv.config({path: path.resolve(__dirname, '../configs/env')});
dotenv.config({path: path.resolve(__dirname, '../configs/env.'+env)});
// dotenv.load();

process.env = eson()
  .use(convertStringToNumeral)
  .parse(JSON.stringify(process.env));

debug(process.env);

function convertStringToNumeral(key, val) {
  if (!isNaN(val)) {
    return parseInt(val);
  } else {
    return val;
  }
}
