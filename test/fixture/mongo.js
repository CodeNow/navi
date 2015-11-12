/**
 * @module test/fixture/mongo
 */
'use strict';

var mongoClient = require('mongodb').MongoClient;

module.exports.seed = function (done) {
  mongoClient.connect(process.env.MONGO, function (err, db) {
    if (err) { return done(err); }
    db.collection('navientries').insertMany([{
      
    }], function (err, res) {
      if (err) { return done(err); }
      done();
    });
  });
};

module.exports.clean = function (done) {
  done();
};
