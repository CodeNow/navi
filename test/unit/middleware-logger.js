/**
 * @module test/unit/middleware-logger
 */
'use strict';

var Lab = require('lab');
var expect = require('code').expect;
var sinon = require('sinon');

var lab = exports.lab = Lab.script();

var before = lab.before;
var describe = lab.describe;
var it = lab.test;

describe('lib/middlewares/logger.js unit test', function () {
  var logger;

  before(function (done) {
    logger = require('../../lib/middlewares/logger');
    done();
  });

  it('should produce a child instance of logger and log non-JSONable prop', function (done) {
    var child = logger(__filename);
    sinon.stub(child.log, 'trace', function () {});
    var middleware = child(['instance'], 'message', 'trace');
    middleware({
      instance: {foo: 'bar'}
    }, {}, function () {
      expect(child.log.trace.callCount).to.equal(1);
      done();
    });
  });

  it('should produce a child instance of logger and log JSONable prop', function (done) {
    var child = logger(__filename);
    sinon.stub(child.log, 'trace', function () {});
    var middleware = child(['instance'], 'message', 'trace');
    middleware({
      instance: {
        toJSON: function () { return {foo:'bar'}; }
      }
    }, {}, function () {
      expect(child.log.trace.callCount).to.equal(1);
      done();
    });
  });

  it('should produce a child instance of logger w/o level arg', function (done) {
    var child = logger(__filename);
    sinon.stub(child.log, 'trace', function () {});
    var middleware = child(['instance'], 'message');
    middleware({}, {}, function () {
      expect(child.log.trace.callCount).to.equal(1);
      done();
    });
  });

  it('should produce a child instance of logger without keys', function (done) {
    var child = logger(__filename);
    sinon.stub(child.log, 'trace', function () {});
    var middleware = child('message');
    middleware({}, {}, function () {
      expect(child.log.trace.callCount).to.equal(1);
      done();
    });
  });
});
