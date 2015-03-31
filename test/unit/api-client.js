'use strict';
require('loadenv');

var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

var sinon = require('sinon');
var apiClient = require('models/api-client');

describe('api-client.js unit test', function () {
  describe('login', function () {
    it('should login to github', function(done) {
      sinon.stub(apiClient.user, 'githubLogin').yields();
      apiClient.login(function() {
        expect(apiClient.user.githubLogin
          .calledWith(process.env.HELLO_RUNNABLE_GITHUB_TOKEN))
          .to.be.true();
        apiClient.user.githubLogin.restore();
        done();
      });
    });
  });
  describe('getBackend', function () {
    it('should login to github', function(done) {
      sinon.stub(apiClient.user, 'fetchBackendForUrl').yields();
      var host = 'host';
      var name = 'name';
      var ref = 'ref';
      apiClient.getBackend(host, name, ref, function() {
        expect(apiClient.user.fetchBackendForUrl
          .calledWith(host, name, ref))
          .to.be.true();
        apiClient.user.fetchBackendForUrl.restore();
        done();
      });
    });
  });
});
