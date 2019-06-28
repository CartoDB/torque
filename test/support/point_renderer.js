const { createCanvas, Canvas, Image }= require('canvas');
var request = require('request');
var _ = require('underscore');
var fs = require('fs');

var torque = require('../../lib/torque/index');


function getTile(jsonRelPath, cartocss, z, x, y, step, callback) {
    step = step || 0;

    var cartoCssOptions = torque.common.TorqueLayer.optionsFromCartoCSS(cartocss);

    var provider = new torque.providers.windshaft(_.extend({ no_fetch_map: true }, cartoCssOptions));
    var rendererOptions = _.extend({cartocss: cartocss}, cartoCssOptions, {
        canvasClass: Canvas,
        imageClass: Image,
        setImageSrc: function(img, url, callback) {
            var requestOpts = {
                url: url,
                method: 'GET',
                encoding: null
            };
            request(requestOpts, function (err, response, body) {
                if (!err && response.statusCode === 200) {
                    img.onload = function() {
                        callback(null);
                    };
                    img.onerror = function() {
                        callback(new Error('Could not load marker-file image: ' + url));
                    };
                    img.src = body;
                } else {
                    callback(new Error('Could not load marker-file image: ' + url));
                }
            });
        },
        qualifyURL: function(url) {
            return url;
        },
        layer: {
            showLimitErros: false
        }
    });

    var rows = JSON.parse(fs.readFileSync(__dirname + '/../fixtures/json/' + jsonRelPath));

    var canvas = createCanvas(256, 256);
    var pointRenderer = new torque.renderer.Point(canvas, rendererOptions);
    provider.proccessTile(rows, {x: x, y: y}, z, function(tile){
      pointRenderer.renderTile(tile, step, function(err) {
          if (err) {
              return callback(err, null);
          }
          pointRenderer.applyFilters();
          return callback(null, canvas);
      });
    }.bind(this));

}

module.exports = {
    getTile: getTile
};
