var torque = require('../lib/torque');

QUnit.module('torque.core.Event');

  function TestObj(){}
  TestObj.prototype = torque.Event;

  test("on", function() {
    var called = false;
    var o = new TestObj();
    o.on('test', function()  { called = true});
    o.trigger('test');
    equal(called, true);
  });

  test("off", function() {
    var called = false;
    var o = new TestObj();
    function fn()  { called = true; }
    o.on('test', fn); 
    equal(o.callbacks('test').length, 1);
    o.off('test', fn);
    equal(o.callbacks('test').length, 0);
    o.trigger('test');
    equal(called, false);
    o.on('test', fn); 
    o.off('test');
    equal(o.callbacks('test').length, 0);
  });
