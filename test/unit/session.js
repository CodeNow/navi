'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;

var expect = require('code').expect;

var Session = require('../../lib/models/session.js');

var ctx = {};
describe('session.js unit test', function () {
  beforeEach(function(done) {
    ctx.session = new Session();
    done();
  });
  describe('handle', function () {
    it('should return session mw', function(done) {
      var sessionMw = ctx.session.handle();
      expect(sessionMw).to.exist();
      done();
    });
  });
});