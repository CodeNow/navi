'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var App = require('../../lib/app.js');

var ctx = {};
lab.experiment('app.js unit test', function () {
  lab.beforeEach(function(done) {
    ctx.app = new App();
    done();
  });
  lab.experiment('start', function () {
    lab.it('should start all services', function(done) {
      var datadog = require('../../lib/models/datadog.js');
      var error = require('../../lib/error.js');

      sinon.stub(datadog, 'monitorStart');
      sinon.stub(error, 'setup');
      sinon.stub(ctx.app.proxy, 'start').yields();

      ctx.app.start(function(err) {
        expect(err).to.not.exist();
        expect(datadog.monitorStart.calledOnce).to.be.true();
        expect(ctx.app.proxy.start.calledOnce).to.be.true();
        expect(error.setup.calledOnce).to.be.true();

        datadog.monitorStart.restore();
        ctx.app.proxy.start.restore();
        error.setup.restore();
        done();
      });
    });
  });
  lab.experiment('stop', function () {
    lab.it('should stop all services', function(done) {
      var datadog = require('../../lib/models/datadog.js');

      sinon.stub(datadog, 'monitorStop');
      sinon.stub(ctx.app.proxy, 'stop').yields();

      ctx.app.stop(function(err) {
        expect(err).to.not.exist();
        expect(datadog.monitorStop.calledOnce).to.be.true();
        expect(ctx.app.proxy.stop.calledOnce).to.be.true();

        datadog.monitorStop.restore();
        ctx.app.proxy.stop.restore();
        done();
      });
    });
  });
});
