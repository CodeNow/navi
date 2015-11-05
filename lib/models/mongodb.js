/**
 * @module lib/models/mongodb
 */
'use strict';

var isFunction = require('101/is-function');
var keypather = require('keypather')();
var mongoClient = require('mongodb').MongoClient;

var log = require('middlewares/logger')(__filename).log;

function Mongo () {
  this.mongoClient = mongoClient;
  this.db = null;
}

Mongo.prototype.start = function (cb) {
  log.info('Mongo.prototype.start');
  var self = this;
  this.mongoClient.connect(process.env.MONGODB_URL, function (err, db) {
    if (err) {
      log.error({
        err: err,
        url: process.env.MONGODB_URL
      }, 'start mongoClient connect error');
      return cb(err);
    }
    log.trace('start mongoClient connect success');
    self.db = db;
    cb();
  });
};

Mongo.prototype.stop = function (cb) {
  log.info('Mongo.prototype.stop');
  if (!isFunction(keypather.get(this.db, 'close'))) {
    log.warn('mongo stop !this.db');
    return cb();
  }
  this.db.close(cb);
};

module.exports = new Mongo();
