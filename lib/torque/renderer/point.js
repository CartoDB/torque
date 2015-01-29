var torque = require('../');
var cartocss = require('./cartocss_render');
var Profiler = require('../profiler');
var carto = global.carto || require('carto');
var filters = require('./torque_filters');

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

  var COMP_OP_TO_CANVAS = {
    "src": 'source-over',
    "src-over": 'source-over',
    "dst-over": 'destination-over',
    "src-in": 'source-in',
    "dst-in": 'destination-in',
    "src-out": 'source-out',
    "dst-out": 'destination-out',
    "src-atop": 'source-atop',
    "dst-atop": 'destination-atop',
    "xor": 'xor',
    "darken": 'darken',
    "lighten": 'lighten'
  }

  function compop2canvas(compop) {
    return COMP_OP_TO_CANVAS[compop] || compop;
  }

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
    this._icons = {};
    this._filters = filters(this._canvas);
    this.setCartoCSS(this.options.cartocss || DEFAULT_CARTOCSS);
    this.TILE_SIZE = 256;
    this._style = null;
    this._gradients = {};
    
    this._forcePoints = false;
  }

  torque.extend(PointRenderer.prototype, torque.Event, {

    clearCanvas: function() {
      var canvas = this._canvas;
      var color = this._Map['-torque-clear-color']
      // shortcut for the default value
      if (color  === "rgba(255, 255, 255, 0)" || !color) {
        this._canvas.width = this._canvas.width;
      } else {
        var ctx = this._ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        var compop = this._Map['comp-op']
        ctx.globalCompositeOperation = compop2canvas(compop);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    },

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
      this._Map = this._shader.getDefault().getStyle({}, { zoom: 0 });
      var img_names = this._shader.getImageURLs();
      this._preloadIcons(img_names);
    },

    clearSpriteCache: function() {
      this._sprites = [];
    },


    //
    // generate sprite based on cartocss style
    //
    generateSprite: function(shader, value, shaderVars) {
      var self = this;
      var prof = Profiler.metric('torque.renderer.point.generateSprite').start();
      var st = shader.getStyle({
        value: value
      }, shaderVars);
      if(this._style === null || this._style !== st){
        this._style = st;
      }

      var pointSize = st['marker-width'];
      if (!pointSize) {
        return null;
      }

      if (st['marker-opacity'] === 0 && !st['marker-line-opacity']) {
        return null;
      }

      var canvas = this._createCanvas();
      // take into account the exterior ring to calculate the size
      var canvasSize = (st['marker-line-width'] || 0) + pointSize*2;
      var ctx = canvas.getContext('2d');
      var w = ctx.width = canvas.width = ctx.height = canvas.height = Math.ceil(canvasSize);
      ctx.translate(w/2, w/2);

      function qualifyURL(url) {
            var a = document.createElement('a');
              a.href = url;
              return a.href;
          };
      var img_name = qualifyURL(st["marker-file"] || st["point-file"]);
      if (img_name && this._icons.itemsToLoad === 0) {
          var img = this._icons[img_name];
          img.w = st['marker-width'] || img.width;
          img.h = st['marker-width'] || st['marker-height'];
          cartocss.renderSprite(ctx, img, st);
      } 
      else {
        var mt = st['marker-type'];
        if (mt && mt === 'rectangle') {
          cartocss.renderRectangle(ctx, st);
        } else {
          cartocss.renderPoint(ctx, st);
        }
      }
      prof.end(true);
      if (torque.flags.sprites_to_images) {
        var i = this._createImage();
        i.src = canvas.toDataURL();
        return i;
      }
      
      return canvas;
    },

    //
    // renders all the layers (and frames for each layer) from cartocss
    //
    renderTile: function(tile, key) {
      var prof = Profiler.metric('torque.renderer.point.renderLayers').start();
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
      
      prof.end(true);
    },

    _createCanvas: function() {
      return this.options.canvasClass
        ? new this.options.canvasClass()
        : document.createElement('canvas');
    },

    _createImage: function() {
      return this.options.imageClass
        ? new this.options.imageClass()
        : new Image();
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    _renderTile: function(tile, key, frame_offset, sprites, shader, shaderVars) {
      if (!this._canvas) return;

      var prof = Profiler.metric('torque.renderer.point.renderTile').start();
      var ctx = this._ctx;
      var blendMode = compop2canvas(shader.eval('comp-op')) || this.options.blendmode;
      if (blendMode) {
        ctx.globalCompositeOperation = blendMode;
      }
      if (this.options.cumulative && key > tile.maxDate) {
        //TODO: precache because this tile is not going to change
        key = tile.maxDate;
      }
      var tileMax = this.options.resolution * (this.TILE_SIZE/this.options.resolution - 1)
      var activePixels = tile.timeCount[key];
      if (activePixels) {
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if (c) {
           var sp = sprites[c];
           if (sp === undefined) {
             sp = sprites[c] = this.generateSprite(shader, c, torque.extend({ zoom: tile.z, 'frame-offset': frame_offset }, shaderVars));
           }
           if (sp) {
             var x = tile.x[posIdx]- (sp.width >> 1);
             var y = tileMax - tile.y[posIdx]; // flip mercator
             ctx.drawImage(sp, x, y - (sp.height >> 1));
           }
          }
        }
      }
      

      prof.end(true);
    },

    setBlendMode: function(b) {
      this.options.blendmode = b;
    },

    /**
     * get active points for a step in active zoom
     * returns a list of bounding boxes [[sw, ne] , [], []] where ne is a {lat: .., lon: ...} obj
     * empty list if there is no active pixels
     */
    getActivePointsBBox: function(tile, step) {
      var positions = [];
      var mercator = new torque.Mercator();

      var tileMax = this.options.resolution * (this.TILE_SIZE/this.options.resolution - 1);
      //this.renderer.renderTile(tile, this.key, pos.x, pos.y);
      var activePixels = tile.timeCount[step];
      var pixelIndex = tile.timeIndex[step];
      for(var p = 0; p < activePixels; ++p) {
        var posIdx = tile.renderDataPos[pixelIndex + p];
        var c = tile.renderData[pixelIndex + p];
        if (c) {
         var x = tile.x[posIdx];
         var y = tileMax - tile.y[posIdx]; // flip mercator
         positions.push(mercator.tilePixelBBox(
           tile.coord.x,
           tile.coord.y,
           tile.coord.z,
           x, y
         ));
        }
      }
      return positions;
    },

    // return the value for x, y (tile coordinates)
    // null for no value
    getValueFor: function(tile, step, px, py) {
      var mercator = new torque.Mercator();
      var res = this.options.resolution;
      var res2 = res >> 1;

      var tileMax = this.options.resolution * (this.TILE_SIZE/this.options.resolution - 1);
      //this.renderer.renderTile(tile, this.key, pos.x, pos.y);
      var activePixels = tile.timeCount[step];
      var pixelIndex = tile.timeIndex[step];
      for(var p = 0; p < activePixels; ++p) {
        var posIdx = tile.renderDataPos[pixelIndex + p];
        var c = tile.renderData[pixelIndex + p];
        if (c) {
         var x = tile.x[posIdx];
         var y = tileMax - tile.y[posIdx];
         var dx = px + res2 - x;
         var dy = py + res2 - y;
         if (dx >= 0 && dx < res && dy >= 0 && dy < res) {
           return {
             value: c,
             bbox: mercator.tilePixelBBox(
               tile.coord.x,
               tile.coord.y,
               tile.coord.z,
               x - res2, y - res2, res
             )
           }
         }
        }
      }
      return null;
    },
    _preloadIcons: function(img_names){
      var self = this;
      this._icons = {};
      if (img_names.length > 0 && !this._forcePoints){
        for (var i = 0; i<img_names.length; i++){
          var new_img = this._createImage();
          function qualifyURL(url) {
            var a = document.createElement('a');
              a.href = url;
              return a.href;
          }
          this._icons[qualifyURL(img_names[i])] = null;
          if (typeof self._icons.itemsToLoad === 'undefined'){
            this._icons.itemsToLoad = img_names.length;
          }
          new_img.crossOrigin = "Anonymous";
          new_img.onload = function(e){
            self._icons[this.src] = this;
            if (Object.keys(self._icons).length === img_names.length + 1){
              self._icons.itemsToLoad--;
              if (self._icons.itemsToLoad === 0){
                self.clearSpriteCache();
                self.fire("allIconsLoaded");
              }
            }
          };
          new_img.onerror = function(){
            self._forcePoints = true;
            self.clearSpriteCache();
            console.error("Couldn't get marker-file " + this.src);
          };
          new_img.src = img_names[i];
        }
      }

  },
  applyFilters: function(){
    if(this._style){
      if(this._style['image-filters']){
        function gradientKey(imf){
          var hash = ""
          for(var i = 0; i < imf.args.length; i++){
            var rgb = imf.args[i].rgb;
            hash += rgb[0] + ":" + rgb[1] + ":" + rgb[2];
          }
          return hash;
        }
        var gradient = this._gradients[gradientKey(this._style['image-filters'])];
        if(!gradient){
          function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
          }

          function rgbToHex(r, g, b) {
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
          }
          gradient = {};
          var colorize = this._style['image-filters'].args;
          
          var increment = 1/colorize.length;
          for (var i = 0; i < colorize.length; i++){
            var key = increment * i + increment;
            var rgb = colorize[i].rgb;
            var formattedColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
            gradient[key] = formattedColor;
          }
          this._gradients[gradientKey(this._style['image-filters'])] = gradient;
        }
        this._filters.gradient(gradient);
        this._filters.draw();
      }
    }
  }
});


  // exports public api
module.exports = PointRenderer;
