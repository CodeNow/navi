/**
 * @module test/unit/report-err
 */
'use strict';
require('loadenv')();

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var expect = require('code').expect;
var sinon = require('sinon');

var ErrorCat = require('error-cat');
var reportErr = require('middlewares/report-err.js');

describe('middlewares/report-err.js unit test', function () {
  beforeEach(function (done) {
    sinon.stub(ErrorCat, 'report', function () {});
    done();
  });
  afterEach(function (done) {
    ErrorCat.report.restore();
    done();
  });
  it('should export an error middleware function', function (done) {
    expect(reportErr.length).to.equal(4);
    done();
  });

  it('should default err.data to empty object', function (done) {
    var err = {};
    var req = {};
    reportErr(err, req, {}, function () {
      expect(ErrorCat.report.callCount).to.equal(1);
      expect(ErrorCat.report.args[0][0]).to.equal(err);
      expect(ErrorCat.report.args[0][1]).to.equal(req);
      expect(err.data).to.be.an.object();
      done();
    });
  });

  it('should not alter existing err.data value', function (done) {
    var err = {
      data: {
        test: 'foo'
      }
    };
    var req = {};
    reportErr(err, req, {}, function () {
      expect(ErrorCat.report.callCount).to.equal(1);
      expect(ErrorCat.report.args[0][0]).to.equal(err);
      expect(ErrorCat.report.args[0][1]).to.equal(req);
      expect(err.data).to.be.an.object();
      expect(err.data.test).to.equal('foo');
      done();
    });
  });
});
