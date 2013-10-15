
var json, url;
module('provider.json')
QUnit.testStart(function() {
    json = new torque.providers.json({
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



