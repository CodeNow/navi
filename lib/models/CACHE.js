'use strict';

var c = {};

c.get = function (/* keys... */) {
  var args = Array.prototype.slice.call(arguments);

  return c.data[args.join(':')];
};

c.set = function (/* keys..., val */) {
  var args = Array.prototype.slice.call(arguments);
  var val = args.pop();

  c.data[args.join(':')] = val;
};

c.data = {};

c.clear = function () {
  c.data = {};
};

module.exports = c;