'use strict';
require('loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var expect = require('code').expect;

var browserCheck = require('middlewares/browser-check.js');

var chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';

describe('browser-check.js unit test', function() {
  describe('chrome agent', function() {
    var testReq;
    beforeEach(function(done) {
      testReq = {
        headers: {
          'user-agent': chromeUserAgent
        }
      };
      done();
    });
    it('should set req.isBrowser to true', function(done) {
      browserCheck(testReq, {}, function () {
        expect(testReq.isBrowser).to.be.true();
      });
      done();
    });
  });
  describe('random agent', function() {
    var testReq;
    beforeEach(function(done) {
      testReq = {
        headers: {
          'user-agent': 'random'
        }
      };
      done();
    });
    it('should set req.isBrowser to true', function(done) {
      browserCheck(testReq, {}, function () {
        expect(testReq.isBrowser).to.be.false();
      });
      done();
    });
  });
  describe('no headers', function() {
    var testReq;
    beforeEach(function(done) {
      testReq = {};
      done();
    });
    it('should set req.isBrowser to true', function(done) {
      browserCheck(testReq, {}, function () {
        expect(testReq.isBrowser).to.be.false();
      });
      done();
    });
  });
});