'use strict';

var Lab = require('lab');
var expect = require('code').expect;
var lab = exports.lab = Lab.script();
var after = lab.after;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

var logger = require('../../lib/logger');

describe('lib/logger.js unit test', function () {
  beforeEach(function (done) {
    delete process.env.LOGGLY_TOKEN;
    logger._streams.length = 0;
    done();
  });

  after(function (done) {
    logger._streams.length = 0;
    delete process.env.LOGGLY_TOKEN;
    done();
  });

  it('should log to loggly', function (done) {
    var testToken = 'testToken';
    process.env.LOGGLY_TOKEN = testToken;
    logger._initializeStreams();
    expect(logger._streams.length).to.equal(2);
    expect(logger._streams[0].stream.logglyConfig.token)
      .to.equal(testToken);

    done();
  });

  it('should logs to stdout if set', function (done) {
    logger._initializeStreams();
    expect(logger._streams.length).to.equal(1);
    expect(logger._streams[0].stream)
      .to.equal(process.stdout);

    done();
  });

  it('should cover serializers', function (done) {
    logger.fatal({
      tx: true,
      req: {}
    }, 'msg');
    done();
  });
});
