'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;

var expect = require('code').expect;

var Whitelist = require('models/whitelist.js');

describe('whitelist.js unit test', function () {
  describe('isNotBrowser', function () {
    it('should be exist if no headers', function (done) {
      var testReq = {};
      Whitelist.isNotBrowser(testReq, {}, function () {
        expect(testReq.isNotBrowser).to.exist();
        done();
      });
    });
    it('should be exist if no user-agent', function (done) {
      var testReq = {
        headers: {}
      };
      Whitelist.isNotBrowser(testReq, {}, function () {
        expect(testReq.isNotBrowser).to.exist();
        done();
      });
    });
    it('should be exist with invalid user-agent', function (done) {
      var testReq = {
        headers: {
          'user-agent': 'fake'
        }
      };
      Whitelist.isNotBrowser(testReq, {}, function () {
        expect(testReq.isNotBrowser).to.exist();
        done();
      });
    });
    it('should be exist with curl user-agent', function (done) {
      var testReq = {
        headers: {
          'user-agent': 'curl/7.37.1'
        }
      };
      Whitelist.isNotBrowser(testReq, {}, function () {
        expect(testReq.isNotBrowser).to.exist();
        done();
      });
    });
    it('should be false user-agent Chrome', function (done) {
      var testReq = {
        headers: {
          'user-agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36'
        }
      };
      Whitelist.isNotBrowser(testReq, {}, function () {
        expect(testReq.isNotBrowser).to.not.exist();
        done();
      });
    });
  });
  describe('senderIsOnlist', function () {
    it('TODO: should next if on white list', function(done) {
      Whitelist.senderIsOnlist(null, null, done);
    });
  });
});
