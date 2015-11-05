/**
 * Same NaviEntry mongodb documents for testing
 * @module test/fixture/navi-entries
 */
'use strict';

module.exports = {
  toJSON: function () {},
  elasticUrl: 'api-staging-codenow.runnableapp.com',
  directUrls: {
    'e4rov2': {
      branch: 'master',
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      status: 'running',
      associations: {}
    },
    'f8k3v2': {
      branch: 'feature-branch1',
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      status: 'stopped',
      associations: {}
    },
    'e4v7ve': {
      branch: 'feature-branch2',
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      status: 'running',
      associations: {}
    },
    'fukw3w': {
      branch: 'feature-branch3',
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      status: 'stopped',
      associations: {}
    },
  },
  userMappings: {
    '847390': 'f8k3v2'
  },
  ownerGithubId: 958313
};
