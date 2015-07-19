'use strict';

var Lab = require('lab');
var expect = require('code').expect;
var rewire = require('rewire');

var lab = exports.lab = Lab.script();

var after = lab.after;
var before = lab.before;
var describe = lab.describe;
var it = lab.test;

describe('lib/logger.js unit test', function () {
  var logger;
  before(function (done) {
    logger = rewire('../../lib/logger');
    done();
  });
  after(function (done) {
    // need 100% coverage...
    process.env.LOGGLY_TOKEN = 'test';
    logger.__get__('initializeStreams')();
    delete process.env.LOGGLY_TOKEN;
    logger.__get__('initializeStreams')();
    done();
  });

  it('should only log to stdout if no env LOGGLY_TOKEN', function (done) {
    var streams = logger.__get__('streams');
    expect(streams.length).to.equal(1);
    expect(streams[0].stream._isStdio).to.equal(true);
    done();
  });

  it('should cover serializers', function (done) {
    logger.error({
      tx: true,
      req: {}
    }, 'msg');
    done();
  });
});
