'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');

var lab = exports.lab = Lab.script();

var expect = require('code').expect;
var querystring = require('querystring');
var request = require('request');
var url = require('url');

var App = require('../../lib/app.js');
var TestServer = require('../fixture/test-server.js');
var mongo = require('models/mongo');
var fixtureMongo = require('../fixture/mongo');
var fixtureRedis = require('../fixture/redis');
var redis = require('models/redis');

var after = lab.after;
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var it = lab.test;

describe('functional test: proxy to instance container', function () {
  var app;

  beforeEach(fixtureRedis.clean);
  beforeEach(fixtureRedis.seed);
  afterEach(fixtureRedis.clean);

  beforeEach(fixtureMongo.clean);
  beforeEach(fixtureMongo.seed);
  afterEach(fixtureMongo.clean);

  before(function (done) {
    app = new App();
    app.start(done);
  });
  after(function (done) {
    app.stop(done);
  });

  // branch: 'master',
  // e4rov2-api-staging-codenow.runnableapp.com
  var masterServer;
  var masterServerText = 'I am api master';
  before(function (done) {
    masterServer = TestServer.create(39940, '0.0.0.0', masterServerText, done);
  });
  after(function (done) {
    masterServer.close(done);
  });

  // branch: 'feature-branch1',
  // f8k3v2-api-staging-codenow.runnableapp.com
  var featureServer;
  var featureServerText = 'I am api feature branch 1';
  before(function (done) {
    featureServer = TestServer.create(39941, '0.0.0.0', featureServerText, done);
  });
  after(function (done) {
    featureServer.close(done);
  });

  // branch: 'feature-branch2',
  // e4v7ve-api-staging-codenow.runnableapp.com
  var featureServer2;
  var featureServer2Text = 'I am api feature branch 2';
  before(function (done) {
    featureServer2 = TestServer.create(39942, '0.0.0.0', featureServer2Text, done);
  });
  after(function (done) {
    featureServer2.close(done);
  });


  var directUrl = 'f8k3v2-api-staging-codenow.runnableapp.com';
  var elasticUrl = 'api-staging-codenow.runnableapp.com';

  var elasticSourceWithDependencyMapping = 'http://frontend-staging-codenow.runnableapp.com';
  var elasticSouceWithoutDependencies = 'whitelist-staging-codenow.runnableapp.com';

  function makeRequest (url, isBrowser, referrer, cb) {
    var requestParams = {
      followRedirect: false,
      headers: {
        host: url
      },
      url: 'http://localhost:' + process.env.HTTP_PORT
    };
    if (isBrowser) {
      requestParams.headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';
    }
    if (referrer) {
      // Did you know that referer is a standard way to do this that
      // is an actual misspelling of Referrer?!
      // The more you know.... The more sad you feel.
      requestParams.headers.referer = referrer
      requestParams.headers.origin = referrer
    }
    request(requestParams, function (err, res) {
      console.log('res.statusCode', res.statusCode);
      console.log('res.body', res.body);
      cb(err, res);
    });
  }

  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:True, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    });
    it('should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServer2Text);
      done();
    })
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:True, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done()
      })
    })
    it('should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServerText);
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:True, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, false, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done()
      })
    })
    it('should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServer2Text);
      done();
    })
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:True, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServerText);
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServer2Text);
      done();
    })
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to the requested container');
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Look up Connections and proxy to the Connections container');
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to the requested container');
  })
  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:True, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Look up user mappings and proxy to the mapped container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(masterServerText);
      done();
    })
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:True, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Set user mapping and redirect to E URL', function (done) {
      expect(response.statusCode).to.equal(307);
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:True, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, false, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to master branch container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(masterServerText);
      done();
    })
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:True, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, false, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain(featureServerText);
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to master branch container');
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to requested container')
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(elasticUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to master branch container')
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to requested container')
  })
});
