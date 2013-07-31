(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};

  var TAU = Math.PI * 2;
  var DEFAULT_CARTOCSS = [
    '#layer {',
    '  marker-fill: #662506;',
    '  marker-width: 3;',
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
    carto.tree.Reference.set(torque['torque-reference']);
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
      if(this._cartoCssStyle.getLayers().length > 1) {
        throw new Error("only one CartoCSS layer is supported");
      }
      this._shader = this._cartoCssStyle.getLayers()[0];
    },

    //
    // generate sprite based on cartocss style
    //
    generateSprite: function(value, tile) {
      var st = this._shader.getStyle('canvas-2d', {
        value: value
      }, { zoom: tile.zoom });

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
      torque.cartocss.renderPoint(ctx, st);
      return canvas;
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    renderTile: function(tile, key) {
      if(!this._canvas) return;
      //var prof = Profiler.get('render').start();
      var ctx = this._ctx;
      var res = this.options.resolution;
      var sprites = this._sprites;
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
             sp = sprites[c] = this.generateSprite(c, tile);
           }
           var x = tile.x[posIdx] - (sp.width >> 1);
           var y = tile.y[posIdx] - (sp.height >> 1);
           ctx.drawImage(sp, x*res, 255 - y*res);
          }
        }
      }
      //prof.end();
    }
  };


  // exports public api
  exports.torque.renderer.Point = PointRenderer;

})(typeof exports === "undefined" ? this : exports);
