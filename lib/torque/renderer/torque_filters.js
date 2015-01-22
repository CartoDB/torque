/*
 Based on simpleheat, a tiny JavaScript library for drawing heatmaps with Canvas, 
 by Vladimir Agafonkin
 https://github.com/mourner/simpleheat
*/

'use strict';

function torque_filters(canvas) {
    // jshint newcap: false, validthis: true
    if (!(this instanceof torque_filters)) { return new torque_filters(canvas); }

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;

    this._max = 1;
    this._data = [];
}

torque_filters.prototype = {

    defaultGradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
    },

    gradient: function (grad) {
        // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    draw: function () {
        if (!this._grad) {
            this.gradient(this.defaultGradient);
        }

        var ctx = this._ctx;
        var colored = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        //this._colorize(colored.data, this._grad);
        this._brilliance(colored.data);
        ctx.putImageData(colored, 0, 0);

        return this;
    },

    _colorize: function (pixels, gradient) {
        for (var i = 3, len = pixels.length, j; i < len; i += 4) {
            j = pixels[i] * 4; // get gradient color from opacity value

            if (j) {
                pixels[i - 3] = gradient[j];
                pixels[i - 2] = gradient[j + 1];
                pixels[i - 1] = gradient[j + 2];
            }
        }
    },

    _brilliance: function(pixels){
        function hslToRgb(h, s, l){
            var r, g, b;

            if(s == 0){
                r = g = b = l; // achromatic
            }else{
                var hue2rgb = function hue2rgb(p, q, t){
                    if(t < 0) t += 1;
                    if(t > 1) t -= 1;
                    if(t < 1/6) return p + (q - p) * 6 * t;
                    if(t < 1/2) return q;
                    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                }

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }

            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }

        function rgbToHsl(r, g, b) {
              r /= 255, g /= 255, b /= 255;
              var max = Math.max(r, g, b), min = Math.min(r, g, b);
              var h, s, l = (max + min) / 2;

              if(max == min){
                  h = s = 0; // achromatic
              } else {
                  var d = max - min;
                  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                  switch(max){
                      case r: h = (g - b) / d ; break;
                      case g: h = 2 + ( (b - r) / d); break;
                      case b: h = 4 + ( (r - g) / d); break;
                  }
                  h*=60;
                  if (h < 0) h +=360;
              }
             return([h, s, l]);
          } 


        var refColor = rgbToHsl(189, 100, 194);

        for (var i = 3; i < pixels.length; i += 4) {
            var opacity = pixels[i]/255;
            if (opacity > 0) {
                var colorWithBrilliance = hslToRgb(refColor[0]/360, refColor[1], opacity);
                // pixels[i] = 255;
                pixels[i - 3] = colorWithBrilliance[0];
                pixels[i - 2] = colorWithBrilliance[1];
                pixels[i - 1] = colorWithBrilliance[2];
            }
        }
    }
};

module.exports = torque_filters;
