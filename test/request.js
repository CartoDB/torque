var torque = require('../lib/torque/core');

QUnit.module('request');

asyncTest("json", 6, function(assert) {
  var called = null;
  torque.net.jsonp('./data/foobar.jsonp.js?callback=?', function(test) {
    called = arguments;
  });

  setTimeout(function() {
    var scripts = document.getElementsByTagName('script');
    var found = null;
    for (var i = 0 ; !found && i < scripts.length; ++i) {
      var s = scripts[i];
      if (s.getAttribute('src').indexOf('foobar.jsonp.js') !== -1) {
        found = s;
      }
    }
    var src = found.getAttribute('src');
    var fnName = src.match(/torque_.*/);
    window[fnName]('test1', 2, null);
    assert.equal(src.indexOf('./data/foobar.jsonp.js?callback=torque_'), 0);
    assert.equal(called[0], 'test1');
    assert.equal(called[1], 2);
    assert.equal(called[2], null);
    assert.equal(found.parent, null);
    assert.equal(window[fnName], undefined);
    QUnit.start();
  }, 5);

});
