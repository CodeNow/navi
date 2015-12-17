/**
 * @module test/unit/workers/navi.cache.invalidated
 */
'use strict';

require('loadenv.js');

var Lab = require('lab');
var expect = require('code').expect;
var keypather = require('keypather')();
var mongodb = require('mongodb');
var ponos = require('ponos');
var put = require('101/put');
var sinon = require('sinon');

var cache = require('cache');
var workerRoutingCacheInvalidated = require('workers/routing.cache.invalidated');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

var TaskFatalError = ponos.TaskFatalError;

describe('lib/workers/navi.cache.invalidated', function () {
  beforeEach(function (done) {
    sinon.stub(cache, 'del');
    done();
  });

  afterEach(function (done) {
    cache.del.restore();
    done();
  });

  it('should throw if missing required data', function (done) {
    workerRoutingCacheInvalidated({})
      .then(function () {
        throw new Error('should have thrown');
      })
      .catch(function (err) {
        sinon.assert.notCalled(cache.del);
        expect(err).to.be.instanceOf(TaskFatalError);
        done();
      });
  });

  it('should dispose cached navi-entry document', function (done) {
    workerRoutingCacheInvalidated({
      elasticUrl: 'elastic-url-staging.runnableapp.com'
    })
      .then(function () {
        sinon.assert.calledOnce(cache.del);
        sinon.assert.calledWith(cache.del, 'elastic-url-staging.runnableapp.com');
        done();
      })
      .catch(done);
  });
});
