'use strict';

var Code = require('code');
var Lab = require('lab');
var sinon = require('sinon');

var lab = exports.lab = Lab.script();

var after = lab.after;
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
      var datadog = require('../../lib/models/datadog.js');

      sinon.stub(app.server, 'start').yields();
      sinon.stub(datadog, 'monitorStart');

      app.start(function(err) {
        expect(err).to.not.exist();
        expect(datadog.monitorStart.calledOnce).to.be.true();
        expect(app.server.start.calledOnce).to.be.true();
        datadog.monitorStart.restore();
        app.server.start.restore();
        done();
      });
    });
  });

  describe('stop', function () {
    it('should stop all services', function(done) {
      var datadog = require('../../lib/models/datadog.js');

      sinon.stub(datadog, 'monitorStop');
      sinon.stub(app.server, 'stop').yields();

      app.stop(function(err) {
        expect(err).to.not.exist();
        expect(datadog.monitorStop.calledOnce).to.be.true();
        expect(app.server.stop.calledOnce).to.be.true();

        datadog.monitorStop.restore();
        app.server.stop.restore();
        done();
      });
    });
  });

  describe('newrelic', function () {
    before(function (done) {
      process.env.NEW_RELIC_LICENSE_KEY = true;
      sinon.stub(global, 'require')
      sinon.stub(app.server, 'start').yields();
      done();
    });

    after(function (done) {
      delete process.env.NEW_RELIC_LICENSE_KEY;
      global.require.restore();
      app.server.start.restore();
      done();
    });

    it('should require newrelic', function (done) {
      app.start(function () {
        sinon.assert.calledOnce(global.require);
        sinon.assert.calledWith(global.require, 'newrelic');
        done();
      });
    });
  });
});
