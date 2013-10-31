
var json, url;
module('provider.json')
QUnit.testStart(function() {
    json = new torque.providers.json({
      table: 'test',
      user_name: "rambo",
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

  test("getSQL", function() {
    var s;
    equal(json.getSQL(), "select * from test");
    json.setSQL(s='select * from test limit 10');
    equal(json.getSQL(), s);
    json.setSQL(null);
    equal(json.getSQL(), "select * from test");
  });



