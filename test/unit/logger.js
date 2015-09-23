'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;

var logger = require('../../lib/logger');

describe('lib/logger.js unit test', function () {
  it('should cover serializers', function (done) {
    logger.fatal({
      tx: true,
      req: {}
    }, 'msg');
    done();
  });
});
