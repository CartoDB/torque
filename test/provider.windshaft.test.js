var torque = require('../lib/torque/core');

var windshaft, url;
var lastCall;
var old_net;
QUnit.module('provider.windshaft', {
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
            "cartocss_version": "1.0.0",
            "cartocss": 'Map{-torque-frame-count:10;-torque-resolution:1;-torque-aggregation-function:\'undefined\';-torque-time-attribute:\'undefined\';-torque-data-aggregation:linear;}',
            "sql": 'test'
          }
        }]
    };

    var url = "http://rambo.cartodb.com:80/api/v1/map?config=" + encodeURIComponent(JSON.stringify(layergroup)) + "&callback="
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

  test("url cdn https", function() {
    windshaft.options.tiler_protocol = 'https';
    windshaft._buildMapsApiTemplate(windshaft.options);
    windshaft.options.cdn_url = { https: 'cartocdn.com' };
    equal(windshaft.url(), "https://cartocdn.com/rambo");
  });

  test("named map", function() {
    windshaft_named = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      named_map: {
        name: 'test_named'
      }
    });
    var url = "http://rambo.cartodb.com:80/api/v1/map/named/test_named/jsonp?config";
    equal(lastCall.indexOf(url), 0);
  });

  test("fetch tile", function() {
    windshaft._ready = true;
    windshaft.getTileData({x: 0, y: 1, corrected: {x: 0, y: 1}}, 2, function() {}, function() {});
    equal(lastCall,"http://rambo.cartodb.com:80/api/v1/map/testlg/0/2/0/1.json.torque?testing=abcd%25");
  });

  test("include auth_token", function() {
    windshaft_named = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      auth_token: 'test_auth_token',
      named_map: {
        name: 'test_named'
      }
    });
    ok(lastCall.indexOf("auth_token=test_auth_token") !== -1);
  })

  test("include stat_tag", function() {
    windshaft_named = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      stat_tag: 'test',
      named_map: {
        name: 'test_named'
      }
    });
    ok(lastCall.indexOf("stat_tag=test") !== -1);
  })

  test("include extra params in named maps", function() {
    windshaft_named = new torque.providers.windshaft({
      table: 'test',
      user: "rambo",
      stat_tag: 'test',
      named_map: {
        name: 'test_named',
        params: {
          "wololo": "wololo"
        }
      }
    });
    ok(lastCall.indexOf("wololo%22%3A%22wololo") !== -1);
  })

test("auth_token as array param", function() {
    windshaft_named = new torque.providers.windshaft({
        table: 'test',
        user: "rambo",
        auth_token: ['test_auth_token'],
        named_map: {
            name: 'test_named'
        }
    });
    ok(lastCall.indexOf("auth_token[]=test_auth_token") !== -1);
});

test("auth_token with several params as array param and present in url", function() {
    windshaft_named = new torque.providers.windshaft({
        table: 'test',
        user: "rambo",
        auth_token: ['token1', 'token2'],
        named_map: {
            name: 'test_named'
        }
    });
    ok(lastCall.indexOf("auth_token[]=token1") !== -1);
    ok(lastCall.indexOf("auth_token[]=token2") !== -1);
});

[
    { shouldInvokeFetchMap: true, desc: 'undefined no_fetch_map option provided should invoke _fetchMap' },
    { no_fetch_map: false, shouldInvokeFetchMap: true, desc: 'no_fetch_map=false should invoke _fetchMap' },
    { no_fetch_map: true, shouldInvokeFetchMap: false, desc: 'no_fetch_map=true should NOT invoke _fetchMap' }
].forEach(function(fetchMapCase) {

    test("no_fetch_map option: " + fetchMapCase.desc, function() {
        var fetchMapFn = torque.providers.windshaft.prototype._fetchMap;

        var _fetchMapInvoked = false;
        torque.providers.windshaft.prototype._fetchMap = function() {
            _fetchMapInvoked = true;
        };

        new torque.providers.windshaft({
            table: 'test',
            user: "rambo",
            no_fetch_map: fetchMapCase.no_fetch_map
        });

        equal(_fetchMapInvoked, fetchMapCase.shouldInvokeFetchMap);

        torque.providers.windshaft.prototype._fetchMap = fetchMapFn;
    });

});

