'use strict';
var url = require('url');

module.exports = removeUrlPath;
/**
 * remove path from url
 * @param  {string} uri  full url
 * @return {string} uriWithoutPath
 */
function removeUrlPath (uri) {
  var parsed = url.parse(uri);
  if (parsed.host) {
    delete parsed.pathname;
  }
  return url.format(parsed);
}
