var torque = require('../lib/torque');
var sinon = require('sinon');
require('phantomjs-polyfill');

QUnit.module('animator');

test('time moves', function(assert) {
	var done = assert.async();
	var animatora = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animatora.start();
	setTimeout(function(){
		assert.notEqual(animatora._time, 0);
		animatora.pause();
		done();
	}, 20)
});

test("rescale should resume animation if previously playing", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.toggle();
	animator.rescale();
	assert.ok(animator.running);
	animator.pause()
});

test("rescale shouldn't resume animation if previously paused", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.pause();
	animator.rescale();
	assert.notOk(animator.running);
});

test("onStart runs properly", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.options.onStop = function(){
		assert.ok(true);
		animator.pause();
	};
	animator.stop();
});

test(".stepsRange sets a custom range with valid input", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	var customStepsRange = animator.stepsRange(101, 202);
	assert.ok(customStepsRange);
	assert.equal(customStepsRange.start, 101);
	assert.equal(customStepsRange.end, 202);

	var didCallOnStepsRange = false;
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2,
		onStepsRange: function() {
		  didCallOnStepsRange = true;
		}
	});
	animator.stepsRange(101, 202);
	assert.ok(didCallOnStepsRange);
});

test(".stepsRange throws error if given range is outside default range", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	assert.throws(function() { animator.stepsRange(1, 501) });
	assert.throws(function() { animator.stepsRange(-1, 500) });
	assert.throws(function() { animator.stepsRange(-1, 9000) });
});

test(".removeCustomStepsRange should remove any custom steps range", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.removeCustomStepsRange();
	animator.stepsRange(101, 202);
	var customStepsRange = animator.stepsRange();
	animator.removeCustomStepsRange();
	var defaultStepsRange = animator.stepsRange();
	assert.ok(defaultStepsRange);
	assert.notEqual(defaultStepsRange, customStepsRange);
	assert.equal(defaultStepsRange.start, 0);
	assert.equal(defaultStepsRange.end, 500);

	var didCallOnStepsRange = false;
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2,
		onStepsRange: function() {
		  didCallOnStepsRange = true;
		}
	});
	animator.stepsRange(101, 202);
	animator.removeCustomStepsRange();
	assert.ok(didCallOnStepsRange);
});

test("stop should take the pointer to position zero by default", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.stop()
	assert.equal(animator._time, 0);
});

test("stop should take the pointer to start position for custom range", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.stepsRange(42, 137);
	animator.stop()
	assert.equal(animator._time, 42);
});

test("stop should call onStop", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.options.onStop = function(){
		assert.ok(true);
		animator.pause();
	};
	animator.stop();
});

test("altering steps should rescale", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	sinon.spy(animator, "rescale");
	animator.steps(600);
	assert.ok(animator.rescale.calledOnce);
});

test("tick should set time to zero if steps are bigger than default range", function(assert){
	var done = assert.async();
	var animatorb = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animatorb.start();
	animatorb.step(800);
	setTimeout(function(){
		console.log(animatorb.step());
		assert.ok(animatorb.step() | 0 === 0);
		done();
	}, 20);
	animatorb.pause();
});

test("tick should set time to start step if steps are bigger than custom range", function(assert){
	var done = assert.async();
	var animatorb = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animatorb.start();
	animatorb.step(800);
	animatorb.stepsRange(42, 137);
	setTimeout(function(){
		console.log(animatorb.step());
		// round step to an integer
		assert.ok(animatorb.step() | 0 === 42);
		done();
	}, 20);
	animatorb.pause();
});

test("tick should pause animation on end if loop is disabled", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.options.loop = false;
	animator.toggle();
	animator.step(600);
	assert.equal(animator._time,animator.options.animationDuration);
});
