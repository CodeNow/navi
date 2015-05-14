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
var isAgentBrowser = require('user-agent-is-browser');
var keypather = require('keypather')();

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
  var userAgent = keypather.get(req, 'headers["user-agent"]');
  var isBrowser;
  if (userAgent) {
    isBrowser = isAgentBrowser(userAgent);
  }

  if (req.method.toLowerCase() ===  'options' ||
      isBrowser) {
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

  checkUrl();

  function checkUrl () {
    // reqUrl entry backendUrl is navi, no need to check existance.
    var urlEntry = req.urlEntry = NaviEntry.createFromUrl(reqUrl);

    urlEntry.getInfo(function (err, info) {
      if (err) { return next(err); }
      var instanceName = info.instanceName;
      var instances = client.fetchInstances({
        name: instanceName,
        'owner.github': info.ownerGithub
      }, function (err) {
        if (err) { return next(err); }
        var instance = instances.models[0];
        if (!instance) {
          return next(ErrorCat.create(404, 'mapped instance no longer exists'));
        }
        if (info.elastic) {
          // elastic url entry always holds a masterPod name
          api._handleElasticUrl(client, reqUrl, refererUrl, instance, proxyToContainer);
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
  urlEntry.directKey = urlEntry.key;
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
 * @param  {Runnable}  client        api client instance
 * @param  {String}    elasticUrl    elastic url (req url)
 * @param  {String}    refererUrl    referer url
 * @param  {handleUrlCb}  cb         callback // jsdoc above
 */
api._handleElasticUrl = function (client, elasticUrl, refererUrl, masterInstance, cb) {
  console.log('(client, elasticUrl, refererUrl, masterInstance, cb) {');
  var parsedElasticUrl = url.parse(elasticUrl);
  var elasticHostname = parsedElasticUrl.hostname;

  checkReferer(cb);
  function checkReferer (cb) {
    console.log('checkReferer (cb) {');
    if (!refererUrl) {
      return checkForMapping(boxSelectionUrl, cb);
    }
    var refererHostname = url.parse(refererUrl).hostname;
    if (refererHostname === 'localhost') {
      return checkForMapping(masterUrl, cb);
    }
    var refererEntry = NaviEntry.createFromUrl(refererUrl);
    refererEntry.exists(function (err, entryExists) {
      console.log('(err, entryExists) {');
      if (err) { return cb(err); }
      if (entryExists) {
        return checkForAssociations(refererHostname, cb);
      }
      checkForMapping(boxSelectionUrl, cb);
    });
  }
  function checkForAssociations(refererHostname, cb) {
    console.log('checkForAssociations(refererHostname, cb) {');
    findUserMapping(refererHostname, function (err, refererRoute) {
      console.log('(err, refererRoute) {');
      if (err) { return cb(err); }
      if (!refererRoute) {
        return checkForMapping(masterUrl, cb);
      }
      // Case: referer has a mapping, check associations
      client
        .newInstance(refererRoute.destInstanceId)
        .fetchDependencies({
          hostname: elasticHostname
        }, function (err, associations) {
          console.log('(err, associations) {');
          if (err) { return cb(err); }
          var assoc = associations[0];
          if (assoc) { // association found!
            var assocInstance = client.fetchInstance(assoc._id, function (err) {
              console.log('(err) {');
              handleInstance(err, assocInstance);
            });
          }
          else {
            // bc this has a referer that is a user-content-url,
            // we can assume this is ajax, and should be routed to fallback
            // Note: the elastic entries name value will match the master pod instance's name
            checkForMapping(masterUrl, cb);
          }
        });
    });
  }
  function checkForMapping (noRouteHandler, cb) {
    console.log('checkForMapping (noRouteHandler, cb) {');
    findUserMapping(elasticHostname, function (err, route) {
      console.log('(err, route) {');
      if (err) { return cb(err); }
      if (!route) {
        // Case: Non-ajax, no route mapping
        return noRouteHandler();
      }
      // Case: No referer, mapping found
      var mappedInstance = client.fetchInstance(route.destInstanceId, function (err) {
        console.log('(err) {');
        handleInstance(err, mappedInstance);
      });
    });
  }
  var _routes;
  function findUserMapping (hostname, cb) {
    console.log('findUserMapping (hostname, cb) {');
    if (_routes) {
      // cache hit
      return handleRoutes(_routes);
    }
    client.fetchRoutes(function (err, routes) {
      console.log('(err, routes) {');
      if (err) { return cb(err); }
      // cache it to avoid second call (1: refUrl mapping, 2: reqUrl mapping)
      _routes = routes;
      handleRoutes(routes);
    });
    function handleRoutes (routes) {
      console.log('handleRoutes (routes) {');
      var route = find(routes, hasKeypaths({
        'srcHostname.toLowerCase()': hostname.toLowerCase()
      }));
      cb(null, route);
    }
  }
  function masterUrl () {
    console.log('masterUrl () {');
    // Note: Master pod instance's name will match the name in the elastic navi entry
    handleInstance(null, masterInstance);
  }
  function boxSelectionUrl () {
    console.log('boxSelectionUrl () {');
    // TODO: redirect to box selection
    masterUrl();
  }
  function handleInstance (err, instance) {
    console.log('handleInstance (err, instance) {');
    if (err) { return cb(err); }
    instance.getContainerUrl(parsedElasticUrl.port, cb);
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
