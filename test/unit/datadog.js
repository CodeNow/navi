'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var it = lab.it;
var describe = lab.experiment;
var child = require('child_process');
var datadog = require('../../lib/models/datadog.js');

describe('datadog.js unit test', function() {
  describe('monitor start', function() {
    it('should call capture socket after some time', function(done) {
      sinon.stub(datadog, '_captureSocketCount', function() {
        datadog.monitorStop();
        datadog._captureSocketCount.restore();
        done();
      });
      datadog.monitorStart();
    });
    it('should return if already interval', function(done) {
      sinon.stub(datadog, '_captureSocketCount').throws();
      datadog.interval = 'something';
      datadog.monitorStart();
      datadog._captureSocketCount.restore();
      done();
    });
  });
  describe('monitor stop', function() {
    it('should stop interval', function(done) {
      datadog.interval = setInterval(
        done.bind(done, new Error('should not be called'),
        60000));
      datadog.monitorStop();
      expect(datadog.interval).to.not.exist();
      done();
    });
    it('should return no interval', function(done) {
      datadog.monitorStop();
      done();
    });
  });
  describe('_captureSocketCount', function() {
    it('should capture just open files', function(done) {
      sinon.stub(child, 'exec', function() {
        child.exec.restore();
        done();
      });
      datadog._captureSocketCount();
    });
    it('should just return if exec error', function(done) {
      sinon.stub(child, 'exec').yields('some error');
      datadog._captureSocketCount();
      child.exec.restore();
      done();
    });
    it('should gauge socket count', function(done) {
      var testCount = 10;
      sinon.stub(child, 'exec').yields(null, testCount+'');
      sinon.stub(datadog.client, 'gauge', function(str, count) {
        expect(count).to.equal(10);
        datadog.client.gauge.restore();
        datadog._captureSocketCount();
        child.exec.restore();
        done();
      });
      datadog._captureSocketCount();
    });
    it('should capture sockets and request', function(done) {
      require('http').globalAgent.sockets.test = 'one';
      require('http').globalAgent.requests.test = 'two';
      sinon.stub(datadog.client, 'gauge').returns();

      sinon.stub(child, 'exec', function() {
        expect(datadog.client.gauge.calledTwice).to.be.true();
        datadog.client.gauge.restore();
        child.exec.restore();
        delete require('http').globalAgent.sockets.test;
        delete require('http').globalAgent.requests.test;
        done();
      });
      datadog._captureSocketCount();
    });
  });
});
