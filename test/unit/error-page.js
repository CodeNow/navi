'use strict';

require('loadenv')();

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var Code = require('code');
var expect = Code.expect;
var querystring = require('querystring');
var errorPage = require('models/error-page.js');
var createMockInstance = require('../fixture/create-mock-instance');
var url = require('url');

describe('error-page.js unit test', function () {
  var ctx = {};
  beforeEach(function(done) {
    ctx = {};
    done();
  });
  describe('generateErrorUrl', function() {
    var testName = 'mickey';
    var testOwner = 'disney';
    var testStatus = 'running';
    var testBranch = 'fig';
    var testContainerUrl = 'newton';
    var testPorts = 'some ports';
    var testHostname = 'that host';
    var testRepoAndBranchName = 'this-repo-that-branch';
    beforeEach(function(done) {
      ctx.mockInstance = createMockInstance({
        name: testName,
        owner: {
          username: testOwner
        },
        container: {
          ports: testPorts
        }
      }, testBranch, testContainerUrl);
      ctx.mockInstance.status.returns(testStatus);
      ctx.mockInstance.getContainerHostname.returns(testHostname);
      ctx.mockInstance.getRepoAndBranchName.returns(testRepoAndBranchName);
      done();
    });
    function expectUrl (type, expected, resultUrl) {
      var testUrl = url.parse(resultUrl);
      var testQuery = querystring.parse(testUrl.query);
      expect(testQuery).to.deep.equal(expected);
      expect(testUrl.protocol + '//' + testUrl.host).to.equal(process.env.ERROR_HOST);
      expect(testUrl.pathname).to.equal('/error/' + type);
    }
    describe('port', function() {
      it('should return port url', function(done) {
        var testUrl = errorPage.generateErrorUrl('port', ctx.mockInstance);
        expectUrl('port', {
          ports: testPorts,
          containerUrl: testHostname,
          branchName: testRepoAndBranchName
        }, testUrl);
        done();
      });
      it('should return unresponsive url', function(done) {
        var testUrl = errorPage.generateErrorUrl('unresponsive', ctx.mockInstance);
        expectUrl('unresponsive', {
          ports: testPorts,
          containerUrl: testHostname,
          branchName: testRepoAndBranchName
        }, testUrl);
        done();
      });
    });
    describe('dead', function() {
      it('should return dead url', function(done) {
        var testUrl = errorPage.generateErrorUrl('dead', ctx.mockInstance);
        expectUrl('dead', {
          instanceName: testName,
          ownerName: testOwner,
          status: testStatus,
          branchName: testRepoAndBranchName
        }, testUrl);
        done();
      });
    });
    describe('signin', function() {
      it('should return signin url', function(done) {
        var testRedirUrl = 'i-am-going-places';
        var testUrl = errorPage.generateErrorUrl('signin', {
          redirectUrl: testRedirUrl
        });
        expectUrl('signin', {
          redirectUrl: testRedirUrl
        }, testUrl);
        done();
      });
    });
    describe('invalid page', function() {
      it('should throw', function(done) {
        expect(function() {
          errorPage.generateErrorUrl('death');
        }).to.throw();
        done();
      });
    });
  });
});