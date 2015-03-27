'use strict';
var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach  = lab.afterEach;
var expect = Code.expect;
var loadenv = require('loadenv');

describe('loadenv', function () {
  var env = process.env;
  beforeEach(function (done) {
    process.env = {};
    process.env.NODE_ENV = 'bogus';
    done();
  });
  afterEach(function (done) {
    process.env = env; // restore
    done();
  });
  it('should error if missing required keys', function (done) {
    expect(loadenv).to.throw(Error, /required/);
    done();
  });
});