var carto = global.carto || require('carto');

  var DEFAULT_CARTOCSS = [
    '#layer {',
    '  polygon-fill: #FFFF00;',
    '  [value > 10] { polygon-fill: #FFFF00; }',
    '  [value > 100] { polygon-fill: #FFCC00; }',
    '  [value > 1000] { polygon-fill: #FE9929; }',
    '  [value > 10000] { polygon-fill: #FF6600; }',
    '  [value > 100000] { polygon-fill: #FF3300; }',
    '}'
  ].join('\n');

  var TAU = Math.PI * 2;

  //
  // this renderer just render points depending of the value
  // 
  function RectanbleRenderer(canvas, options) {
    this.options = options;
    carto.tree.Reference.set(torque['torque-reference']);
    this.setCanvas(canvas);
    this.setCartoCSS(this.options.cartocss || DEFAULT_CARTOCSS);
  }

  RectanbleRenderer.prototype = {

    //
    // sets the cartocss style to render stuff
    //
    setCartoCSS: function(cartocss) {
      this._cartoCssStyle = new carto.RendererJS().render(cartocss);
      if(this._cartoCssStyle.getLayers().length > 1) {
        throw new Error("only one CartoCSS layer is supported");
      }
      this._shader = this._cartoCssStyle.getLayers()[0].shader;
    },

    setCanvas: function(canvas) {
      if(!canvas) return;
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
    },

    accumulate: function(tile, keys) {
      var prof = Profiler.metric('RectangleRender:accumulate').start();
      var x, y, posIdx, p, k, key, activePixels, pixelIndex;
      var res = this.options.resolution;
      var s = 256/res;
      var accum = new Float32Array(s*s);

      if(typeof(keys) !== 'object') {
        keys = [keys];
      }

      for(k = 0; k < keys.length; ++k) {
        key = keys[k];
        activePixels = tile.timeCount[key];
        if(activePixels) {
          pixelIndex = tile.timeIndex[key];
          for(p = 0; p < activePixels; ++p) {
            posIdx = tile.renderDataPos[pixelIndex + p];
            x = tile.x[posIdx]/res;
            y = tile.y[posIdx]/res;
            accum[x*s + y] += tile.renderData[pixelIndex + p];
          }
        }
      }

      prof.end();
      return accum;
    },

    renderTileAccum: function(accum, px, py) {
      var prof = Profiler.metric('RectangleRender:renderTileAccum').start();
      var color, x, y, alpha;
      var res = this.options.resolution;
      var ctx = this._ctx;
      var s = (256/res) | 0;
      var s2 = s*s;
      var colors = this._colors;
      if(this.options.blendmode) {
        ctx.globalCompositeOperation = this.options.blendmode;
      }
      var polygon_alpha = this._shader['polygon-opacity'] || function() { return 1.0; };
      for(var i = 0; i < s2; ++i) {
        var xy = i;
        var value = accum[i];
        if(value) {
          x = (xy/s) | 0;
          y = xy % s;
          // by-pass the style generation for improving performance
          color = this._shader['polygon-fill']({ value: value }, { zoom: 0 });
          ctx.fillStyle = color;
          //TODO: each function should have a default value for each 
          //property defined in the cartocss
          alpha = polygon_alpha({ value: value }, { zoom: 0 });
          if(alpha === null) {
            alpha = 1.0;
          }
          ctx.globalAlpha = alpha;
          ctx.fillRect(x * res, 256 - res - y * res, res, res);
        }
      }
      prof.end();
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    renderTile: function(tile, key, callback) {
      if(!this._canvas) return;

      var res = this.options.resolution;

      //var prof = Profiler.get('render').start();
      var ctx = this._ctx;
      var colors = this._colors;
      var activepixels = tile.timeCount[key];
      if(activepixels) {
        var w = this._canvas.width;
        var h = this._canvas.height;
        //var imageData = ctx.getImageData(0, 0, w, h);
        //var pixels = imageData.data;
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if(c) {
           var color = colors[Math.min(c, colors.length - 1)];
           var x = tile.x[posIdx];// + px;
           var y = tile.y[posIdx]; //+ py;

           ctx.fillStyle = color;
           ctx.fillRect(x, y, res, res);
           /*

           for(var xx = 0; xx < res; ++xx) {
            for(var yy = 0; yy < res; ++yy) {
              var idx = 4*((x+xx) + w*(y + yy));
              pixels[idx + 0] = color[0];
              pixels[idx + 1] = color[1];
              pixels[idx + 2] = color[2];
              pixels[idx + 3] = color[3];
            }
           }
           */
          }
        }
        //ctx.putImageData(imageData, 0, 0);
      }
      //prof.end();
      return callback && callback(null);
    }
  };


  // exports public api
module.exports = RectanbleRenderer;
