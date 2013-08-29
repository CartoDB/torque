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
    this._sprites = {};
    this._shader = null;
    this._trailsShader = null;
    //carto.tree.Reference.set(torque['torque-reference']);
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
      this._sprites = {};
      this._cartoCssStyle = new carto.RendererJS().render(cartocss);
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
      if(!pointSize) {
        throw new Error("marker-width property should be set");
      }
      var canvasSize = pointSize*2;

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      ctx.width = canvas.width = canvasSize;
      ctx.height = canvas.height = canvasSize;
      ctx.translate(pointSize, pointSize);
      if(st['point-file'] || st['marker-fil']) {
        torque.cartocss.renderSprite(ctx, st);
      } else {
        torque.cartocss.renderPoint(ctx, st);
      }
      prof.end();
      return canvas;
    },

    //
    // renders all the layers (and frames for each layer) from cartocss
    //
    renderTile: function(tile, key) {
      var layers = this._cartoCssStyle.getLayers();
      for(var i = 0, n = layers.length; i < n; ++i ) {
        var layer = layers[i];
        // frames for each layer
        for(var fr = 0; fr < layer.frames().length; ++fr) {
          var frame = layer.frames()[fr];
          var sprites = this._sprites[frame] || (this._sprites[frame] = []);
          this._renderTile(tile, key - frame, frame, sprites, layer);
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
      var res = this.options.resolution;
      var activePixels = tile.timeCount[key];
      if(this.options.blendmode) {
        ctx.globalCompositeOperation = this.options.blendmode;
      }
      if(activePixels) {
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if(c) {
           var sp = sprites[c];
           if(!sp) {
             sp = sprites[c] = this.generateSprite(shader, c, _.extend({ zoom: tile.zoom, 'frame-offset': frame_offset }, shaderVars));
           }
           var x = tile.x[posIdx]*res - (sp.width >> 1);
           var y = (256 - res - res*tile.y[posIdx]) - (sp.height >> 1);
           ctx.drawImage(sp, x, y);
          }
        }
      }
      prof.end();
    }
  };


  // exports public api
  exports.torque.renderer.Point = PointRenderer;

})(typeof exports === "undefined" ? this : exports);
