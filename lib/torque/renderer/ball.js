//////////////////////////////////
// Torque BallRenderer          //
// CartoDB, 2015                //
// developed by Francisco Dans  //
//////////////////////////////////

function BallRenderer(torqueLayer){
	this.torqueLayer = torqueLayer;
	this.canvas = torqueLayer.renderer._canvas;
	this.ctx = this.canvas.getContext("2d");
	this.width = this.canvas.width;
	this.chWidth = this.canvas.width * 4;
	this.height = this.canvas.height;
	this.size = this.width * this.height;
	this.pointLayer = new Uint8ClampedArray(this.size * 4);
	this.drawnTemp = {};
	this.prof = 0;
	this.gradient = {};
	this.ballsSoFar = 0;
	this.balls = 0;
	this.cumulative = true;
	this.availableWorkers = 10;
	this.mode = "heat";
	this.cachedBalls = [];
	this.initialize();
}
BallRenderer.prototype = {
	initialize: function(){
		var self = this;
		this.torqueLayer._map.on("movestart", function(){ 
			self.transit = true
		});
		this.torqueLayer._map.on("moveend", function(){ 
			self.transit = false
		});
	},
	getBallIndices: function(x, y){
		var indices = new Int8Array(2*r+1);
		return indices;
	},
	addBall: function(x0, y0, st){
		this.radius = st["marker-width"];
		this.RW4 = this.radius * this.width *4;
		if(this.cachedBalls[this.radius]){
			if(x0 < 0 || y0 < 0 || x0 > this.width || y0 > this.height) return;
			var startingPoint = this.getRIndexPos(x0, y0) - this.RW4 - this.radius*4;
			var i = 0, 
			pointer = startingPoint, 
			ballWidth = (this.radius*2)*4
			linemax = startingPoint + 2 * this.radius*4,
			endPoint = this.getRIndexPos(x0, y0) + this.RW4 + this.radius;
			while (pointer <= endPoint){
				while (pointer <= linemax){
					this.pointLayer[pointer+3] += this.cachedBalls[this.radius][i+3];
					i+=4;
					pointer+=4;
				}
				linemax += this.width * 4;
				pointer += this.width * 4 - ballWidth -4;
			}
		}
		else{
			this.precacheBall(x0,y0);
		}
	},
	precacheBall: function(x0, y0){
		this.cachedBalls[this.radius]  = new Uint8ClampedArray(Math.pow(2 * this.radius + 1, 2)*4);
		x0 = this.radius;
		y0 = this.radius;
		var orad = this.radius;
        var x = this.radius;
        var y = 0;
        var radiusError = 1 - x;
        while (x >= y){
        	// Try not to touch the following, it's a pain in the ass to write
            this.horizontalLine(-x + x0, x + x0, y + y0, x0, y0);
            this.horizontalLine(-y + x0, y + x0, -x + y0, x0, y0);
            this.horizontalLine(-x + x0, x + x0, -y + y0, x0, y0);
            this.horizontalLine(-y + x0, y + x0, x + y0, x0, y0);
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
        
	},
	horizontalLine: function(xi, xf, yi, x0, y0){
		// Assumes xi is on the left and xf is on the right
		if(typeof this.drawnTemp[yi] === "undefined"){
			while (xi <= xf){
				this.addPoint(xi, yi, 50 - ((50 * this.lineDistance(xi, yi,x0,y0)) / this.radius));
				++xi;
			}
			this.drawnTemp[yi]=true;
		}
	},
	addPoint: function(x, y, alpha){
		var indexPos = (y*(this.radius*2+1)+x)*4;
		this.cachedBalls[this.radius][indexPos + 3] += alpha;
	},
	map_range: function(value, low1, high1, low2, high2) {
        return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
    },
    lineDistance: function(x,y,x0,y0){
		  var xs = Math.pow(x - x0, 2);
		  var ys = Math.pow(y - y0, 2);
		  return Math.sqrt( xs + ys );
	},
	draw: function(modeData, dataArray){
		switch (this.mode){
			case "contour":
				this.contour();
			case "isopleth":
				this.contour(5);
				this.isopleth();
			default:
				this.heatmap();
		}
		if (!dataArray){
			if (this.isoplethLayer) dataArray = this.isoplethLayer;
			else if (this.contourLayer) dataArray = this.contourLayer;
			else if (this.heatmapLayer) dataArray = this.heatmapLayer;
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
	invalidate: function(full){
		// if(!transit){
			for (var i = 0, len = this.pointLayer.length; i< len; i+=4){
			this.pointLayer[i + 3] -= 10;
			}
		// }
		// else{
		// 	this.pointLayer = new Uint8ClampedArray(this.size * 4);
		// }
		
		if(this.heatmapLayer){
		  this.heatmapLayer =  new Uint8ClampedArray(this.size * 4);
		}
		else if(this.contourLayer){
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
		var n = index - this.chWidth;
		var s = index + this.chWidth;
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
		if(!this.contourGradient){
			var step = 255/granularity;
			var i = 0, a = new Uint8ClampedArray(granularity+1), c=0;
			while (i<255){
				a[c] = i;
				i += step;
				c++;
			}
			a[a.length-1] = 255;
			var l = -step/2;
			this.contourGradient = new Uint8ClampedArray(1024);
			for(var i = 0; i<a.length; i++){
				var y = Math.round(i*step);
				var thisAlpha = a[i];
				while(y<step*(i+1)){
					this.contourGradient[y*4+3] = thisAlpha;
					y++;
				}
			}
		}
		var gradient = this.contourGradient;
		if(!this.contourLayer) this.contourLayer = new Uint8ClampedArray(this.size * 4);
		for (var i = this.pointLayer.length-4, alpha; i>=0; i-=4){
			if(this.pointLayer[i+3] > 0){
				var currentAlpha = this.pointLayer[i+3];
				this.contourLayer[i+0] = 255;
				this.contourLayer[i+1] = 105;
				this.contourLayer[i+2] = 180;
				this.contourLayer[i+3] = gradient[currentAlpha*4+3];
			}
		}
	},
    isopleth: function(){
    	var iso = this.createArray();
    	var contour = this.contourLayer;
    	var eq = false;
    	for (var i = 0, len = contour.length; i<len; i+=4){
			if(!eq){
	    		var alpha = contour[i + 3];
	    		if (alpha > 20 && alpha < 255){
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

    heatmap: function (gradient){
    	if(!gradient) gradient = {
	        0.4: 'blue',
	        0.6: 'cyan',
	        0.7: 'lightgreen',
	        0.9: 'yellow',
	        1.0: 'red'
	    };
    	if(JSON.stringify(this.gradient) !== JSON.stringify(gradient)){
    		this.gradient = gradient;
        	// create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
	        var canvas = document.createElement('canvas'),
	            ctx = canvas.getContext('2d'),
	            gradientColours = ctx.createLinearGradient(0, 0, 0, 256);

	        canvas.width = 1;
	        canvas.height = 256;

	        for (var i in gradient) {
	            gradientColours.addColorStop(+i, gradient[i]);
	        }

	        ctx.fillStyle = gradientColours;
	        ctx.fillRect(0, 0, 1, 256);
	        this.gradientData = ctx.getImageData(0, 0, 1, 256).data;
    	}
    	this.colorize();
    },

    colorize: function () {
    	var grad = this.gradientData;
    	if(!this.heatmapLayer) this.heatmapLayer = new Uint8ClampedArray(this.size * 4);
        for (var i = this.pointLayer.length-4, alpha; i>=0; i-=4){
            alpha = this.pointLayer[i+3] * 4; // get gradient color from opacity value

            if (alpha>0) {
                this.heatmapLayer[i] = grad[alpha]; // R
                this.heatmapLayer[i + 1] = grad[alpha + 1]; // G
                this.heatmapLayer[i + 2] = grad[alpha + 2]; // B
                this.heatmapLayer[i + 3] = alpha; 	// A
            }
        }
    },

    initColorWorkers: function(){
    	var workerCount = 3
    	this.colorWorkers = [];
	    for (var i = 0; i < workerCount; i++) {
	        this.colorWorkers.push(work(require('./colorWorker.js')));
	    }
    }
}

module.exports = BallRenderer;