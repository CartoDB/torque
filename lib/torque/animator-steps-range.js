/**
 * Abstract handler for animator steps
 */
var AnimatorStepsRange = function(start, end) {
  if (start < 0) throw new Error('start must be a positive number');
  if (start >= end) throw new Error('start must be smaller than end');

  this.start = start;
  this.end = end;
};

AnimatorStepsRange.prototype = {

  diff: function() {
    return this.end - this.start;
  },

  isLast: function(step) {
    // round step into an integer, to be able to compare number as expected (also converts bad input to 0)
    return (step | 0) === this.end;
  }
};

module.exports = AnimatorStepsRange;
