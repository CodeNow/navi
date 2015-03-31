'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var beforeEach = lab.beforeEach;
var expect = require('code').expect;
var sinon = require('sinon');

var HostMapping = require('../../lib/models/host-mapping.js');

var ctx = {};
describe('host-mapping.js unit test', function () {
  beforeEach(function(done) {
    ctx.hostMapping = new HostMapping();
    done();
  });
  describe('getNameFromHost', function () {
    it('should callback err if lrange error', function(done) {
      var testErr = 'some err';
      sinon.stub(ctx.hostMapping.redis, 'lrange').yields(testErr);
      ctx.hostMapping.getNameFromHost('', function(err) {
        expect(err).to.equal(testErr);
        ctx.hostMapping.redis.lrange.restore();
        done();
      });
    });
    it('should callback err if no key found', function(done) {
      sinon.stub(ctx.hostMapping.redis, 'lrange').yields(null, []);
      ctx.hostMapping.getNameFromHost('', function(err) {
        expect(err).to.exist();
        ctx.hostMapping.redis.lrange.restore();
        done();
      });
    });
    it('should callback raw name returned from redis', function(done) {
      var testName = 'some-name';
      sinon.stub(ctx.hostMapping.redis, 'lrange').yields(null, [testName]);
      ctx.hostMapping.getNameFromHost('', function(err, name) {
        expect(err).to.not.exist();
        expect(name).to.equal(testName);
        ctx.hostMapping.redis.lrange.restore();
        done();
      });
    });
  });
});
