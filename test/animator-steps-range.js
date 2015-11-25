var AnimatorStepsRange = require('../lib/torque/animator-steps-range');

QUnit.module('animator-steps-range');

test('start and end props are available', function(assert) {
  var stepsRange = validStepsRange();
  assert.equal(stepsRange.start, 0);
  assert.equal(stepsRange.end, 4);
});

test('.lastStep returns true if given last step', function(assert) {
  var stepsRange = validStepsRange();
  assert.ok(stepsRange.isLast(stepsRange.end));

  assert.notOk(stepsRange.isLast(3));
  assert.notOk(stepsRange.isLast(42));
  assert.notOk(stepsRange.isLast(true));
  assert.notOk(stepsRange.isLast());
  assert.notOk(stepsRange.isLast('whatever'));
});

test('.diff returns the steps between start and end', function(assert) {
  var stepsRange = validStepsRange();
  assert.equal(stepsRange.diff(), 4);
});

test('throws error in inconsistent range', function(assert) {
  assert.throws(function() { new AnimatorStepsRange(4, 3) });
  assert.throws(function() { new AnimatorStepsRange(4, 4) });
});

function validStepsRange() {
  return new AnimatorStepsRange(0, 4);
}
