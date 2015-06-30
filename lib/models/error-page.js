'use strict';
require('loadenv.js');

var qs = require('querystring');
var keypather = require('keypather')();
var ErrorCat = require('error-cat');

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
      instanceName: opts.attrs.name,
      ownerName: keypather.get(opts, 'attrs.owner.username'),
      status: opts.status(),
      branchName: opts.getRepoAndBranchName()
    };
  } else if (type === 'signin') {
    query.redirectUrl = opts.redirectUrl;
  }
  else {
    throw ErrorCat.create(500, 'invalid error page');
  }
  return process.env.ERROR_URL + '/error/' + type + '?' + qs.stringify(query);
}