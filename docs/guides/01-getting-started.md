## Getting Started

Although the most straightforward way to use Torque is through either CARTO Builder, or by passing the layer's viz.json to [CARTO.js](https://carto.com/docs/carto-engine/carto-js/getting-started/), many use cases work best with the standalone [Torque.js](https://github.com/CartoDB/torque/tree/master/dist). Assuming you have a public dataset with a `date` column, it is really simple to create an animated map with the library. First, you need to have a Leaflet map prepared in an HTML page:

```html
  <link rel="stylesheet" href="http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.css" />
  <body>
    <div id="map"></div>
    <script src="http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.js"></script>
    <script>
      var map = new L.Map('map', {
        zoomControl: true,
        center: [40, 0],
        zoom: 3
      });

      L.tileLayer('http://{s}.api.cartocdn.com/base-dark/{z}/{x}/{y}.png', {
        attribution: 'CARTO'
      }).addTo(map);
    </script>
  </body>
```

This HTML file automatically generates the Torque.js library, which includes any Torque dependencies. For Torque to work with your table, you only need a username, the name of the table, and a CartoCSS string to style the map. Leaflet's method `addTo` adds the Torque layer to the map. `play` runs the animation with the options specified in the CartoCSS properties.

```html
  <script>
    var CARTOCSS = [
      'Map {',
      '-torque-time-attribute: "date";',
      '-torque-aggregation-function: "count(cartodb_id)";',
      '-torque-frame-count: 760;',
      '-torque-animation-duration: 15;',
      '-torque-resolution: 2',
      '}',
      '#layer {',
      '  marker-width: 3;',
      '  marker-fill-opacity: 0.8;',
      '  marker-fill: #FEE391; ',
      '  comp-op: "lighten";',
      '}'
    ].join('\n');

    var torqueLayer = new L.TorqueLayer({
      user       : 'your_username',
      table      : 'your_table_name',
      cartocss: CARTOCSS
    });
    torqueLayer.addTo(map);
    torqueLayer.play()
  </script>
```

You can use any kind of tile source outside CARTO, by specifying the location of a [valid TileJSON](https://github.com/mapbox/tilejson-spec) file:

```javascript
  var torqueLayer = new L.TorqueLayer({
    tileJSON: 'http://url.to/tile.json'
    cartocss: CARTOCSS
  });
```

Optionally, it is also possible to use a custom SQL query for your visualization:

```javascript
  var torqueLayer = new L.TorqueLayer({
    user       : 'your_username',
    table      : 'your_table_name',
    sql_query  : 'SELECT * FROM your_table_name WHERE whatever'
    cartocss: CARTOCSS
  });
```

Like in a video player, you can use animation control methods such as `play`, `stop` and `pause` at any point. Torque's animator fires a `change:time` event each time the animation "ticks" to the next frame, and there are a number of properties and methods that can be run during playback, which are detailed in the [API documentation](https://carto.com/docs/carto-engine/torque/torqueapi/). At any point, for example, the styling of the layer's markers can be changed using the `layer.setCartoCSS('##style##')`.

### Usage Examples
The best way to start learning about the library is by taking a look at some of the examples below:

* A basic example using the WWI British Navy dataset - ([view live](http://cartodb.github.io/torque/examples/navy_leaflet.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html))
* Using tileJSON to fetch tiles - ([view live](http://cartodb.github.io/torque/examples/tilejson.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/tilejson.html))
* A car's route at the Nürburgring track mapped in Torque - ([view live](http://cartodb.github.io/torque/examples/car.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/car.html))

### Additional Torque Resources

The following links contain examples, and other public information, about using Torque maps.

- Torque [CartoCSS Reference page](https://github.com/cartodb/torque-reference), useful for building parsers, tests, compilers, and syntax highlighting/checking
- CARTO repository of [examples](https://github.com/CartoDB/torque/tree/master/examples)
- A CARTO [time example](http://cartodb.github.com/torque/) of a Torque map and data
- CARTO wiki page describing [how spatial aggregration works](https://github.com/CartoDB/torque/wiki/How-spatial-aggregation-works)
- The [Guardian's Data Blog](http://www.guardian.co.uk/news/datablog/interactive/2012/oct/01/first-world-war-royal-navy-ships-mapped) about Royal Navy ships in WWI using a Torque map
- An example of how to create a [simple Torque visualization](https://github.com/CartoDB/torque#getting-started) and the [source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html) used to create the example
- An example of how to use CARTO.js to [add a Torque layer from a named map with auth_tokens enabled](https://gist.github.com/chriswhong/a4d1e6305ecaf2ad507a)
