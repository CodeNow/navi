/**
 * @module test/unit/workers/navi.cache.invalidated
 */
'use strict';

require('loadenv')();

var Lab = require('lab');
var expect = require('code').expect;
var ponos = require('ponos');
var sinon = require('sinon');
const joi = require('joi');

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

  it('should expose joi validator requiring elasticUrl', function (done) {
    joi.validate({}, workerRoutingCacheInvalidated.jobSchema, (err) => {
      expect(err).to.exist();
      expect(err).to.match(/elasticUrl/);
      done();
    });
  });

  it('should dispose cached navi-entry document', function (done) {
    workerRoutingCacheInvalidated.task({
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
