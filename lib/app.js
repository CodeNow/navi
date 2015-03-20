'use strict';
require('./loadenv.js');

var express = require('express');
var app = module.exports = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var envIs = require('101/env-is');

app.use(morgan('short', {
  skip: function () {
    return envIs('test') || process.env.LOG !== 'true';
  }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// error handler
app.use(require('./error.js').errorResponder);

app.get('/', function (req, res) {
  res
    .status(200)
    .json({
      message: process.env.npm_package_description,
      git: process.env.npm_package_gitHead,
      config: process.env
    });
});

app.all('*', function (req, res) {
  res
    .status(404)
    .json({
      message: 'route not implemented'
    });
});
