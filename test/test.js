'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var supertest = require('supertest');
var server = require('server');
var describe = lab.describe;
var it = lab.it;

describe('test', function () {
  it('root route returns hello', function (done) {
    supertest(server)
      .get('/')
      .expect('hello', done);
  });
});