'use strict';
var url = require('url');
var debug = require('auto-debug')();

module.exports = removeUrlPath;
/**
 * remove path from url
 * @param  {string} uri  full url
 * @return {string} uriWithoutPath
 */
function removeUrlPath (uri) {
  debug.trace();
  var parsed = url.parse(uri);
  if (parsed.host) {
    delete parsed.pathname;
  }
  return url.format(parsed);
}
