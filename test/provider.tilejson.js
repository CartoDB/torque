var torque = require('../lib/torque/core');

var windshaft, url;
var lastCall;
var old_net;
QUnit.module('provider.tilejson', {
  setup: function() {
    old_net = torque.net.jsonp;
    old_get = torque.net.get;
    torque.net.jsonp = function(url, callback) {
      lastCall = url;
      callback({ layergroupid: 'testlg', metadata: { torque: { 0: { data_steps:10 }} } });
    };
    torque.net.get = function(url, callback) {
      lastCall = url;
      var tilejson = '{"tiles": ["./{z}/{x}/{y}.json.torque"], "end": 903000, "column_type": "number", "start": 1000, "data_steps": 1, "resolution": 32}';
      callback({response: tilejson});
    };
    windshaft = new torque.providers.tileJSON({
      tileJSON: 'http://what.ev.er/tilejson.json',
      cartocss: '#test{}',
      resolution: 1,
      steps: 10
    });
  }, 
  teardown: function() {
    torque.net.jsonp = old_net;
    torque.net.get = old_get;
  }
});

test("tile urls should be correctly formed for relative urls", function() {
  windshaft._ready = true;
  windshaft.getTileData({x: 0, y: 1, corrected: {x: 0, y: 1}}, 2, function() {});
  equal(lastCall,"http://what.ev.er/./2/0/1.json.torque");
});