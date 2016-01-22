/*
 Based on simpleheat, a tiny JavaScript library for drawing heatmaps with Canvas, 
 by Vladimir Agafonkin
 https://github.com/mourner/simpleheat
*/

'use strict';

function torque_filters(canvas, options) {
    // jshint newcap: false, validthis: true
    if (!(this instanceof torque_filters)) { return new torque_filters(canvas, options); }

    options = options || {};

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;

    this._max = 1;
    this._data = [];

    this.canvasClass = options.canvasClass;
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
        var canvas = this._createCanvas(),
            ctx = canvas.getContext('2d'),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(+i, grad[i]);
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
        this._colorize(colored.data, this._grad);
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

    _createCanvas: function() {
        return this.canvasClass
            ? new this.canvasClass()
            : document.createElement('canvas');
    }
};

module.exports = torque_filters;
