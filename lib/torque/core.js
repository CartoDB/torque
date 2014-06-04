(function(exports) {

  exports.torque = exports.torque || {};

  var Event = {};
  Event.on = function(evt, callback) {
      var cb = this._evt_callbacks = this._evt_callbacks || {};
      var l = cb[evt] || (cb[evt] = []);
      l.push(callback);
      return this;
  };

  Event.trigger = function(evt) {
      var c = this._evt_callbacks && this._evt_callbacks[evt];
      for(var i = 0; c && i < c.length; ++i) {
          c[i].apply(this, Array.prototype.slice.call(arguments, 1));
      }
      return this;
  };

  Event.fire = Event.trigger;

  Event.off = function (evt, callback) {
      var c = this._evt_callbacks && this._evt_callbacks[evt];
      if (c && !callback) {
        delete this._evt_callbacks[evt];
        return this;
     }
     var remove = [];
     for(var i = 0; c && i < c.length; ++i) {
       if(c[i] === callback) remove.push(i);
     }
     while((i = remove.pop()) !== undefined) c.splice(i, 1);
    return this;
  };

  Event.callbacks = function(evt) {
    return (this._evt_callbacks && this._evt_callbacks[evt]) || [];
  };

  exports.torque.Event = Event;


  // types
  exports.torque.types = {
    Uint8Array: typeof(window['Uint8Array']) !== 'undefined' ? window.Uint8Array : Array,
    Uint32Array: typeof(window['Uint32Array']) !== 'undefined' ? window.Uint32Array : Array,
    Int32Array: typeof(window['Int32Array']) !== 'undefined' ? window.Int32Array: Array
  };

  exports.torque.isBrowserSupported = function() {
    return !!document.createElement('canvas');
  };

})(typeof exports === "undefined" ? this : exports);
