var torque = require('../../lib/torque/index');

QUnit.module('leaflet-torque-layer');

test('exposes key property', function(assert) {
  var torqueLayer = new L.TorqueLayer({});
  assert.equal(torqueLayer.key, 0);
  assert.equal(torqueLayer.getKey(), torqueLayer.key);
});
