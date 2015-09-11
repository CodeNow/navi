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
  var input, output, injectScriptStream, zip;
  input = output = injectScriptStream = scriptInjector(script);

  if (resIsGziped) {
    // 1) un-gzip it so script can be injected
    // 2) inject xhr patch script
    // 3) re-gzip it
    input = zip = zlib.createGunzip();
    output = zip
      .pipe(injectScriptStream)
      .pipe(zlib.createGzip());
  }

  return {
    input : createResStream(input),
    output: createResStream(output)
  };
}