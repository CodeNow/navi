'use strict';

var Code = require('code');
var Lab = require('lab');
var sinon = require('sinon');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = Code.expect;
var it = lab.test;

var App = require('../../lib/server.js');

describe('app.js unit test', function () {
  var app;
  beforeEach(function(done) {
    app = new App();
    sinon.stub(app.server, 'start').yields();
    sinon.stub(app.server, 'stop').yields();
    done();
  });
  afterEach(function (done) {
    app.server.start.restore();
    app.server.stop.restore();
    done()
  });

  describe('start', function () {
    it('should start all services', function(done) {
      app.start().asCallback(function(err) {
        expect(err).to.not.exist();
        expect(app.server.start.calledOnce).to.be.true();
        done();
      });
    });
  });

  describe('stop', function () {
    it('should stop all services', function(done) {
      app.stop().asCallback(function(err) {
        expect(err).to.not.exist();
        expect(app.server.stop.calledOnce).to.be.true();
        done();
      });
    });
  });
});
