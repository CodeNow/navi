/**
 * @module lib/script-inject-res-stream
 */
'use strict';

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

  // Vars for injectScriptInHTMLTagFromChunk to function
  script = '<script type=\"text/javascript\">\n;(' + script + ')()\n<\/script>\n';
  var needToAddScript = true;
  var prevChars = '';

  /**
   * Searches the chunk for the HTML string, and injects the script in and returns the modified chunk if found.
   * Otherwise returns the chunk unmodified.
   * @param {String} searchString
   * @param {String} chunk
   * @returns {String} modifiedChunk
   */
  function injectScriptInHTMLTagFromChunk (searchString, chunk) {
    if (needToAddScript) {
      var tmp = prevChars + chunk;
      var stringIndex = tmp.indexOf(searchString);
      if (stringIndex > -1) {
        var dataIndex = stringIndex - prevChars.length + searchString.length;
        chunk = chunk.slice(0, dataIndex) + script + chunk.slice(dataIndex);
        needToAddScript = false;
      }
    }
    return chunk;
  }

  var i = 0;
  var contentStream = through(
    function (data, enc, cb) {
      data = injectScriptInHTMLTagFromChunk('<head>', data);
      data = injectScriptInHTMLTagFromChunk('<body>', data);
      if (needToAddScript) {
        prevChars = data.toString().slice( -('<body>'.length) );
      }
      this.push(data);
      cb();
    });

  input = output = injectScript = createResStream(contentStream);

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
