var torque = require('../../lib/torque');

QUnit.module('renderer/point');

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

test('render conditional point layers', function() {
  var css = [
  '#test {',
  'marker-width: 10;',
  '[zoom = 18] {',
    'marker-width: 20;',
  '}}'].join('\n');

  renderer.setCartoCSS(css)

  var layer = renderer._shader.getLayers()[0];
  var st = layer.getStyle({}, { zoom: 10, 'frame-offset': 0 });
  equal(st['marker-width'], 10);
  st = layer.getStyle({}, { zoom: 18, 'frame-offset': 0 });
  equal(st['marker-width'], 20);
});

test('should generate sprite when maker-fill > 0', function() {
  var css = [
  '#test {',
  '  marker-width: 10;',
  '}'].join('\n');

  renderer.setCartoCSS(css)
  var layer = renderer._shader.getLayers()[0];
  var sprite = renderer.generateSprite(layer, 0, { zoom: 0 })
  notEqual(sprite, null);
});


test('should not generate sprite when maker-fill: 0', function() {
  var css = [
  '#test {',
  '  marker-width: 0;',
  '}'].join('\n');

  renderer.setCartoCSS(css)
  var layer = renderer._shader.getLayers()[0];
  var sprite = renderer.generateSprite(layer, 0, { zoom: 0 })
  equal(sprite, null);
});

test('should not generate sprite when maker-opacity: 0', function() {
  var css = [
  '#test {',
  '  marker-width: 10;',
  '  marker-opacity: 0;',
  '}'].join('\n');

  renderer.setCartoCSS(css)
  var layer = renderer._shader.getLayers()[0];
  var sprite = renderer.generateSprite(layer, 0, { zoom: 0 })
  equal(sprite, null);
});

test('get value for position', function() {
  var mercator = new torque.Mercator();
  tile = {
    timeCount: [1],
    timeIndex: [0],
    renderDataPos: [0],
    renderData: [5],
    x: [100],
    y: [3],
    coord: { x: 0, y: 0, z: 0 }
  };
  renderer.options = {
    resolution: 1
  };
  var v = renderer.getValueFor(tile, 0, 100, 255 - 3);
  var bbox = mercator.tilePixelBBox(0, 0, 0, 100, 255 - 3, 1);
  equal(v.bbox[0].lat, bbox[0].lat);
  equal(v.bbox[1].lat, bbox[1].lat);
  equal(v.bbox[0].lon, bbox[0].lon);
  equal(v.bbox[1].lon, bbox[1].lon);
  equal(v.value, 5);

  v = renderer.getValueFor(tile, 0, 100, 255 - 4);
  equal(v, null);
  v = renderer.getValueFor(tile, 0, 99, 255 - 3);
  equal(v, null);
});

test('get values for tile', function() {
  var mercator = new torque.Mercator();
  tile = {
    timeCount: [2],
    timeIndex: [0],
    renderDataPos: [0, 0],
    renderData: [5, 7],
    x: [100],
    y: [3],
    coord: { x: 0, y: 0, z: 0 }
  };
  renderer.options = {
    resolution: 1
  };
  v = renderer.getValues(tile, 0);
  equal(v[0], 5);
  equal(v[1], 7);
});
