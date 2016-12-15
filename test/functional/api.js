'use strict';
require('loadenv')();

const Lab = require('lab');

const lab = exports.lab = Lab.script();

const expect = require('code').expect;
const querystring = require('querystring');
const request = require('request');
const url = require('url');

const App = require('../../lib/server.js');
const TestServer = require('../fixture/test-server.js');
const mongo = require('models/mongo');
const fixtureMongo = require('../fixture/mongo');
const fixtureRedis = require('../fixture/redis');
const redis = require('models/redis');

const after = lab.after;
const afterEach = lab.afterEach;
const before = lab.before;
const beforeEach = lab.beforeEach;
const describe = lab.describe;
const it = lab.test;

const chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3)' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';

describe('functional test: proxy to instance container', function () {
  var app;
  var testErrorPort = 55551;
  var testErrorServer;
  var testErrorText = 'ididerror';
  var testHost = '0.0.0.0';
  var testPort = 39940;
  var testPort2 = 39941;
  var testPort3 = 39944;
  var testResponse = 'non-browser running container';
  var testResponseFeatureBranch = 'non-browser running container feature branch 1';
  var testResponseIsolatedBranch = 'non-browser running container isolated branch 1';
  var testServerMasterInstance;
  var testServerFeatureBranchInstance;
  var testServerIsolatedBranchInstance;

  before(function (done) {
    testServerMasterInstance = TestServer.create(testPort, testHost, testResponse, done);
  });
  before(function (done) {
    testServerFeatureBranchInstance =
      TestServer.create(testPort2, testHost, testResponseFeatureBranch, done);
  });
  before(function (done) {
    testServerIsolatedBranchInstance =
      TestServer.create(testPort3, testHost, testResponseIsolatedBranch, done);
  });
  before(function (done) {
    testErrorServer = TestServer.create(
      testErrorPort, testHost, testErrorText, done);
  });
  after(function (done) {
    testServerMasterInstance.close(done);
  });
  after(function (done) {
    testServerFeatureBranchInstance.close(done);
  });
  after(function (done) {
    testServerIsolatedBranchInstance.close(done);
  });
  after(function (done) {
    testErrorServer.close(done);
  });
  beforeEach(fixtureRedis.seed);
  afterEach(fixtureRedis.clean);
  beforeEach(fixtureMongo.seed);
  afterEach(fixtureMongo.clean);
  before(function (done) {
    app = new App();
    app.start().asCallback(done)
  });
  after(function (done) {
    app.stop().asCallback(done);
  });

  describe('non-browser', function () {
    it('should bypass auth and proxy directly to master instance', function (done) {
      var host = 'api-staging-codenow.runnableapp.com';
      request({
        followRedirect: false,
        headers: {
          host: host
        },
        url: 'http://localhost:'+process.env.HTTP_PORT
      }, function (err, res) {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.equal(testResponse+';'+host+'/');
        done();
      });
    });

    it('should return detention if container not running', function (done) {
      done();
    });
  });

  describe('browser', function () {
    describe('unathenticated', function () {
      var j;
      beforeEach(function (done) {
        j = request.jar();
        done();
      });
      it('should get blocked by a whitelisted instance', function (done) {
        var host = 'whitelist-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          headers: {
            host: host,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          expect(res.statusCode).to.equal(404);
          done();
        });
      });
      it('should bypass auth and proxy directly to master instance', function (done) {
        var host = 'api-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          headers: {
            host: host,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          expect(res.statusCode).to.equal(200);
          expect(res.body).to.equal(testResponse+';'+host+'/');
          done();
        });
      });
      it('should bypass auth and redirect to the elastic instance', function (done) {
        var host = 'f8k3v2-api-staging-codenow.runnableapp.com';
        var elasticUrl = 'api-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          jar: j,
          headers: {
            host: host,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(307);
          expect(res.headers.location).to.equal('http://' + elasticUrl + ':80');
          request({
            followRedirect: false,
            jar: j,
            headers: {
              'user-agent' : chromeUserAgent,
              host: elasticUrl
            },
            url: 'http://localhost:'+process.env.HTTP_PORT
          }, function (err, res) {
            if (err) { return done(err); }
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.equal(testResponseFeatureBranch+';'+elasticUrl+'/');
            done();
          });
        });
      });
      it('should block access when instance is whitelisted', function (done) {
        var host = 'whitelist-staging-codenow.runnableapp.com';
        var elasticUrl = 'whitelist-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          jar: j,
          headers: {
            host: host,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(404);
          done();
        });
      });
      it('should use the referer navi entry for navigation', function (done) {
        var host = 'f8k3v2-api-staging-codenow.runnableapp.com';
        var elasticUrl = 'api-staging-codenow.runnableapp.com';
        var frontHost = 'bbbbb2-frontend-staging-codenow.runnableapp.com';
        var frontElasticUrl = 'frontend-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          jar: j,
          headers: {
            host: frontHost,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) {
            return done(err);
          }
          expect(res.statusCode).to.equal(307);
          expect(res.headers.location).to.equal('http://' + frontElasticUrl + ':80');
          request({
            followRedirect: false,
            jar: j,
            headers: {
              host: host,
              'User-Agent': chromeUserAgent,
              referer: 'http://frontend-staging-codenow.runnableapp.com'
            },
            url: 'http://localhost:' + process.env.HTTP_PORT
          }, function (err, res) {
            if (err) {
              return done(err);
            }
            expect(res.statusCode).to.equal(307);
            expect(res.headers.location).to.equal('http://' + elasticUrl + ':80');
            request({
              followRedirect: false,
              jar: j,
              headers: {
                'user-agent': chromeUserAgent,
                host: elasticUrl,
                referer: 'http://frontend-staging-codenow.runnableapp.com'
              },
              url: 'http://localhost:' + process.env.HTTP_PORT
            }, function (err, res) {
              if (err) {
                return done(err);
              }
              expect(res.statusCode).to.equal(200);
              expect(res.body).to.equal(testResponseFeatureBranch + ';' + elasticUrl + '/');
              done();
            });
          });
        });
      });

      describe('isolated', function () {

        it('should use the referer navi entry for navigation', function (done) {
          var elasticUrl = 'api-staging-codenow.runnableapp.com';
          var frontHost = '214d23d--frontend-staging-codenow.runnableapp.com';
          var frontElasticUrl = 'frontend-staging-codenow.runnableapp.com';
          request({
            followRedirect: false,
            jar: j,
            headers: {
              host: frontHost,
              'User-Agent': chromeUserAgent
            },
            url: 'http://localhost:'+process.env.HTTP_PORT
          }, function (err, res) {
            if (err) {
              return done(err);
            }
            expect(res.statusCode).to.equal(307);
            expect(res.headers.location).to.equal('http://' + frontElasticUrl + ':80');
            request({
              followRedirect: false,
              jar: j,
              headers: {
                'user-agent': chromeUserAgent,
                host: elasticUrl,
                referer: 'http://frontend-staging-codenow.runnableapp.com'
              },
              url: 'http://localhost:' + process.env.HTTP_PORT
            }, function (err, res) {
              if (err) {
                return done(err);
              }
              expect(res.statusCode).to.equal(200);
              expect(res.body).to.equal(testResponseIsolatedBranch + ';' + elasticUrl + '/');
              done();
            });
          });
        });
      });
    });

    describe('referer', function () {
      var j = request.jar();
      var userId = 9999;
      // set up authenticated session
      before(function (done) {
        redis.set('apiSessionRedisKeyVal', JSON.stringify({
          passport: {
            user: 84234234
          }
        }), done);
      });
      before(function (done) {
        redis.rpush('validAccessToken', JSON.stringify({
          cookie: '', // TODO nix
          apiSessionRedisKey: 'apiSessionRedisKeyVal',
          userGithubOrgs: [userId, 1111, 958313],
          userId: userId
        }), done);
      });

      before(function (done) {
        request({
          followRedirect: false,
          jar: j,
          headers: {
            'user-agent' : chromeUserAgent
          },
          qs: {
            runnableappAccessToken: 'validAccessToken'
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function () {
          done();
        });
      });
      it('should use the referer navi entry for navigation', function (done) {
        var host = 'f8k3v2-api-staging-codenow.runnableapp.com';
        var elasticUrl = 'api-staging-codenow.runnableapp.com';
        var frontHost = 'bbbbb2-frontend-staging-codenow.runnableapp.com';
        var frontElasticUrl = 'frontend-staging-codenow.runnableapp.com';
        request({
          followRedirect: false,
          jar: j,
          headers: {
            host: frontHost,
            'User-Agent': chromeUserAgent
          },
          url: 'http://localhost:'+process.env.HTTP_PORT
        }, function (err, res) {
          if (err) {
            return done(err);
          }
          expect(res.statusCode).to.equal(307);
          expect(res.headers.location).to.equal('http://' + frontElasticUrl + ':80');
          request({
            followRedirect: false,
            jar: j,
            headers: {
              host: host,
              'User-Agent': chromeUserAgent,
              referer: 'http://frontend-staging-codenow.runnableapp.com'
            },
            url: 'http://localhost:' + process.env.HTTP_PORT
          }, function (err, res) {
            if (err) {
              return done(err);
            }
            expect(res.statusCode).to.equal(307);
            expect(res.headers.location).to.equal('http://' + elasticUrl + ':80');
            request({
              followRedirect: false,
              jar: j,
              headers: {
                'user-agent': chromeUserAgent,
                host: elasticUrl,
                referer: 'http://frontend-staging-codenow.runnableapp.com'
              },
              url: 'http://localhost:' + process.env.HTTP_PORT
            }, function (err, res) {
              if (err) {
                return done(err);
              }
              expect(res.statusCode).to.equal(200);
              expect(res.body).to.equal(testResponseFeatureBranch + ';' + elasticUrl + '/');
              done();
            });
          });
        });
      });
    });
  });
});
