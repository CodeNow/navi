/**
 * @module test/unit/mongo
 */
'use strict';

require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;
var mongodb = require('mongodb');
var sinon = require('sinon');

var mongo = require('models/mongo');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

describe('lib/models/mongodb', function () {
  var mockDb = {
    collection: function () {
    }
  };
  beforeEach(function (done) {
    sinon.stub(mongodb.MongoClient, 'connect').yieldsAsync(null, mockDb);
    done();
  });
  afterEach(function (done) {
    mongodb.MongoClient.connect.restore();
    done();
  });
  describe('Mongo.prototype.start', function () {
    it('should attempt to connect to mongo server', function (done) {
      mongo.start(function (err) {
        expect(err).to.be.undefined();
        expect(mongodb.MongoClient.connect.callCount).to.equal(1);
        done();
      });
    });
  });
});
