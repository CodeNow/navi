'use strict';
require('loadenv.js');

var ErrorCat = require('error-cat');
var NaviEntry = require('navi-entry');
var Runnable = require('runnable');
var assign = require('101/assign');
var find = require('101/find');
var hasKeypaths = require('101/has-keypaths');
var keypather = require('keypather')();
var url = require('url');

var errorPage = require('models/error-page.js');
var logger = require('middlewares/logger')(__filename);

NaviEntry.setRedisClient(require('./redis'));

var log = logger.log;

module.exports = api;

// this is used for hello runnable user so we only have to login once
var superUser = new Runnable(process.env.API_HOST, {
  requestDefaults: {
    headers: {
      'user-agent': 'navi-root'
    },
  },
});
/**
 * module used to make calls to runnable API as a specific user
 */
function api () {}
/**
 * used to login with root account, we only have to do this once
 * @param  {Function} cb (err)
 */
api.loginSuperUser = function (cb) {
  log.trace({
    tx: true
  }, 'loginSuperUser');
  superUser.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb);
};
/**
 * creates runnable api client and appends to request
 * if options or non browser request, login as super user
 * @return {object} middleware
 */
api.createClient = function (req, res, next) {
  log.trace({
    tx: true,
    isBrowser: req.isBrowser
  }, 'createClient');
  var runnableOpts = {
    requestDefaults: {
      headers: {
        'user-agent': 'navi'
      },
    },
  };
  if (req.method.toLowerCase() ===  'options' || !req.isBrowser) {
    req.apiClient = superUser;
    return next();
  }
  var cookie = req.session.apiCookie;
  log.trace({
    tx: true,
    cookie: cookie
  }, 'createClient cookie');
  if (cookie) {
    runnableOpts.requestDefaults.headers.Cookie = cookie;
  }
  req.apiClient = new Runnable(process.env.API_HOST, runnableOpts);
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
  log.trace({
    tx: true,
    reqUrl: reqUrl,
    refererUrl: refererUrl
  }, 'getTargetHost');

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
          log.error({
            tx: true,
            instanceName: instanceName
          }, 'instance not found');
          return next(ErrorCat.create(404, 'mapped instance no longer exists'));
        }
        if (info.elastic) {
          // elastic url entry always holds a masterPod name
          api._handleElasticUrl(client, reqUrl, refererUrl, instance, proxyToContainer);
        }
        else { // direct url
          if (!req.isBrowser) {
            log.trace({
              tx: true,
              // might be too noisy, use serializer if so
              instance: instance,
              reqUrl: reqUrl,
              port: url.parse(reqUrl).port
            }, 'non-browser direct url request, proxy to direct container');
            return handleInstance(null, instance, url.parse(reqUrl).port, proxyToContainer);
          }
          // set mapping and redirect to elastic url
          api._handleDirectUrl(urlEntry, client, instance, redirectToElastic);
        }
      });
    });
  }
  function redirectToElastic (err, hostname) {
    log.trace({
      tx: true,
      err: err,
      hostname: hostname
    }, 'redirectToElastic');
    if (err) { return next(err); }

    var parsed = assign(url.parse(reqUrl), {
      hostname: hostname
    });
    delete parsed.host;
    var redirectUrl = url.format(parsed);
    res.redirect(redirectUrl);
  }
  function proxyToContainer (err, containerUrl, targetInstance) {
    log.trace({
      tx: true,
      err: err,
      containerUrl: containerUrl,
      instance: targetInstance
    }, 'proxyToContainer');
    if (err) { return next(err); }
    req.targetInstance = targetInstance;
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
  log.trace({
    tx: true,
    urlEntry: urlEntry,
    client: client,
    instance: instance
  }, '_handleDirectUrl');

  urlEntry.directKey = urlEntry.key;
  var elasticHostname = urlEntry.getElasticHostname(instance.attrs.shortHash);

  client.createRoute({
    srcHostname:    elasticHostname,
    destInstanceId: instance.attrs._id
  }, function (err) {
    if (err && /hello.*runnable/i.test(err.message)) {
      log.error({
        tx: true,
        err: err
      }, 'hello runnable error');
      err = null;
    }
    cb(err, elasticHostname);
  });
};

/**
 * handle the routing of an elastic
 * @param  {Runnable}  client        api client instance
 * @param  {String}    elasticUrl    elastic url (req url)
 * @param  {String}    refererUrl    referer url
 * @param  {handleUrlCb}  cb         (err, targetUrl, targetInstance) // jsdoc above
 */
api._handleElasticUrl = function (client, elasticUrl, refererUrl, masterInstance, cb) {
  var parsedElasticUrl = url.parse(elasticUrl);
  var elasticHostname = parsedElasticUrl.hostname;
  log.trace({
    tx: true,
    client: client,
    elasticUrl: elasticUrl,
    refererUrl: refererUrl,
    instance: masterInstance,
    parsedElasticUrl: parsedElasticUrl
  }, '_handleElasticUrl');
  checkReferer(cb);
  function checkReferer (cb) {
    log.trace({
      tx: true
    }, 'checkReferer');
    if (!refererUrl) {
      return checkForMapping(boxSelectionUrl, cb);
    }
    var refererHostname = url.parse(refererUrl).hostname;
    if (refererHostname === 'localhost') {
      log.trace({
        tx: true
      }, 'localhost referer');
      return checkForMapping(masterUrl, cb);
    }
    else if (refererHostname.toLowerCase() === elasticHostname.toLowerCase()) {
      // referer is self, mapping should hit, else master
      return checkForMapping(masterUrl, cb);
    }
    var refererEntry = NaviEntry.createFromUrl(refererUrl);
    refererEntry.exists(function (err, entryExists) {
      if (err) {
        log.error({
          err: err
        }, 'refererEntry exists error');
        return cb(err);
      }
      log.trace({
        tx: true,
        entryExists: entryExists
      }, 'refererEntry exists');
      if (entryExists) {
        return checkForAssociations(refererHostname, cb);
      }
      checkForMapping(boxSelectionUrl, cb);
    });
  }
  function checkForAssociations(refererHostname, cb) {
    log.trace({
      tx: true,
      refererHostname: refererHostname
    }, 'checkForAssociations');
    findUserMapping(refererHostname, function (err, refererRoute) {
      if (err) {
        log.error({
          tx: true,
          err: err,
          refererHostname: refererHostname
        }, 'checkForAssociations findUserMapping');
        return cb(err);
      }
      if (!refererRoute) {
        log.info({
          tx: true,
          refererRoute: refererRoute
        }, '!refererRoute');
        return checkForMapping(masterUrl, cb);
      }
      log.trace({
        tx: true,
        refererRoute: refererRoute
      }, 'referer has a mapping, checking associations');
      client
        .newInstance(refererRoute.destInstanceId)
        .fetchDependencies({
          hostname: elasticHostname
        }, function (err, associations) {
          if (err) {
            log.error({
              tx: true,
              err: err
            }, 'fetchDependencies error');
            return cb(err);
          }
          var assoc = associations[0];
          log.trace({
            tx: true,
            association: assoc
          }, 'association');
          if (assoc) {
            var assocInstance = client.fetchInstance(assoc.id, function (err) {
              handleInstance(err, assocInstance, parsedElasticUrl.port, cb);
            });
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
  function checkForMapping (noRouteHandler, cb) {
    log.trace({
      tx: true,
      noRouteHandler: noRouteHandler
    }, 'checkForMapping');
    findUserMapping(elasticHostname, function (err, route) {
      if (err) {
        log.error({
          tx: true,
          err: err,
          elasticHostname: elasticHostname
        }, 'findUserMapping error');
        return cb(err);
      }
      if (!route) {
        log.trace({
          tx: true,
          route: route,
          elasticHostname: elasticHostname
        }, 'non-ajax, no route mapping');
        return noRouteHandler();
      }
      log.trace({
        tx: true,
        elasticHostname: elasticHostname,
        route: route
      }, 'no referer, mapping found');
      var mappedInstance = client.fetchInstance(route.destInstanceId, function (err) {
        log.trace({
          tx: true,
          err: err,
          instanceId: route.destInstanceId
        }, 'fetchInstance result');
        handleInstance(err, mappedInstance, parsedElasticUrl.port, cb);
      });
    });
  }
  var _routes;
  function findUserMapping (hostname, cb) {
    log.trace({
      tx: true,
      hostname: hostname
    }, 'findUserMapping');
    if (_routes) {
      log.trace({
        tx: true,
        _routes: _routes
      }, '_routes');
      // cache hit
      return handleRoutes(_routes);
    }
    client.fetchRoutes(function (err, routes) {
      log.trace({
        tx: true,
        err: err,
        routes: routes
      }, 'fetchRoutes');
      if (err) { return cb(err); }
      // cache it to avoid second call (1: refUrl mapping, 2: reqUrl mapping)
      _routes = routes;
      handleRoutes(routes);
    });
    function handleRoutes (routes) {
      var route = find(routes, hasKeypaths({
        'srcHostname.toLowerCase()': hostname.toLowerCase()
      }));
      log.trace({
        tx: true,
        route: route
      }, 'handleRoutes');
      cb(null, route);
    }
  }
  function masterUrl () {
    log.trace({
      tx: true
    }, 'masterUrl');
    // Note: Master pod instance's name will match the name in the elastic navi entry
    handleInstance(null, masterInstance, parsedElasticUrl.port, cb);
  }
  function boxSelectionUrl () {
    log.trace({
      tx: true
    },'boxSelectionUrl');
    // TODO: redirect to box selection
    masterUrl();
  }
};

function handleInstance (err, instance, port, cb) {
  log.trace({
    tx: true,
    err: err,
    instance: instance,
    port: port
  }, 'handleInstance');
  if (err) { return cb(err); }
  instance.getContainerUrl(port, function (err, url) {
    if (err) {
      log.error({
        tx: true,
        err: err
      }, 'instance.getContainerUrl error');
    }
    if (!err && url) {
      return cb(null, url, instance);
    }
    if (!err.isBoom) {
      return cb(err);
    }
    var statusCode = keypather.get(err, 'output.statusCode');
    // error code 504 and 503 come from api client. they mean the container has error
    // look at getContainerUrl function on instance model
    if (instance.status() !=='running' ||
      statusCode === 504 ||
      statusCode === 503) {
      return cb(null, errorPage.generateErrorUrl('dead', instance), instance);
    }
    if (statusCode === 400) {
      // redirect to port not exposed page
      return cb(null, errorPage.generateErrorUrl('ports', instance), instance);
    }
    return cb(err);
  });
}
/**
 * convert host to full url
 * @param  {object} req  the request object to use as input
 * @return {string}      formatted host to send to api
 *                       <protocol>/<host>:<port>
 */
api._getUrlFromRequest = function (req) {
  log.trace({
    tx: true,
    req: req
  }, '_getUrlFromRequest');
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
api.checkIfLoggedIn = function (req, res, next) {
  req.apiClient.fetch('me', function (err) {
    log.trace({
      tx: true,
      err: err,
      authTried: req.session.authTried,
      url: api._getUrlFromRequest(req)
    }, 'req.apiClient.fetch me error');
    if (err) {
      if (isUnauthorizedErr(err)) {
        var url = api._getUrlFromRequest(req);
        req.targetHost = errorPage.generateErrorUrl('signin', {
          redirectUrl: req.apiClient.getGithubAuthUrl(url, req.session.authTried)
        });
        // no need to reset because it is only used for god mode
        req.session.authTried = true;
        return next();
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
