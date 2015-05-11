'use strict';
require('loadenv.js');

var url = require('url');
var debug = require('auto-debug')();
var Runnable = require('runnable');
var ErrorCat = require('error-cat');
var NaviEntry = require('navi-entry');
var find = require('101/find');
var assign = require('101/assign');
var hasKeypaths = require('101/has-keypaths');
NaviEntry.setRedisClient(require('./redis'));

module.exports = api;

/**
 * module used to make calls to runnable API as a specific user
 */
function api () {}

/**
 * creates runnable api client and appends to request
 * if options request, login as super user
 * @return {object} middleware
 */
api.createClient = function (req, res, next) {
  var runnableOpts = {
    requestDefaults: {
      headers: {
        'user-agent': 'navi'
      },
    },
  };
  var cookie = req.session.apiCookie;
  debug('cookie', cookie);
  if (cookie) {
    runnableOpts.requestDefaults.headers.Cookie = cookie;
  }
  req.apiClient = new Runnable(process.env.API_HOST, runnableOpts);
  if (req.method.toLowerCase() ===  'options') {
    debug('options req, using super user');
    return req.apiClient.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, next);
  }
  next();
};
/**
 * attempts to find a backend host to route request too
 * first checks user mapping then checks dependencies
 * and sets req.targetHost if host found
 * @param  {object}   req  express request
 * @param  {object}   res  express response
 * @param  {Function} next express next
 */
api.getTargetHost = function (req, res, next) {
  var reqUrl = api._getUrlFromRequest(req);
  var client = req.apiClient;
  var refererUrl = req.headers.referer;
  debug('reqUrl', reqUrl, 'referer', refererUrl);

  handleUrl();

  function handleUrl () {
    if (refererUrl) {
      var refererEntry = NaviEntry.createFromUrl(refererUrl);
      refererEntry.exists(function (err, entryExists) {
        if (err) { return next(err); }
        if (!entryExists) {
          refererUrl = null;
        }
        checkUrl();
      });
    }
    else {
      checkUrl();
    }
  }
  function checkUrl () {
    // reqUrl entry backendUrl is navi, no need to check existance.
    var urlEntry = req.urlEntry = NaviEntry.createFromUrl(reqUrl);

    urlEntry.getInstanceName(function (err, instanceName) {
      if (err) { return next(err); }
      var instances = client.fetchInstances({
        name: instanceName,
        githubUsername: client.attrs.accounts.github.username
      }, function (err) {
        if (err) { return next(err); }
        var instance = instances.models[0];
        if (!instance) {
          return next(ErrorCat.create(404, 'mapped instance no longer exists'));
        }
        var isElasticUrl = instance.attrs.masterPod;
        if (isElasticUrl) {
          api._handleElasticUrl(urlEntry, client, reqUrl, refererUrl, instance, proxyToContainer);
        }
        else { // direct url
          api._handleDirectUrl(urlEntry, client, instance, redirectToElastic);
        }
      });
    });
  }
  function redirectToElastic (err, hostname) {
    if (err) { return next(err); }
    var parsed = assign(url.parse(reqUrl), {
      hostname: hostname
    });
    delete parsed.host;
    var redirectUrl = url.format(parsed);
    res.redirect(redirectUrl);
  }
  function proxyToContainer (err, containerUrl) {
    if (err) { return next(err); }
    req.targetHost = containerUrl;
    next();
  }
};

/**
 * handle the routing of a direct url
 * @param  {NaviEntry} urlEntry navi entry for url
 * @param  {Runnable}  client   api client instance
 * @param  {handleUrlCb}  cb       callback
 */
/**
 * @callback handleUrlCb
 * @param {Error}  err
 * @param {String} destHostname
 */
api._handleDirectUrl = function (urlEntry, client, instance, cb) {
  var elasticHostname = urlEntry.getElasticHostname(instance.getBranchName());

  client.createRoute({
    srcHostname:    elasticHostname,
    destInstanceId: instance.attrs._id
  }, function (err) {
    cb(err, elasticHostname);
  });
};

/**
 * handle the routing of an elastic
 * @param  {NaviEntry} elasticEntry  navi entry for url
 * @param  {Runnable}  client        api client instance
 * @param  {String}    elasticUrl    elastic url
 * @param  {String}    refererUrl    referer url
 * @param  {handleUrlCb}  cb         callback // jsdoc above
 */
api._handleElasticUrl = function (elasticEntry, client, elasticUrl, refererUrl, masterInstance, cb) {
  var elasticHostname = url.parse(elasticUrl).hostname;
  var refererHostname = url.parse(refererUrl).hostname;
  checkReferer(cb);
  function checkReferer (cb) {
    if (!refererUrl) {
      // Case: No referer or url is NOT a user-content-url
      return findUserMapping(elasticHostname, function (err, route) {
        if (err) { return cb(err); }
        if (!route) {
          // Case: Non-ajax, no route mapping
          // TODO: Box Selection, master for now.
          return boxSelectionUrl(cb);
        }
        // Case: No referer, mapping found
        client.fetchInstance(route.destInstanceId, handleInstance);
      });
    }
    var refererEntry = NaviEntry.createFromUrl(refererUrl);
    refererEntry.exists(function (err, refererIsUserContentUrl) {
      if (err) { return cb(err); }
      if (refererIsUserContentUrl) {
        // Case: Referer is a user-content-url
        return checkForAssociations(cb);
      }
      // Case: Url is NOT a user-content-url (same behavior as no-referer)
      findUserMapping(elasticHostname, function (err, route) {
        if (err) { return cb(err); }
        if (!route) {
          // Case: Non-AJAX or AJAX, No Mapping
          // This could be AJAX from local or user's external server
          // This could be non-AJAX, refered from link on website
          // TODO: This is the hard case
          if (refererHostname.toLowerCase() === 'localhost') {
            return masterUrl();
          }
          return boxSelectionUrl(cb);
        }
        // Case: Unknown referer, mapping
        client.fetchInstance(route.destInstanceId, handleInstance);
      });
    });

  }
  function checkForAssociations(cb) {
    findUserMapping(refererHostname, function (err, refererRoute) {
      if (err) { return cb(err); }
      if (!refererRoute) {
        return masterUrl();
      }
      // Case: referer has a mapping, check associations
      client
        .newInstance(refererRoute.destInstanceId)
        .fetchDependencies({
          hostname: elasticHostname
        }, function (err, associations) {
          if (err) { return cb(err); }
          var assoc = associations[0];
          if (assoc) { // association found!
            client.findInstance(assoc._id, handleInstance);
          }
          else {
            // bc this has a referer that is a user-content-url,
            // we can assume this is ajax, and should be routed to fallback
            // Note: the elastic entries name value will match the master pod instance's name
            masterUrl();
          }
        });
    });
  }
  var _routes;
  function findUserMapping (hostname, cb) {
    client.fetchRoutes(function (err, routes) {
      if (err) { return cb(err); }
      _routes = routes;
      var route = find(routes, hasKeypaths({
        'srcHostname.toLowerCase()': elasticHostname.toLowerCase()
      }));
      if (route) {

      cb(null, route);
      }
    });
  }
  function masterUrl () {
    // Note: Master pod instance's name will match the name in the elastic navi entry
    handleInstance(null, masterInstance);
  }
  function boxSelectionUrl (cb) {
    // TODO: redirect to box selection
    masterUrl(cb);
  }
  function handleInstance (err, instance) {
    if (err) { return cb(err); }
    if (instance.toJSON) { instance = instance.toJSON(); }
    client.newInstance(instance).getContainerUrl(cb);
  }
};
/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
api._getUrlFromRequest = function (req) {
  var host = req.headers.host;
  var split = host.split('.');
  var numSubDomains = 3;
  if (split.length > numSubDomains) {
    split.splice(0, split.length-numSubDomains);
  }
  host = split.join('.');
  // append 80 if port not in url
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  // we only support https on port 443
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';

  return protocol + host;
};
/**
 * make a request for self to check if authorized
 * if not, redirect for authorization
 * @return  {Function} middleware
 */
api.redirectIfNotLoggedIn = function (req, res, next) {
  req.apiClient.fetch('me', function (err) {
    if (err) {
      debug('error while fetching', err);
      if (isUnauthorizedErr(err)) {
        var url = api._getUrlFromRequest(req);
        debug('user not logged in, url', url);
        return req.apiClient.redirectForAuth(url, res);
      }
      return next(err);
    }
    next();
  });
};
/**
 * check to see if error is due to user not authorized
 * @param  {[type]}  err returned from api client
 * @return {Boolean}     true if not logged in, else false
 */
function isUnauthorizedErr (err) {
  if (err.output.statusCode === 401 &&
    err.data.error === 'Unauthorized') {
    return true;
  }
  return false;
}
