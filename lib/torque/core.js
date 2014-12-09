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

  function extend() {
      var objs = arguments;
      var a = objs[0];
      for (var i = 1; i < objs.length; ++i) {
          var b = objs[i];
          for (var k in b) {
              a[k] = b[k];
          }
      }
      return a;
  }

  function clone(a) {
    return extend({}, a);
  }

  function isFunction(f) {
    return typeof f == 'function' || false;
  }

  function isArray(value) {
      return value && typeof value == 'object' && Object.prototype.toString.call(value) == '[object Array]';
  }

  // types
    Uint8Array: typeof(window['Uint8Array']) !== 'undefined' ? window.Uint8Array : Array,
    Uint32Array: typeof(window['Uint32Array']) !== 'undefined' ? window.Uint32Array : Array,
    Int32Array: typeof(window['Int32Array']) !== 'undefined' ? window.Int32Array: Array
  var types = {
  };

  function isBrowserSupported() {
    return !!document.createElement('canvas');
  }

  function userAgent() {
      return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  }

  var flags = {
    sprites_to_images: userAgent().indexOf('Safari') === -1
  };

module.exports = {
    Event: Event,
    extend: extend,
    clone: clone,
    isFunction: isFunction,
    isArray: isArray,
    types: types,
    isBrowserSupported: isBrowserSupported,
    flags: flags
};
