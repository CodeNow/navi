'use strict';
var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = Code.expect;

var describe = lab.describe;
var it = lab.it;
var removeUrlPath = require('remove-url-path');

describe('blah', function () {
  describe('url with host', function () {
    it('should remove url path', function (done) {
      expect(removeUrlPath('http://hello.com/hey')).to.equal('http://hello.com');
      done();
    });
  });
  describe('url without host (malformatted)', function () {
    it('should return the same url', function (done) {
      expect(removeUrlPath('hey')).to.equal('hey');
      done();
    });
  });
});