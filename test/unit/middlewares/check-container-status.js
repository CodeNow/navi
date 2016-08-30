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


var Api = require('models/api.js');
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
      sinon.stub(Api, 'getTargetUrl').returns('getTargetUrl');
      sinon.stub(checkContainerStatus, '_getTargetShortHash').returns('_getTargetShortHash');
      sinon.stub(errorPage, 'generateErrorUrl').returns('generateErrorUrl');
      done();
    });
    afterEach(function (done) {
      Api.getTargetUrl.restore();
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
        sinon.assert.notCalled(Api.getTargetUrl);
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
        sinon.assert.calledOnce(Api.getTargetUrl);
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
        sinon.assert.calledOnce(Api.getTargetUrl);
        sinon.assert.calledWith(Api.getTargetUrl, req.parsedReqUrl, req.targetNaviEntryInstance);
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'dock_removed', {
          elasticUrl: 'getTargetUrl',
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
        sinon.assert.calledOnce(Api.getTargetUrl);
        sinon.assert.calledWith(Api.getTargetUrl, req.parsedReqUrl, req.targetNaviEntryInstance);
        sinon.assert.calledOnce(errorPage.generateErrorUrl);
        sinon.assert.calledWith(errorPage.generateErrorUrl, 'not_running', {
          elasticUrl: 'getTargetUrl',
          shortHash: '_getTargetShortHash'
        });
        sinon.assert.calledOnce(next);
        done();
      });
    })
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
