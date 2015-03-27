'use strict';
var Runnable = require('runnable');
var removeUrlPath = require('remove-url-path');

function ApiClient () {
  var self = this;
  Runnable.call(this, process.env.API_HOST);
  this.loginQueue = []; /*[{ method:'method', args:[] }]*/
  this.loggedIn = false;
  this.loginWithHelloRunnable(function (err) {
    if (err) { throw err; }
    self.loggedIn = true;
    while (self.loginQueue.length) {
      var task = self.loginQueue.pop();
      self[task.method].apply(self, task.args);
    }
  });
}

require('util').inherits(ApiClient, Runnable);

ApiClient.prototype.getBackend = function () {};

/**
 * authenticate this runnable api client with a moderator session (hello runnable)
 * @param  {Function} cb callback
 */
ApiClient.prototype.loginWithHelloRunnable = function (cb) {
  var token = process.env.HELLO_RUNNABLE_GITHUB_TOKEN;
  this.githubLogin(token, cb);
};

/**
 * ensure the client is authenticated or queue until it is.
 * @param  {String}  method    instance method being called
 * @param  {Array}   args      instance method arguments
 * @return {Boolean} loggedIn  if the client is logged in and the method should not be queued
 */
ApiClient.prototype.ensureAuth = function (method, args) {
  if (this.loggedIn) { return true; }
  this.loginQueue.push({
    method: method,
    args: args
  });
};

/**
 * get backend url for a master pod instance url
 * @param  {String}   url        master pod instance url
 * @param  {String}   name       master pod instance name
 * @param  {String}   [referer]  http request referer (possible pod instance url) (optional)
 * @param  {Function} cb         callback(err, instance)
 */
ApiClient.prototype.fetchInstanceForUrl = function (url, name, referer, cb) {
  if (!this.ensureAuth('fetchInstanceForUrl', arguments)) { return; }
  if (typeof referer === 'function') {
    cb = referer;
    referer = null;
  }
  var self = this;
  var query = {
    url: removeUrlPath(url),
    name: name
  };
  var instances = this.fetchInstances(query, function (err) {
    if (err) { return cb(err); }
    var masterInstance = instances.models[0];

    if (!masterInstance) {
      return cb(new Error('master instance not found')); // TODO: boom 404 or not configured
    }
    if (!referer) {
      return cb(null, masterInstance);
    }
    var context = masterInstance.attrs.contextVersion.context;
    var githubUsername = masterInstance.attrs.owner.username;
    var query2 = {
      url: removeUrlPath(referer),
      githubUsername: githubUsername
    };
    self.fetchInstanceDepWithContext(query2, context, function (err, depInstance) {
      if (err) { return cb(err); }
      cb(null, depInstance || masterInstance);
    });
  });
};

/**
 * find an instance with the query and find its dependency with the context
 * @param  {String} query          instance url
 * @param  {String} githubUsername instance owner github username
 * @param  {String} context        context of dependency to find
 * @param  {String} cb             callback(err, instance)
 */
ApiClient.prototype.fetchInstanceDepWithContext = function (query, context, cb) {
  if (!this.ensureAuth('fetchInstanceDepWithContext', arguments)) { return; }
  var instances = this.fetchInstances(query, function (err) {
    if (err) { return cb(err); }
    var instance = instances.models[0];

    if (!instance) {
      return cb();
    }
    var query2 = { 'contextVersion.context': context };
    var deps = instance.fetchDependencies(query2, function (err) {
      cb(err, deps.models[0]);
    });
  });
};

module.exports = ApiClient;
