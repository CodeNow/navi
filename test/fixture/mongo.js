/**
 * @module test/fixture/mongo
 */
'use strict';

var mongoClient = require('mongodb').MongoClient;
var put = require('101/put');

var naviEntriesFixtures = require('./navi-entries');
var dbSeedData = put({}, naviEntriesFixtures);

module.exports.seed = function (done) {
  mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) { return done(err); }
    var mySeed = [];
    Object.keys(dbSeedData).forEach(function (key) {
      mySeed.push(dbSeedData[key]);
    });
    db.collection('navientries').insertMany(mySeed, function (err) {
      db.close();
      done(err);
    });
  });
};

module.exports.clean = function (done) {
  mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) { return done(err); }
    db.collection('navientries').drop(function (err) {
      if (err && err.message !== 'ns not found') {
        db.close();
        return done(err);
      }
      db.close();
      return done();
    });
  });
};
