'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var expect = require('code').expect;
var sinon = require('sinon');

var HostLookup = require('../../lib/models/host-lookup.js');

describe('host-lookup.js unit test', function () {
  var hostLookup;
  beforeEach(function (done) {
    hostLookup = new HostLookup();
    done();
  });
  describe('lookup', function () {
    describe('using api driver', function () {
      var req = {test: 'test'};
      beforeEach(function (done) {
        sinon.stub(hostLookup.api, 'shouldUse').returns(true);
        done();
      });
      afterEach(function (done) {
        expect(hostLookup.api.shouldUse.calledWith(req)).to.be.true();
        hostLookup.api.shouldUse.restore();
        done();
      });
      it('should cb err if errored getting host', function (done) {
        var testErr = 'some Err';
        sinon.stub(hostLookup.api, 'getHost').yields(testErr);

        hostLookup.lookup(req, {}, function (err) {
          expect(err).to.equal(testErr);
          hostLookup.api.getHost.restore();
          done();
        });
      });
      it('should use api to return host', function (done) {
        var host = 'localhost:3232';
        var res = {send: 'some res'};
        sinon.stub(hostLookup.api, 'getHost').yields(null, host);

        hostLookup.lookup(req, res, function (err) {
          if (err) { return done(err); }

          expect(hostLookup.api.getHost.calledWith(req)).to.be.true();
          hostLookup.api.getHost.restore();
          done();
        });
      });
    });
    describe('using no driver', function () {
      var req = {test: 'test'};
      beforeEach(function (done) {
        sinon.stub(hostLookup.api, 'shouldUse').returns(false);
        done();
      });
      afterEach(function (done) {
        expect(hostLookup.api.shouldUse.calledWith(req)).to.be.true();
        hostLookup.api.shouldUse.restore();
        done();
      });
      it('should error if we cant use any drivers', function (done) {
        hostLookup.lookup(req, {}, function (err) {
          expect(err).to.exist();
          done();
        });
      });
    });
  });
});
