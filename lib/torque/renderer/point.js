var torque = require('../');
var cartocss = require('./cartocss_render');
var Profiler = require('../profiler');
var carto = global.carto || require('carto');
var Filters = require('./torque_filters');
var d3 = require('d3');
var contour = require('./contour');

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
    this.globalGrid = [];
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
    // renders all the layers (and frames for each layer) from cartocss
    //
    renderTile: function(tile, key, pos) {
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
            this._renderTile(tile, key - frame, frame, fr_sprites, layer, pos);
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
    _renderTile: function(tile, key, frame_offset, sprites, shader, pos) {
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

        /*
          Torque Isolines
          To be moved somewhere else (ideally something link isolines.js within /renderer/)
        */
      var isolines = true;
      if (isolines) {
        function getRandomColor() {
            var letters = '0123456789ABCDEF'.split('');
            var color = '#';
            for (var i = 0; i < 6; i++ ) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }
        this._gridData(tile);
      }
      prof.end(true);
    },

    _gridData: function(tile){
      var valsPerTile = this.TILE_SIZE/this.options.resolution;
      // baseIndex is the distance to the upper left corner of the grid, in cells
      var baseIndex = {
        x: (tile.coord.x - this.firstTileCoords.coord.x) * valsPerTile,
        y: (tile.coord.y - this.firstTileCoords.coord.y) * valsPerTile
      }

      for(var i = 0; i < tile.renderData.length; i++){
        var x = tile.x[i], y = tile.y[i];
        this.globalGrid[baseIndex.y + (256 - y)/this.options.resolution-1][baseIndex.x + x/this.options.resolution] = tile.renderData[i];
      }
    },

    _getPipe: function(cell, contour){
      var parsedCell = cell.map(function(cornerValue){
          if (cornerValue >= contour){
            return "1";
          }
          return "0";
        }).join("");
      var type = parseInt(parsedCell, 2);
      var interpolated = true;
      var N = interpolated?[this._lerp(cell[1], cell[0], contour), 0]: [0.5,0], 
          S = interpolated?[this._lerp(cell[2], cell[3], contour), 1]: [0.5,1], 
          E = interpolated?[1, this._lerp(cell[2], cell[1], contour)]: [1,0.5], 
          W = interpolated?[0, this._lerp(cell[3], cell[0], contour)]: [0,0.5]
      // Blank
      if (type === 0 || type === 15) return null;
      // W - S
      if (type === 1 || type === 14) return [W, S]  
      // S - E
      if (type === 2 || type === 13) return [S, E]
      // W - E  
      if (type === 3 || type === 12) return [W, E]  
      // N - E
      if (type === 4 || type === 11) return [N, E]  
      // N - S
      if (type === 6 || type === 9) return [N, S]
      // W - N
      if (type === 7 || type === 8) return [W, N] 
      // W - N / S - E
      if (type === 5) return [W, N, S, E]
      // W - S / N - E
      if (type === 10) return [W, S, N, E]
    },

    _lerp: function(valueA, valueB, contourValue){
      return Math.max(Math.min(1 + (-0.5) * (contourValue - valueA) / (valueB - valueA), 0.8), 0.2);
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
    if (this.globalGrid.length > 0) {
      // var cellsY = this.globalGrid.length-1;
      // var contourValues = [0, 4, 8, 16];
      var ctx = this._ctx;
      var res = this.options.resolution;
      // var startPos = this.firstTileCoords.pos;
      // ctx.strokeStyle = "white";
      // for (var c = 0; c < contourValues.length; c++) {
      //   for (var y = 0;  y < cellsY; y++) {
      //     if (this.globalGrid[y]) {
      //       for (var x = 0;  x < this.globalGrid[y].length-1; x++){
      //         var currentCell = [
      //                             this.globalGrid[y][x], 
      //                             this.globalGrid[y][x+1], 
      //                             this.globalGrid[y+1][x+1], 
      //                             this.globalGrid[y+1][x]
      //                             ];
      //         var pipe = this._getPipe(currentCell, contourValues[c]);
      //         if (pipe){
      //           ctx.beginPath();
      //           ctx.moveTo(res * (x + 0.5 + pipe[0][0]), res * (y + 0.5 + pipe[0][1]));
      //           ctx.lineTo(res * (x + 0.5 + pipe[1][0]), res * (y + 0.5 + pipe[1][1]));
      //           ctx.stroke();
      //           if (pipe.length === 4){
      //             ctx.beginPath();
      //             ctx.moveTo(res * (x + 0.5 + pipe[2][0]), res * (y + 0.5 + pipe[2][1]));
      //             ctx.lineTo(res * (x + 0.5 + pipe[3][0]), res * (y + 0.5 + pipe[3][1]));
      //             ctx.stroke();
      //           }
      //         }
      //       }
      //     }
      //   }
      // }
      for (var y = 0;  y < this.globalGrid.length; y++){
        for (var x = 0;  x < this.globalGrid[0].length; x++){
          ctx.beginPath();
          ctx.arc(res/2 + x*res, res/2 + y*res, 1, 0, 2 * Math.PI, false);
          var value = this.globalGrid[y][x];
          ctx.fillStyle = "rgb("+0+", "+value * 50+", "+value * 50+")";
          if(value === 0) ctx.fillStyle = "red";
          ctx.fill();
        }
      }
    }
   }
});


  // exports public api
module.exports = PointRenderer;
