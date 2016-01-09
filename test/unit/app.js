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

var App = require('../../lib/app.js');

describe('app.js unit test', function () {
  var app;
  beforeEach(function(done) {
    app = new App();
    done();
  });
  describe('start', function () {
    it('should start all services', function(done) {

      sinon.stub(app.server, 'start').yields();

      app.start(function(err) {
        expect(err).to.not.exist();
        expect(app.server.start.calledOnce).to.be.true();
        app.server.start.restore();
        done();
      });
    });
  });

  describe('stop', function () {
    it('should stop all services', function(done) {

      sinon.stub(app.server, 'stop').yields();

      app.stop(function(err) {
        expect(err).to.not.exist();
        expect(app.server.stop.calledOnce).to.be.true();

        app.server.stop.restore();
        done();
      });
    });
  });
});
