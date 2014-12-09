var torque = require('../lib/torque');
var providers = torque.providers;

var json, url;
QUnit.module('provider.json');
QUnit.testStart(function() {
    json = new providers.json({
      table: 'test',
      user: "rambo",
      resolution: 1,
      steps: 10,
      extra_params: {
        testing: 'abcd%'
      }
    });
});

  test("url", function() {
    equal("http://rambo.cartodb.com/api/v2/sql", json.url());
  });

  test("extra_params", function() {
    var url = "http://rambo.cartodb.com/api/v2/sql?q=1&testing=abcd%25";
    json.sql('1');
    equal(torque.net.lastCall().url, url);
  });

  test("no_cdn", function() {
    var url = "http://rambo.cartodb.com/api/v2/sql?q=1&testing=abcd%25";
    json.options.cdn_url = 'test-cdn.com'
    json.sql('1', null, { no_cdn: true });
    equal(torque.net.lastCall().url, url);
  });

  test("getSQL", function() {
    var s;
    equal(json.getSQL(), "select * from test");
    json.setSQL(s='select * from test limit 10');
    equal(json.getSQL(), s);
    json.setSQL(null);
    equal(json.getSQL(), "select * from test");
  });

  test("cdn_url", function() {
    json.options.cdn_url = { http: 'test.com' };
    equal(json.url('a'), 'http://a.test.com/rambo/api/v2/sql');
  });



