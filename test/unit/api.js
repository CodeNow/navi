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
    var testBackend = 'testBackend';
    beforeEach(function(done) {
      sinon.stub(api.apiClient, 'getBackend').yields(null, testBackend);
      done();
    });
    afterEach(function(done) {
      api.apiClient.getBackend.restore();
      done();
    });
    describe('no referer', function() {
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
          expect(api.apiClient.getBackend
            .calledWith('http://'+host, undefined)).to.be.true();
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
          expect(api.apiClient.getBackend
            .calledWith('http://'+host+':80', undefined)).to.be.true();
          done();
        });
      });
    });
    describe('with referer', function() {
      var testRef = 'someRef';
      it('should get backend', function(done) {
        var hostName = 'localhost';
        var host = hostName + ':1234';
        var testArgs = {
          headers: {
            host: host,
            referer: testRef
          }
        };
        api.getHost(testArgs, function(err, backend) {
          if (err) { return done(err); }
          expect(api.apiClient.getBackend
            .calledWith('http://'+host, testRef)).to.be.true();
          expect(backend).to.equal(testBackend);
          done();
        });
      });
      it('should add 80 to host', function(done) {
        var host = 'localhost';
        var testArgs = {
          headers: {
            host: host,
            referer: testRef
          }
        };
        api.getHost(testArgs, function() {
          expect(api.apiClient.getBackend
            .calledWith('http://'+host+':80', testRef)).to.be.true();
          done();
        });
      });
    });
  });
});
