var windshaft, url;
var lastCall;
var old_net;
module('provider.windshaft', {
  setup: function() {
    old_net = torque.net.jsonp;
    old_get = torque.net.get;
    torque.net.jsonp = function(url, callback) {
      lastCall = url;
      callback({ layergroupid: 'testlg', metadata: { torque: { 0: { data_steps:10 }} } });
    };
    torque.net.get = function(url, callback) {
      lastCall = url;
      callback(null);
    };
    windshaft = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      cartocss: '#test{}',
      sql: 'test',
      resolution: 1,
      steps: 10,
      extra_params: {
        testing: 'abcd%'
      }
    });
  }, 
  teardown: function() {
    torque.net.jsonp = old_net;
    torque.net.get = old_get;
  }
});

  test("tiler request", function() {
    var layergroup = {
        "version": "1.0.1",
        "stat_tag":  'torque',
        "layers": [{
          "type": "torque",
          "options": {
            "cartocss_version": "2.1.1",
            "cartocss": '#test{}',
            "sql": 'test'
          }
        }]
    };

    var url = "http://rambo.cartodb.com:80/tiles/layergroup?config=" + encodeURIComponent(JSON.stringify(layergroup)) + "&callback="
    equal(lastCall.indexOf(url), 0);
    equal(windshaft.options.data_steps, 10);

  });

  test("url", function() {
    equal(windshaft.url(), "http://rambo.cartodb.com:80");
  });

  test("url cdn", function() {
    windshaft.options.cdn_url = { http: 'cartocdn.com' };
    equal(windshaft.url(), "http://{s}.cartocdn.com/rambo");
  });

  test("named map", function() {
    windshaft_named = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      named_map: {
        name: 'test_named'
      }
    });
    var url = "http://rambo.cartodb.com:80/tiles/template/test_named/jsonp?config";
    equal(lastCall.indexOf(url), 0);
  });

  test("fetch tile", function() {
    windshaft._ready = true;
    windshaft.getTileData({x: 0, y: 1}, 2, function() {});
    equal(lastCall,"http://rambo.cartodb.com:80/tiles/layergroup/testlg/0/2/0/1.json.torque?testing=abcd%25");
  });



