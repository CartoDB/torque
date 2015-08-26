var torque = require('../');
var carto = global.carto || require('carto');
var Renderer = require('../renderer');

// A renderer that generates isolines and isobands out of Torque aggregated point values

function IsoRenderer (canvas, options) {
	if (!canvas) {
		throw new Error("canvas can't be undefined");
	}
	this.options = options;
	this._canvas = canvas;
	this._ctx = canvas.getContext('2d');
	this.setCartoCSS(this.options.cartocss || DEFAULT_CARTOCSS);
	this.TILE_SIZE = 256;
}

torque.extend(IsoRenderer.prototype, torque.Event, {
	clearSpriteCache: function() {
      this._sprites = [];
    },
	setCartoCSS: function(cartocss) {
    // clean sprites
    this.setShader(new carto.RendererJS().render(cartocss));
  },

  setShader: function(shader) {
    // clean sprites
    this._sprites = [];
    this._shader = shader;
    this._Map = this._shader.getDefault().getStyle({}, { zoom: 0 });
  },

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

  _createCanvas: function() {
    return this.options.canvasClass
      ? new this.options.canvasClass()
      : document.createElement('canvas');
  },

	renderTile: function(tile, key, pos) {
		var layers = this._shader.getLayers();
		for (var i = 0, n = layers.length; i < n; ++i) {
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
  },

  _renderTile: function(tile, key, frame_offset, sprites, shader, pos) {
  	if (!this._canvas) return;
  	var ctx = this._ctx;
  	this._gridData(tile);
  },

  _gridData: function(tile){
  	var valsPerTile = this.TILE_SIZE/this.options.resolution;
  	var difX = tile.coord.x - this.firstTileCoords.coord.x;
  	var difY = tile.coord.y - this.firstTileCoords.coord.y;
  	if (difX < 0 || difY < 0) return;
    // baseIndex is the distance to the upper left corner of the grid, in cells
    var baseIndex = {
    	x: (difX) * valsPerTile,
    	y: (difY) * valsPerTile
    }

    for(var i = 0; i < tile.renderData.length; i++){
    	var x = tile.x[i], y = tile.y[i];
    	this.globalGrid[baseIndex.y + (256 - y) / this.options.resolution -1][baseIndex.x + x/this.options.resolution] = tile.renderData[i];
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
    var N = interpolated? [this._lerp(cell[1], cell[0], contour), 0]: [0.5,0], 
    S = interpolated? [this._lerp(cell[2], cell[3], contour), 1]: [0.5,1], 
    E = interpolated? [1, this._lerp(cell[2], cell[1], contour)]: [1,0.5], 
    W = interpolated? [0, this._lerp(cell[3], cell[0], contour)]: [0,0.5]
    if (type === 0 || type === 15) return null;
    if (type === 1 || type === 14) return [W, S]  
    if (type === 2 || type === 13) return [S, E]
    if (type === 3 || type === 12) return [W, E]  
    if (type === 4 || type === 11) return [N, E]  
    if (type === 6 || type === 9) return [N, S]
    if (type === 7 || type === 8) return [W, N] 
    if (type === 5) return [W, N, S, E]
    if (type === 10) return [W, S, N, E]
  },

	getNext: function(currentPos, previousPos, cornerValues, contourValue){
		var binaryCell = cornerValues.map(function(cornerValue){
				if (cornerValue > contourValue){
					return "1";
				}
				return "0";
			}).join("");
		var type = parseInt(binaryCell, 2);
		var N = [0, -1], 
		    S = [0, 1], 
		    E = [1, 0], 
		    W = [-1, 0];

		var next, interpolation;

		if (type === 0 || type === 15) return null;
		else if (type === 1 || type === 14){
			next = [S,W];
			interpolation = {
				x: lerp(cornerValues[2], cornerValues[3], contourValue), 
				y: lerp(cornerValues[0], cornerValues[3], contourValue)
			};	
		} 
		else if (type === 2 || type === 13){
			next = [E,S];
			interpolation = {
				x: lerp(cornerValues[3], cornerValues[2], contourValue), 
				y: lerp(cornerValues[1], cornerValues[2], contourValue)
			};	
		} 
		else if (type === 3 || type === 12) {
			next = [E,W];
			interpolation = {
				x: 0.5, 
				y: 0.5
			};	
		} 
		else if (type === 4 || type === 11){
			next = [N,E];
			interpolation = {
				x: lerp(cornerValues[0], cornerValues[1], contourValue), 
				y: lerp(cornerValues[2], cornerValues[1], contourValue)
			};	
		} 
		else if (type === 6 || type === 9) {
			next = [N,S];
			interpolation = {
				x: 0.5, 
				y: 0.5
			};	
		} 
		else if (type === 7 || type === 8) {
			next = [N,W];
			interpolation = {
				x: lerp(cornerValues[1], cornerValues[0], contourValue), 
				y: lerp(cornerValues[3], cornerValues[0], contourValue)
			};	
		} 
		else if (type === 5 || type === 10) {
			var diff = [previousPos.x - currentPos.x, previousPos.y - currentPos.y];
			if (diff[0] === -1){
				return {x: currentPos.x, y: currentPos.y - 1};
			} else if (diff[0] === 1){
				return {x: currentPos.x, y: currentPos.y + 1};
			} else if (diff[1] === -1){
				return {x: currentPos.x + 1, y: currentPos.y};
			} else if (diff[1] === 1){
				return {x: currentPos.x - 1, y: currentPos.y};
			}
		}	

		if (!previousPos || (currentPos.x + next[0][0] === previousPos.x && currentPos.y + next[0][1] === previousPos.y)){
			return {x: currentPos.x + next[1][0], y: currentPos.y + next[1][1], interpolation};
		}
		else return {x: currentPos.x + next[0][0], y: currentPos.y + next[0][1], interpolation};
	},


	_lerp: function(valueA, valueB, contourValue){
		return 1 + (-0.5) * (contourValue - valueA) / (valueB - valueA);
	},

	drawIsolines: function(){
		if (this.globalGrid.length > 0) {
			var style = this._shader.getLayers()[1].getStyle({}, {zoom: 2});
			var cellsY = this.globalGrid.length-1;
			var contourValues = [0, 4, 8, 16, 32, 64, 128];
			var ctx = this._ctx;
			var res = this.options.resolution;
			var startPos = this.firstTileCoords.pos;
			ctx.strokeStyle = style["-isoline-line-color"] || "black";
			ctx.lineWidth = style["-isoline-line-width"] || 2;
			ctx.globalAlpha = style["-isoline-line-opacity"] || 0.8;
			var grad = style["-isoline-line-ramp"] && this._generateGradient(style["-isoline-line-ramp"].args);
			for (var c = 0; c < contourValues.length; c++) {
				if(style["-isoline-line-decay"]){
					var max = contourValues[contourValues.length - 1];
					ctx.globalAlpha = (contourValues[c]/max)*(style["-isoline-line-opacity"] || 0.8);
				}
				if(grad){
					ctx.strokeStyle = "rgb("+grad[4*contourValues[c]]+","+grad[4*contourValues[c]+1]+","+grad[4*contourValues[c]+2]+")";
				}
				for (var y = 0;  y < cellsY; y++) {
					for (var x = 0;  x < this.globalGrid[y].length-1; x++){
						var currentCell = [
						this.globalGrid[y][x],
						this.globalGrid[y][x+1],
						this.globalGrid[y+1][x+1],
						this.globalGrid[y+1][x]
						];
						var pipe = this._getPipe(currentCell, contourValues[c]);
						if (pipe){
							ctx.beginPath();
							ctx.moveTo(res * (x + 0.5 + pipe[0][0]), res * (y + 0.5 + pipe[0][1]));
							ctx.lineTo(res * (x + 0.5 + pipe[1][0]), res * (y + 0.5 + pipe[1][1]));
							ctx.stroke();
							if (pipe.length === 4) {
								ctx.beginPath();
								ctx.moveTo(res * (x + 0.5 + pipe[2][0]), res * (y + 0.5 + pipe[2][1]));
								ctx.lineTo(res * (x + 0.5 + pipe[3][0]), res * (y + 0.5 + pipe[3][1]));
								ctx.stroke();
							}
						}
					}
				}
			}
			ctx.globalAlpha = 0;
		}
	},
	postProcess: function(){
		this.drawIsolines();
	},

	_generateGradient: function(ramp){
		var gradientCanvas = this._createCanvas(),
		gctx = gradientCanvas.getContext('2d'),
		gradient = gctx.createLinearGradient(0, 0, 0, 256);
		gradientCanvas.width = 1;
		gradientCanvas.height = 256;	
		for (var i = 0; i < ramp.length; i++) {
			var color = "rgb("+ramp[i].rgb[0]+","+ramp[i].rgb[1]+","+ramp[i].rgb[2]+")";
			gradient.addColorStop(i/(ramp.length-1), color);
		}
		gctx.fillStyle = gradient;
		gctx.fillRect(0, 0, 1, 256);

		return gctx.getImageData(0, 0, 1, 256).data;
	}

});

module.exports = IsoRenderer;