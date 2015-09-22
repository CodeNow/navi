'use strict';
require('../../lib/loadenv.js');
var zlib = require('zlib');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.test;
var expect = require('code').expect;
var concat = require('concat-stream');
var createScriptInjectResStream = require('../../lib/script-inject-res-stream.js').create;
var createResStream = require('../../lib/create-res-stream.js');

var html = [
  '<html>',
  '  <body>',
  '   Hello World',
  '   <script>alert("yoyoma");</script>',
  '  </body>',
  '</html>'
].join('\n');

var script = function () {
  console.log('hello');
}.toString();

var expected = [
  '<html>',
  '  <body>',
  '   Hello World',
  '   <script type="text/javascript">',
  ';('+script+')()',
  '</script>',
  '<script>alert("yoyoma");</script>',
  '  </body>',
  '</html>'
].join('\n');

describe('script inject response stream', function() {
  it('should return a script inject stream', function (done) {
    var resIsGziped = false;
    var injectScriptStream = createScriptInjectResStream(script, resIsGziped);
    var resStream = createResStream();

    resStream
      .pipe(injectScriptStream.input);
    injectScriptStream.output
      .pipe(concat(function (html) {
        expect(html.toString()).to.equal(expected);
        done();
      }));
    // write html
    resStream.write(html);
    resStream.end();
  });

  describe('response is gziped', function() {
    it('should return a script inject stream w/ unzip and zip', function (done) {
      var resIsGziped = true;
      var injectScriptStream = createScriptInjectResStream(script, resIsGziped);
      var resStream = createResStream();

      resStream
        .pipe(createResStream(zlib.createGzip()))
        .pipe(injectScriptStream.input);
      injectScriptStream.output
        .pipe(createResStream(zlib.createGunzip()))
        .pipe(concat(function (html) {
          expect(html.toString()).to.equal(expected);
          done();
        }));
      // write html
      resStream.write(html);
      resStream.end();
    });
  });
});