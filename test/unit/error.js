'use strict';
require('../../lib/loadenv.js');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var expect = require('code').expect;
var sinon = require('sinon');
var Boom = require('boom');

var error = require('../../lib/error.js');

describe('error.js unit test', function () {
  describe('errorResponder', function () {
    it('send 500 error if not boom', function(done) {
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
    it('send boom error', function(done) {
      var testMessage = 'some error';
      var testErr = Boom.create(400, testMessage);
      var res = {
        writeHead: function (code) {
          expect(code).to.equal(400);
        },
        end: function (message) {
          message = JSON.parse(message);
          expect(message.message).to.equal(testMessage);
          done();
        }
      };
      error.errorResponder(testErr, res);
    });
  });
  describe('setup', function () {
    it('should init rollbar', function(done) {
      var rollbar = require('rollbar');
      sinon.stub(rollbar, 'init');

      error.setup();
      expect(rollbar.init.calledOnce).to.be.true();
      rollbar.init.restore();
      done();
    });
    it('should not init rollbar if missing env', function(done) {
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
  describe('log', function () {
    it('should send log to debug and return error', function(done) {
      var testErr = 'some error';
      var test = error.log(testErr);
      expect(test).to.equal(testErr);
      done();
    });
    it('should report error', function(done) {
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
    it('should report custom error', function(done) {
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
  describe('create', function () {
    it('should return error with data', function(done) {
      var testErr = 'some err';
      var someData = 'some data';
      var testCode = 423;
      var test = error.create(testCode, testErr, someData);
      expect(test.isBoom).to.be.true();
      expect(test.output.statusCode).to.equal(testCode);
      expect(test.output.payload.message).to.equal(testErr);
      expect(test.data).to.equal(someData);
      done();
    });
  });
});
