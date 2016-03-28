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

var ErrorCat = require('error-cat');
var redirectDisabled = require('middlewares/redirect-disabled');
var ProxyServer = require('models/proxy.js');

describe('lib/middlewares/redirect-disabled', function () {
  describe('exported middleware', function () {
    var req;
    var res;
    var next;
    beforeEach(function (done) {
      sinon.stub(redirectDisabled, '_makeDecision');
      req = {
        naviEntry: {
          redirectEnabled: false
        }
      };
      res = {};
      next = sinon.stub();
      done();
    });
    afterEach(function (done) {
      redirectDisabled._makeDecision.restore();
      done();
    });
    describe('when redirect is enabled', function () {
      beforeEach(function (done) {
        req.naviEntry.redirectEnabled = true;
        done();
      });
      it('should just call next', function (done) {
        redirectDisabled(req, res, next);
        sinon.assert.calledOnce(next);
        sinon.assert.notCalled(redirectDisabled._makeDecision);
        done();
      });
    });
    describe('when redirect is disabled', function () {
      beforeEach(function (done) {
        req.naviEntry.redirectEnabled = false;
        done();
      });
      it('should try to make a decision about the request', function (done) {
        redirectDisabled(req, res, next);
        sinon.assert.notCalled(next);
        sinon.assert.calledOnce(redirectDisabled._makeDecision);
        done();
      });
    })
  });

  describe('_makeDecision', function () {
    var req;
    var res;
    var next;
    beforeEach(function (done) {
      req = {
        headers: {},
        hipacheEntry: {}
      };
      res = {};
      next = sinon.stub();
      done();
    });
    beforeEach(function (done) {
      sinon.stub(redirectDisabled, '_getMasterBranchContainer').returns('_getMasterBranchContainer');
      sinon.stub(redirectDisabled, '_getConnectionContainer').returns('_getConnectionContainer');
      sinon.stub(redirectDisabled, '_getRequestedContainer').returns('_getRequestedContainer');
      sinon.stub(redirectDisabled, '_proxyRequest').returns('_proxyRequest');
      done();
    });
    afterEach(function (done) {
      redirectDisabled._getMasterBranchContainer.restore();
      redirectDisabled._getConnectionContainer.restore();
      redirectDisabled._getRequestedContainer.restore();
      redirectDisabled._proxyRequest.restore();
      done();
    });
    describe('with a direct url', function () {
      beforeEach(function (done) {
        req.hipacheEntry.elastic = false;
        done();
      });
      it('should try to proxy to the requested container', function (done) {
        redirectDisabled._makeDecision(req, res, next);
        sinon.assert.notCalled(redirectDisabled._getMasterBranchContainer);
        sinon.assert.notCalled(redirectDisabled._getConnectionContainer);
        sinon.assert.calledOnce(redirectDisabled._getRequestedContainer);
        sinon.assert.calledWith(redirectDisabled._getRequestedContainer, req);
        sinon.assert.calledOnce(redirectDisabled._proxyRequest);
        sinon.assert.calledWith(redirectDisabled._proxyRequest, '_getRequestedContainer', req, res, next);
        done();
      });
    });
    describe('with an elastic url', function () {
      beforeEach(function (done) {
        req.hipacheEntry.elastic = true;
        done();
      });
      describe('when a browser', function () {
        beforeEach(function (done) {
          req.isBrowser = true;
          done();
        });
        describe('with referrer', function () {
          beforeEach(function (done) {
            req.headers.referer = '1234';
            done();
          });
          it('should look up connections', function (done) {
            redirectDisabled._makeDecision(req, res, next);
            sinon.assert.notCalled(redirectDisabled._getMasterBranchContainer);
            sinon.assert.notCalled(redirectDisabled._getRequestedContainer);
            sinon.assert.calledOnce(redirectDisabled._getConnectionContainer);
            sinon.assert.calledWith(redirectDisabled._getConnectionContainer, req);
            sinon.assert.calledOnce(redirectDisabled._proxyRequest);
            sinon.assert.calledWith(redirectDisabled._proxyRequest, '_getConnectionContainer', req, res, next);
            done();
          });
        });
        describe('without referrer', function () {
          beforeEach(function (done) {
            delete req.headers.referer;
            done();
          });
          it('should look up and proxy master', function (done) {
            redirectDisabled._makeDecision(req, res, next);
            sinon.assert.notCalled(redirectDisabled._getConnectionContainer);
            sinon.assert.notCalled(redirectDisabled._getRequestedContainer);
            sinon.assert.calledOnce(redirectDisabled._getMasterBranchContainer);
            sinon.assert.calledWith(redirectDisabled._getMasterBranchContainer, req);
            sinon.assert.calledOnce(redirectDisabled._proxyRequest);
            sinon.assert.calledWith(redirectDisabled._proxyRequest, '_getMasterBranchContainer', req, res, next);
            done();
          });
        });
      });
      describe('when not browser', function () {
        beforeEach(function (done) {
          req.isBrowser = false;
          done();
        });
        describe('with referrer', function () {
          beforeEach(function (done) {
            req.headers.referer = '1234';
            done();
          });
          it('should look up connections', function (done) {
            redirectDisabled._makeDecision(req, res, next);
            sinon.assert.notCalled(redirectDisabled._getMasterBranchContainer);
            sinon.assert.notCalled(redirectDisabled._getRequestedContainer);
            sinon.assert.calledOnce(redirectDisabled._getConnectionContainer);
            sinon.assert.calledWith(redirectDisabled._getConnectionContainer, req);
            sinon.assert.calledOnce(redirectDisabled._proxyRequest);
            sinon.assert.calledWith(redirectDisabled._proxyRequest, '_getConnectionContainer', req, res, next);
            done();
          });
        });
        describe('without referrer', function () {
          beforeEach(function (done) {
            delete req.headers.referer;
            done();
          });
          it('should look up and proxy master', function (done) {
            redirectDisabled._makeDecision(req, res, next);
            sinon.assert.notCalled(redirectDisabled._getConnectionContainer);
            sinon.assert.notCalled(redirectDisabled._getRequestedContainer);
            sinon.assert.calledOnce(redirectDisabled._getMasterBranchContainer);
            sinon.assert.calledWith(redirectDisabled._getMasterBranchContainer, req);
            sinon.assert.calledOnce(redirectDisabled._proxyRequest);
            sinon.assert.calledWith(redirectDisabled._proxyRequest, '_getMasterBranchContainer', req, res, next);
            done();
          });
        });
      });
    });
  });

  describe('_getMasterBranchContainer', function () {
    var req;
    beforeEach(function (done) {
      req = {
        naviEntry: {
          directUrls: [
            {
              id: '1',
              masterPod: false
            },
            {
              id: '2',
              masterPod: true
            }
          ]
        }
      };
      done();
    });
    it('should return the masterpod branch', function (done) {
      expect(redirectDisabled._getMasterBranchContainer(req)).to.equal(req.naviEntry.directUrls[1]);
      done();
    });
  });
  describe('_getConnectionContainer', function () {
    var req;
    beforeEach(function (done) {
      req = {
        resolvedHostId: 'ghjkl',
        hipacheEntry: {
          elastic: 'customServerElastic.runnableapp.com'
        },
        naviEntry: {
          directUrls: {
            'referredShortHash': {
              id: 'referredShortHash',
              masterPod: false
            },
            'asdf': {
              id: '2',
              masterPod: true
            },
            'ghjkl': {
              id: '3',
              masterPod: false
            }
          },
          refererNaviEntry: {
            directUrls: {
              '1234': {
                dependencies: [
                  {
                    elasticUrl: 'customServerElastic.runnableapp.com',
                    shortHash: 'referredShortHash'
                  }
                ]
              },
              '4567': {
                dependencies: [
                  {
                    elasticUrl: 'nope.runnableapp.com',
                    shortHash: 'nope'
                  }
                ]
              }
            }
          }
        }
      };
      done();
    });
    describe('When the source has mappings for our connection', function () {
      beforeEach(function (done) {
        req.resolvedReferrerId = '1234';
        done();
      });
      it('should return the mapped url', function (done) {
        expect(redirectDisabled._getConnectionContainer(req)).to.equal(req.naviEntry.directUrls.referredShortHash);
        done();
      });
    });
    describe('when there is no dependency mapped', function () {
      beforeEach(function (done) {
        req.resolvedReferrerId = '4567';
        done();
      });
      it('should return the target container', function (done) {
        expect(redirectDisabled._getConnectionContainer(req)).to.equal(req.naviEntry.directUrls.ghjkl);
        done();
      });
    });
  });
  describe('_getRequestedContainer', function () {
    var req;
    beforeEach(function (done) {
      req = {
        resolvedHostId: 'foo',
        naviEntry: {
          directUrls: {
            deadbeef: {
              id: 1
            },
            foo: {
              id: 2
            }
          }
        }
      };
      done();
    });
    it('should return the requested container', function (done) {
      expect(redirectDisabled._getRequestedContainer(req)).to.equal(req.naviEntry.directUrls.foo);
      done();
    });
  });
  describe('_proxyRequest', function () {
    var container;
    var req;
    var res;
    var next;
    var errCatResponse;
    var proxy;
    beforeEach(function (done) {
      errCatResponse = { id: 'ErrorCat Response' };
      sinon.stub(ErrorCat, 'create').returns(errCatResponse);
      proxy = sinon.stub();
      sinon.stub(ProxyServer.prototype, 'proxyIfTargetHostExist').returns(proxy);
      done();
    })
    afterEach(function (done) {
      ErrorCat.create.restore();
      ProxyServer.prototype.proxyIfTargetHostExist.restore();
      done();
    });
    beforeEach(function (done) {

      container = {
        dockerHost: 'dockerHost',
        ports: {
          80: 2000,
          443: 3000
        }
      };
      req = {
        headers: {
          host: 'host'
        }
      };
      res = { id: 'res' };
      next = sinon.stub();
      done();
    });
    describe('without a container', function () {
      beforeEach(function (done) {
        container = null;
        done();
      });
      it('should throw 404 not found from error-cat', function (done) {
        redirectDisabled._proxyRequest(container, req, res, next);
        sinon.assert.notCalled(ProxyServer.prototype.proxyIfTargetHostExist);
        sinon.assert.calledOnce(next);
        sinon.assert.calledWith(next, errCatResponse);
        sinon.assert.calledOnce(ErrorCat.create);
        sinon.assert.calledWith(ErrorCat.create, 404, 'Not Found');
        done();
      });
    });
    describe('when no port is specified', function () {
      beforeEach(function (done) {
        req.headers.host = 'host';
        done();
      });
      it('should proxy the request to the right host', function (done) {
        redirectDisabled._proxyRequest(container, req, res, next);
        sinon.assert.notCalled(next);
        sinon.assert.notCalled(ErrorCat.create);
        sinon.assert.calledOnce(ProxyServer.prototype.proxyIfTargetHostExist);
        sinon.assert.calledOnce(proxy);
        expect(proxy.lastCall.args[0].targetHost).to.equal('http://dockerHost:2000');
        done();
      });
    });
    describe('when a port is specified of 443', function () {
      beforeEach(function (done) {
        req.headers.host = 'host:443';
        done();
      });
      it('should proxy the request to the right port on https', function (done) {
        redirectDisabled._proxyRequest(container, req, res, next);
        sinon.assert.notCalled(next);
        sinon.assert.notCalled(ErrorCat.create);
        sinon.assert.calledOnce(ProxyServer.prototype.proxyIfTargetHostExist);
        sinon.assert.calledOnce(proxy);
        expect(proxy.lastCall.args[0].targetHost).to.equal('https://dockerHost:3000');
        done();
      });
    });
  });
});
