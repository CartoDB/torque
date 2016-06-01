var pointRenderer = require('../../support/point_renderer');
var image = require('../../support/image');

QUnit.module('renderer/point');

var IMAGE_DIFF_TOLERANCE = 4 / 100;

// HOW TO debug image output
// -------------------------
// Once you have a valid canvas and no errors, it's possible to write to disk the canvas buffer as a png image with:
// require('fs').writeFileSync('/tmp/torque-acceptance-test-tile.png', canvas.toBuffer(), {encoding: null});

var cartocss = [
    'Map {',
    '  -torque-time-attribute: "date";',
    '  -torque-aggregation-function: "count(cartodb_id)";',
    '  -torque-frame-count: 760;',
    '  -torque-animation-duration: 15;',
    '  -torque-resolution: 2',
    '}',
    '#layer {',
    '  marker-width: 3;',
    '  marker-fill-opacity: 0.8;',
    '  marker-fill: #FEE391; ',
    '  comp-op: "lighten";',
    '  [value > 2] { marker-fill: #FEC44F; }',
    '  [value > 3] { marker-fill: #FE9929; }',
    '  [value > 4] { marker-fill: #EC7014; }',
    '  [value > 5] { marker-fill: #CC4C02; }',
    '  [value > 6] { marker-fill: #993404; }',
    '  [value > 7] { marker-fill: #662506; }',
    '  [frame-offset = 1] { marker-width: 10; marker-fill-opacity: 0.05;}',
    '  [frame-offset = 2] { marker-width: 15; marker-fill-opacity: 0.02;}',
    '}'
].join('\n');

asyncTest('navy example', function(assert) {
    var step = 300;

    pointRenderer.getTile('default_navy_3-3-2.torque.json', cartocss, 3, 3, 2, step, function(err, canvas) {
        assert.ok(!err, 'no error while getting tile');
        var imageDiff = image.compare(canvas.toBuffer(), 'default_navy_3-3-2.png');
        assert.ok(imageDiff < IMAGE_DIFF_TOLERANCE, 'navy tile is ok');
        QUnit.start();
    });
});

asyncTest('tileSize = 512', function(assert) {
    var step = 300;
    var tileSize = 512;
    var options = {
        tileSize: tileSize
    };

    pointRenderer.getTile('default_navy_3-3-2.torque.json', cartocss, 3, 3, 2, step, options, function(err, canvas) {
        assert.ok(!err, 'no error while getting tile');
        var img = image.getImage(canvas.toBuffer());
        assert.equal(img.width(), tileSize);
        assert.equal(img.height(), tileSize);
        QUnit.start();
    });
});

asyncTest('basic heatmap', function(assert) {
    var cartocss = [
        'Map {',
        '  -torque-time-attribute: "date";',
        '  -torque-aggregation-function: "count(cartodb_id)";',
        '  -torque-frame-count: 1;',
        '  -torque-resolution: 1',
        '}',
        '#layer {',
        '  marker-width: 4;',
        '  image-filters: colorize-alpha(blue, cyan, lightgreen, yellow , orange, red);',
        '  marker-file: url(http://s3.amazonaws.com/com.cartodb.assets.static/alphamarker.png);',
        '}'
    ].join('\n');

    var step = 0;

    pointRenderer.getTile('heatmap_navy_3-2-3.torque.json', cartocss, 3, 2, 3, step, function(err, canvas) {
        assert.ok(!err, 'no error while getting tile');
        var imageDiff = image.compare(canvas.toBuffer(), 'heatmap_navy_3-2-3.png');
        assert.ok(imageDiff < IMAGE_DIFF_TOLERANCE, 'heatmap tile is ok');
        QUnit.start();
    });
});

asyncTest('render multiple steps', function(assert) {
    var CARTOCSS = [
        'Map {',
        '  -torque-frame-count: 360;',
        '  -torque-animation-duration: 30;',
        '  -torque-time-attribute: "cartodb_id";',
        '  -torque-aggregation-function: "count(cartodb_id)";',
        '  -torque-resolution: 1;',
        '  -torque-data-aggregation: linear;',
        '}',
        '#generate_series {',
        '  comp-op: lighter;',
        '  marker-fill-opacity: 0.9;',
        '  marker-line-color: #FFF;',
        '  marker-line-width: 0;',
        '  marker-line-opacity: 1;',
        '  marker-type: rectable;',
        '  marker-width: 6;',
        '  marker-fill: #0F3B82;',
        '}'
    ].join('\n');

    var steps = [];
    for (var i = 20; i <= 50; i++) {
        steps.push(i);
    }

    // Dataset can be regenerated with:
    // SELECT
    //   s + 181 as cartodb_id,
    //   st_transform(ST_SetSRID (st_makepoint(s, 20 + 10*sin(s)), 4326), 3857) as the_geom_webmercator
    // FROM generate_series(-180, 180, 1) as s
    pointRenderer.getTile('generate_series_sin-2-0-1.torque.json', CARTOCSS, 2, 0, 1, steps, function(err, canvas) {
        assert.ok(!err, 'no error while getting tile');
        var imageDiff = image.compare(canvas.toBuffer(), 'generate_series_sin-2-0-1.png');
        assert.ok(imageDiff < IMAGE_DIFF_TOLERANCE, 'image not matching, probably not rendering several steps');
        QUnit.start();
    });
});