(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};

  var TAU = Math.PI * 2;
  var DEFAULT_CARTOCSS = [
    '#layer {',
    '  marker-fill: #662506;',
    '  marker-width: 4;',
    '  [value > 1] { marker-fill: #FEE391; }',
    '  [value > 2] { marker-fill: #FEC44F; }',
    '  [value > 3] { marker-fill: #FE9929; }',
    '  [value > 4] { marker-fill: #EC7014; }',
    '  [value > 5] { marker-fill: #CC4C02; }',
    '  [value > 6] { marker-fill: #993404; }',
    '  [value > 7] { marker-fill: #662506; }',
    '}'
  ].join('\n');

  //
  // this renderer just render points depending of the value
  //
  function PointRenderer(canvas, options) {
    if (!canvas) {
      throw new Error("canvas can't be undefined");
    }
    this.options = options;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._sprites = []; // sprites per layer
    this._shader = null;
    this.setCartoCSS(this.options.cartocss || DEFAULT_CARTOCSS);
  }

  PointRenderer.prototype = {

    setCanvas: function(canvas) {
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
    },

    //
    // sets the cartocss style to render stuff
    //
    setCartoCSS: function(cartocss) {
      // clean sprites
      this.setShader(new carto.RendererJS().render(cartocss));
    },

    setShader: function(shader) {
      // clean sprites
      this._sprites = [];
      this._shader = shader;
    },

    clearSpriteCache: function() {
      this._sprites = [];
    },

    //
    // generate sprite based on cartocss style
    //
    generateSprite: function(shader, value, shaderVars) {
      var prof = Profiler.metric('PointRenderer:generateSprite').start();
      var st = shader.getStyle('canvas-2d', {
        value: value
      }, shaderVars);

      var pointSize = st['point-radius'];
      if (!pointSize) {
        throw new Error("marker-width property should be set");
      }

      // take into account the exterior ring to calculate the size
      var canvasSize = (st.lineWidth || 0) + pointSize*2;

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      ctx.width = canvas.width = Math.ceil(canvasSize);
      ctx.height = canvas.height = Math.ceil(canvasSize);
      ctx.translate(canvasSize/2, canvasSize/2);
      if(st['point-file'] || st['marker-file']) {
        torque.cartocss.renderSprite(ctx, st);
      } else {
        var mt = st['marker-type'];
        if (mt && mt === 'rectangle') {
          torque.cartocss.renderRectangle(ctx, st);
        } else {
          torque.cartocss.renderPoint(ctx, st);
        }
      }
      prof.end();
      return canvas;
    },

    //
    // renders all the layers (and frames for each layer) from cartocss
    //
    renderTile: function(tile, key) {
      var layers = this._shader.getLayers();
      for(var i = 0, n = layers.length; i < n; ++i ) {
        var layer = layers[i];
        if (layer.name() !== "Map") {
          var sprites = this._sprites[i] || (this._sprites[i] = {});
          // frames for each layer
          for(var fr = 0; fr < layer.frames().length; ++fr) {
            var frame = layer.frames()[fr];
            var fr_sprites = sprites[frame] || (sprites[frame] = []);
            this._renderTile(tile, key - frame, frame, fr_sprites, layer);
          }
        }
      }
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    _renderTile: function(tile, key, frame_offset, sprites, shader, shaderVars) {
      if(!this._canvas) return;

      var prof = Profiler.metric('PointRenderer:renderTile').start();
      var ctx = this._ctx;
      var blendMode = shader.eval('comp-op') || this.options.blendmode;
      if(blendMode) {
        ctx.globalCompositeOperation = blendMode;
      }
      if (this.options.cumulative && key > tile.maxDate) {
        //TODO: precache because this tile is not going to change
        key = tile.maxDate;
      }
      var tileMax = this.options.resolution * (256/this.options.resolution - 1)
      var activePixels = tile.timeCount[key];
      if(activePixels) {
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if(c) {
           var sp = sprites[c];
           if(!sp) {
             sp = sprites[c] = this.generateSprite(shader, c, _.extend({ zoom: tile.z, 'frame-offset': frame_offset }, shaderVars));
           }
           //var x = tile.x[posIdx]*res - (sp.width >> 1);
           //var y = (256 - res - res*tile.y[posIdx]) - (sp.height >> 1);
           var x = tile.x[posIdx]- (sp.width >> 1);
           var y = tileMax - tile.y[posIdx]; // flip mercator
           ctx.drawImage(sp, x, y - (sp.height >> 1));
          }
        }
      }
      prof.end();
    },

    setBlendMode: function(b) {
      this.options.blendmode = b;
    }

  };


  // exports public api
  exports.torque.renderer.Point = PointRenderer;

})(typeof exports === "undefined" ? this : exports);
