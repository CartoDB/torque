(function(exports) {

  exports.torque = exports.torque || {};

  function clamp(a, b) {
    return function(t) {
      return Math.max(Math.min(t, b), a);
    };
  }

  function invLinear(a, b, options) {
    var c;
    if (options && options.extrapolate) {
      c = function(t) { return t; };
    } else {
      c = clamp(0, 1.0);
    }
    return function(t) {
      return c((t - a)/(b - a));
    };
  }

  function linear(a, b, options) {
    var c ;
    if (options && options.extrapolate) {
      c = function(t) { return t; };
    } else {
      c = clamp(a, b);
    }
    function _linear(t) {
      return c(a*(1.0 - t) + t*b);
    }

    _linear.invert = function(options) {
      return invLinear(a, b, options);
    };

    return _linear;
  }

  exports.torque.math = {
    clamp: clamp,
    linear: linear,
    invLinear: invLinear
  };

})(typeof exports === "undefined" ? this : exports);

