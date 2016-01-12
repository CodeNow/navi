/**
 * @module test/unit/cache
 */
'use strict';

require('loadenv.js');

var Lab = require('lab');
var sinon = require('sinon');

var cache = require('cache');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

describe('lib/cache', function () {
  beforeEach(function (done) {
    sinon.stub(cache._log, 'trace');
    done();
  });

  afterEach(function (done) {
    cache._log.trace.restore();
    done();
  });

  it('should dispose of a cached entry', function (done) {
    cache.set('key', {
      elasticUrl: 'elasticUrl123'
    });
    cache.del('key');
    sinon.assert.calledOnce(cache._log.trace);
    sinon.assert.calledWith(cache._log.trace,
                            sinon.match.has('elasticUrl', 'elasticUrl123'), 'LRU dispose');
    done();
  });
});
