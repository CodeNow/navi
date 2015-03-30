'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var Api = require('../../lib/models/api.js');

var ctx = {};
lab.experiment('api.js unit test', function () {
  lab.beforeEach(function(done) {
    ctx.api = new Api();
    done();
  });
  lab.experiment('shouldUse', function () {
    lab.it('should use if host provided', function (done) {
      var testArgs = {
        headers: {
          host: 'localhost:1234'
        }
      };
      var use = ctx.api.shouldUse(testArgs);
      expect(use).to.be.true();
      done();
    });
    lab.it('should be false if no headers', function (done) {
      var testArgs = {};
      var use = ctx.api.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    lab.it('should be false if host not provided', function (done) {
      var testArgs = {
        headers: {}
      };
      var use = ctx.api.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
  });
  lab.experiment('getHost', function () {
    lab.it('should cb error if err to getNameFromHost', function(done) {
      var testErr = 'some err';
      var testArgs = {
        headers: {
          host: 'localhost:1234'
        }
      };
      var stub = sinon.stub(ctx.api.hostMapping, 'getNameFromHost').yields(testErr);
      ctx.api.getHost(testArgs, function(err) {
        expect(err).to.equal(testErr);
        stub.restore();
        done();
      });
    });
    lab.experiment('getNameFromHost passes', function () {
      var testName = 'somename';
      var testBackend = 'testBackend';
      lab.beforeEach(function(done) {
        ctx.getNameFromHostStub = sinon.stub(ctx.api.hostMapping, 'getNameFromHost')
          .yields(null, testName);
        ctx.getBackendStub = sinon.stub(ctx.api.apiClient, 'getBackend')
          .yields(null, testBackend);
        done();
      });
      lab.afterEach(function(done) {
        ctx.getNameFromHostStub.restore();
        ctx.getBackendStub.restore();
        done();
      });
      lab.it('should get backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':1234';
        var testArgs = {
          headers: {
            host: host
          }
        };
        ctx.api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(ctx.getNameFromHostStub.calledWith(hostName)).to.be.true();
          expect(ctx.getBackendStub.calledWith(host, testName)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      lab.it('should add 80 to host', function(done) {
        var host = 'localhost';
        var testArgs = {
          headers: {
            host: host
          }
        };
        ctx.api.getHost(testArgs, function() {
          expect(ctx.getNameFromHostStub.calledWith(host)).to.be.true();
          expect(ctx.getBackendStub.calledWith(host+':80', testName)).to.be.true();
          done();
        });
      });
    });
  });
});
