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
	this.radius = 15;
	this.drawnTemp = {};
	this.prof = 0;
	this.gradient = {};
	this.ballsSoFar = 0;
	this.balls = 0;
	this.cumulative = true;
	this.RW4 = this.radius * this.width *4;
	this.availableWorkers = 10;
}
BallRenderer.prototype = {
	getBallIndices: function(x, y){
		var indices = new Int8Array(2*r+1);

		return indices;
	},
	addBall: function(x0, y0){
		if(this.cachedBall){
			var startingPoint = this.getRIndexPos(x0, y0) - this.RW4 - this.radius*4;
			var i = 0, 
			pointer = startingPoint, 
			ballWidth = (this.radius*2)*4
			linemax = startingPoint + 2 * this.radius*4,
			endPoint = this.getRIndexPos(x0, y0) + this.RW4 + this.radius;
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
				this.addPoint(xi, yi, 20 - ((20 * this.lineDistance(xi, yi,x0,y0)) / this.radius));
				++xi;
			}
			this.drawnTemp[yi]=true;
		}
	},
	addPoint: function(x, y, alpha){
		var indexPos = (y*(this.radius*2+1)+x)*4;
		this.cachedBall[indexPos + 3] += alpha;
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
		var reductionFactor = 10;
		if(full){
			for (var i = 0; i< this.pointLayer.length; i+=4){
				this.pointLayer[i + 3] -= reductionFactor;
			}
		}
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
    contour: function(granularity){
		var step = 255/granularity;
		var i = 0, a = new Uint8ClampedArray(granularity+1), c=0;
		while (i<255){
			a[c] = i;
			i += step;
			c++;
		}
		a[a.length-1] = 255;
		var l = -step/2;
		var gradient = new Uint8ClampedArray(1024);
		for(var i = 0; i<a.length; i++){
			var y = Math.round(i*step);
			var thisAlpha = a[i];
			while(y<step*(i+1)){
				gradient[y*4+3] = thisAlpha;
				y++;
			}
		}
		if(!this.contourLayer) this.contourLayer = new Uint8ClampedArray(this.size * 4);
		for (var i = 0; i< this.pointLayer.length; i+=4){
			if(this.pointLayer[i+3] === 0) continue;
			var currentAlpha = this.pointLayer[i+3];
			this.contourLayer[i+3] = gradient[currentAlpha*4+3]*2;
			this.contourLayer[i+2] = gradient[255];
			this.contourLayer[i+1] = gradient[255];
			this.contourLayer[i+0] = gradient[255];
		}
	},
    isopleth: function(){
    	var iso = this.createArray();
    	var contour = this.contourLayer;
    	var eq = false;
    	for (var i = 0, len = contour.length; i<len; i+=4){
			if(!eq){
	    		var alpha = contour[i + 3];
	    		if (alpha > 0 && alpha < 255){
	    			var neighbors = this.getNeighbors(i);
	    			var refCol = contour[neighbors[0]+3];
	    			for (var n = 1, ln = neighbors.length; n<ln; ++n){
	    				if (contour[neighbors[n]+3] !== refCol) break;
	    				if (n === ln-1) eq = true;
	    			}
	    			if(!eq){
		    			for (var n = 0, ln = neighbors.length; n<ln; ++n){
		    				var index = neighbors[n];
		    				if(index>0 && (contour[index+3] === 0 || contour[index+3] !== contour[i+3])){
		    					iso[index + 3] = contour[i+3];
		    					iso[index] = 153;
		    					iso[index + 1] = 60;
		    					iso[index + 2] = 243;
		    				}
		    			}
		    		}
		    	}
    		}
	    	else{
	    		eq = false;
	    	}
    	}
    	this.isoplethLayer = iso;
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