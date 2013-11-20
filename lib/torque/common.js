//
// common functionallity for torque layers
//

(function(exports) {

function TorqueLayer() {}

TorqueLayer.prototype = {
};

TorqueLayer.optionsFromLayer = function(mapConfig) {
  var opts = {};
  if (!mapConfig) return opts;
  var attrs = {
    'buffer-size': 'buffer-size',
    '-torque-steps': 'steps',
    '-torque-resolution': 'resolution',
    '-torque-animation-duration': 'animationDuration',
    '-torque-aggregation-function': 'countby',
    '-torque-time-attribute': 'column',
    '-torque-data-aggregation': 'data_aggregation'
  };
  for (var i in attrs) {
    var v = mapConfig.eval(i);
    if (v !== undefined) {
      var a = attrs[i];
      opts[a] = v;
    }
  }
  return opts;
};

TorqueLayer.optionsFromCartoCSS = function(cartocss) {
  var shader = new carto.RendererJS().render(cartocss);
  var mapConfig = shader.findLayer({ name: 'Map' });
  return L.TorqueLayer.optionsFromLayer(mapConfig);
};

exports.torque.common = torque.common || {};
exports.torque.common.TorqueLayer = TorqueLayer;

})(typeof exports === "undefined" ? this : exports);
