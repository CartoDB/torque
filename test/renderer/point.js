module('renderer/point');

var DEFAULT_CARTOCSS = [
  'Map {',
  ' -torque-resolution: 1;',
  '}',
  '#layer {',
  '  marker-fill: #662506;',
  '  marker-width: 4;',
  '  [value > 1] { marker-fill: #FEE391; }',
  '  [value > 2] { marker-fill: #FEC44F; }',
  '  [value > 3] { marker-fill: #FE9929; }',
  '  [value > 4] { marker-fill: #EC7014; }',
  '  [value > 5] { marker-fill: #CC4C02; }',
  '  [value > 6] { marker-fill: #993404; }',
  '  [value > 7] { marker-fill: #662506; }',
  '}'
].join('\n');

var renderer = null;
QUnit.testStart(function() {
    var canvas = document.createElement('canvas');
    renderer = new torque.renderer.Point(canvas, {});
});

test('render shader layers', function() {
  renderer.setCartoCSS(DEFAULT_CARTOCSS)
  var count = 0;
  renderer._renderTile = function() { ++count };
  renderer.renderTile(null, 0);
  equal(count, 1);
});
