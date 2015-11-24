/**
 * @module lib/script-inject-res-stream
 */
'use strict';

var trumpet = require('trumpet');
var through = require('through2');
var zlib = require('zlib');

var createResStream = require('create-res-stream');
var log = require('middlewares/logger')(__filename).log;

module.exports.create = createScriptInjectResStream;

/**
 * Create a script injection response stream
 * @param  {String } script to be injected into the response
 * @param  {Boolean} resIsGziped whether or not the response is gziped
 * @return {MergedStream} scriptInjectResStream response stream which injects script into html res
 *         {MergedStream.input} merged-stream input response stream ( pipe data into this stream)
 *         {MergedStream.output} merged-stream output response stream ( pipe data out of this)
 */
function createScriptInjectResStream (script, resIsGziped) {
  var logData = {
    tx: true,
    resIsGziped: resIsGziped
  };
  log.info(logData, 'createScriptInjectResStream');
  // The response is transformed by injecting a script (xhr patch) when
  // content-type html is detected.
  var input, output, injectScript, zip, unzip;

  script = script ? '<script type=\"text/javascript\">\n;(' + script + ')()\n<\/script>\n'
    : ';(' + "function () { console.log('You didn\'t provide a script to inject') }" + ')()';
  var headStream = trumpet().createStream('head');

  var needToAddScript = false;
  headStream // If there were no <script>'s, insert the script right before </body>
    .pipe(through(
      function (data, enc, cb) {
        if (needToAddScript) {
          this.push(script);
          needToAddScript = false;
        }
        this.push(data);
        cb();
      }))
    .pipe(headStream);

  input = output = injectScript = createResStream(headStream);

  if (resIsGziped) {
    // 1) un-gzip it so script can be injected
    // 2) inject xhr patch script
    // 3) re-gzip it
    zip   = createResStream(zlib.createGunzip());
    unzip = createResStream(zlib.createGzip());

    input = zip;
    output = zip
      .pipe(injectScript)
      .pipe(unzip);
  }

  return {
    input : input,
    output: output
  };
}
