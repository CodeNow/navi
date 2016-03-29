'use strict';
require('../../lib/loadenv.js')();

var Lab = require('lab');

var lab = exports.lab = Lab.script();

var expect = require('code').expect;
var querystring = require('querystring');
var request = require('request');
var url = require('url');
var callbackCount = require('callback-count');

var App = require('../../lib/app.js');
var TestServer = require('../fixture/test-server.js');
var naviEntries = require('../fixture/navi-entries');
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

  var serversByID
  before(function (done) {
    var count = callbackCount(done);
    serversByID = {};
    Object.keys(naviEntries.api.directUrls).forEach(function (id) {
      var entry = naviEntries.api.directUrls[id];
      serversByID[id] = TestServer.create(entry.ports['80'], '0.0.0.0', 'I am server ' + id, count.inc().next);
    });
    Object.keys(naviEntries.apiRedirectDisabled.directUrls).forEach(function (id) {
      var entry = naviEntries.apiRedirectDisabled.directUrls[id];
      serversByID[id] = TestServer.create(entry.ports['80'], '0.0.0.0', 'I am server ' + id,  count.inc().next);
    });
  });
  after(function (done) {
    var count = callbackCount(done);
    Object.keys(serversByID).forEach(function (id) {
      serversByID[id].close(count.inc().next);
    })
  });

  var directUrl = 'f8k3v2-' + naviEntries.api.elasticUrl;
  var elasticUrl = naviEntries.api.elasticUrl;
  var noRedirectElasticUrl = naviEntries.apiRedirectDisabled.elasticUrl;
  var noRedirectDirectUrl = 'rukw3w-' + naviEntries.apiRedirectDisabled.elasticUrl;

  var elasticSourceWithDependencyMapping = 'http://frontend-staging-codenow.runnableapp.com';

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
      expect(response.body).to.contain('e4v7ve');
      done();
    })
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:True, Referrer:True (ajax call)', function () {
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
    it.skip('TODO: should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('f8k3v2');
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
    it.skip('TODO: should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('f8k3v2');
      done();
    })
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:True, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(directUrl, false, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('TODO: should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('f8k3v2');
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectElasticUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('r4v7ve');
      done();
    })
  })

  describe('Url:Direct, IsBrowser:True, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectDirectUrl, true, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('TODO: should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('rukw3w');
      done();
    });
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectElasticUrl, false, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Look up Connections and proxy to the Connections container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('r4v7ve');
      done();
    });
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:False, Referrer:True', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectDirectUrl, false, elasticSourceWithDependencyMapping, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to the requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('rukw3w');
      done();
    });
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
      expect(response.body).to.contain('e4rov2');
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
      expect(response.body).to.contain('e4rov2');
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
      expect(response.body).to.contain('f8k3v2');
      done();
    })
  })
  describe('Url:Elastic, IsBrowser:True, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectElasticUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to master branch container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('r4rov2');
      done();
    });
  })
  describe('Url:Direct, IsBrowser:True, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectDirectUrl, true, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('rukw3w');
      done();
    });
  })
  describe('Url:Elastic, IsBrowser:False, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectElasticUrl, false, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to master branch container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('r4rov2');
      done();
    });
  })
  describe('Url:Direct, IsBrowser:False, RedirectEnabled:False, Referrer:False', function () {
    var response;
    beforeEach(function (done) {
      makeRequest(noRedirectDirectUrl, false, null, function (err, res) {
        if (err) {
          return done(err)
        }
        response = res;
        done();
      })
    })
    it('should Proxy to requested container', function (done) {
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.contain('rukw3w');
      done();
    });
  })
});
