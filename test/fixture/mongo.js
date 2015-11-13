/**
 * @module test/fixture/mongo
 */
'use strict';

var mongoClient = require('mongodb').MongoClient;
var put = require('101/put');

var naviEntriesFixtures = require('./navi-entries');
var dbSeedData = put({}, naviEntriesFixtures);

var refNaviEntry = dbSeedData.refererNaviEntry;
delete dbSeedData.refererNaviEntry;

module.exports.seed = function (done) {
  mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) { return done(err); }
    db.collection('navientries').insertMany([
      dbSeedData,
      refNaviEntry
    ], function (err, res) {
      if (err) { return done(err); }
      done();
    });
  });
};

module.exports.clean = function (done) {
  mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) { return done(err); }
    db.collection('navientries').drop(done);
  });
};
