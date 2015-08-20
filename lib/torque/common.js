//
// common functionallity for torque layers
//
var carto = global.carto || require('carto');

function TorqueLayer() {}

TorqueLayer.prototype = {
};

TorqueLayer.optionsFromLayer = function(mapConfig) {
  var opts = {};
  if (!mapConfig) return opts;
  var attrs = {
    'buffer-size': 'buffer-size',
    '-torque-frame-count': 'steps',
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
  var renderer = cartocss.indexOf("-isoline-") > -1? "iso":"point";
  var shader = new carto.RendererJS().render(cartocss);
  var mapConfig = shader.findLayer({ name: 'Map' });
  var options =  TorqueLayer.optionsFromLayer(mapConfig);
  options.renderer = renderer;
  return options;
};

module.exports.TorqueLayer = TorqueLayer;
