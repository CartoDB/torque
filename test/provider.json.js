
module('provider.json');

  test("url", function() {
    var json = new torque.providers.json({
      user: "rambo",
      resolution: 1,
      steps: 10
    });
    equal("http://rambo.cartodb.com/api/v2/sql", json.url());
  });



