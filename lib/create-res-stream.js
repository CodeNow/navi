'use strict';

var responseStream = require('response-stream');
var through = require('through2');

/*
 * Accepts a stream and converts it into a response-like stream.
 *   It enables piping http responses to responses, while also proxying
 *   response methods: writeHead, setHeader, etc.
 * @param {DuplexStream} stream - stream to be converted to a response-like stream
 * @return {ResponseStream} resStream
 */
module.exports = createResStream;

function createResStream (stream) {
  stream = stream || through();
  var resStream = responseStream(stream);

  return resStream;
}