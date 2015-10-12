/**
 * @module lib/models/error-page
 */
'use strict';
require('loadenv.js');

var ErrorCat = require('error-cat');
var isObject = require('101/is-object');
var keypather = require('keypather')();
var qs = require('querystring');

var logger = require('middlewares/logger')(__filename);

var log = logger.log;

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
  log.trace({
    tx: true,
    type: type,
    opts: opts
  }, 'generateErrorUrl');
  var query = {};
  if (type === 'ports' ||
      type === 'unresponsive' ||
      type === 'dead') {
    query = {
      branchName: opts.getRepoAndBranchName(),
      instanceName: keypather.get(opts, 'attrs.name'),
      ownerName: keypather.get(opts, 'attrs.owner.username'),
      status: opts.status(),
    };
    var ports = keypather.get(opts, 'attrs.container.ports');
    var portArray = [];
    if (isObject(ports)) {
      Object.keys(ports).forEach(function(key) {
        portArray.push(key.replace('/tcp', ''));
      });
    }
    if (portArray.length) {
      query.ports = portArray;
    }
  } else if (type === 'signin') {
    query.redirectUrl = opts.redirectUrl;
  }
  else {
    log.trace({
      tx: true,
      type: type
    }, 'invalid type');
    throw ErrorCat.createAndReport(500, 'invalid error page');
  }
  query.type = type;
  log.trace({
    tx: true,
    query: query
  }, 'error page query');
  return process.env.ERROR_URL + '?' + qs.stringify(query);
}
