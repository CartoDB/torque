var torque = require('../lib/torque/core');

QUnit.module('request');

asyncTest("json", 6, function(assert) {
  var called = null;
  torque.net.jsonp('http://test.com?callback=?', function(test) {
    called = arguments;
  });

  setTimeout(function() {
    var scripts = document.getElementsByTagName('script');
    var found = null;
    for (var i = 0 ; !found && i < scripts.length; ++i) {
      var s = scripts[i];
      if (s.getAttribute('src').indexOf('test.com') !== -1) {
        found = s;
      }
    }
    var src = found.getAttribute('src');
    var fnName = src.match(/torque_.*/);
    window[fnName]('test1', 2, null);
    equal(src.indexOf('http://test.com?callback=torque_'), 0);
    equal(called[0], 'test1');
    equal(called[1], 2);
    equal(called[2], null);
    equal(found.parent, null);
    equal(window[fnName], undefined);
    QUnit.start();
  }, 5);

});
