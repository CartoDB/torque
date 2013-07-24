(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};


  function palette(slots) {
    var conds = []
    for(var i = slots.length - 1; i >= 0; --i) {
      conds.push("if( x >= " + slots[i] + ") return " + (i + 1)  + ";");
    }
    conds.push("return 0;");
    var body = conds.join('\n');
    return new Function("x", body);
  }


  var pal = palette([10, 100, 1000, 10000, 100000]);
  console.log(pal(0), pal(11));

  var TAU = Math.PI * 2;
  var DEFAULT_COLORS = [
  "#FFFF00", "#FFCC00", "#FF9900", "#FF6600", "#FF3300", "#CC0000"
  /*
        "#FEE391",
        "#FEC44F",
        "#FE9929",
        "#EC7014",
        "#CC4C02",
        "#993404",
        "#662506"
        */
  ];

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      255
    ] : [0, 0, 0, 0];
  }

  //
  // this renderer just render points depending of the value
  // 
  function RectanbleRenderer(canvas, options) {
    if (!canvas) {
      throw new Error("canvas can't be undefined");
    }
    this.options = options;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._colors = DEFAULT_COLORS;//DEFAULT_COLORS.map(hexToRgb);

  }

  RectanbleRenderer.prototype = {

    accumulate: function(tile, keys) {
      var x, y, posIdx, p, k, key, activePixels, pixelIndex;
      var res = this.options.resolution;
      var s = 256/res;
      var accum = new Float32Array(s*s);

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
      return accum;
    },

    renderTileAccum: function(accum, px, py) {
      var res = this.options.resolution;
      var ctx = this._ctx;
      var s = (256/res) | 0;
      var s2 = s*s;
      var colors = this._colors;
      for(var i = 0; i < s2; ++i) {
        var xy = i;
        var value = accum[i];
        if(value) {
          var x = (xy/s) | 0;
          var y = xy % s;
          var color = colors[pal(value)];//Math.min(value|0, colors.length - 1)];
          ctx.fillStyle = color;
          ctx.fillRect(x * res, 255 - y * res, res, res);
        }
      }
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    renderTile: function(tile, key, px, py) {
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
    }
  };


  // exports public api
  exports.torque.renderer.Rectangle = RectanbleRenderer;

})(typeof exports === "undefined" ? this : exports);
