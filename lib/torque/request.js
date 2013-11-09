(function(exports) {
  var torque = exports.torque = exports.torque || {};
  torque.net = torque.net || {};

  var lastCall = null;

  function jsonp(url, callback, options) {
     options = options || { timeout: 10000 };
     var head = document.getElementsByTagName('head')[0];
     var script = document.createElement('script');

     // function name
     var fnName = 'torque_' + Date.now();

     function clean() {
       head.removeChild(script);
       clearTimeout(timeoutTimer);
       delete window[fnName];
     }

     window[fnName] = function() {
       clean();
       callback.apply(window, arguments);
     };

     // timeout for errors
     var timeoutTimer = setTimeout(function() { 
       clean();
       callback.call(window, null); 
     }, options.timeout);

     // setup url
     url = url.replace('callback=\?', 'callback=' + fnName);
     script.type = 'text/javascript';
     script.src = url;
     script.async = true;
     // defer the loading because IE9 loads in the same frame the script
     // so Loader._script is null
     setTimeout(function() { head.appendChild(script); }, 0);
  }

  function get(url, callback, options) {
    options = options || {
      method: 'GET',
      data: null
    };
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

    req.open(options.method, url, true);
    //req.responseType = 'arraybuffer';
    if (options.data) {
      req.setRequestHeader("Content-type", "application/json");
      //req.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
      req.setRequestHeader("Accept", "*");
    }
    req.send(options.data);
    return req;
  }

  function post(url, data, callback) {
    return get(url, callback, {
      data: data,
      method: "POST"
    });
  }

  torque.net = {
    get: get,
    post: post,
    jsonp: jsonp,
    lastCall: function() { return lastCall; }
  };

})(typeof exports === "undefined" ? this : exports);
