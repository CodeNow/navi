'use strict';

var sinon = require('sinon');

module.exports = createMockInstance;

/**
 * create a mock instance api-client-model
 * @param  {object} attrs        instance attributes
 * @param  {string} branch       instance cv.acv.branch
 * @param  {string} containerUrl mock container url for any exposedPort requested
 * @return {object}              mockInstance
 */
function createMockInstance (attrs, branch, containerUrl) {
  return {
    attrs: attrs,
    toJSON: function () {
      return this.attrs;
    },
    getContainerUrl: sinon.stub().yieldsAsync(null, containerUrl),
    getBranchName: sinon.stub().returns(branch),
    fetchDependencies: sinon.stub(),
    status: sinon.stub(),
    getContainerHostname: sinon.stub(),
    getRepoAndBranchName: sinon.stub()
  };
}