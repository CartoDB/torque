if(typeof(L) !== 'undefined') {
/**
 * torque layer
 */
L.TorqueLayer = L.CanvasLayer.extend({

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.jsonarray,
    'windshaft': torque.providers.windshaft
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
    if (options.cartocss) {
      _.extend(options, torque.common.TorqueLayer.optionsFromCartoCSS(options.cartocss));
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
    }, options);

    this.play = this.animator.start.bind(this.animator);
    this.stop = this.animator.stop.bind(this.animator);
    this.pause = this.animator.pause.bind(this.animator);
    this.toggle = this.animator.toggle.bind(this.animator);
    this.setDuration = this.animator.duration.bind(this.animator);
    this.isRunning = this.animator.isRunning.bind(this.animator);


    L.CanvasLayer.prototype.initialize.call(this, options);

    //this.options.renderer = this.options.renderer || 'point';
    this.options.provider = this.options.provider || 'windshaft';
    this.renderer = new WebGLRenderer(this._canvas);

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
    //this.renderer = new this.renderers[this.options.renderer](this.getCanvas(), options);


    // for each tile shown on the map request the data
    this.on('tileAdded', function(t) {
      var tileData = this.provider.getTileData(t, t.zoom, function(tileData) {
        // don't load tiles that are not being shown
        if (t.zoom !== self._map.getZoom()) return;

        // prepare vb
        var xy = [];
        var keys = {}
        var init, end;
        for(var key = 0; key < tileData.maxDate; ++key) {
          init = xy.length/2;
          var activePixels = tileData.timeCount[key];
          if(activePixels) {
            var pixelIndex = tileData.timeIndex[key];
            for(var p = 0; p < activePixels; ++p) {
              var posIdx = tileData.renderDataPos[pixelIndex + p];
              var c = tileData.renderData[pixelIndex + p];
              xy.push(tileData.x[posIdx]);
              xy.push(255 - tileData.y[posIdx]);
            }
          }
          end = xy.length/2;
          keys[key] = [init, end - init + 1];
        }
        tileData.vb = self.renderer.createVertexBuffer(xy);
        tileData.keys = keys;
        self._tileLoaded(t, tileData);
        if (tileData) {
          self.redraw();
        }
      });
    }, this);


  },

  _clearCaches: function() {
    this.renderer && this.renderer.clearSpriteCache();
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
    if (!this.renderer) return;
    var gl = this.renderer.gl;
    var canvas = this.getCanvas();

    //var zoom = gl.getUniformLocation(this.renderer.activeProgram(), "zoom");
    var tilePos = gl.getUniformLocation(this.renderer.activeProgram(), "tilePos");
    var mapSize = gl.getUniformLocation(this.renderer.activeProgram(), "mapSize");
    var pSize = gl.getUniformLocation(this.renderer.activeProgram(), "pSize");
    //var center = L.CRS.EPSG3857.project(this._map.getCenter());
    //var _time = gl.getUniformLocation(this.renderer.activeProgram(), "iGlobalTime");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.disable(gl.DEPTH_TEST);
    //gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //gl.uniform1f(zoom, this._map.getZoom());
      gl.uniform2fv(mapSize, [
        this._map.getSize().x,
        this._map.getSize().y
      ]);

    var self = this;
    function renderKey(tile, key, s) {
        if (tile && tile.keys[key]) {
          var count = tile.keys[key][1];
          if(count) {
            var offset = tile.keys[key][0];
            pos = self.getTilePos(tile.coord);
            gl.uniform1f(pSize, s);
            gl.uniform2fv(tilePos, [
              pos.x  - self._map.getSize().x/2,
              -pos.y + self._map.getSize().y/2
            ]);
            setBufferData(gl, self.renderer.activeProgram(), "pos", tile.vb);
            gl.drawArrays(gl.POINT, offset, count);
          }
        }
    }
    for(t in this._tiles) {
      tile = this._tiles[t];
      renderKey(tile, this.key, 10);
      renderKey(tile, this.key - 1, 9);
      renderKey(tile, this.key - 2, 8);
      renderKey(tile, this.key - 3, 7);
      renderKey(tile, this.key - 4, 6);
      renderKey(tile, this.key - 5, 5);
      renderKey(tile, this.key - 6, 4);
    }

  },

  /**
   * set key to be shown. If it's a single value
   * it renders directly, if it's an array it renders
   * accumulated
   */
  setKey: function(key, options) {
    this.key = key;
    this.animator.step(key);
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
    var times = this.provider.getKeySpan();
  },

  /**
   * set the cartocss for the current renderer
   */
  setCartoCSS: function(cartocss) {
    if (!this.renderer) throw new Error('renderer is not valid');
    var shader = new carto.RendererJS().render(cartocss);
    this.renderer.setShader(shader);

    // provider options
    var options = torque.common.TorqueLayer.optionsFromLayer(shader.findLayer({ name: 'Map' }));
    this.provider.setCartoCSS && this.provider.setCartoCSS(cartocss);
    if(this.provider.setOptions(options)) {
      this._reloadTiles();
    }

    _.extend(this.options, options);

    // animator options
    if (options.animationDuration) {
      this.animator.duration(options.animationDuration);
    }

    this.redraw();
    return this;
  }

});

} //L defined
