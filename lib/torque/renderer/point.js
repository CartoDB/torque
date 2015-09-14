var torque = require('../');
var cartocss = require('./cartocss_render');
var Profiler = require('../profiler');
var carto = global.carto || require('carto');
var Filters = require('./torque_filters');

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
    this._iconsToLoad = 0;
    this._filters = new Filters(this._canvas, {canvasClass: options.canvasClass});
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

    processScaleFunction:function(input, opts){

      if(typeof(input)!='string'){
        return input;
      }

      var matches = input.match(/scale_(.*)\((.*)\)/)
      if(matches){
        var type = matches[1];
        var params = matches[2].split(",");

        var variable  = params[0]
        var domain = params.slice(1,3);
        var range  = params.slice(3,params.length);

        var scale = {lin: d3.scale.linear, log: d3.scale.log, quant: d3.scale.quantize, sqrt: d3.scale.sqrt}[type]

        var s = scale().domain(domain).range(range)
        return s(opts[variable])
      }
      else{
        return input;
      }
    },

    //
    // generate sprite based on cartocss style
    //
    generateSprite: function(shader, value, shaderVars) {
      var self = this;
      var prof = Profiler.metric('torque.renderer.point.generateSprite').start();

      var values = {}
      if(value.length ==1){
        values["value"] = value[0]
      }
      else{
        value.forEach(function(val,index){
          values["value"+index] = val;
        })
      }


      var st = shader.getStyle(values, shaderVars);

      var processingVars = {}
      for(var key in shaderVars){ processingVars[key]= shaderVars[key]}
      for(var key in values){processingVars[key] = values[key]}

      var varsToProcess = ['marker-width', 'marker-fill-opacity', 'marker-fill', 'marker-stroke', 'marker-angle', 'marker-mag']
      varsToProcess.forEach(function(key){
        if(st[key]){
          st[key] = this.processScaleFunction(st[key], processingVars)
        }
      }.bind(this))

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
      var ctx = canvas.getContext('2d');

      var markerFile = st["marker-file"] || st["point-file"];
      var qualifiedUrl = markerFile && this._qualifyURL(markerFile);

      if (qualifiedUrl && this._iconsToLoad <= 0 && this._icons[qualifiedUrl]) {
        var img = this._icons[qualifiedUrl];

        var dWidth =  Math.min(st['marker-width'] * 2 || img.width, cartocss.MAX_SPRITE_RADIUS * 2);
        var dHeight = Math.min((st['marker-height'] || dWidth) * (img.width / img.height), cartocss.MAX_SPRITE_RADIUS * 2);

        canvas.width = ctx.width = dWidth;
        canvas.height = ctx.height = dHeight;

        ctx.scale(dWidth/img.width, dHeight/img.height);

        cartocss.renderSprite(ctx, img, st);
      } else {
        // take into account the exterior ring to calculate the size
        var canvasSize = (st['marker-line-width'] || 0) + pointSize*2;
        var w = ctx.width = canvas.width = ctx.height = canvas.height = Math.ceil(canvasSize);
        ctx.translate(w/2, w/2);

        var mt = st['marker-type'];
        if (mt && mt === 'rectangle') {
          cartocss.renderRectangle(ctx, st);
        } else if(mt && mt === 'vector') {
          cartocss.renderVector(ctx,st);
        }
        else{
          cartocss.renderPoint(ctx, st);
        }
      }

      if(st['text-name']){
        var captures = st['text-name'].match(/\{\{(.*)\}\}/)
        captures.slice(1,captures.length).forEach(function(rep){
          st['text-name'] = st['text-name'].replace("{{"+rep+"}}", values[rep])
        })
        // st['text-name'] = st['text-name'].replace("{{value}}",value)
        cartocss.renderText(ctx,st)
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
    renderTile: function(tile, key, callback) {
      if (this._iconsToLoad > 0) {
          this.on('allIconsLoaded', function() {
              this.renderTile.apply(this, [tile, key, callback]);
          });
          return false;
      }
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

      return callback && callback(null);
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

    _setImageSrc: function(img, url, callback) {
      if (this.options.setImageSrc) {
        this.options.setImageSrc(img, url, callback);
      } else {
        img.onload = function(){
            callback(null);
        };
        img.onerror = function(){
            callback(new Error('Could not load image'));
        };
        img.src = url;
      }
    },

    _qualifyURL: function(url) {
      if (typeof this.options.qualifyURL !== "undefined"){
        return this.options.qualifyURL(url);
      }
      else{
        var a = document.createElement('a');
        a.href = url;
        return a.href;
      }
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
      var anchor = this.options.resolution/2;
      if (activePixels) {
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData.map(function(a){return a[pixelIndex + p]});
          if (c) {
           var sp = sprites[c];
           if (sp === undefined) {
             sp = sprites[c] = this.generateSprite(shader, c, torque.extend({ zoom: tile.z, 'frame-offset': frame_offset }, shaderVars));
           }
           if (sp) {
             var x = tile.x[posIdx]- (sp.width >> 1) + anchor;
             var y = tileMax - tile.y[posIdx] + anchor; // flip mercator
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

        var c =tile.renderData.map(function(r){ return r[pixelIndex + p]})

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

    _preloadIcons: function(img_names) {
      var self = this;

      if (img_names.length > 0 && !this._forcePoints) {

        var qualifiedImageUrlSet = Object.keys(img_names.reduce(function(imgNamesMap, imgName) {
            var qualifiedUrl = self._qualifyURL(imgName);
            if (!self._icons[qualifiedUrl]) {
                imgNamesMap[qualifiedUrl] = true;
            }
            return imgNamesMap;
        }, {}));

        var filtered = self._shader.getLayers().some(function(layer) {
          return typeof layer.shader["image-filters"] !== "undefined";
        });

        this._iconsToLoad += qualifiedImageUrlSet.length;

        qualifiedImageUrlSet.forEach(function(qualifiedImageUrl) {
          self._icons[qualifiedImageUrl] = null;

          var img = self._createImage();

          if (filtered) {
            img.crossOrigin = 'Anonymous';
          }

          self._setImageSrc(img, qualifiedImageUrl, function(err) {
            if (err) {
              self._forcePoints = true;
              self.clearSpriteCache();
              self._iconsToLoad = 0;
              self.fire("allIconsLoaded");
              if(filtered) {
                console.info("Only CORS-enabled, or same domain image-files can be used in combination with image-filters");
              }
              console.error("Couldn't get marker-file " + qualifiedImageUrl);
            } else {
              self._icons[qualifiedImageUrl] = img;
              self._iconsToLoad--;

              if (self._iconsToLoad <= 0){
                self.clearSpriteCache();
                self.fire("allIconsLoaded");
              }
            }
          });
        });
      } else {
          this.fire("allIconsLoaded");
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
