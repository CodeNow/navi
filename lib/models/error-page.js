'use strict';
require('loadenv.js');

var qs = require('querystring');
var keypather = require('keypather')();
var ErrorCat = require('error-cat');
var debug = require('auto-debug')();

module.exports = {
  generateErrorUrl: generateErrorUrl
};

/**
 * get url of error pages
 * @param  {string} type [dead,ports,unresponsive,invalid,signin]
 * @param  {object} opts to get error data from
 *                       for port,unresponsive,dead this is instance model
 *                       for signin this is redirectUrl
 * @return {string}      url of error page. <proto>://<host>:<port>
 *                       throws if type is invalid
 */
function generateErrorUrl(type, opts) {
  debug(type);
  var query = {};
  if (type === 'ports' ||
      type === 'unresponsive') {
    query = {
      ports: keypather.get(opts, 'attrs.container.ports'),
      containerUrl: opts.getContainerHostname(),
      branchName: opts.getRepoAndBranchName()
    };
  } else if (type === 'dead') {
    query = {
      instanceName: keypather.get(opts, 'attrs.name'),
      ownerName: keypather.get(opts, 'attrs.owner.username'),
      status: opts.status(),
      branchName: opts.getRepoAndBranchName()
    };
  } else if (type === 'signin') {
    query.redirectUrl = opts.redirectUrl;
  }
  else {
    debug('invalid type, throwing', type);
    throw ErrorCat.createAndReport(500, 'invalid error page');
  }
  debug(type + 'error page', query);
  return process.env.ERROR_URL + '/error/' + type + '?' + qs.stringify(query);
}