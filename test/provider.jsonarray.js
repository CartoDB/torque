
test("processTile", function() {
  var json = new torque.providers.JsonArray({
    url: "http://test.com/{z}/{x}/{y}.json"
  });
  var tile = json.proccessTile(jsonarray_fixture.rows, {
    x: 0, 
    y: 0,
    z: 0
  });
  ok(tile);
  equal(jsonarray_fixture.rows.length, tile.x.length);
  equal(jsonarray_fixture.rows.length, tile.y.length);

});
