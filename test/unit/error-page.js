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
    var testPorts = {
      '3000/tcp': [ { HostIp: '0.0.0.0', HostPort: '32856' } ],
      '80/tcp': [ { HostIp: '0.0.0.0', HostPort: '32858' } ]
    };
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
      ctx.mockInstance.getRepoAndBranchName.returns(testRepoAndBranchName);
      done();
    });
    function expectUrl (expected, resultUrl) {
      var testUrl = url.parse(resultUrl);
      var testQuery = querystring.parse(testUrl.query);
      expect(testQuery).to.deep.equal(expected);
      expect(testUrl.protocol + '//' + testUrl.host).to.equal(process.env.ERROR_URL);
    }
    describe('port', function() {
      it('should return port url', function(done) {
        ctx.mockInstance.elasticUrl = testHostname;
        var testUrl = errorPage.generateErrorUrl('ports', ctx.mockInstance);
        expectUrl({
          type: 'ports',
          ports: ['3000', '80'],
          containerUrl: testHostname,
          branchName: testRepoAndBranchName,
          status: testStatus,
          ownerName: testOwner,
          instanceName: testName
        }, testUrl);
        done();
      });
      it('should return port url with no ports', function(done) {
        ctx.mockInstance2 = createMockInstance({
          name: testName,
          owner: {
            username: testOwner
          },
          container: {
            ports: {}
          }
        }, testBranch, testContainerUrl);
        ctx.mockInstance2.status.returns(testStatus);
        ctx.mockInstance2.getRepoAndBranchName.returns(testRepoAndBranchName);
        ctx.mockInstance2.elasticUrl = testHostname;
        var testUrl = errorPage.generateErrorUrl('ports', ctx.mockInstance2);
        expectUrl({
          type: 'ports',
          containerUrl: testHostname,
          branchName: testRepoAndBranchName,
          status: testStatus,
          ownerName: testOwner,
          instanceName: testName
        }, testUrl);
        done();
      });
    });
    describe('unresponsive', function() {
      it('should return unresponsive url', function(done) {
        ctx.mockInstance.elasticUrl = testHostname;
        var testUrl = errorPage.generateErrorUrl('unresponsive', ctx.mockInstance);
        expectUrl({
          type: 'unresponsive',
          ports: ['3000', '80'],
          containerUrl: testHostname,
          branchName: testRepoAndBranchName,
          status: testStatus,
          ownerName: testOwner,
          instanceName: testName
        }, testUrl);
        done();
      });
    });
    describe('dead', function() {
      it('should return dead url', function(done) {
        ctx.mockInstance.elasticUrl = testHostname;
        var testUrl = errorPage.generateErrorUrl('dead', ctx.mockInstance);
        expectUrl({
          type: 'dead',
          ports: ['3000', '80'],
          containerUrl: testHostname,
          branchName: testRepoAndBranchName,
          status: testStatus,
          ownerName: testOwner,
          instanceName: testName
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
        expectUrl({
          type: 'signin',
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