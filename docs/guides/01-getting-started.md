## Getting Started

Although the most straightforward way to use Torque is through either CARTO Builder, or by passing the layer's viz.json to [CARTO.js]({{site.cartojs_docs}}/), many use cases work best with the standalone Torque.js. Assuming you have a public dataset with a `date` column, it is really simple to create an animated map with the library. First, you need to have a Leaflet map prepared in an HTML page:

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

This HTML file automatically generates the Torque.js library, which includes any Torque dependencies. For Torque to work with your table, you only need a username, the name of the table, and a [CartoCSS]({{site.styling_cartocss}}/) string to style the map. Leaflet's method `addTo` adds the Torque layer to the map. `play` runs the animation with the options specified in the CartoCSS properties.

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

Like in a video player, you can use animation control methods such as `play`, `stop` and `pause` at any point. Torque's animator fires a `change:time` event each time the animation "ticks" to the next frame, and there are a number of properties and methods that can be run during playback, which are detailed in the [API reference]({{site.torque_docs}}/reference/). At any point, for example, the styling of the layer's markers can be changed using the `layer.setCartoCSS('##style##')`.

### Usage Examples
The best way to start learning about the library is by taking a look at the [examples section]({{site.torque_docs}}/examples/).
