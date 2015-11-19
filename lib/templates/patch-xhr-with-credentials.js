function () {
  /*
   * Runnable Injected Script.
   *  - We use this to protect your applications from unauthorized use.
   *  - Patches `XMLHttpRequest` and `fetch` to always send credentials.
   */
  // script-injector expects a function, which becomes an immediately invoked anonymous function
  'use strict';
  var exists = function (o) {
    return (typeof o !== 'undefined');
  };
  // Runnable containers are ones that contain the runnable domain, or the url doesn't start with http(s)// or //
  var urlIsRunnable = function (url) {
    return typeof url === 'string' && (
        url.indexOf('{{DOMAIN}}') > -1 ||
        !url.match(/^(http:\/\/|https:\/\/|\/\/)/)
      )
  };
  if (exists(window.XMLHttpRequest)) {
    var xhrOpen = XMLHttpRequest.prototype.open;
    // override the native open()
    XMLHttpRequest.prototype.open = function (method, url) {
      // always send credentials if we are hitting runnable containers
      if (urlIsRunnable(url)) {
        this.withCredentials = true;
      }
      xhrOpen.apply(this, arguments);
    };
  }
  if (exists(window.fetch)) {
    var fetch = window.fetch;
    // override the native fetch()
    window.fetch = function () {
      var args = Array.prototype.slice.call(arguments);
      var url = args[0];
      if (typeof url === 'object') {
        // This is a request object, so fetch the url from the object itself
        url = url.url
      }
      if (urlIsRunnable(url)) {
        var opts = args[1] = args[1] || {};
        // always send credentials
        opts.credentials = 'include';
      }
      fetch.apply(this, args);
    };
  }
}
