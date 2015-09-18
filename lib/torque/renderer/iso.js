var torque = require('../');
var carto = global.carto || require('carto');
var Renderer = require('../renderer');
var cSpline = require('cardinal-spline')

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
	this.contourValues = [1,2,4,8,10,16,32];
	this.lines = [];
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
	postProcess: function(){
		this.generateIsolines();
	},

	_generateGradient: function(ramp){
		contourValues = this.contourValues;
		var max = contourValues[contourValues.length-1];
		var gradientCanvas = this._createCanvas(),
		gctx = gradientCanvas.getContext('2d'),
		gradient = gctx.createLinearGradient(0, 0, 0, max);
		gradientCanvas.width = 1;
		gradientCanvas.height = max;	
		for (var i = 0; i < ramp.length; i++) {
			var color = "rgb("+ramp[i].rgb[0]+","+ramp[i].rgb[1]+","+ramp[i].rgb[2]+")";
			gradient.addColorStop(i/(ramp.length-1), color);
		}
		gctx.fillStyle = gradient;
		gctx.fillRect(0, 0, 1, max);

		return gctx.getImageData(0, 0, 1, max).data;
	},

	_cardinalSpline: function(line){
		var plainArray = [];
		var res = this.options.resolution;
		for (var p = 0; p < line.length; p++){
			var relativePosition = line[p].coord.relativePosition || {x: 0.5, y: 0.5};
			if (relativePosition.length){
				plainArray.push(res + res*line[p].coord.x + res * relativePosition[1].x);
				plainArray.push(res + res*line[p].coord.y + res * relativePosition[1].y);
			}
			else { 
				plainArray.push(res + res*line[p].coord.x + res * relativePosition.x);
				plainArray.push(res + res*line[p].coord.y + res * relativePosition.y);
			}
		}
		return cSpline(plainArray, 0.5, 25, true);
	},

	_getNext: function(currentPos, previousPos, cornerValues, contourValue){
		var binaryCell = cornerValues.map(function(cornerValue){
				if (cornerValue >= contourValue){
					return "1";
				}
				return "0";
			}).join("");
		var type = parseInt(binaryCell, 2);
		var N = [0, -1], 
		    S = [0, 1], 
		    E = [1, 0], 
		    W = [-1, 0];

		var next, relativePosition;

		var diff;
		if (previousPos){
			diff = [previousPos.x - currentPos.x, previousPos.y - currentPos.y];
		}

		if (type === 0 || type === 15) return null;
		else if (type === 1 || type === 14){
			next = [S,W];
			if (type === 1){
				relativePosition = [{
					x: 1 - this._lerp(cornerValues[2], cornerValues[3], contourValue), 
					y: 1
				},{
					x: 0, 
					y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
				}];		
			}
			else{
				relativePosition = [{
					x: 0, 
					y: 1 - this._lerp(cornerValues[3], cornerValues[0], contourValue)
				},{
					x: 0, 
					y: 1 - this._lerp(cornerValues[3], cornerValues[0], contourValue)
				}];	
				if (diff && diff[0] === -1){
					relativePosition = [{
						x: 0, 
						y: 1 - this._lerp(cornerValues[3], cornerValues[0], contourValue)
					},{
						x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
						y: 1
					}];	
				}
			}
		} 
		else if (type === 2 || type === 13){
			next = [E,S];
			if (type === 13){
				relativePosition = [{
					x: this._lerp(cornerValues[2], cornerValues[3], contourValue), 
					y: 1
				},{
					x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
					y: 1
				}];	
				if (diff && diff[1] === 1){
					relativePosition = [{
						x: this._lerp(cornerValues[2], cornerValues[3], contourValue), 
						y: 1
					},{
						x: 1, 
						y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
					}];	
				}
			} else {
				relativePosition = [{
					x: 1, 
					y: 1 - this._lerp(cornerValues[1], cornerValues[2], contourValue)
				},{
					x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
					y: 1
				}];	
			}	
		} 
		else if (type === 12 || type === 3) {
			next = [E,W];
			if (type === 3){
				relativePosition = [{
					x: 1, 
					y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
				},{
					x: 0, 
					y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
				}];	
			} else {
				relativePosition = [{
					x: 0, 
					y: 1 - this._lerp(cornerValues[3], cornerValues[0], contourValue)
				},{
					x: 1, 
					y: 1 - this._lerp(cornerValues[2], cornerValues[1], contourValue)
				}];	
			}
		} 
		else if (type === 4 || type === 11){
			next = [N,E];

			if (type === 11){
				relativePosition = [{
					x: 0, 
					y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
				},{
					x: 1, 
					y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
				}];	
				if (diff && diff[0] === 1){
					relativePosition = [{
						x: 0, 
						y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
					},{
						x: this._lerp(cornerValues[0], cornerValues[1], contourValue), 
						y: 0
					}];	
				}
			} else {
				relativePosition = [{
					x: this._lerp(cornerValues[1], cornerValues[0], contourValue), 
					y: 0
				},{
					x: 1,
					y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
				}];	
			}
		} 
		else if (type === 6 || type === 9) {
			next = [N,S];
			if (type === 6){
				relativePosition = [{
					x: this._lerp(cornerValues[0], cornerValues[1], contourValue), 
					y: 0
				},{
					x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
					y: 1
				}];	
			} else {
				relativePosition = [{
					x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
					y: 1
				},{
					x: this._lerp(cornerValues[0], cornerValues[1], contourValue), 
					y: 0
				}];	
			}	
		} 
		else if (type === 7 || type === 8) {
			next = [N,W];
			if (type === 7){
				relativePosition = [{
					x: 0, 
					y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
				},{
					x: this._lerp(cornerValues[0], cornerValues[1], contourValue), 
					y: 0
				}];	
				if (diff && diff[1] === -1){
					relativePosition = [{
						x: 0, 
						y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
					},{
						x: 0, 
						y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
					}];	
				}
			} else {
				relativePosition = [{
					x: 0, 
					y: this._lerp(cornerValues[3], cornerValues[0], contourValue),
				},{
					x: 1 - this._lerp(cornerValues[1], cornerValues[0], contourValue), 
					y: 0
				}];	
			}	
		}

		if (type === 5 || type === 10) {
			var avg = cornerValues.reduce(function(a, b) { return a + b; }) / cornerValues.length;
			if (avg < contourValue){
				type = type%10 + 5;
			}
		}

		if (type === 5) {
			if (!previousPos) return null;
			// 8
			if (diff[0] === -1){
				return {
					x: currentPos.x, 
					y: currentPos.y - 1,
					relativePosition: [{
						x: 0, 
						y: this._lerp(cornerValues[3], cornerValues[0], contourValue),
					},{
						x: 1 - this._lerp(cornerValues[1], cornerValues[0], contourValue), 
						y: 0
				}]
				};
			// 13
			} else if (diff[0] === 1){
				return {
					x: currentPos.x, 
					y: currentPos.y + 1,
					relativePosition: [{
						x: this._lerp(cornerValues[2], cornerValues[3], contourValue), 
						y: 1
					},{
						x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
						y: 1
					}]
				};
			// 2
			} else if (diff[1] === -1){
				return {
					x: currentPos.x - 1, 
					y: currentPos.y,
					relativePosition: [{
						x: 1, 
						y: 1 - this._lerp(cornerValues[1], cornerValues[2], contourValue)
					},{
						x: 0, 
						y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
					}]
				};
			// 7
			} else if (diff[1] === 1){
				return {
					x: currentPos.x + 1, 
					y: currentPos.y,
					relativePosition: [{
						x: 0, 
						y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
					},{
						x: 1, 
						y: 1 - this._lerp(cornerValues[2], cornerValues[1], contourValue)
					}]
				};
			}
		}	
		else if (type === 10) {
			if (!previousPos) return null;
			var diff = [previousPos.x - currentPos.x, previousPos.y - currentPos.y];
			// 11
			if (diff[0] === -1){
				return {
					x: currentPos.x, 
					y: currentPos.y - 1,
					relativePosition: [{
						x: 1, 
						y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
					},{
						x: 1 - this._lerp(cornerValues[1], cornerValues[0], contourValue), 
						y: 0
					}]
				};
			// 14
			} else if (diff[0] === 1){
				return {
					x: currentPos.x, 
					y: currentPos.y + 1,
					relativePosition: [{
						x: 0, 
						y: 1 - this._lerp(cornerValues[3], cornerValues[0], contourValue)
					},{
						x: this._lerp(cornerValues[3], cornerValues[2], contourValue), 
						y: 1
					}]
				};
			// 4
			} else if (diff[1] === -1){
				return {
					x: currentPos.x + 1, 
					y: currentPos.y,
					relativePosition: [{
						x: this._lerp(cornerValues[1], cornerValues[0], contourValue), 
						y: 0
					},{
						x: 1,
						y: this._lerp(cornerValues[1], cornerValues[2], contourValue)
					}]	
				};
			// 1
			} else if (diff[1] === 1){
				return {
					x: currentPos.x - 1, 
					y: currentPos.y,
					relativePosition: [{
						x: 1 - this._lerp(cornerValues[2], cornerValues[3], contourValue), 
						y: 1
					},{
						x: 0, 
						y: this._lerp(cornerValues[0], cornerValues[3], contourValue)
					}]
				};
			}
		}	

		if (!previousPos || (currentPos.x + next[0][0] === previousPos.x && currentPos.y + next[0][1] === previousPos.y)){
			return {x: currentPos.x + next[1][0], y: currentPos.y + next[1][1], relativePosition};
		}
		else return {x: currentPos.x + next[0][0], y: currentPos.y + next[0][1], relativePosition};
	},


	_lerp: function(low1, high1, value) {
		var low2 = 0.3, high2 = 0.7;
	  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
	},

	draw: function(){
		var style = this._shader.getLayers()[1].getStyle({}, {zoom: 2});
		var cellsY = this.globalGrid.length-1;
		var ctx = this._ctx;
		ctx.strokeStyle = style["-isoline-line-color"] || "black";
		ctx.lineWidth = style["-isoline-line-width"] || 2;
		ctx.globalAlpha = style["-isoline-line-opacity"] || 0.8;			
		var grad = style["-isoline-line-ramp"] && this._generateGradient(style["-isoline-line-ramp"].args, contourValues);
		var contourValues = this.contourValues;
		for (var c = 0; c < this.lines.length; c++){
			var thisContour = this.lines[c];
			if(style["-isoline-line-decay"]){
				var max = contourValues[contourValues.length - 1];
				ctx.globalAlpha = (contourValues[c]/max)*(style["-isoline-line-opacity"] || 0.8);
			}
			if(grad){
				ctx.strokeStyle = "rgb("+grad[4*contourValues[c]]+","+grad[4*contourValues[c]+1]+","+grad[4*contourValues[c]+2]+")";
				ctx.fillStyle = "rgb("+grad[4*contourValues[c]]+","+grad[4*contourValues[c]+1]+","+grad[4*contourValues[c]+2]+")";
			}
			for (var l = 0; l < thisContour.length; l++){
				if(style["-isoline-line-decay"]){
					ctx.globalAlpha = (contourValues[c]/max)*(style["-isoline-line-opacity"] || 0.8);
				}
				var line = this._cardinalSpline(thisContour[l]);
				ctx.beginPath();
				ctx.moveTo(line[0][0], line[0][1]);
				for (var p = 2; p < line.length; p+=2){
					ctx.lineTo(line[p], line[p+1]);
				}
				ctx.closePath();
				ctx.stroke();
				if (style["-isoline-mode"] === "isoband"){
					// var savedOpacity = ctx.globalAlpha;
					// ctx.globalAlpha = 1;
					// ctx.globalCompositeOperation = 'destination-out';
					// ctx.fill();
					// ctx.globalAlpha = savedOpacity;
					// ctx.globalCompositeOperation = 'source-over';
					ctx.fill();
				}
			}
		}
	},

	generateIsolines: function(){
		var grid = this.globalGrid;
		var self = this;
		var contourValues = this.contourValues;
		if (grid.length > 0) {
			var res = this.options.resolution;
			var startPos = this.firstTileCoords.pos;
			for (var c = 0; c < contourValues.length; c++) {
				this.lines[c] = [];
				var pointsTraveled = new Set();
				var pointerX = 0, pointerY = 0, x = 0, y = 0;
				var line = [];
				var xy = march(0,0);

				while(xy){
					xy = march(xy.x, xy.y);
				}

				function march(x,y){
					if(x >= grid[0].length){
						pointerX = 0;
						pointerY++;
						return {x: pointerX, y: pointerY };
					}
					if (pointerX === 0 && y > grid.length-2) return;
					if (pointsTraveled.has(x+":"+y) && line.length === 0) {
						pointerX ++;
						return {x: pointerX, y: pointerY };
					}
					else{
						pointsTraveled.add(x+":"+y);
						var NW = grid[y]? grid[y][x]: 0,
						    NE = grid[y]? grid[y][x+1]: 0,
						    SE = grid[y+1]? grid[y+1][x+1]: 0,
						    SW = grid[y+1]? grid[y+1][x]: 0;
						var cornerValues = [NW, NE, SE, SW];
						var currentPos = {x: x, y: y};
						var previousPos = line.length > 0? {x: line[line.length-1].coord.x, y: line[line.length-1].coord.y}: null;
						var next = self._getNext(currentPos, previousPos, cornerValues, contourValues[c]);
						if (next){
							if (line.length > 0 && (line[0].coord.x === x && line[0].coord.y === y)){
								self.lines[c].push(line);
								line = [];
								pointerX ++;
								return {x: pointerX, y: pointerY };
							}
							else{
								line.push({coord: {x: x, y: y, relativePosition: next.relativePosition}, values: cornerValues});
								return next;
							} 
						}
						else {
							pointerX ++;
							return {x: pointerX, y: pointerY };
						}
					}
				}
			}
			this.draw();
			
		}
	}
});

module.exports = IsoRenderer;