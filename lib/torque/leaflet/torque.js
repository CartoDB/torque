var carto = global.carto || require('carto');
var torque = require('../');

require('./canvas_layer');

/**
 * torque layer
 */
L.TorqueLayer = L.CanvasLayer.extend({

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.JsonArray,
    'windshaft': torque.providers.windshaft,
    'splunk': torque.providers.splunk
  },

  renderers: {
    'point': torque.renderer.Point,
    'pixel': torque.renderer.Rectangle
  },

  initialize: function(options) {

    var self = this;
    if (!torque.isBrowserSupported()) {
      throw new Error("browser is not supported by torque");
    }
    options.tileLoader = true;
    this.key = 0;
    this.prevRenderedKey = 0;
    if (options.cartocss) {
      torque.extend(options, torque.common.TorqueLayer.optionsFromCartoCSS(options.cartocss));
    }

    options.resolution = options.resolution || 2;
    options.steps = options.steps || 100;
    options.visible = options.visible === undefined ? true: options.visible;
    this.hidden = !options.visible;

    this.animator = new torque.Animator(function(time) {
      var k = time | 0;
      if(self.key !== k) {
        self.setKey(k, { direct: true });
      }
    }, torque.extend(torque.clone(options), {
      onPause: function() {
        self.fire('pause');
      },
      onStop: function() {
        self.fire('stop');
      },
      onStart: function() {
        self.fire('play');
      }
    }));

    this.play = this.animator.start.bind(this.animator);
    this.stop = this.animator.stop.bind(this.animator);
    this.pause = this.animator.pause.bind(this.animator);
    this.toggle = this.animator.toggle.bind(this.animator);
    this.setDuration = this.animator.duration.bind(this.animator);
    this.isRunning = this.animator.isRunning.bind(this.animator);


    L.CanvasLayer.prototype.initialize.call(this, options);

    this.options.renderer = this.options.renderer || 'point';
    this.options.provider = this.options.provider || 'windshaft';

    options.ready = function() {
      
      self.fire("change:bounds", {
        bounds: self.provider.getBounds()
      });
      self.animator.steps(self.provider.getSteps());
      self.animator.rescale();
      self.fire('change:steps', {
        steps: self.provider.getSteps()
      });
      self.setKey(self.key);
    };

    this.provider = new this.providers[this.options.provider](options);

    this.renderer = new this.renderers[this.options.renderer](this.getCanvas(), options);

    this.renderer.on("allIconsLoaded", this.render.bind(this));


    // for each tile shown on the map request the data
    this.on('tileAdded', function(t) {
 
      var tileData = this.provider.getTileData(t, t.zoom, function(tileData) {

     
        // don't load tiles that are not being shown
        if (t.zoom !== self._map.getZoom()) return;
        self._tileLoaded(t, tileData);
        self._clearTileCaches();
        if (tileData) {
          self.redraw();
        }
      });
    }, this);

  },

  _clearTileCaches: function() {
    var t, tile;
    for(t in this._tiles) {
      tile = this._tiles[t];
      if (tile && tile._tileCache) {
        tile._tileCache = null;
      }
    }
  },

  _clearCaches: function() {
    this.renderer && this.renderer.clearSpriteCache();
    this._clearTileCaches();
  },

  onAdd: function (map) {
    map.on({
      'zoomend': this._clearCaches,
      'zoomstart': this._pauseOnZoom,
    }, this);

    map.on({
      'zoomend': this._resumeOnZoom
    }, this);
    L.CanvasLayer.prototype.onAdd.call(this, map);
  },

  onRemove: function(map) {
    this.fire('remove');
    this._removeTileLoader();
    map.off({
      'zoomend': this._clearCaches,
      'zoomstart': this._pauseOnZoom,
    }, this);
    map.off({
      'zoomend': this._resumeOnZoom
    }, this);
    L.CanvasLayer.prototype.onRemove.call(this, map);
  },

  _pauseOnZoom: function() {
    this.wasRunning = this.isRunning();
    if (this.wasRunning) {
      this.pause();
    }
  },

  _resumeOnZoom: function() {
    if (this.wasRunning) {
      this.play();
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
    this.renderer.setBlendMode(_);
    this.redraw();
  },

  setSteps: function(steps) {
    this.provider.setSteps(steps);
    this._reloadTiles();
  },

  setColumn: function(column, isTime) {
    this.provider.setColumn(column, isTime);
    this._reloadTiles();
  },

  getTimeBounds: function() {
    return this.provider && this.provider.getKeySpan();
  },

  clear: function() {
    var canvas = this.getCanvas();
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
    var canvas = this.getCanvas();
    this.renderer.clearCanvas();
    var ctx = canvas.getContext('2d');

    for(t in this._tiles) {
      tile = this._tiles[t];
      if (tile) {
        // clear cache
        if (this.animator.isRunning()) {
          tile._tileCache = null;
        }

        pos = this.getTilePos(tile.coord);
        ctx.setTransform(1, 0, 0, 1, pos.x, pos.y);

        if (tile._tileCache) {
          // when the tile has a cached image just render it and avoid to render
          // all the points
          this.renderer._ctx.drawImage(tile._tileCache, 0, 0);
        } else {
          this.renderer.renderTile(tile, this.key);
        }
      }
    }
    this.renderer.applyFilters();

    // prepare caches if the animation is not running
    // don't cache if the key has just changed, this avoids to cache
    // when the user is dragging, it only cache when the map is still
    if (!this.animator.isRunning() && this.key === this.prevRenderedKey) {
      var tile_size = this.renderer.TILE_SIZE;
      for(t in this._tiles) {
        tile = this._tiles[t];
        if (tile && !tile._tileCache) {
          var c = tile._tileCache = document.createElement('canvas');
          c.width = c.height = tile_size;
          pos = this.getTilePos(tile.coord);
          // clip bounds, firefox raise an exception when try to get data from outside canvas
          var x = Math.max(0, pos.x)
          var y = Math.max(0, pos.y)
          var w = Math.min(tile_size, this.getCanvas().width - x);
          var h = Math.min(tile_size, this.getCanvas().height - y);
          if (w > 0 && h > 0) {
            c.getContext('2d').drawImage(this.getCanvas(), x, y, w, h, x - pos.x, y - pos.y, w, h);
          }
        }
      }
    }

    this.prevRenderedKey = this.key;

  },

  /**
   * set key to be shown. If it's a single value
   * it renders directly, if it's an array it renders
   * accumulated
   */
  setKey: function(key, options) {
    this.key = key;
    this.animator.step(key);
    this._clearTileCaches();
    this.redraw(options && options.direct);
    this.fire('change:time', { time: this.getTime(), step: this.key });
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

  /**
   * transform from animation step to Date object 
   * that contains the animation time
   *
   * ``step`` should be between 0 and ``steps - 1`` 
   */
  stepToTime: function(step) {
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
    return this.key;
  },

  /**
   * returns the animation time defined by the data
   * in the defined column. Date object
   */
  getTime: function() {
    return this.stepToTime(this.key);
  },

  /**
   * returns an object with the start and end times
   */
  getTimeSpan: function() {
    return this.provider.getKeySpan();
  },

  /**
   * set the cartocss for the current renderer
   */
  setCartoCSS: function(cartocss) {
    if (this.provider.options.named_map) throw new Error("CartoCSS style on named maps is read-only");
    if (!this.renderer) throw new Error('renderer is not valid');
    var shader = new carto.RendererJS().render(cartocss);
    this.renderer.setShader(shader);

    // provider options
    var options = torque.common.TorqueLayer.optionsFromLayer(shader.findLayer({ name: 'Map' }));
    this.provider.setCartoCSS && this.provider.setCartoCSS(cartocss);
    if(this.provider.setOptions(options)) {
      this._reloadTiles();
    }

    torque.extend(this.options, options);

    // animator options
    if (options.animationDuration) {
      this.animator.duration(options.animationDuration);
    }
    this._clearCaches();
    this.redraw();
    return this;
  },

  /**
   * get active points for a step in active zoom
   * returns a list of bounding boxes [[] , [], []]
   * empty list if there is no active pixels
   */
  getActivePointsBBox: function(step) {
    var positions = [];
    for(var t in this._tiles) {
      var tile = this._tiles[t];
      positions = positions.concat(this.renderer.getActivePointsBBox(tile, step));
    }
    return positions;
  },

  /**
   * return the value for position relative to map coordinates. null for no value
   */
  getValueForPos: function(x, y, step) {
    step = step === undefined ? this.key: step;
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

  getValueForBBox: function(x, y, w, h) {
    var xf = x + w, yf = y + h, _x=x;
    var sum = 0;
    for(_y = y; _y<yf; _y+=this.options.resolution){
      for(_x = x; _x<xf; _x+=this.options.resolution){
        var thisValue = this.getValueForPos(_x,_y);
        if (thisValue){
          var bb = thisValue.bbox;
          var xy = this._map.latLngToContainerPoint([bb[1].lat, bb[1].lon]);
          if(xy.x < xf && xy.y < yf){
            sum += thisValue.value;
          }
        }
      }
    }
    return sum;
  },

  invalidate: function() {
    this.provider.reload();
  }
});
