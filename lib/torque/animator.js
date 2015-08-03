var torque = require('./');

var requestAnimationFrame = global.requestAnimationFrame
    || global.mozRequestAnimationFrame
    || global.webkitRequestAnimationFrame
    || global.msRequestAnimationFrame
    || function(callback) { return global.setTimeout(callback, 1000 / 60); };

var cancelAnimationFrame = global.cancelAnimationFrame
    || global.mozCancelAnimationFrame
    || global.webkitCancelAnimationFrame
    || global.msCancelAnimationFrame
    || function(id) { clearTimeout(id); };

  /**
   * options:
   *    animationDuration in seconds
   *    animationDelay in seconds
   */
  function Animator(callback, options) {
    if(!options.steps) {
      throw new Error("steps option missing")
    }
    this.options = options;
    this.running = false;
    this._tick = this._tick.bind(this);
    this._t0 = +new Date();
    this.callback = callback;
    this._time = 0.0;
    this.itemsReady = false;

    this.options = torque.extend({
        animationDelay: 0,
        maxDelta: 0.2,
        loop: options.loop === undefined ? true : options.loop
    }, this.options);

    this.rescale();

  }


  Animator.prototype = {

    start: function() {
        this.running = true;
        requestAnimationFrame(this._tick);
        this.options.onStart && this.options.onStart();
        if(this.options.steps === 1){
          this.running = false;
        }
    },

    isRunning: function() {
      return this.running;
    },

    stop: function() {
      this.pause();
      this.time(0);
      this.options.onStop && this.options.onStop();
    },

    // real animation time
    time: function(_) {
      if (!arguments.length) return this._time;
      this._time = _;
      var t = this.range(this.domain(this._time));
      this.callback(t);
    },

    toggle: function() {
      if (this.running) {
        this.pause()
      } else {
        this.start()
      }
    },

    rescale: function() {
      this.domainInv = torque.math.linear(this.options.animationDelay, this.options.animationDelay + this.options.animationDuration);
      this.domain = this.domainInv.invert();
      this.range = torque.math.linear(0, this.options.steps);
      this.rangeInv = this.range.invert();
      this.time(this._time);
      this.running? this.start(): this.pause();
      return this;
    },

    duration: function(_) {
      if (!arguments.length)  return this.options.animationDuration;
      this.options.animationDuration = _;
      if (this.time() > _) {
        this.time(0);
      }
      this.rescale();
      return this;
    },

    steps: function(_) {
      this.options.steps = _;
      return this.rescale();
    },

    step: function(s) {
      if(arguments.length === 0) return this.range(this.domain(this._time));
      this._time = this.domainInv(this.rangeInv(s));
    },

    pause: function() {
      this.running = false;
      cancelAnimationFrame(this._tick);
      this.options.onPause && this.options.onPause();
    },

    _tick: function() {
      var t1 = +new Date();
      var delta = (t1 - this._t0)*0.001;
      // if delta is really big means the tab lost the focus
      // at some point, so limit delta change
      delta = Math.min(this.options.maxDelta, delta);
      this._t0 = t1;
      this._time += delta;
      if(this.step() >= this.options.steps) {
        if(!this.options.loop){
          // set time to max time
          this.time(this.options.animationDuration);
          this.pause();
        } else {
          this._time = 0;
        }
      }
      if(this.running) {
        this.time(this._time);
        requestAnimationFrame(this._tick);
      }
    }

  };

module.exports = Animator;
