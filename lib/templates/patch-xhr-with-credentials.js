function () {
  // script-injector expects a function
  'use strict';
  var exists = function (o) {
    return (typeof o !== 'undefined');
  };
  if (exists(XMLHttpRequest)) {
      var xhrOpen = XMLHttpRequest.prototype.open;
      // override the native open()
      XMLHttpRequest.prototype.open = function () {
          // always send credentials
          this.withCredentials = true;
          xhrOpen.apply(this, arguments);
      };
  }
  if (exists(fetch)) {
    var fetch = window.fetch;
    // override the native fetch()
    window.fetch = function () {
      var args = Array.prototype.slice.call(arguments);
      var opts = args[1] = args[1] || { };
      // always send credentials
      opts.credentials = 'include';
      fetch.apply(this, args);
    };
  }
}