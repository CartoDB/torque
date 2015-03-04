var pointRenderer = require('../../support/point_renderer');
var image = require('../../support/image');

QUnit.module('renderer/point');

asyncTest('navy example', function(assert) {
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

    var step = 300;

    pointRenderer.getTile('default_navy_3-3-2.torque.json', cartocss, 3, 3, 2, step, function(err, canvas) {
        assert.ok(!err, 'no error while getting tile');
        var imageDiff = image.compare(canvas.toBuffer(), 'default_navy_3-3-2.png');
        assert.equal(imageDiff, 0, 'navy tile is ok');
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
        assert.equal(imageDiff, 0, 'heatmap tile is ok');
        QUnit.start();
    });
});