var torque = require('../lib/torque/core');

QUnit.module('animator');

var animator = null;

QUnit.testStart(function() {
    animator = new torque.Animator();
});

test('time moves', function() {
  animator.start();
});