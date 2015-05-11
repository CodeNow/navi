'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;

var Whitelist = require('models/whitelist.js');

describe('whitelist.js unit test', function () {
  var whitelist;
  beforeEach(function (done) {
    whitelist = new Whitelist();
    done();
  });
  describe('isNotBrowser', function () {
    it('should be true if no headers', function (done) {
      var test = Whitelist.isNotBrowser({});
      expect(test).to.be.true();
      done();
    });
    it('should be true if no user-agent', function (done) {
      var test = Whitelist.isNotBrowser({
        headers: {}
      });
      expect(test).to.be.true();
      done();
    });
    it('should be true with invalid user-agent', function (done) {
      var test = Whitelist.isNotBrowser({
        headers: {
          'user-agent': 'fake'
        }
      });
      expect(test).to.be.true();
      done();
    });
    it('should be true with curl user-agent', function (done) {
      var test = Whitelist.isNotBrowser({
        headers: {
          'user-agent': 'curl/7.37.1'
        }
      });
      expect(test).to.be.true();
      done();
    });
    it('should be false user-agent Chrome', function (done) {
      var test = Whitelist.isNotBrowser({
        headers: {
          'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36'
        }
      });
      expect(test).to.be.false();
      done();
    });
  });
  describe('senderIsOnlist', function () {
    it('TODO: should next if on white list', function(done) {
      Whitelist.senderIsOnlist(null, null, done);
    });
  });
});
