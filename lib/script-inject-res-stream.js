'use strict';
var zlib = require('zlib');
var scriptInjector = require('script-injector');
var createResStream = require('./create-res-stream.js');

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
  // The response is transformed by injecting a script (xhr patch) when
  // content-type html is detected.
  var input, output, injectScript, zip, unzip;
  input = output = injectScript = createResStream(scriptInjector(script));

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