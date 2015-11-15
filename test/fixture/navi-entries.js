/**
 * Same NaviEntry mongodb documents for testing
 * @module test/fixture/navi-entries
 */
'use strict';

var refererNaviEntry = {
  toJSON: function () {},
  elasticUrl: 'frontend-staging-codenow.runnableapp.com',
  directUrls: {
    'aaaaa1': {
      branch: 'master',
      masterPod: true,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      running: true,
      associations: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'e4v7ve'
      }]
    },
    'bbbbb2': {
      branch: 'frontend-feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.1',
      ports: {
        '80': 39941,
        '8080': 23423
      },
      running: true,
      associations: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'f8k3v2'
      }]
    },
    'ccccc3': {
      branch: 'frontend-feature-branch2',
      masterPod: false,
      dockerHost: '0.0.0.2',
      ports: {
        '80': 39942,
        '8080': 23453
      },
      running: true,
      associations: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'f8k3v2'
      }]
    },
    'ddddd4': {
      branch: 'frontend-feature-branch3',
      masterPod: false,
      dockerHost: '0.0.0.3',
      ports: {
        '80': 39943,
        '8080': 23453
      },
      running: false,
      associations: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'f8k3v2'
      }]
    },
  },
  userMappings: {
    '847390': 'bbbbb2'
  },
  ownerGithubId: 958313
};

module.exports = {
  toJSON: function () {},
  elasticUrl: 'api-staging-codenow.runnableapp.com',
  directUrls: {
    'e4rov2': {
      branch: 'master',
      masterPod: true,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39940,
        '8080': 23453
      },
      running: true,
      associations: []
    },
    'f8k3v2': {
      branch: 'feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39941,
        '8080': 23423
      },
      running: true,
      associations: []
    },
    'e4v7ve': {
      branch: 'feature-branch2',
      masterPod: false,
      dockerHost: '0.0.0.2',
      ports: {
        '80': 39942,
        '8080': 23453
      },
      running: true,
      associations: []
    },
    'fukw3w': {
      branch: 'feature-branch3',
      masterPod: false,
      dockerHost: '0.0.0.3',
      ports: {
        '80': 39943,
        '8080': 23453
      },
      running: true,
      associations: []
    },
  },
  userMappings: {
    '847390': 'f8k3v2'
  },
  ownerGithubId: 958313,
  // This property only set by mongo model if req has a referer
  refererNaviEntry: refererNaviEntry
};
