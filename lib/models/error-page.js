/**
 * @module lib/models/error-page
 */
'use strict';
require('loadenv.js');

var ErrorCat = require('error-cat');
var qs = require('querystring');

var log = require('middlewares/logger')(__filename).log;

module.exports = {
  generateErrorUrl: generateErrorUrl
};

/**
 * get url of error pages
 * @param  {string} type [dead,ports,unresponsive,invalid,signin]
 * @param  {object} opts to get error data from
 *                       for port,unresponsive,dead this is instance model
 *                         with elasticUrl key
 *                       for signin this is redirectUrl
 * @return {string}      url of error page. <proto>://<host>:<port>
 *                       throws if type is invalid
 */
function generateErrorUrl(type, opts) {
  var logData = {
    tx: true,
    type: type,
    opts: opts
  };
  log.info(logData, 'generateErrorUrl');
  var query = {
    type: type
  };

  switch (type) {
    case 'signin': {
      var redirectUrl = process.env.API_HOST+
        '/auth/github?requiresToken=yes&redirect='+opts.redirectUrl;
      query.redirectUrl = redirectUrl;
      log.trace(logData, 'generateErrorUrl signin');
      break
    }
    case 'not_running':
    case 'unresponsive':
    case 'ports':
    case 'dock_removed': {
      query.elasticUrl = opts.elasticUrl;
      query.shortHash = opts.shortHash;
      break
    }
    default: {
      throw ErrorCat.createAndReport(500, 'invalid error page');
    }
  }

  logData.query = query;
  log.trace(logData, 'generateErrorUrl query');
  return process.env.ERROR_URL + '?' + qs.stringify(query);
}
