'use strict';

require('loadenv.js');

var Code = require('code');
var Lab = require('lab');
var sinon = require('sinon');
var lab = exports.lab = Lab.script();
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = Code.expect;
var it = lab.test;


var checkContainerStatus = require('middlewares/check-container-status');
var errorPage = require('models/error-page.js');

describe('lib/middlewares/check-container-status', function () {
  describe('exported middleware', function () {
    var req;
    var res;
    var next;

    beforeEach(function (done) {
      req = {
        targetNaviEntryInstance: {
          dockRemoved: false,
          running: true
        }
      };
      res = {};
      next = sinon.stub();
      done();
    });

    beforeEach(function (done) {
      sinon.stub(checkContainerStatus, '_getUrlFromNaviEntryInstance').returns('_getUrlFromNaviEntryInstance');
      sinon.stub(checkContainerStatus, '_getTargetShortHash').returns('_getTargetShortHash');
      sinon.stub(errorPage, 'generateErrorUrl').returns('generateErrorUrl');
      done();
    });
    afterEach(function (done) {
      checkContainerStatus._getUrlFromNaviEntryInstance.restore();
      checkContainerStatus._getTargetShortHash.restore();
      errorPage.generateErrorUrl.restore();
      done();
    });


    describe('with no targetNaviEntryInstance', function () {
      beforeEach(function (done) {
        delete req.targetNaviEntryInstance;
        done();
      });
      it('should just next without doing anything', function (done) {
        checkContainerStatus.middleware(req, res, next);
        sinon.assert.calledOnce(next);
        sinon.assert.notCalled(checkContainerStatus._getUrlFromNaviEntryInstance);
        sinon.assert.notCalled(checkContainerStatus._getTargetShortHash);
        sinon.assert.notCalled(errorPage.generateErrorUrl);
        done();
      });
    });
    describe('When the container is running', function () {
      it('should next with the generated url', function (done) {
        checkContainerStatus.middleware(req, res, next);
        sinon.assert.notCalled(checkContainerStatus._getTargetShortHash);
        sinon.assert.notCalled(errorPage.generateErrorUrl);
        sinon.assert.calledOnce(checkContainerStatus._getUrlFromNaviEntryInstance);
        sinon.assert.calledOnce(next);
        done();
      });
    });
    describe('When the container is migrating', function () {
      beforeEach(function (done) {
        req.targetNaviEntryInstance.dockRemoved = true;
        done();
      });
      it('should next with the generated url', function (done) {
        checkContainerStatus.middleware(req, res, next);
        sinon.assert.calledOnce(checkContainerStatus._getTargetShortHash);
        sinon.assert.calledWith(checkContainerStatus._getTargetShortHash, req);
        sinon.assert.calledOnce(checkContainerStatus._getUrlFromNaviEntryInstance);
        sinon.assert.calledWith(checkContainerStatus._getUrlFromNaviEntryInstance, req);
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'dock_removed', {
          elasticUrl: '_getUrlFromNaviEntryInstance',
          shortHash: '_getTargetShortHash'
        });
        sinon.assert.calledOnce(next);
        done();
      });
    });
    describe('When the container is not running', function () {
      beforeEach(function (done) {
        req.targetNaviEntryInstance.running = false;
        done();
      });
      it('should next with the generated url', function (done) {
        checkContainerStatus.middleware(req, res, next);
        sinon.assert.calledOnce(checkContainerStatus._getTargetShortHash);
        sinon.assert.calledWith(checkContainerStatus._getTargetShortHash, req);
        sinon.assert.calledOnce(checkContainerStatus._getUrlFromNaviEntryInstance);
        sinon.assert.calledWith(checkContainerStatus._getUrlFromNaviEntryInstance, req);
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'not_running', {
          elasticUrl: '_getUrlFromNaviEntryInstance',
          shortHash: '_getTargetShortHash'
        });
        sinon.assert.calledOnce(next);
        done();
      });
    })
  });

  describe('_getUrlFromNaviEntryInstance', function () {
    var req;
    beforeEach(function (done) {
      req = {
        headers: {
          host: 'foo.com'
        },
        targetNaviEntryInstance: {
          dockerHost: 'dockerHost',
          ports: {
            '80': 3000,
            '443': 4000
          }
        }
      };
      done();
    });
    describe('when no port is specified', function () {
      it('should resolve a url with http and on the right port', function (done) {
        expect(checkContainerStatus._getUrlFromNaviEntryInstance(req)).to.equal('http://dockerHost:3000');
        done();
      });
    });
    describe('when port 443 is specified', function () {
      beforeEach(function (done) {
        req.headers.host = req.headers.host + ':443';
        done();
      });
      it('should resolve a url with https and on the right port', function (done) {
        expect(checkContainerStatus._getUrlFromNaviEntryInstance(req)).to.equal('https://dockerHost:4000');
        done();
      });
    });
  });

  describe('_getTargetShortHash', function () {
    var req
    beforeEach(function (done) {
      req = {
        targetNaviEntryInstance: {
          branch: 'branchName'
        },
        naviEntry: {
          directUrls: {
            'foo': {
              branch: 'foo'
            },
            'foo1': {
              branch: 'foo1'
            },
            'foo2': {
              branch: 'branchName'
            }
          }
        }
      }
      done();
    });
    it('should get the target short hash', function (done) {
      expect(checkContainerStatus._getTargetShortHash(req)).to.equal('foo2');
      done();
    });
  })
});
