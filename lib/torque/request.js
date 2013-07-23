(function(exports) {
  var torque = exports.torque = exports.torque || {};
  torque.net = torque.net || {};

  function get(url, callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (req.readyState == 4){
        if (req.status == 200){
          callback(req);
        } else {
          callback(null);
        }
      }
    };

    req.open("GET", url, true);
    //req.responseType = 'arraybuffer';
    req.send(null)
    return req;
  }

  torque.net = {
    get: get
  };

})(typeof exports === "undefined" ? this : exports);
