var torque = require('../lib/torque');
var sinon = require('sinon');
require('phantomjs-polyfill');

asyncTest('time moves', function(assert) {
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.start();
	setTimeout(function(){
		assert.notEqual(animator._time, 0);
		QUnit.start();
	}, 100)
	animator.pause();
});

test("rescale should resume animation if previously playing", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.toggle();
	animator.rescale();
	assert.ok(animator.running);
	animator.pause()
});

test("rescale shouldn't resume animation if previously paused", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.pause();
	animator.rescale();
	assert.notOk(animator.running);
});

asyncTest("onStart runs properly", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.options.onStart = function(){
		assert.ok(true);
		animator.pause();
		QUnit.start();
	};
	animator.start();
});

test("stop should take the pointer to position zero", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.stop()
	assert.equal(animator._time, 0);
});

test("stop should call onStop", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.options.onStop = function(){
		assert.ok(true);
		animator.pause();
	};
	animator.stop();
});

test("altering steps should rescale", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	sinon.spy(animator, "rescale");
	animator.steps(600);
	assert.ok(animator.rescale.calledOnce);
});

asyncTest("tick should set time to zero if steps are bigger than range", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	animator.start();
	setTimeout(function(){
		animator._time = 0;
		animator.step(800);
		assert.ok(animator.step() < 800);
		QUnit.start();
	}, 200);
	animator.pause();
});

QUnit.test("tick should pause animation on end if loop is disabled", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
	var done = assert.async();
	animator.options.loop = false;
	animator.toggle();
	animator.step(600);
	setTimeout(function(){
		assert.equal(animator._time,animator.options.animationDuration);
		done();
	}, 200);
});
