var Canvas = require('canvas');
var image = require('../support/image');

QUnit.module('example');

test('reference test with canvas', function() {
    var circleRadius = 20;
    var canvasSize = circleRadius * 2 + 2;
    var canvas = new Canvas(canvasSize, canvasSize);

    var ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.arc(circleRadius + 1, circleRadius + 1, circleRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    var imageDiff = image.compare(canvas.toBuffer(), 'canvas_basic_reference.png');

    equal(imageDiff, 0);
});
