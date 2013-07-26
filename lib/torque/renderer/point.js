(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};

  var TAU = Math.PI * 2;
  var DEFAULT_COLORS = [
        "#FEE391",
        "#FEC44F",
        "#FE9929",
        "#EC7014",
        "#CC4C02",
        "#993404",
        "#662506"
  ];

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
    this._sprites = [];

    this.generateSprites();
  }

  PointRenderer.prototype = {

    //
    // pregenerate sprites to improve rendering. There should
    // be a sprite for each one of the values of the categories
    // if there is no sprite for that the value is not rendered
    //
    generateSprites: function() {
      var pixel_size = this.options.pixel_size;
      for(var c = 0; c < DEFAULT_COLORS.length; ++c) {
        // create a canvas
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        ctx.width = canvas.width = pixel_size * 2;
        ctx.height = canvas.height = pixel_size * 2;
        ctx.globalAlpha = 1;
        ctx.fillStyle = DEFAULT_COLORS[c];

        // render a circle
        ctx.beginPath();
        ctx.arc(pixel_size, pixel_size, pixel_size, 0, TAU, true, true);
        ctx.closePath();
        ctx.fill();
        this._sprites.push(canvas);
      }
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
           var sp = sprites[Math.min(c, sprites.length - 1)];
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
