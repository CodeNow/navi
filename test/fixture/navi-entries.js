/**
 * Same NaviEntry mongodb documents for testing
 * @module test/fixture/navi-entries
 */
'use strict';

var whitelistedNaviEntry = {
  elasticUrl: 'whitelist-staging-codenow.runnableapp.com',
  directUrls: {},
  userMappings: {
    '847390': 'f8k3v2'
  },
  ipWhitelist: {
    enabled: true
  },
  ownerGithubId: 958313
};
var refererNaviEntry = {
  redirectEnabled: true,
  elasticUrl: 'frontend-staging-codenow.runnableapp.com',
  directUrls: {
    'aaaaa1': {
      branch: 'master',
      masterPod: true,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39944,
        '8080': 23453
      },
      running: true,
      dependencies: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'e4v7ve'
      }, {
        elasticUrl: 'no-redirect-api-staging-codenow.runnableapp.com',
        shortHash: 'r4v7ve'
      }]
    },
    'bbbbb2': {
      branch: 'frontend-feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.1',
      ports: {
        '80': 39945,
        '8080': 23423
      },
      running: true,
      dependencies: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'f8k3v2'
      }]
    },
    'ccccc3': {
      branch: 'frontend-feature-branch2',
      masterPod: false,
      dockerHost: '0.0.0.2',
      ports: {
        '80': 39946,
        '8080': 23453
      },
      running: true,
      dependencies: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: 'f8k3v2'
      }]
    },
    'ddddd4': {
      branch: 'frontend-feature-branch3',
      masterPod: false,
      dockerHost: '0.0.0.3',
      ports: {
        '80': 39947,
        '8080': 23453
      },
      running: false,
      dependencies: [{
        elasticUrl: 'no-redirect-api-staging-codenow.runnableapp.com',
        shortHash: 'rukw3w'
      }]
    },
    '214d23d': {
      branch: 'frontend-feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.2',
      ports: {
        '80': 39948,
        '8080': 23453
      },
      running: true,
      dependencies: [{
        elasticUrl: 'api-staging-codenow.runnableapp.com',
        shortHash: '214d23d'
      }],
      isolated: 'adasdasdasds'
    }
  },
  userMappings: {
    '847390': 'bbbbb2'
  },
  ownerGithubId: 958313
};

var api = {
  redirectEnabled: true,
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
      dependencies: []
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
      dependencies: []
    },
    'e4v7ve': {
      branch: 'feature-branch2',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39942,
        '8080': 23453
      },
      running: true,
      dependencies: []
    },
    'fukw3w': {
      branch: 'feature-branch3',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39943,
        '8080': 23453
      },
      running: true,
      dependencies: []
    },
    '214d23d': {
      branch: 'feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39941,
        '8080': 23423
      },
      running: true,
      isIsolationGroupMaster: true,
      isolated: 'adasdasdasds',
      dependencies: []
    }
  },
  userMappings: {
    '847390': 'f8k3v2'
  },
  ownerGithubId: 958313
};


var apiRedirectDisabled = {
  redirectEnabled: false,
  elasticUrl: 'no-redirect-api-staging-codenow.runnableapp.com',
  directUrls: {
    'r4rov2': {
      branch: 'no-redirect-master',
      masterPod: true,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39960,
        '8080': 23453
      },
      running: true,
      dependencies: []
    },
    'r8k3v2': {
      branch: 'no-redirect-feature-branch1',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39961,
        '8080': 23423
      },
      running: true,
      dependencies: []
    },
    'r4v7ve': {
      branch: 'no-redirect-feature-branch2',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39962,
        '8080': 23453
      },
      running: true,
      dependencies: []
    },
    'rukw3w': {
      branch: 'no-redirect-feature-branch3',
      masterPod: false,
      dockerHost: '0.0.0.0',
      ports: {
        '80': 39963,
        '8080': 23453
      },
      running: true,
      dependencies: []
    },
  },
  userMappings: {
    '847390': 'r8k3v2'
  },
  ownerGithubId: 958313
};


module.exports = {
  // This property only set by mongo model if req has a referer
  refererNaviEntry: refererNaviEntry,
  whitelistedNaviEntry: whitelistedNaviEntry,
  api: api,
  apiRedirectDisabled: apiRedirectDisabled
};
