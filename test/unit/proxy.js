'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var Proxy = require('../../lib/models/proxy.js');

lab.experiment('proxy.js unit test', function () {
  lab.experiment('Proxy', function () {
    lab.it('should load without throwing', function(done) {
      try {
        new Proxy();
      } catch (err) {
        return done(err);
      }
      done();
    });
  });
  lab.experiment('start', function () {
    lab.it('should start http server', function(done) {
      var proxy = new Proxy();
      var listenStub = sinon.stub(proxy.server, 'listen', function(port, cb) {
        expect(port).to.equal(process.env.HTTP_PORT);
        cb();
      });
      proxy.start(function(err) {
        if (err) { return done(err); }
        listenStub.restore();
        done();
      });
    });
  });
  lab.experiment('requestHandler', function () {
    lab.it('should lookup and proxy request', function(done) {
      var proxy = new Proxy();
      var lookupStub = sinon.stub(proxy.hostLookup, 'lookup').yields();
      var webStub = sinon.stub(proxy.proxy, 'web', function() {
        expect(lookupStub.calledOnce).to.equal(true);
        expect(webStub.calledOnce).to.equal(true);

        lookupStub.restore();
        webStub.restore();
        done();
      });
      var res = {};
      var req = {};
      proxy.requestHandler(res, req);
    });
    lab.it('should call respond error if lookup errors', function(done) {
      var proxy = new Proxy();
      var lookupStub = sinon.stub(proxy.hostLookup, 'lookup').yields('some error');
      var error = require('../../lib/error.js');

      var handleErrorStub = sinon.stub(error, 'errorResponder', function() {
        expect(lookupStub.calledOnce).to.equal(true);

        lookupStub.restore();
        handleErrorStub.restore();
        done();
      });
      var res = {};
      var req = {};
      proxy.requestHandler(res, req);
    });
  });
  lab.experiment('wsRequestHandler', function () {
    lab.it('should proxy ws', function(done) {
      var proxy = new Proxy();
      var wsStub = sinon.stub(proxy.proxy, 'ws', function() {
        wsStub.restore();
        done();
      });
      proxy.wsRequestHandler();
    });
  });
});