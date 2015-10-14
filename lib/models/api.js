/**
 * @module lib/models/api
 */
'use strict';
require('loadenv.js');

var ErrorCat = require('error-cat');
var NaviEntry = require('navi-entry');
var Runnable = require('runnable');
var assign = require('101/assign');
var find = require('101/find');
var hasKeypaths = require('101/has-keypaths');
var keypather = require('keypather')();
var put = require('101/put');
var url = require('url');

var errorPage = require('models/error-page.js');
var log = require('middlewares/logger')(__filename).log;

NaviEntry.setRedisClient(require('./redis'));

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
  var logData = {
    tx: true
  };
  log.info(logData, 'api.loginSuperUser');
  superUser.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, function (err) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'api.loginSuperUser error');
    } else {
      log.trace(logData, 'api.loginSuperUser success');
    }
    cb(err);
  });
};
/**
 * creates runnable api client and appends to request
 * if options or non browser request, login as super user
 * @return {object} middleware
 */
api.createClient = function (req, res, next) {
  var logData = {
    tx: true,
    isBrowser: req.isBrowser,
    method: req.method.toLowerCase()
  };
  log.info(logData, 'api.createClient');
  var runnableOpts = {
    requestDefaults: {
      headers: {
        'user-agent': 'navi'
      },
    },
  };
  if (req.method.toLowerCase() ===  'options' || !req.isBrowser) {
    log.trace(logData, 'api.createClient session check bypass');
    req.apiClient = superUser;
    return next();
  }
  var cookie = req.session.apiCookie;
  if (cookie) {
    log.trace(put({
      cookie: cookie
    }, logData), 'api.createClient session api cookie');
    runnableOpts.requestDefaults.headers.Cookie = cookie;
  } else {
    log.trace(logData, 'api.createClient session api cookie - no cookie');
  }
  req.apiClient = new Runnable(process.env.API_HOST, runnableOpts);
  next();
};
/**
 * Attempts to find a backend host to route request to.
 * First checks user mapping then checks dependencies
 * and sets req.targetHost if host found
 * @param  {object}   req  express request
 * @param  {object}   res  express response
 * @param  {Function} next express next
 */
api.getTargetHost = function (req, res, next) {
  var reqUrl = api._getUrlFromRequest(req);
  var client = req.apiClient;
  // origin is the url from which the request came from
  // referer is set by older browsers, default to that
  var refererUrl = req.headers.origin || req.headers.referer;
  var logData = {
    tx: true,
    reqUrl: reqUrl,
    refererUrl: refererUrl
  };
  log.info(logData, 'api.getTargetHost');

  checkUrl();

  function checkUrl () {
    // reqUrl entry backendUrl is navi, no need to check existance.
    var urlEntry = req.urlEntry = NaviEntry.createFromUrl(reqUrl);

    // log data specific to checkUrl function
    var checkUrlLogData = put({urlEntry: urlEntry}, logData);
    log.info(checkUrlLogData, 'api.getTargetHost checkUrl');

    urlEntry.getInfo(function (err, info) {
      if (err) {
        log.error(put({
          err: err
        }, checkUrlLogData), 'api.getTargetHost checkUrl urlEntry.getInfo error');
        return next(err);
      } else {
        checkUrlLogData = put({ info: info }, checkUrlLogData);
        log.trace(checkUrlLogData, 'api.getTargetHost checkUrl urlEntry.getInfo success');
      }
      var instanceName = info.instanceName;
      var instances = client.fetchInstances({
        name: instanceName,
        'owner.github': info.ownerGithub
      }, function (err) {
        if (err) {
          log.error(put({
            err: err
          }, checkUrlLogData),
          'api.getTargetHost checkUrl urlEntry.getInfo client.fetchInstances error');
          return next(err);
        }
        var instance = instances.models[0];
        if (!instance) {
          log.warn(checkUrlLogData,
                   'api.getTargetHost checkUrl urlEntry.getInfo client.fetchInstances !instance');
          return next(ErrorCat.create(404, 'mapped instance no longer exists'));
        }
        // extend meta-data for all subsequent logs with instance
        checkUrlLogData.instance = instance;
        if (info.elastic) {
          // elastic url entry always holds a masterPod name
          log.trace(checkUrlLogData,
                    'api.getTargetHost checkUrl urlEntry.getInfo client.fetchInstances '+
                    'info.elastic');
          api._handleElasticUrl(client, reqUrl, refererUrl, instance, proxyToContainer);
        }
        else { // direct url
          if (!req.isBrowser) {
            log.trace(checkUrlLogData,
                      'api.getTargetHost checkUrl urlEntry.getInfo client.fetchInstances '+
                      '!req.isBrowser');
            return handleInstance(null, instance, url.parse(reqUrl).port, proxyToContainer);
          }
          log.trace(checkUrlLogData,
                    'api.getTargetHost checkUrl urlEntry.getInfo client.fetchInstances '+
                    'req.isBrowser');
          // set mapping and redirect to elastic url
          api._handleDirectUrl(urlEntry, client, instance, redirectToElastic);
        }
      });
    });
  }
  function redirectToElastic (err, hostname) {
    var redirectToElasticLogData = put({
      hostname: hostname
    }, logData);
    log.info(redirectToElasticLogData, 'api.getTargetHost redirectToElastic');
    if (err) {
      log.error(put({
        err: err
      }, redirectToElasticLogData), 'api.getTargetHost redirectToElastic error');
      return next(err);
    }
    var parsed = assign(url.parse(reqUrl), {
      hostname: hostname
    });
    delete parsed.host;
    var redirectUrl = url.format(parsed);
    log.trace(put({
      redirectUrl: redirectUrl
    }, redirectToElasticLogData), 'api.getTargetHost redirectToElastic res.redirect');
    res.redirect(redirectUrl);
  }
  function proxyToContainer (err, containerUrl, targetInstance) {
    var proxyToContainerLogData = put({
      containerUrl: containerUrl,
      targetInstance: targetInstance
    }, logData);
    log.info(proxyToContainerLogData, 'api.getTargetHost proxyToContainer');
    if (err) {
      log.error(put({
        err: err
      }, proxyToContainerLogData), 'api.getTargetHost proxyToContainer error');
      return next(err);
    }
    log.trace(proxyToContainerLogData, 'api.getTargetHost proxyToContainer success');
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
 * @param {Instance} targetInstance instance being proxied to
 */
api._handleDirectUrl = function (urlEntry, client, instance, cb) {
  urlEntry.directKey = urlEntry.key;
  var elasticHostname = urlEntry.getElasticHostname(instance.attrs.shortHash);
  var logData = {
    tx: true,
    urlEntry: urlEntry,
    client: client,
    instance: instance,
    elasticHostname: elasticHostname
  };
  log.info(logData, 'api._handleDirectUrl');
  client.createRoute({
    srcHostname: elasticHostname,
    destInstanceId: instance.attrs._id
  }, function (err) {
    if (err && /hello.*runnable/i.test(err.message)) {
      log.error(put({
        err: err
      }, logData), 'api._handleDirectUrl client.createRoute error');
      err = null;
    } else {
      log.trace(logData, 'api._handleDirectUrl client.createRoute success');
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
  var logData = {
    tx: true,
    client: client,
    elasticUrl: elasticUrl,
    refererUrl: refererUrl,
    instance: masterInstance,
    parsedElasticUrl: parsedElasticUrl
  };
  log.info(logData, 'api._handleElasticUrl');
  checkReferer(cb);
  function checkReferer (cb) {
    log.info(logData, 'api._handleElasticUrl checkReferer');
    if (!refererUrl) {
      log.trace(logData, 'api._handleElasticUrl checkReferer !refererUrl');
      return checkForMapping(boxSelectionUrl, cb);
    }
    var refererHostname = url.parse(refererUrl).hostname;
    if (refererHostname === 'localhost') {
      log.trace(logData, 'api._handleElasticUrl checkReferer localhost');
      return checkForMapping(masterUrl, cb);
    }
    else if (refererHostname.toLowerCase() === elasticHostname.toLowerCase()) {
      // referer is self, mapping should hit, else master
      log.trace(logData,
                'api._handleElasticUrl checkReferer refererHostname === elasticHostname');
      return checkForMapping(masterUrl, cb);
    }
    var refererEntry = NaviEntry.createFromUrl(refererUrl);

    refererEntry.exists(function (err, entryExists) {
      if (err) {
        log.error(put({
          err: err
        }, logData), 'api._handleElasticUrl checkReferer refererEntry.exists error');
        return cb(err);
      }
      if (entryExists) {
        log.trace(put({
          entryExists: entryExists
        }, logData),
        'api._handleElasticUrl checkReferer refererEntry.exists entryExists');
        return checkForAssociations(refererHostname, cb);
      }
      log.trace(put({
        entryExists: entryExists
      }, logData),
      'api._handleElasticUrl checkReferer refererEntry.exists !entryExists');
      checkForMapping(boxSelectionUrl, cb);
    });
  }
  function checkForAssociations(refererHostname, cb) {
    var checkForAssociationsLogData = put({
      refererHostname: refererHostname
    }, logData);
    log.info(checkForAssociationsLogData, 'api._handleElasticUrl checkForAssociations');
    findUserMapping(refererHostname, function (err, refererRoute) {
      if (err) {
        log.error(put({
          err: err
        }, checkForAssociationsLogData),
        'api._handleElasticUrl checkForAssociations findUserMapping error');
        return cb(err);
      }
      checkForAssociationsLogData = put({
        refererRoute: refererRoute
      }, checkForAssociationsLogData);
      if (!refererRoute) {
        log.trace(checkForAssociationsLogData,
                  'api._handleElasticUrl checkForAssociations findUserMapping !refererRoute');
        return checkForMapping(masterUrl, cb);
      }
      log.trace(checkForAssociationsLogData,
                'api._handleElasticUrl checkForAssociations findUserMapping success');
      client
        .newInstance(refererRoute.destInstanceId)
        .fetchDependencies({
          hostname: elasticHostname
        }, function (err, associations) {
          if (err) {
            log.error(put({
              err: err
            }, checkForAssociationsLogData),
            'api._handleElasticUrl checkForAssociations findUserMapping fetchDependencies error');
            return cb(err);
          }
          checkForAssociationsLogData.associations = associations;
          var assoc = associations[0];
          if (assoc) {
            log.trace(checkForAssociationsLogData,
                      'api._handleElasticUrl checkForAssociations findUserMapping '+
                        'fetchDependencies association found');
            var assocInstance = client.fetchInstance(assoc.id, function (err) {
              if (err) {
                log.error(put({
                  err: err
                }, checkForAssociationsLogData),
                'api._handleElasticUrl checkForAssociations findUserMapping fetchDependencies '+
                'fetchInstance error');
              }
              else {
                log.trace(checkForAssociationsLogData,
                          'api._handleElasticUrl checkForAssociations findUserMapping '+
                          'fetchDependencies fetchInstance success');
              }
              handleInstance(err, assocInstance, parsedElasticUrl.port, cb);
            });
          }
          else {
            log.warn(checkForAssociationsLogData,
                     'api._handleElasticUrl checkForAssociations findUserMapping '+
                     'fetchDependencies no association found');
            // bc this has a referer that is a user-content-url,
            // we can assume this is ajax, and should be routed to fallback
            // Note: the elastic entries name value will match the master pod instance's name
            masterUrl();
          }
        });
    });
  }
  function checkForMapping (noRouteHandler, cb) {
    var checkForMappingLogData = put({
      noRouteHandler: noRouteHandler
    }, logData);
    log.info(checkForMappingLogData, 'api._handleElasticUrl checkForMapping');
    findUserMapping(elasticHostname, function (err, route) {
      if (err) {
        log.error(put({
          err: err
        }, checkForMappingLogData), 'api._handleElasticUrl checkForMapping findUserMapping error');
        return cb(err);
      }
      if (!route) {
        log.warn(put({
          err: err
        }, checkForMappingLogData), 'api._handleElasticUrl checkForMapping findUserMapping !route');
        return noRouteHandler();
      }
      checkForMappingLogData = put({ route: route }, checkForMappingLogData);
      log.trace(checkForMappingLogData,
                'api._handleElasticUrl checkForMapping findUserMapping !route');
      var mappedInstance = client.fetchInstance(route.destInstanceId, function (err) {
        if (err) {
          log.error(put({
            err: err
          }, checkForMappingLogData),
          'api._handleElasticUrl checkForMapping findUserMapping client.fetchInstance error');
        } else {
          checkForMappingLogData.instance = mappedInstance;
          log.trace(checkForMappingLogData,
                    'api._handleElasticUrl checkForMapping findUserMapping client.fetchInstance '+
                    'success');
        }
        handleInstance(err, mappedInstance, parsedElasticUrl.port, cb);
      });
    });
  }
  var _routes;
  function findUserMapping (hostname, cb) {
    var findUserMappingLogData = put({
      hostname: hostname
    }, logData);
    log.info(findUserMappingLogData, 'api._handleElasticUrl findUserMapping');
    if (_routes) {
      log.trace(put({
        routes: _routes
      }, findUserMappingLogData), 'api._handleElasticUrl findUserMapping _routes');
      // cache hit
      return handleRoutes(_routes);
    } else {
      log.trace(findUserMappingLogData, 'api._handleElasticUrl findUserMapping !_routes');
    }
    client.fetchRoutes(function (err, routes) {
      if (err) {
        log.error(put({
          err: err
        }, findUserMappingLogData),
        'api._handleElasticUrl findUserMapping client.fetchRoutes error');
        return cb(err);
      }
      var findUserMappingLogDataFetchRoutes = put({
        routes: routes
      }, findUserMappingLogData);
      log.error(findUserMappingLogDataFetchRoutes,
        'api._handleElasticUrl findUserMapping client.fetchRoutes success');
      // cache it to avoid second call (1: refUrl mapping, 2: reqUrl mapping)
      _routes = routes;
      handleRoutes(routes);
    });
    function handleRoutes (routes) {
      var route = find(routes, hasKeypaths({
        'srcHostname.toLowerCase()': hostname.toLowerCase()
      }));
      var handleRoutesLogData = put({
        routes: routes,
        route: route
      }, logData);
      log.info(handleRoutesLogData, 'api._handleElasticUrl handleRoutes');
      cb(null, route);
    }
  }
  function masterUrl () {
    log.info(put({
      instance: masterInstance,
      port: parsedElasticUrl.port
    }, logData), 'api._handleElasticUrl masterUrl');
    // Note: Master pod instance's name will match the name in the elastic navi entry
    handleInstance(null, masterInstance, parsedElasticUrl.port, cb);
  }
  function boxSelectionUrl () {
    log.info(logData, 'api._handleElasticUrl boxSelectionUrl');
    // TODO: redirect to box selection
    masterUrl();
  }
};

function handleInstance (err, instance, port, cb) {
  var logData = {
    tx: true,
    instance: instance,
    port: port
  };
  log.info(logData, 'handleInstance');
  if (err) {
    log.error(put({ err: err }, logData), 'handleInstance error');
    return cb(err);
  }
  log.trace(logData, 'handleInstance success');

  var state = instance.status();
  if (state !== 'running') {
    log.trace(put({
      state: state
    }, logData), 'handleInstance state !running');
    return cb(null, errorPage.generateErrorUrl('dead', instance), instance);
  }
  log.trace(put({
    state: state
  }, logData), 'handleInstance state running');

  instance.getContainerUrl(port, function (err, url) {
    if (err) {
      // if error is not boom, statusCode is null
      var statusCode = keypather.get(err, 'output.statusCode');
      var getContainerUrlLogData = put({
        err: err,
        statusCode: statusCode
      }, logData);
      log.error(getContainerUrlLogData, 'handleInstance instance.getContainerUrl error');
      // error code 504 and 503 come from api client. they mean the container has error
      // look at getContainerUrl function on instance model
      if (statusCode === 504 ||
          statusCode === 503) {
        log.trace(getContainerUrlLogData,
                  'handleInstance instance.getContainerUrl error 504 || 503');
        return cb(null, errorPage.generateErrorUrl('dead', instance), instance);
      }
      // redirect to port not exposed page
      if (statusCode === 400) {
        log.trace(getContainerUrlLogData, 'handleInstance instance.getContainerUrl error 400');
        return cb(null, errorPage.generateErrorUrl('ports', instance), instance);
      }

      log.trace(getContainerUrlLogData, 'handleInstance instance.getContainerUrl error no '+
                'statusCode match');
      return cb(err);
    }
    log.trace(put({
      url: url
    }, logData), 'handleInstance instance.getContainerUrl success');
    return cb(null, url, instance);
  });
}
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
  var logData = {
    tx: true,
    req: req,
    host: host,
    split: split,
    numSubDomains: numSubDomains
  };
  log.info(logData, 'api._getUrlFromRequest');
  // append 80 if port not in url
  if (!~host.indexOf(':')) {
    host = host + ':80';
  }
  // we only support https on port 443
  var protocol = host.split(':')[1] === '443' ?
    'https://' : 'http://';

  log.info(put({
    returnVal: protocol + host
  }, logData), 'api._getUrlFromRequest final return');
  return protocol + host;
};
/**
 * make a request for self to check if authorized
 * if not, redirect for authorization
 * @return  {Function} middleware
 */
api.checkIfLoggedIn = function (req, res, next) {
  var logData = {
    tx: true,
    req: req,
    authTried: req.session.authTried,
    url: api._getUrlFromRequest(req)
  };
  log.info(logData, 'api.checkIfLoggedIn');
  req.apiClient.fetch('me', function (err) {
    if (err) {
      log.error(put({
        err: err
      }, logData), 'api.checkIfLoggedIn req.apiClient.fetch me error');
      if (isUnauthorizedErr(err)) {
        var url = api._getUrlFromRequest(req);
        req.redirectUrl = req.apiClient.getGithubAuthUrl(url, req.session.authTried);
        log.trace(put({
          err: err,
          url: url,
          redirectUrl: req.redirectUrl
        }, logData), 'api.checkIfLoggedIn req.apiClient.fetch me error - isUnauthorizedErr');
        // first attempt should be redirect
        if (req.session.authTried) {
          // error pages use proxy to retain url in address bar.
          req.targetHost = errorPage.generateErrorUrl('signin', {
            redirectUrl: req.redirectUrl
          });
          log.trace(put({
            err: err,
            url: url,
            redirectUrl: req.redirectUrl,
            session: req.session,
            targetHost: req.targetHost
          }, logData),
          'api.checkIfLoggedIn req.apiClient.fetch me error - isUnauthorizedErr '+
          'req.session.authTried');
          delete req.redirectUrl;
        } else {
          log.trace(put({
            err: err,
            url: url,
            redirectUrl: req.redirectUrl,
            session: req.session,
          }, logData),
          'api.checkIfLoggedIn req.apiClient.fetch me error - isUnauthorizedErr '+
          '!req.session.authTried');
        }
        req.session.authTried = true;
        return next();
      } else {
        log.error(put({
          err: err
        }, logData), 'api.checkIfLoggedIn req.apiClient.fetch me error !isUnauthorizedErr');
      }
      return next(err);
    }
    log.trace(logData, 'api.checkIfLoggedIn req.apiClient.fetch me success');
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
