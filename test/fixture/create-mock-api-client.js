'use strict';

var sinon = require('sinon');

module.exports = createMockApiClient;

/**
 * create a mock instance api-client-model
 * @return {object}              mockApiClient
 */
function createMockApiClient () {
  var mockApiClient = {};
  mockApiClient.fetchInstances = sinon.stub();
  mockApiClient.fetchInstance = sinon.stub();
  mockApiClient.newInstance = sinon.stub();
  mockApiClient.createRoute = sinon.stub();
  mockApiClient.fetchRoutes = sinon.stub();

  return mockApiClient;
}