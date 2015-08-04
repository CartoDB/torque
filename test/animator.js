var torque = require('../lib/torque');
var sinon = require('sinon');
require('phantomjs-polyfill');

QUnit.module('animator');

var animator = new torque.Animator(function(){}, {steps: 500});

asyncTest('time moves', function(assert) {
	// Function.prototype.bind = _.bind;
	animator.start();
	setTimeout(function(){
		console.log(animator.running);
		assert.notEqual(animator._time, 0);
		QUnit.start();
	}, 100)
	animator.pause();
});

// test("rescale shouldn't resume animation if previously paused", function(assert){
// 	animator.pause();
// 	animator.rescale();
// 	assert.notOk(animator.running);
// });

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
	animator.toggle();
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

// test("altering steps should rescale", function(assert){
// 	sinon.spy(animator, "rescale");
// 	animator.start = torque.Animator.prototype.start;
// 	animator.steps(600); // thanks QUnit :/
// 	assert.ok(animator.rescale.calledOnce);
// });

// asyncTest("tick should set time to zero if steps are bigger than range", function(assert){
// 	animator.step(800);
// 	setTimeout(function(){
// 		console.log(animator.step())
// 		assert.ok(animator.step() < 800);
// 		QUnit.start();
// 	}, 200);
// 	animator.pause();
// });

// QUnit.test("tick should pause animation on end if loop is disabled", function(assert){
// 	animator.options.loop = false;
// 	assert.ok(!animator.running);
// 	animator.toggle();
// 	assert.ok(animator.running);
// 	setTimeout(function(){
// 		assert.notEqual(animator._time, 0);
// 		QUnit.start();
// 	}, 100)
// 	animator.pause();
// });
