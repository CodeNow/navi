'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var HostLookup = require('../../lib/models/host-lookup.js');

lab.experiment('hostLookup.js unit test', function () {
  lab.experiment('lookup', function () {
    lab.it('should use cookie to return host', function(done) {
      var hostLookup = new HostLookup();
      var req = {test: 'test'};
      var shouldUseStub = sinon.stub(hostLookup.cookie, 'shouldUse').returns(true);
      var getHostStub = sinon.stub(hostLookup.cookie, 'getHost').yields();

      hostLookup.lookup(req, function(err) {
        if (err) { return done(err); }

        expect(shouldUseStub.calledWith(req)).to.be.true();
        expect(getHostStub.calledWith(req)).to.be.true();

        shouldUseStub.restore();
        getHostStub.restore();
        done();
      });
    });
    lab.experiment('using api lookup', function () {
      var ctx = {};
      lab.beforeEach(function(done) {
        ctx.hostLookup = new HostLookup();
        ctx.shouldUseStubCookie = sinon.stub(ctx.hostLookup.cookie, 'shouldUse').returns(false);
        ctx.shouldUseStubApi = sinon.stub(ctx.hostLookup.api, 'shouldUse').returns(true);
        done();
      });
      lab.afterEach(function(done) {
        expect(ctx.shouldUseStubCookie.called).to.be.true();
        expect(ctx.shouldUseStubApi.called).to.be.true();
        ctx.shouldUseStubCookie.restore();
        ctx.shouldUseStubApi.restore();
        done();
      });
      lab.it('should cb err if errored getting host', function(done) {
        var req = {test: 'test'};
        var testErr = 'some Err';
        var getHostStub = sinon.stub(ctx.hostLookup.api, 'getHost').yields(testErr);

        ctx.hostLookup.lookup(req, function(err) {
          expect(err).to.equal(testErr);
          getHostStub.restore();
          done();
        });
      });
      lab.it('should use api to return host and save cookie', function(done) {
        var req = {test: 'test'};
        var host = 'localhost:3232';
        var saveHostStub = sinon.stub(ctx.hostLookup.cookie, 'saveHost').returns();
        var getHostStub = sinon.stub(ctx.hostLookup.api, 'getHost').yields(null, host);

        ctx.hostLookup.lookup(req, function(err) {
          if (err) { return done(err); }

          expect(getHostStub.calledWith(req)).to.be.true();
          expect(saveHostStub.calledWith(req, host)).to.be.true();
          saveHostStub.restore();
          getHostStub.restore();
          done();
        });
      });
    });
    lab.experiment('using api lookup', function () {
      var ctx = {};
      lab.beforeEach(function(done) {
        ctx.hostLookup = new HostLookup();
        ctx.shouldUseStubCookie = sinon.stub(ctx.hostLookup.cookie, 'shouldUse').returns(false);
        ctx.shouldUseStubApi = sinon.stub(ctx.hostLookup.api, 'shouldUse').returns(false);
        done();
      });
      lab.afterEach(function(done) {
        expect(ctx.shouldUseStubCookie.called).to.be.true();
        expect(ctx.shouldUseStubApi.called).to.be.true();
        ctx.shouldUseStubCookie.restore();
        ctx.shouldUseStubApi.restore();
        done();
      });
      lab.it('should error if we cant use any drivers', function(done) {
        var req = {test: 'test'};
        ctx.hostLookup.lookup(req, function(err) {
          expect(err).to.exist();
          done();
        });
      });
    });
  });
});