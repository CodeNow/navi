'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var HostMapping = require('../../lib/models/host-mapping.js');

var ctx = {};
lab.experiment('host-mapping.js unit test', function () {
  lab.beforeEach(function(done) {
    ctx.hostMapping = new HostMapping();
    done();
  });
  lab.experiment('getNameFromHost', function () {
    lab.it('should callback err if lrange error', function(done) {
      var testErr = 'some err';
      var lrangeStub = sinon.stub(ctx.hostMapping.redis, 'lrange').yields(testErr);
      ctx.hostMapping.getNameFromHost('', function(err) {
        expect(err).to.equal(testErr);
        lrangeStub.restore();
        done();
      });
    });
    lab.it('should callback err if no key found', function(done) {
      var lrangeStub = sinon.stub(ctx.hostMapping.redis, 'lrange').yields(null, []);
      ctx.hostMapping.getNameFromHost('', function(err) {
        expect(err).to.exist();
        lrangeStub.restore();
        done();
      });
    });
    lab.it('should callback raw name returned from redis', function(done) {
      var testName = 'some-name';
      var lrangeStub = sinon.stub(ctx.hostMapping.redis, 'lrange').yields(null, [testName]);
      ctx.hostMapping.getNameFromHost('', function(err, name) {
        expect(err).to.not.exist();
        expect(name).to.equal(testName);
        lrangeStub.restore();
        done();
      });
    });
  });
});