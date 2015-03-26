'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var cookie = require('cookie');

var Cookie = require('../../lib/models/cookie.js');

var ctx = {};
lab.experiment('cookie.js unit test', function () {
  lab.beforeEach(function(done) {
    ctx.cookie = new Cookie();
    done();
  });
  lab.experiment('shouldUse', function () {
    lab.it('should use if cookie provided', function (done) {
      var cookieValue = 'cookieValue';
      var testArgs = {
        headers: {
          cookie: cookie.serialize(process.env.COOKIE_NAME, cookieValue)
        }
      };
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.true();
      expect(ctx.cookie.cookieValue).to.equal(cookieValue);
      done();
    });
    lab.it('should be false if no req', function (done) {
      var testArgs = {};
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    lab.it('should be false if cookie not provided', function (done) {
      var testArgs = {
        headers: {}
      };
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    lab.it('should be false if blank cookie', function (done) {
      var testArgs = {
        headers: {
          cookie: ''
        }
      };
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    lab.it('should be false if junk cookie', function (done) {
      var testArgs = {
        headers: {
          cookie: '1aj=!h@#$%^&*js()}{:<>?/.,_+=`~='
        }
      };
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
    lab.it('should be false if correct cookie not provided', function (done) {
      var testArgs = {
        headers: {
          cookie: cookie.serialize('random', 'cookieVal')
        }
      };
      var use = ctx.cookie.shouldUse(testArgs);
      expect(use).to.be.false();
      done();
    });
  });
  lab.experiment('getHost', function () {
    lab.it('should return host from cookie', function (done) {
      var testHost = 'somehost:80';
      ctx.cookie.cookieValue = testHost;
      ctx.cookie.getHost({}, function(err, host) {
        if (err) { return done(err); }
        expect(host).to.equal(testHost);
        done();
      });
    });
  });
  lab.experiment('saveHost', function () {
    lab.it('should setCookie on res', function (done) {
      var testHost = 'somehost:80';
      ctx.cookie.saveHost({
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
