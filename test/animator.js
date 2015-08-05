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
		done();
	}, 20)
	animatora.pause();
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

test("stop should take the pointer to position zero", function(assert){
	var animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animator.stop()
	assert.equal(animator._time, 0);
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

test("tick should set time to zero if steps are bigger than range", function(assert){
	var done = assert.async();
	var animatorb = new torque.Animator(function(){}, {steps: 500, animationDuration: 2});
	animatorb.start();
	animatorb.step(800);
	setTimeout(function(){
		console.log(animatorb.step());
		assert.ok(animatorb.step() < 800);
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
