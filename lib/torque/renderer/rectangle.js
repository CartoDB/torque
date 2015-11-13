var torque = require('../');
var cartocss = require('./cartocss_render');
var Profiler = require('../profiler');
var carto = global.carto || require('carto');
var Filters = require('./torque_filters');
var PointRenderer = require('./point')

var PixelRenderer = function(canvas, options) {
  PointRenderer.call(this, canvas, options);
}

torque.extend(PixelRenderer.prototype, PointRenderer.prototype, {

    generateSprite: function(shader, value, shaderVars) {
      var self = this;
      var prof = Profiler.metric('torque.renderer.point.generateSprite').start();
      var st = shader.getStyle({
        value: value
      }, shaderVars);
      if(this._style === null || this._style !== st){
        this._style = st;
      }

      return {
        width: st['marker-width'],
        color: st['marker-fill']
      }
    },

    _renderTile: function(tile, key, frame_offset, sprites, shader, shaderVars) {
      if (!this._canvas) return;
      var prof = Profiler.metric('torque.renderer.point.renderTile').start();
      var ctx = this._ctx;
      if (this.options.cumulative && key > tile.maxDate) {
        //TODO: precache because this tile is not going to change
        key = tile.maxDate;
      }
      var tileMax = this.options.resolution * (this.TILE_SIZE/this.options.resolution - 1)
      var activePixels = tile.x.length;
      var anchor = this.options.resolution/2;
      if (activePixels) {
        var pixelIndex = 0;//tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
            var posIdx = tile.renderDataPos[pixelIndex + p];
            var c = tile.renderData[pixelIndex + p];
            var sp = sprites[c];
            if (sp === undefined) {
               sp = sprites[c] = this.generateSprite(shader, c, torque.extend({ zoom: tile.z, 'frame-offset': frame_offset }, shaderVars));
            }
            if (sp) {
              var x = tile.x[posIdx]- (sp.width >> 1) + anchor;
              var y = tileMax - tile.y[posIdx] + anchor; // flip mercator
              ctx.fillStyle = sp.color;
              ctx.fillRect(x, y, sp.width, sp.width);
            }
        }
      }
    }
});

module.exports = PixelRenderer;
