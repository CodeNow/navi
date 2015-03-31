'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var beforeEach = beforeEach;
var afterEach  = afterEach;
var expect = require('code').expect;

var sinon = require('sinon');

var Api = require('../../lib/models/api.js');

describe('api.js unit test', function () {
  var api;
  beforeEach(function(done) {
    api = new Api();
    done();
  });
  describe('shouldUse', function () {
    it('should use if host provided', function (done) {
      var testArgs = {
        headers: {
          host: 'localhost:1234'
        }
      };
      var use = api.shouldUse(testArgs);
      expect(use).to.be.true();
      done();
    });
    it('should be false if no headers', function (done) {
      var testArgs = {};
      var use = api.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    it('should be false if host not provided', function (done) {
      var testArgs = {
        headers: {}
      };
      var use = api.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
  });
  describe('getHost', function () {
    it('should cb error if err to getNameFromHost', function(done) {
      var testErr = 'some err';
      var testArgs = {
        headers: {
          host: 'localhost:1234'
        }
      };
      sinon.stub(api.hostMapping, 'getNameFromHost').yields(testErr);
      api.getHost(testArgs, function(err) {
        expect(err).to.equal(testErr);
        api.hostMapping.getNameFromHost.restore();
        done();
      });
    });
    describe('getNameFromHost passes', function () {
      var testName = 'somename';
      var testBackend = 'testBackend';
      beforeEach(function(done) {
        sinon.stub(api.hostMapping, 'getNameFromHost').yields(null, testName);
        sinon.stub(api.apiClient, 'getBackend').yields(null, testBackend);
        done();
      });
      afterEach(function(done) {
        api.hostMapping.getNameFromHost.restore();
        api.apiClient.getBackend.restore();
        done();
      });
      it('should get backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':1234';
        var testArgs = {
          headers: {
            host: host
          }
        };
        api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(api.hostMapping.getNameFromHost.calledWith(hostName)).to.be.true();
          expect(api.apiClient.getBackend.calledWith(host, testName)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      it('should add 80 to host', function(done) {
        var host = 'localhost';
        var testArgs = {
          headers: {
            host: host
          }
        };
        api.getHost(testArgs, function() {
          expect(api.hostMapping.getNameFromHost.calledWith(host)).to.be.true();
          expect(api.apiClient.getBackend.calledWith(host+':80', testName)).to.be.true();
          done();
        });
      });
    });
  });
});
