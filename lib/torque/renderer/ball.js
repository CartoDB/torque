////////////////////////////////
// Torque BallRenderer
// CartoDB, 2015
// developed by Francisco Dans
////////////////////////////////

function BallRenderer(thecanvas){
	this.canvas = thecanvas;
	this.ctx = this.canvas.getContext("2d");
	this.width = this.canvas.width;
	this.height = this.canvas.height;
	this.size = this.width * this.height;
	this.pointLayer = new Uint8ClampedArray(this.size * 4);
	this.radius = 30;
	this.drawnTemp = {};
	this.prof = 0;
	this.gradient = {};
	this.ballsSoFar = 0;
	this.balls = 0;
	this.cumulative = true;
}
BallRenderer.prototype = {
	addBall: function(x0, y0){
		if(this.cachedBall){
			var startingPoint = this.getRIndexPos(x0, y0) - this.radius * this.width *4 - this.radius*4;
			var i = 0, 
			pointer = startingPoint, 
			ballWidth = (this.radius*2)*4
			linemax = startingPoint + 2 * this.radius*4,
			endPoint = this.getRIndexPos(x0, y0) + this.radius * this.width *4 + this.radius;
			while (pointer <= endPoint){
				while (pointer <= linemax){
					this.pointLayer[pointer+3] += this.cachedBall[i+3];
					i+=4;
					pointer+=4;
				}
				linemax += this.width * 4;
				pointer += this.width * 4 - ballWidth -4;
			}
		}
		else{
			this.cachedBall = new Uint8ClampedArray(Math.pow(2 * this.radius + 1, 2)*4);
			x0 = this.radius;
			y0 = this.radius;
			var orad = this.radius;
	        var x = this.radius;
	        var y = 0;
	        var radiusError = 1 - x;
	        while (x >= y){
	        	// Try not to touch the following, it's a pain in the ass to write
	            this.horizontalLine(-x + x0, x + x0, y + y0, x0,y0);
	            this.horizontalLine(-y + x0, y + x0, -x + y0, x0,y0);
	            this.horizontalLine(-x + x0, x + x0, -y + y0, x0,y0);
	            this.horizontalLine(-y + x0, y + x0, x + y0, x0,y0);
	            ++y;
	            if (radiusError<0){
	                radiusError += 2 * y + 1;
	            }
	            else{
	                --x;
	                radiusError += 2 * (y - x) + 1;
	            }
	        }
	        this.drawnTemp = {};
		}
        
	},
	horizontalLine: function(xi, xf, yi, x0, y0){
		// Assumes xi is on the left and xf is on the right
		if(typeof this.drawnTemp[yi] === "undefined"){
			while (xi <= xf){
				this.addPoint(xi, yi, 30 - ((30 * this.lineDistance(xi, yi,x0,y0)) / this.radius));
				++xi;
			}
			this.drawnTemp[yi]=true;
		}
	},
	addPoint: function(x, y, alpha){
		var indexPos = (y*(this.radius*2+1)+x)*4;
		this.cachedBall[indexPos + 3] = this.cachedBall[indexPos + 3] + alpha;
	},
	map_range: function(value, low1, high1, low2, high2) {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },
    lineDistance: function(x,y,x0,y0){
		  var xs = Math.pow(x - x0, 2);
		  var ys = Math.pow(y - y0, 2);
		  return Math.sqrt( xs + ys );
	},
	draw: function(dataArray){
		if (!dataArray){
			if (this.isoplethLayer) dataArray = this.isoplethLayer;
			else if (this.contourLayer) dataArray = this.contourLayer;
			else dataArray = this.pointLayer;
		}
		if(!this.imageData) this.imageData = this.ctx.createImageData(this.width, this.height);
	    this.imageData.data.set(dataArray);
	    this.ctx.putImageData(this.imageData, 0, 0);
	},
	mergeLayers: function(from, to){
		if (from.length !== to.length) throw("layers aren't of the same size"); return;
		for (var i = 0; i<to.length; i++){
			if(from[i+3]>0){
				// There's a better way of doing this but I was lazy.
				to[i] = from[i];
				to[i+1] = from[i+1];
				to[i+2] = from[i+2];
				to[i+3] = from[i+3];
			}
		}
	},
	reduceArray: function(){

	},
	expandArray: function(){

	},
	invalidate: function(full){
		this.pointLayer = new Uint8ClampedArray(this.size * 4);
		if(this.contourLayer){
			this.contourLayer = new Uint8ClampedArray(this.size * 4);
			if(this.isoplethLayer){
				this.isoplethLayer = new Uint8ClampedArray(this.size * 4);
			}
		} 
	},
	getRIndexPos: function(x,y){
		var rIndexPos = (y*this.width+x)*4;
		return rIndexPos;
	},
	getXYFromRIndex: function(index){
		var x = (index % (this.width*4))/4;
		var y = (index - 4 * x) / (4 * this.width);
		return [x,y];
	},
	// Clockwise. Again, there definitely is a better way.
	getNeighbors: function(index){
		var tw = this.width*4;
		var n = index - tw;
		var s = index + tw;
		return [n, n + 4, index + 4, s + 4, s, s - 4, index - 4, n -4];
	},
    isEmpty: function(layer) {
    	for (var i = 0; i<layer.length; i+=4){
    		if(layer[i+3] > 0) return false;
    	}
    	return true;
    },
    isInvalid: function(layer) {
    	for (var i = 0; i<layer.length; i+=4){
    		if(layer[i+3]!==0 && !layer[i+3]) return true;
    	}
    	return false;
    },
    createArray: function(){
    	return new Uint8ClampedArray(this.size * 4);
    },
    isopleth: function(){
    	for (var i = 0, len = this.contourLayer.length; i<len; i+=4){
    		var alpha = this.contourLayer[i + 3];
    		if (alpha > 0 && alpha < 255){
    			var neighbors = this.getNeighbors(i);
    			for (var n = 0, ln = neighbors.length; n<ln; n++){
    				var index = neighbors[n];
    				if(this.contourLayer[index+3] === 0 || this.contourLayer[index+3] !== this.contourLayer[i+3]){
    					this.isoplethLayer[index+3] = 255;
    					this.isoplethLayer[index] = this.contourLayer[index+3];
    					this.isoplethLayer[index+1] = this.contourLayer[index+3];
    					this.isoplethLayer[index+2] = this.contourLayer[index+3];
    				}
    			}
    		}
    	}
    },
    colorize: function (pixels, gradient) {
        for (var i = 3, len = pixels.length, j; i < len; i += 4) {
            j = pixels[i] * 4; // get gradient color from opacity value

            if (j) {
                pixels[i - 3] = gradient[j];
                pixels[i - 2] = gradient[j + 1];
                pixels[i - 1] = gradient[j + 2];
            }
        }
    }
}

module.exports = BallRenderer;