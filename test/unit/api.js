// 'use strict';
// require('loadenv.js');

// var Lab = require('lab');
// var lab = exports.lab = Lab.script();
// var describe = lab.describe;
// var it = lab.test;
// var beforeEach = lab.beforeEach;
// var afterEach = lab.afterEach;
// var expect = require('code').expect;

// var sinon = require('sinon');
// var Runnable = require('runnable');

// var api = require('../../lib/models/api.js');

// describe('api.js unit test', function () {
//   describe('_getUrlFromRequest', function() {
//     var base = 'repo-staging-codenow.runnableapp.com';
//     var result = 'http://repo-staging-codenow.runnableapp.com:80';
//     it('should add 80', function(done) {
//       var test = api._getUrlFromRequest({
//         headers: {
//           host: base
//         }
//       });
//       expect(test).to.equal(result);
//       done();
//     });
//     it('should add https', function(done) {
//       var test = api._getUrlFromRequest({
//         headers: {
//           host: base+':443'
//         }
//       });
//       expect(test).to.equal('https://'+ base +':443');
//       done();
//     });
//     it('should add 80 to subdomain', function(done) {
//       var test = api._getUrlFromRequest({
//         headers: {
//           host: 'dat.sub.domain.' + base
//         }
//       });
//       expect(test).to.equal(result);
//       done();
//     });
//     it('should add https to subdomain', function(done) {
//       var test = api._getUrlFromRequest({
//         headers: {
//           host: 'dat.sub.domain.' + base + ':443'
//         }
//       });
//       expect(test).to.equal('https://'+ base +':443');
//       done();
//     });
//     it('should be valid for correct hostname', function(done) {
//       var test = api._getUrlFromRequest({
//         headers: {
//           host: base + ':100'
//         }
//       });
//       expect(test).to.equal('http://'+ base +':100');
//       done();
//     });
//   });
//   describe('createClient', function () {
//     it('should not add cookie if it does not exist', function (done) {
//       var testReq = {
//         session: {},
//         method: 'post'
//       };
//       api.createClient(testReq, {}, function () {
//         expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
//           .to.equal('navi');
//         expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
//           .to.not.exist();
//         done();
//       });
//     });
//     it('should login with super user if options request', function (done) {
//       var testReq = {
//         session: {},
//         method: 'OPTIONS'
//       };
//       sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync();
//       api.createClient(testReq, {}, function () {
//         expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
//           .to.equal('navi');
//         expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
//           .to.not.exist();
//         expect(testReq.apiClient.githubLogin
//           .calledWith(process.env.HELLO_RUNNABLE_GITHUB_TOKEN))
//           .to.be.true();
//         Runnable.prototype.githubLogin.restore();
//         done();
//       });
//     });
//     it('should add runnable client with cookie', function (done) {
//       var testCookie = 'sid:longcookie;';
//       var testReq = {
//         session: {
//           apiCookie: testCookie
//         },
//         method: 'post'
//       };
//       api.createClient(testReq, {}, function () {
//         expect(testReq.apiClient.opts.requestDefaults.headers['user-agent'])
//           .to.equal('navi');
//         expect(testReq.apiClient.opts.requestDefaults.headers.Cookie)
//           .to.equal(testCookie);
//         done();
//       });
//     });
//   });
//   describe('with logged in user', function() {
//     var hostName = 'localhost';
//     var port = ':1234';
//     var host = hostName + port;
//     var testReq = {
//       headers: {
//         host: host
//       },
//       method: 'post'
//     };
//     beforeEach(function (done) {
//       testReq.session = {
//         apiCookie: 'cookie'
//       };
//       api.createClient(testReq, {}, done);
//     });
//     describe('redirectIfNotLoggedIn', function () {
//       beforeEach(function (done) {
//         sinon.stub(testReq.apiClient, 'fetch');
//         done();
//       });
//       afterEach(function (done) {
//         testReq.apiClient.fetch.restore();
//         done();
//       });
//       it('should next if 500 error', function (done) {
//         var testErr = {
//           output: {
//             statusCode: 500
//           },
//           data: 'dude this just happed'
//         };
//         testReq.apiClient.fetch.yields(testErr);
//         api.redirectIfNotLoggedIn(testReq, {}, function (err) {
//           expect(err).to.equal(testErr);
//           done();
//         });
//       });
//       it('should redir if no logged in', function (done) {
//         var testErr = {
//           output: {
//             statusCode: 401
//           },
//           data: {
//             error: 'Unauthorized'
//           }
//         };
//         var testRes = 'that res';
//         testReq.apiClient.fetch.yields(testErr);
//         sinon.stub(testReq.apiClient, 'redirectForAuth').returns();
//         api.redirectIfNotLoggedIn(testReq, testRes, function () {
//           done(new Error('should not get called'));
//         });
//         expect(testReq.apiClient.redirectForAuth
//           .calledWith('http://'+host, testRes)).to.be.true();
//         testReq.apiClient.redirectForAuth.restore();
//         done();
//       });
//       it('should next if logged in', function (done) {
//         testReq.apiClient.fetch.yields();
//         api.redirectIfNotLoggedIn(testReq, {}, done);
//       });
//     });
//     describe('getTargetHost', function () {
//       beforeEach(function (done) {
//         sinon.stub(testReq.apiClient, 'getBackendFromUserMapping');
//         done();
//       });
//       afterEach(function (done) {
//         testReq.apiClient.getBackendFromUserMapping.restore();
//         done();
//       });
//       describe('getBackendFromUserMapping returns host', function () {
//         var testHost = 'can.com';
//         it('should get backend', function (done) {
//           testReq.apiClient.getBackendFromUserMapping.yields(null, testHost);
//           api.getTargetHost(testReq, {}, function (err) {
//             if (err) { return done(err); }
//             expect(testReq.apiClient.getBackendFromUserMapping
//               .calledWith('http://'+host)).to.be.true();
//             expect(testReq.targetHost).to.equal(testHost);
//             done();
//           });
//         });
//       });
//       describe('getBackendFromUserMapping returns error', function() {
//         beforeEach(function(done) {
//           testReq.apiClient.getBackendFromUserMapping.yields('some err');
//           sinon.stub(testReq.apiClient, 'fetchBackendForUrl');
//           done();
//         });
//         afterEach(function (done) {
//           testReq.apiClient.fetchBackendForUrl.restore();
//           done();
//         });
//         describe('getBackendFromDeps returns host', function () {
//           var testHost = 'can.com';
//           beforeEach(function(done) {
//             testReq.apiClient.fetchBackendForUrl.yields(null, testHost);
//             done();
//           });
//           describe('no referer', function () {
//             it('should get backend', function (done) {
//               api.getTargetHost(testReq, {}, function (err) {
//                 if (err) { return done(err); }
//                 expect(testReq.apiClient.fetchBackendForUrl
//                   .calledWith('http://'+host, undefined)).to.be.true();
//                 expect(testReq.targetHost).to.equal(testHost);
//                 done();
//               });
//             });
//             it('should add 80 to host', function (done) {
//               var host = 'localhost';
//               var testArgs = {
//                 headers: {
//                   host: host
//                 },
//                 apiClient: testReq.apiClient,
//                 method: 'post'
//               };
//               api.getTargetHost(testArgs, {}, function () {
//                 expect(testArgs.apiClient.fetchBackendForUrl
//                   .calledWith('http://'+host+':80', undefined)).to.be.true();
//                 done();
//               });
//             });
//           });
//           describe('with referer', function () {
//             var testRef = 'someRef';
//             it('should get backend', function (done) {
//               var testArgs = {
//                 headers: {
//                   host: host,
//                   referer: testRef
//                 },
//                 apiClient: testReq.apiClient,
//                 method: 'post'
//               };
//               api.getTargetHost(testArgs, {}, function (err) {
//                 if (err) { return done(err); }
//                 expect(testArgs.apiClient.fetchBackendForUrl
//                   .calledWith('http://'+host, testRef)).to.be.true();
//                 expect(testArgs.targetHost).to.equal(testHost);
//                 done();
//               });
//             });
//             it('should get https backend', function (done) {
//               var host = 'localhost:443';
//               var testArgs = {
//                 headers: {
//                   host: host,
//                   referer: testRef
//                 },
//                 apiClient: testReq.apiClient,
//                 method: 'post'
//               };
//               api.getTargetHost(testArgs, {}, function (err) {
//                 if (err) { return done(err); }
//                 expect(testArgs.apiClient.fetchBackendForUrl
//                   .calledWith('https://'+host, testRef)).to.be.true();
//                 expect(testArgs.targetHost).to.equal(testHost);
//                 done();
//               });
//             });
//           });
//         });
//       });
//     });
//     describe('checkAndSetIfDirectUrl', function () {
//       it('should just next if target already found', function (done) {
//         var req = {
//           targetHost: 'coolhostbro',
//           apiClient: testReq.apiClient,
//           method: 'post'
//         };
//         api.handleDirectUrl(req, {}, function (err) {
//           expect(err).to.not.exist();
//           done();
//         });
//       });
//       it('should redirect to self after successful mapping', function (done) {
//         var req = {
//           headers: {
//             host: host
//           },
//           apiClient: testReq.apiClient,
//           method: 'post'
//         };
//         var testRes = {
//           redirect: function (code, url) {
//             expect(code).to.equal(301);
//             expect(url).to.equal('http://'+host);
//             done();
//           }
//         };
//         sinon.stub(testReq.apiClient, 'checkAndSetIfDirectUrl').yields(null, {
//           statusCode: 200
//         });

//         api.handleDirectUrl(req, testRes);

//         expect(testReq.apiClient.checkAndSetIfDirectUrl.calledWith('http://'+host))
//           .to.be.true();
//         testReq.apiClient.checkAndSetIfDirectUrl.restore();
//       });
//       it('should next err if checkAndSetIfDirectUrl had error', function (done) {
//         var testErr = 'error';
//         var req = {
//           headers: {
//             host: host
//           },
//           apiClient: testReq.apiClient,
//           method: 'post'
//         };
//         sinon.stub(req.apiClient, 'checkAndSetIfDirectUrl').yields(testErr);

//         api.handleDirectUrl(req, null, function (err) {
//           expect(err).to.equal(testErr);
//           expect(req.apiClient.checkAndSetIfDirectUrl.calledWith('http://'+host))
//             .to.be.true();
//           req.apiClient.checkAndSetIfDirectUrl.restore();
//           done();
//         });
//       });
//       it('should redirect to box selection if checkAndSetIfDirectUrl 404', function (done) {
//         var testRes = 'testres';
//         var req = {
//           headers: {
//             host: host
//           },
//           apiClient: testReq.apiClient,
//           method: 'post'
//         };
//         sinon.stub(req.apiClient, 'checkAndSetIfDirectUrl').yields(null, {
//           statusCode: 404
//         });
//         sinon.stub(req.apiClient, 'redirectToBoxSelection').returns();

//         api.handleDirectUrl(req, testRes);
//         expect(req.apiClient.checkAndSetIfDirectUrl.calledWith('http://'+host))
//           .to.be.true();
//         expect(req.apiClient.redirectToBoxSelection.calledWith('http://'+host, testRes))
//           .to.be.true();
//         req.apiClient.checkAndSetIfDirectUrl.restore();
//         req.apiClient.redirectToBoxSelection.restore();
//         done();
//       });
//     });
//   });
// });
