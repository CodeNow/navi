'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var error = require('../../lib/error.js');

lab.experiment('error.js unit test', function () {
  lab.experiment('errorResponder', function () {
    lab.it('send 500 error', function(done) {
      var testErr = 'test error';
      var res = {
        writeHead: function (code) {
          expect(code).to.equal(500);
        },
        end: function (message) {
          expect(message).to.exist();
          done();
        }
      };
      error.errorResponder(testErr, res);
    });
  });
  lab.experiment('setup', function () {
    lab.it('should init rollbar', function(done) {
      var rollbar = require('rollbar');
      sinon.stub(rollbar, 'init');

      error.setup();
      expect(rollbar.init.calledOnce).to.be.true();
      rollbar.init.restore();
      done();
    });
    lab.it('should not init rollbar if missing env', function(done) {
      var rollbar = require('rollbar');
      sinon.stub(rollbar, 'init');
      var oldEnv = process.env.ROLLBAR_KEY;
      delete process.env.ROLLBAR_KEY;

      error.setup();

      expect(rollbar.init.calledOnce).to.be.false();
      process.env.ROLLBAR_KEY = oldEnv;

      rollbar.init.restore();
      done();
    });
  });
  lab.experiment('log', function () {
    lab.it('should send log to debug and return error', function(done) {
      var testErr = 'some error';
      var test = error.log(testErr);
      expect(test).to.equal(testErr);
      done();
    });
    lab.it('should report error', function(done) {
      var rollbar = require('rollbar');
      sinon.stub(rollbar, 'handleErrorWithPayloadData');
      var testErr = 'some error';
      var oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'other test';

      var test = error.log(testErr);
      process.env.NODE_ENV = oldEnv;

      expect(rollbar.handleErrorWithPayloadData
        .withArgs(testErr, {
          custom: {}
        }).calledOnce).to.be.true();
      rollbar.handleErrorWithPayloadData.restore();
      expect(test).to.equal(testErr);
      done();
    });
    lab.it('should report custom error', function(done) {
      var rollbar = require('rollbar');
      sinon.stub(rollbar, 'handleErrorWithPayloadData');
      var customData = 'custom error';
      var testErr = {
        message: 'some err',
        data: customData
      };
      var oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'other test';

      var test = error.log(testErr);
      process.env.NODE_ENV = oldEnv;

      expect(rollbar.handleErrorWithPayloadData
        .withArgs(testErr, {
          custom: customData
        }).calledOnce).to.be.true();
      rollbar.handleErrorWithPayloadData.restore();
      expect(test).to.equal(testErr);
      done();
    });
  });
  lab.experiment('create', function () {
    lab.it('should return error with data', function(done) {
      var testErr = 'some err';
      var someData = 'some data';

      var test = error.create(testErr, someData);
      expect(test instanceof Error).to.be.true();
      expect(test.data).to.equal(someData);
      expect(test.message).to.equal(testErr);
      done();
    });
  });
});
