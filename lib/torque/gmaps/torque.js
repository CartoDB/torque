var carto = global.carto || require('carto');
var torque = require('../');
var CanvasLayer = require('./CanvasLayer');
var CanvasTileLayer = require('./canvas_tile_layer');
var GMapsTileLoader = require('./gmaps_tileloader_mixin');

function GMapsTorqueLayer(options) {
  var self = this;
  if (!torque.isBrowserSupported()) {
    throw new Error("browser is not supported by torque");
  }
  this.keys = [0];
  Object.defineProperty(this, 'key', {
    get: function() {
      return this.getKey();
    }
  });
  this.shader = null;
  this.ready = false;
  this.options = torque.extend({}, options);
  this.options = torque.extend({
    provider: 'windshaft',
    renderer: 'point',
    resolution: 2,
    steps: 100,
    visible: true
  }, this.options);
  if (options.cartocss) {
    torque.extend(this.options,
        torque.common.TorqueLayer.optionsFromCartoCSS(options.cartocss));
  }

  if(options.tileJSON) this.options.provider = "tileJSON";

  this.hidden = !this.options.visible;

  this.showLimitErrors = options.showLimitErrors;

  this.animator = new torque.Animator(function(time) {
    var k = time | 0;
    if(self.getKey() !== k) {
      self.setKey(k);
    }
  }, torque.extend(torque.clone(this.options), {
    onPause: function() {
      self.fire('pause');
    },
    onStop: function() {
      self.fire('stop');
    },
    onStart: function() {
      self.fire('play');
    },
    onStepsRange: function() {
      self.fire('change:stepsRange', self.animator.stepsRange());
    }
  }));

  this.play = this.animator.start.bind(this.animator);
  this.stop = this.animator.stop.bind(this.animator);
  this.pause = this.animator.pause.bind(this.animator);
  this.toggle = this.animator.toggle.bind(this.animator);
  this.setDuration = this.animator.duration.bind(this.animator);
  this.isRunning = this.animator.isRunning.bind(this.animator);


  CanvasLayer.call(this, {
    animate: false,
    updateHandler: this.render,
    readyHandler: this.initialize
  });

}

/**
 * torque layer
 */
GMapsTorqueLayer.prototype = torque.extend({},
  CanvasLayer.prototype,
  GMapsTileLoader.prototype,
  torque.Event,
  {

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.JsonArray,
    'windshaft': torque.providers.windshaft,
    'tileJSON': torque.providers.tileJSON
  },

  renderers: {
    'point': torque.renderer.Point,
    'pixel': torque.renderer.Rectangle
  },

  initialize: function() {
    var self = this;

    this.onTileAdded = this.onTileAdded.bind(this);

    this.options.ready = function() {
      self.fire("change:bounds", {
        bounds: self.provider.getBounds()
      });
      self.animator.steps(self.provider.getSteps());
      self.animator.rescale();
      self.fire('change:steps', {
        steps: self.provider.getSteps()
      });
      self.setKeys(self.getKeys());
    };

    this.provider = new this.providers[this.options.provider](this.options);
    this.renderer = new this.renderers[this.options.renderer](this.getCanvas(), this.options);
    this.renderer.options.errorCallback = this.options.errorCallback;

    // this listener should be before tile loader
    this._cacheListener = google.maps.event.addListener(this.map, 'zoom_changed', function() {
      self.renderer && self.renderer.clearSpriteCache();
    });

    this._initTileLoader(this.map, this.getProjection());

    if (this.shader) {
      this.renderer.setShader(this.shader);
    }

  },

  hide: function() {
    if(this.hidden) return this;
    this.pause();
    this.clear();
    this.hidden = true;
    return this;
  },

  show: function() {
    if(!this.hidden) return this;
    this.hidden = false;
    this.play();
    if (this.options.steps === 1){
      this.redraw();
    }
    return this;
  },

  setSQL: function(sql) {
    if (this.provider.options.named_map) throw new Error("SQL queries on named maps are read-only");
    if (!this.provider || !this.provider.setSQL) {
      throw new Error("this provider does not support SQL");
    }
    this.provider.setSQL(sql);
    this._reloadTiles();
    return this;
  },

  setBlendMode: function(_) {
    this.renderer && this.renderer.setBlendMode(_);
    this.redraw();
  },

  setSteps: function(steps) {
    this.provider && this.provider.setSteps(steps);
    this.animator && this.animator.steps(steps);
    this._reloadTiles();
  },

  setColumn: function(column, isTime) {
    this.provider && this.provider.setColumn(column, isTime);
    this._reloadTiles();
  },

  getTimeBounds: function() {
    return this.provider && this.provider.getKeySpan();
  },

  getCanvas: function() {
    return this.canvas;
  },

    // for each tile shown on the map request the data
  onTileAdded: function(t) {
    var self = this;
    var callback = function (tileData, error) {
      // don't load tiles that are not being shown
      if (t.zoom !== self.map.getZoom()) return;

      self._tileLoaded(t, tileData);

      if (tileData) {
        self.redraw();
      }

      self.fire('tileLoaded');

      if (error) {
        self.fire('tileError', error);
      }
    }

    this.provider.getTileData(t, t.zoom, callback);
  },

  clear: function() {
    var canvas = this.canvas;
    canvas.width = canvas.width;
  },

  /**
   * render the selectef key
   * don't call this function directly, it's called by
   * requestAnimationFrame. Use redraw to refresh it
   */
  render: function() {
    if(this.hidden) return;
    var t, tile, pos;
    var canvas = this.canvas;
    this.renderer.clearCanvas();
    var ctx = canvas.getContext('2d');

    // renders only a "frame"
    for(t in this._tiles) {
      tile = this._tiles[t];
      if (tile) {
        pos = this.getTilePos(tile.coord);
        ctx.setTransform(1, 0, 0, 1, pos.x, pos.y);
        this.renderer.renderTile(tile, this.keys);
      }
    }
    this.renderer.applyFilters();
  },

  getActivePointsBBox: function(step) {
    var positions = [];
    var tileMax = this.options.resolution * (256/this.options.resolution - 1);
    for(var t in this._tiles) {
      var tile = this._tiles[t];
      positions = positions.concat(this.renderer.getActivePointsBBox(tile, step));
    }
    return positions;
  },

  /**
   * set key to be shown. If it's a single value
   * it renders directly, if it's an array it renders
   * accumulated
   */
  setKey: function(key) {
    this.setKeys([key]);
  },

  /**
   * returns the array of keys being rendered
   */
  getKeys: function() {
    return this.keys;
  },

  setKeys: function(keys) {
    this.keys = keys;
    this.animator.step(this.getKey());
    this.redraw();
    this.fire('change:time', { time: this.getTime(), step: this.getKey() });
  },

  getKey: function() {
    return this.keys[0];
  },

  /**
   * helper function, does the same than ``setKey`` but only
   * accepts scalars.
   */
  setStep: function(time) {
    if(time === undefined || time.length !== undefined) {
      throw new Error("setTime only accept scalars");
    }
    this.setKey(time);
  },

  renderRange: function(start, end) {
    this.pause();
    var keys = [];
    for (var i = start; i <= end; i++) {
      keys.push(i);
    }
    this.setKeys(keys);
  },

  resetRenderRange: function() {
    this.stop();
    this.play();
  },

  /**
   * transform from animation step to Date object
   * that contains the animation time
   *
   * ``step`` should be between 0 and ``steps - 1``
   */
  stepToTime: function(step) {
    if (!this.provider) return 0;
    var times = this.provider.getKeySpan();
    var time = times.start + (times.end - times.start)*(step/this.provider.getSteps());
    return new Date(time);
  },

  timeToStep: function(timestamp) {
    if (typeof timestamp === "Date") timestamp = timestamp.getTime();
    if (!this.provider) return 0;
    var times = this.provider.getKeySpan();
    var step = (this.provider.getSteps() * (timestamp - times.start)) / (times.end - times.start);
    return step;
  },

  getStep: function() {
    return this.getKey();
  },

  /**
   * returns the animation time defined by the data
   * in the defined column. Date object
   */
  getTime: function() {
    return this.stepToTime(this.getKey());
  },

  /**
   * set the cartocss for the current renderer
   */
  setCartoCSS: function(cartocss) {
    if (!this.renderer) throw new Error('renderer is not valid');

    if (this.provider && this.provider.options.named_map) {
      console.log('Torque layer: CartoCSS style on named maps is read-only');
      return false;
    }

    var shader = new carto.RendererJS().render(cartocss);
    this.shader = shader;
    if (this.renderer) {
      this.renderer.setShader(shader);
    }

    // provider options
    var options = torque.common.TorqueLayer.optionsFromLayer(shader.findLayer({ name: 'Map' }));
    this.provider && this.provider.setCartoCSS && this.provider.setCartoCSS(cartocss);
    if(this.provider && this.provider.setOptions(options)) {
      this._reloadTiles();
    }
    torque.extend(this.options, options);

    // animator options
    if (options.animationDuration) {
      this.animator.duration(options.animationDuration);
    }

    this.redraw();
    return this;
  },

  redraw: function() {
    this.scheduleUpdate();
  },

  onRemove: function() {
    this.fire('remove');
    CanvasLayer.prototype.onRemove.call(this);
    this.animator.stop();
    this._removeTileLoader();
    google.maps.event.removeListener(this._cacheListener);
  },

  /**
   * return an array with the values for all the pixels active for the step
   */
  getValues: function(step) {
    var values = [];
    step = step === undefined ? this.getKey(): step;
    var t, tile;
    for(t in this._tiles) {
      tile = this._tiles[t];
      this.renderer.getValues(tile, step, values);
    }
    return values;
  },

  getValueForPos: function(x, y, step) {
    step = step === undefined ? this.getKey(): step;
    var t, tile, pos, value = null, xx, yy;
    for(t in this._tiles) {
      tile = this._tiles[t];
      pos = this.getTilePos(tile.coord);
      xx = x - pos.x;
      yy = y - pos.y;
      if (xx >= 0 && yy >= 0 && xx < this.renderer.TILE_SIZE && yy <= this.renderer.TILE_SIZE) {
        value = this.renderer.getValueFor(tile, step, xx, yy);
      }
      if (value !== null) {
        return value;
      }
    }
    return null;
  },

  /** return the number of points for a step */
  pointCount: function(step) {
    var t, tile;
    step = step === undefined ? this.key: step;
    var c = 0;
    for(t in this._tiles) {
      tile = this._tiles[t];
      if (tile) {
        c += tile.timeCount[step];
      }
    }
    return c;
  },

  getValueForBBox: function(x, y, w, h) {
    var xf = x + w, yf = y + h;
    var sum = 0;
    for(_y = y; y<yf; y+=this.options.resolution){
      for(_x = x; x<xf; x+=this.options.resolution){
        var thisValue = this.getValueForPos(_x,_y);
        if (thisValue){
          var bb = thisValue.bbox;
          var proj = this.getProjection()
          var xy = proj.fromLatLngToContainerPixel(new google.maps.LatLng(bb[1].lat, bb[1].lon));
          if(xy.x < xf && xy.y < yf){
            sum += thisValue.value;
          }
        }
      }
    }
    return sum;
  },

  error: function (callback) {
    this.options.errorCallback = callback;
    return this;
  }

});



function GMapsTiledTorqueLayer(options) {
  this.options = torque.extend({}, options);
  CanvasTileLayer.call(this, this._loadTile.bind(this), this.drawTile.bind(this));
  this.initialize(options);
}

GMapsTiledTorqueLayer.prototype = torque.extend({}, CanvasTileLayer.prototype, {

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.JsonArray
  },

  renderers: {
    'point': torque.renderer.Point,
    'pixel': torque.renderer.Rectangle
  },

  initialize: function(options) {
    var self = this;
    this.keys = [0];

    this.options.renderer = this.options.renderer || 'pixel';
    this.options.provider = this.options.provider || 'sql_api';

    this.provider = new this.providers[this.options.provider](options);
    this.renderer = new this.renderers[this.options.renderer](null, options);

  },

  _tileLoaded: function(tile, tileData) {
    tile.data = tileData;
    this.drawTile(tile);
  },

  _loadTile: function(tile, coord, zoom) {
    var self = this;
    var limit = 1 << zoom;
    // wrap tile
    var wrappedCoord = {
      x: ((coord.x % limit) + limit) % limit,
      y: coord.y
    };

    this.provider.getTileData(wrappedCoord, zoom, function(tileData) {
      self._tileLoaded(tile, tileData);
    });
  },

  drawTile: function (tile) {
    var canvas = tile.canvas;
    if(!tile.data) return;
    canvas.width = canvas.width;

    this.renderer.setCanvas(canvas);

    var accum = this.renderer.accumulate(tile.data, this.getKey());
    this.renderer.renderTileAccum(accum, 0, 0);
  },

  setKey: function(key) {
    this.keys = [key];
    this.redraw();
  },

  /**
   * set the cartocss for the current renderer
   */
  setCartoCSS: function(cartocss) {
    if (!this.renderer) throw new Error('renderer is not valid');
    return this.renderer.setCartoCSS(cartocss);
  },

  setStepsRange: function(start, end) {
    this.animator.stepsRange(start, end);
  },

  removeStepsRange: function() {
    this.animator.removeCustomStepsRange();
  },

  getStepsRange: function() {
    return this.animator.stepsRange();
  }

});

module.exports = {
    GMapsTiledTorqueLayer: GMapsTiledTorqueLayer,
    GMapsTorqueLayer: GMapsTorqueLayer
};
