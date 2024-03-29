/**
 * @module test/unit/logger
 */
'use strict';

var Lab = require('lab');
var Code = require('code');
var domain  = require('domain');

var lab = exports.lab = Lab.script();

var describe = lab.describe;
var expect = Code.expect;
var it = lab.test;

var logger = require('../../lib/logger');

describe('lib/logger.js unit test', function () {
  describe('serializers', function () {
    describe('tx', function () {
      it('should use data from domain', function (done) {
        var d = domain.create();
        d.runnableData = {
          foo: 'bar'
        };
        d.run(function () {
          var serialized = logger._serializers.tx();
          expect(serialized.txTimestamp).to.be.an.instanceOf(Date);
          expect(serialized.foo).to.equal('bar');
          done();
        });
      });

      it('should use existing domain.reqStart', function (done) {
        var d = domain.create();
        d.runnableData = {
          reqStart: new Date()
        };
        d.run(function () {
          var serialized = logger._serializers.tx();
          expect(serialized.txTimestamp).to.be.an.instanceOf(Date);
          expect(serialized.txMSFromReqStart).to.be.a.number();
          done();
        });
      });

      // log delta -- milliseconds since previous log message
      it('should use previous txTimestamp to derrive log time delta', function (done) {
        var d = domain.create();
        d.runnableData = {
          reqStart: new Date(),
          txTimestamp: new Date(new Date()-1000000)
        };
        d.run(function () {
          var serialized = logger._serializers.tx();
          expect(serialized.txTimestamp).to.be.an.instanceOf(Date);
          expect(serialized.txMSFromReqStart).to.be.a.number();
          expect(serialized.txMSDelta >= 1000000).to.equal(true);
          done();
        });
      });

      it('should work when domain.runnableData not defined', function (done) {
        var serialized = logger._serializers.tx();
        expect(serialized.txTimestamp).to.be.an.instanceOf(Date);
        done();
      });
    });

    describe('req', function () {
      it('should parse keys from req object', function (done) {
        var serialized = logger._serializers.req({
          method: 'GET',
          url: 'some-url',
          headers: {
            host: 'host'
          }
        });
        expect(serialized.host).to.equal('host');
        expect(serialized.method).to.equal('GET');
        expect(serialized.url).to.equal('some-url');
        done();
      });
    });
  });
});
