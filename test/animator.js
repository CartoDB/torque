var torque = require('../lib/torque');
var sinon = require('sinon');
require('phantomjs-polyfill');

var animator;

QUnit.module('animator', {
  beforeEach: function() {
  	animator = new torque.Animator(function(){}, {steps: 500, animationDuration: 10});
  }
});

asyncTest('time moves', function(assert) {
	animator.start();
	setTimeout(function(){
		console.log(animator.running);
		assert.notEqual(animator._time, 0);
		QUnit.start();
	}, 100)
	animator.pause();
});

test("rescale should resume animation if previously playing", function(assert){
	animator.toggle();
	animator.rescale();
	assert.ok(animator.running);
	animator.pause()
});

asyncTest("onStart runs properly", function(assert){
	animator.options.onStart = function(){
		assert.ok(true);
		animator.pause();
		QUnit.start();
	};
	animator.start();
});

test("stop should take the pointer to position zero", function(assert){
	animator.stop()
	assert.equal(animator._time, 0);
});

test("stop should call onStop", function(assert){
	animator.options.onStop = function(){
		assert.ok(true);
		animator.pause();
	};
	animator.stop();
});

test("altering steps should rescale", function(assert){
	sinon.spy(animator, "rescale");
	animator.steps(600);
	assert.ok(animator.rescale.calledOnce);
});

asyncTest("tick should set time to zero if steps are bigger than range", function(assert){
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
	animator.options.loop = false;
	var done = assert.async();
	animator.toggle();
	setTimeout(function(){
		assert.notEqual(animator._time, 0);
		done();
	}, 100)
	animator.pause();
});
