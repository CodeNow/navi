'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var expect = require('code').expect;
var sinon = require('sinon');

var Api = require('../../lib/models/api.js');
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
      var error = require('../../lib/error.js');

      sinon.stub(app.server, 'start').yields();
      sinon.stub(Api, 'login').yields();
      sinon.stub(datadog, 'monitorStart');
      sinon.stub(error, 'setup');

      app.start(function(err) {
        expect(err).to.not.exist();
        expect(datadog.monitorStart.calledOnce).to.be.true();
        expect(app.server.start.calledOnce).to.be.true();
        expect(Api.login.calledOnce).to.be.true();
        expect(error.setup.calledOnce).to.be.true();

        datadog.monitorStart.restore();
        app.server.start.restore();
        Api.login.restore();
        error.setup.restore();
        done();
      });
    });
    it('should error is login failed', function(done) {
      var datadog = require('../../lib/models/datadog.js');
      var error = require('../../lib/error.js');
      var testErr = 'some type of err';
      sinon.stub(app.server, 'start').yields();
      sinon.stub(Api, 'login').yields(testErr);
      sinon.stub(datadog, 'monitorStart');
      sinon.stub(error, 'setup');

      app.start(function(err) {
        expect(err).to.equal(testErr);
        expect(app.server.start.calledOnce).to.be.false();
        expect(Api.login.calledOnce).to.be.true();

        datadog.monitorStart.restore();
        app.server.start.restore();
        Api.login.restore();
        error.setup.restore();
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
});
