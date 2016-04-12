'use strict';

require('loadenv.js');

var Code = require('code');
var Lab = require('lab');
var sinon = require('sinon');

var resolveUrls = require('middlewares/resolve-urls');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = Code.expect;
var it = lab.test;

describe('lib/middlewares/resolve-urls', function () {
  describe('exported middleware', function () {
    beforeEach(function (done) {
      sinon.stub(resolveUrls, 'resolveUrl').returns('ResolvedUrl!');
      done();
    });
    afterEach(function (done) {
      resolveUrls.resolveUrl.restore();
      done();
    });
    it('should call resolve url for the referrer first', function (done) {
      var req = {
        headers: {
          referer: 'referer',
          host: 'host'
        },
        naviEntry: {
          id: 'naviEntry',
          referrerNaviEntry: {
            id: 'referrerNaviEntry'
          }
        }
      };
      var res = {};
      var next = sinon.stub();
      resolveUrls.middleware(req, res, next);
      sinon.assert.calledOnce(next);
      sinon.assert.calledTwice(resolveUrls.resolveUrl);
      done();
    });
  });
  describe('resolveUrl method', function () {
    var directUrl;
    var elasticUrl;
    var req;
    var url;
    var naviEntry;
    beforeEach(function (done) {
      sinon.stub(resolveUrls, 'splitDirectUrlIntoShortHashAndElastic').returns({
        shortHash: '1234'
      })
      directUrl = 'fb1-foo-bar.runnableapp.com';
      elasticUrl = 'foo-bar.runnableapp.com';
      req = {
        session: {
          directShortHash: {
          }
        }
      }
      naviEntry = {
        elasticUrl: elasticUrl,
        redirectEnabled: true,
        directUrls: {
          'fb1': {
          },
          'master1': {
            masterPod: true
          },
          'custom': {

          }
        }
      }
      done();
    });

    afterEach(function (done) {
      resolveUrls.splitDirectUrlIntoShortHashAndElastic.restore()
      done();
    });

    describe('with an elastic url with redirect enabled', function () {
      var results
      beforeEach(function (done) {
        url = elasticUrl
        req.session.directShortHash[url] = 'custom';
        done()
      });
      it('should resolve from the session store', function (done) {
        results = resolveUrls.resolveUrl(req, url, naviEntry);
        expect(results).to.equal('custom');
        done()
      });

      describe('when there is no session mapping', function () {
        beforeEach(function (done) {
          url = elasticUrl + '1234';
          req.session.directShortHash[url] = 'custom';
          done()
        });
        it('should resolve the master branch', function (done) {
          results = resolveUrls.resolveUrl(req, url, naviEntry);
          expect(results).to.equal('master1');
          done();
        });
      });
      describe('when there is no session directShortHash', function () {
        beforeEach(function (done) {
          delete req.session.directShortHash;
          done();
        });
        it('should resolve the master branch', function (done) {
          results = resolveUrls.resolveUrl(req, url, naviEntry);
          expect(results).to.equal('master1');
          done();
        });
      })
    });
    describe('with an elastic url with redirect disabled', function () {
      var results;
      beforeEach(function (done) {
        url = elasticUrl;
        naviEntry.redirectEnabled = false;
        done()
      });
      it('should resolve the masterpod', function (done) {
        results = resolveUrls.resolveUrl(req, url, naviEntry);
        expect(results).to.equal('master1');
        done()
      });
    });

    describe('with a direct url', function () {
      var results;
      beforeEach(function (done) {
        url = directUrl;
        naviEntry.redirectEnabled = false;
        done()
      });
      it('should resolve the direct url', function (done) {
        resolveUrls.splitDirectUrlIntoShortHashAndElastic.returns({
          shortHash: 'fb1'
        })
        results = resolveUrls.resolveUrl(req, url, naviEntry);
        expect(results).to.equal('fb1');
        done()
      });
    });

    describe('elastic url with a referrer that resolves and matches', function () {
      var results
      beforeEach(function (done) {
        url = elasticUrl;
        naviEntry.refererNaviEntry = {
          directUrls: {
            refferedNoDeps: {
              dependencies: []
            },
            'referrered': {
              dependencies: [{
                shortHash: 'matchingShortHash',
                elasticUrl: elasticUrl
              }]
            }
          }
        };
        req.resolvedReferrerId = 'referrered';
        done()
      });
      it('should resolve the referrers url', function (done) {
        results = resolveUrls.resolveUrl(req, url, naviEntry);
        expect(results).to.equal('matchingShortHash');
        done()
      });
      it('should return master if the referrer entry does not exist', function (done) {
        req.resolvedReferrerId = 'refferedNoDeps';
        results = resolveUrls.resolveUrl(req, url, naviEntry);
        expect(results).to.equal('master1');
        done()
      });
    });

    describe('with invalid parameters', function () {
      it('should return null if no req', function (done) {
        expect(resolveUrls.resolveUrl(null, url, naviEntry)).to.equal(null);
        done();
      });
      it('should return null if no url', function (done) {
        expect(resolveUrls.resolveUrl(req, null, naviEntry)).to.equal(null);
        done();
      });
      it('should return null if no naviEntry', function (done) {
        expect(resolveUrls.resolveUrl(req, url)).to.equal(null);
        done();
      });
    });
  });
});
