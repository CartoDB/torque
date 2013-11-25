
module('torque');


test('gets metadata from cartocss', function() {
  var STYLE = [
  "Map { ",
  " buffer-size: 1;",
  " -torque-frame-count: 1;",
  " -torque-resolution: 2;",
  " -torque-animation-duration: 31;",
  " -torque-aggregation-function: 'avg(cartodb_id)';",
  " -torque-time-attribute: 'time';",
  " -torque-data-aggregation: 'cumulative';",
  "}",
  "#layer { ",
  " polygon-fill: #FFF;",
  "}"
  ].join('\n');
  var opts = torque.common.TorqueLayer.optionsFromCartoCSS(STYLE);
  equal(opts['buffer-size'], 1);
  equal(opts['steps'], 1);
  equal(opts['resolution'], 2);
  equal(opts['animationDuration'], 31);
  equal(opts['countby'], 'avg(cartodb_id)');
  equal(opts['column'],'time');
  equal(opts['data_aggregation'], 'cumulative');
})
