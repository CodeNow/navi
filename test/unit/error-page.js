'use strict';

require('loadenv')();

var Code = require('code');
var Lab = require('lab');

var errorPage = require('models/error-page.js');

var lab = exports.lab = Lab.script();

var describe = lab.describe;
var expect = Code.expect;
var it = lab.it;

describe('error-page.js unit test', function () {
  describe('generateErrorUrl', function () {
    it('should generate error url for signin error', function (done) {
      var proxyUrl = errorPage.generateErrorUrl('signin', {
        redirectUrl: 'api-staging-codenow.runnableapp.com'
      });
      expect(proxyUrl).to
        .equal(
          'http://localhost:55551?type=signin&redirectUrl=api-staging-codenow.runnableapp.com');
      done();
    });

    it('should generate error url for not-running error', function (done) {
      var proxyUrl = errorPage.generateErrorUrl('not_running', {
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        targetBranch: 'master'
      });
      expect(proxyUrl).to
        .equal(
          'http://localhost:55551?'+
          'type=not_running&elasticUrl=api-staging-codenow.runnableapp.com'+
          '&targetBranch=master');
      done();
    });

    it('should generate error url for unresponsive error', function (done) {
      var proxyUrl = errorPage.generateErrorUrl('unresponsive', {
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        targetBranch: 'master'
      });
      expect(proxyUrl).to
        .equal(
          'http://localhost:55551?'+
          'type=unresponsive&elasticUrl=api-staging-codenow.runnableapp.com'+
          '&targetBranch=master');
      done();
    });

    it('should generate error url for ports error', function (done) {
      var proxyUrl = errorPage.generateErrorUrl('ports', {
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        targetBranch: 'master'
      });
      expect(proxyUrl).to
        .equal(
          'http://localhost:55551?'+
          'type=ports&elasticUrl=api-staging-codenow.runnableapp.com'+
          '&targetBranch=master');
      done();
    });

    it('should throw if invalid error', function (done) {
      function throws () {
        errorPage.generateErrorUrl('skjfasghasdg', {
          elasticUrl: 'api-staging-codenow.runnableapp.com',
          targetBranch: 'master'
        });
      }
      expect(throws).to.throw();
      done();
    });
  });
});
