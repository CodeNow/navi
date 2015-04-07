'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var before = lab.before;
var after = lab.after;
var expect = require('code').expect;
var cookie = require('cookie');

var Cookie = require('../../lib/models/cookie.js');

describe('cookie.js unit test', function () {
  var tCookie;
  beforeEach(function(done) {
    tCookie = new Cookie();
    done();
  });
  describe('shouldUse', function () {
    before(function(done) {
      process.env.ENABLE_COOKIE = 'true';
      done();
    });
    after(function(done) {
      delete process.env.ENABLE_COOKIE;
      done();
    });
    it('should use if cookie provided', function (done) {
      var cookieValue = 'cookieValue';
      var testArgs = {
        headers: {
          cookie: cookie.serialize(process.env.COOKIE_NAME, cookieValue)
        }
      };
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.true();
      expect(tCookie.cookieValue).to.equal(cookieValue);
      done();
    });
    it('should be false if no req', function (done) {
      var testArgs = {};
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    it('should be false if cookie not provided', function (done) {
      var testArgs = {
        headers: {}
      };
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    it('should be false if blank cookie', function (done) {
      var testArgs = {
        headers: {
          cookie: ''
        }
      };
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    it('should be false if junk cookie', function (done) {
      var testArgs = {
        headers: {
          cookie: '1aj=!h@#$%^&*js()}{:<>?/.,_+=`~='
        }
      };
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    it('should be false if correct cookie not provided', function (done) {
      var testArgs = {
        headers: {
          cookie: cookie.serialize('random', 'cookieVal')
        }
      };
      var use = tCookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
  });
  describe('getHost', function () {
    it('should return host from cookie', function (done) {
      var testHost = 'somehost:80';
      tCookie.cookieValue = testHost;
      tCookie.getHost({}, function(err, host) {
        if (err) { return done(err); }
        expect(host).to.equal(testHost);
        done();
      });
    });
  });
  describe('saveHost', function () {
    before(function(done) {
      process.env.ENABLE_COOKIE = 'true';
      done();
    });
    after(function(done) {
      delete process.env.ENABLE_COOKIE;
      done();
    });
    it('should setCookie on res', function (done) {
      var testHost = 'somehost:80';
      tCookie.saveHost({
        setHeader: function(setCookie, cookieStr) {
          expect(setCookie).to.equal('Set-Cookie');
          var test = cookie.parse(cookieStr);
          expect(test[process.env.COOKIE_NAME]).to.equal(testHost);
          expect(test['Max-Age']).to.equal(process.env.COOKIE_MAX_AGE_SECONDS+'');
          expect(test.Domain).to.equal(process.env.COOKIE_DOMAIN);
        }
      }, testHost);

      done();
    });
  });
});
