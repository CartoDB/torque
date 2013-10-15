(function(exports) {
  var torque = exports.torque = exports.torque || {};
  torque.net = torque.net || {};

  var lastCall = null;

  function get(url, callback) {
    lastCall = { url: url, callback: callback };
    var request = XMLHttpRequest;
    // from d3.js
    if (window.XDomainRequest
        && !("withCredentials" in request)
        && /^(http(s)?:)?\/\//.test(url)) request = XDomainRequest;
    var req = new request();


    function respond() {
      var status = req.status, result;
      if (!status && req.responseText || status >= 200 && status < 300 || status === 304) {
        callback(req);
      } else {
        callback(null);
      }
    }

    "onload" in req
      ? req.onload = req.onerror = respond
      : req.onreadystatechange = function() { req.readyState > 3 && respond(); };

    req.open("GET", url, true);
    //req.responseType = 'arraybuffer';
    req.send(null)
    return req;
  }

  torque.net = {
    get: get,
    lastCall: function() { return lastCall; }
  };

})(typeof exports === "undefined" ? this : exports);
