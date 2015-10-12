/**
 * @module lib/create-res-stream
 */
'use strict';

var responseStream = require('response-stream');
var through = require('through2');

var log = require('middlewares/logger')(__filename).log;

/*
 * Accepts a stream and converts it into a response-like stream.
 *   It enables piping http responses to responses, while also proxying
 *   response methods: writeHead, setHeader, etc.
 * @param {DuplexStream} stream - stream to be converted to a response-like stream
 * @return {ResponseStream} resStream
 */
module.exports = createResStream;

function createResStream (stream) {
  log.info('createResStream');
  stream = stream || through();
  // responseStream attaches 11 listeners alone
  // set maxListeners to 15 to give few extra for piping to other streams etc
  stream.setMaxListeners(15);
  var resStream = responseStream(stream);
  return resStream;
}
