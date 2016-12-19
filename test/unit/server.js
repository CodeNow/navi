'use strict';

const Code = require('code');
const Lab = require('lab');
const sinon = require('sinon');

const lab = exports.lab = Lab.script();

const afterEach = lab.afterEach;
const beforeEach = lab.beforeEach;
const describe = lab.describe;
const expect = Code.expect;
const it = lab.test;

const App = require('../../lib/server.js');
const rabbitMQ = require('models/rabbitmq');

describe('app.js unit test', function () {
  var app;

  beforeEach(function(done) {
    app = new App();
    sinon.stub(app.server, 'start').yields();
    sinon.stub(app.server, 'stop').yields();
    sinon.stub(rabbitMQ, 'connect').returns(Promise.resolve());
    sinon.stub(rabbitMQ, 'disconnect').returns(Promise.resolve());
    done();
  });

  afterEach(function (done) {
    app.server.start.restore();
    app.server.stop.restore();
    rabbitMQ.connect.restore();
    rabbitMQ.disconnect.restore();
    done()
  });

  describe('start', function () {
    it('should start all services', function(done) {
      app.start().asCallback(function(err) {
        console.log(err)
        expect(err).to.not.exist();
        sinon.assert.calledOnce(rabbitMQ.connect);
        sinon.assert.calledOnce(app.server.start);
        done();
      });
    });
  });

  describe('stop', function () {
    it('should stop all services', function(done) {
      app.stop().asCallback(function(err) {
        expect(err).to.not.exist();
        sinon.assert.calledOnce(rabbitMQ.disconnect);
        sinon.assert.calledOnce(app.server.stop);
        done();
      });
    });
  });
});
