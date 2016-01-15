#Getting started

Assuming you have a public dataset with a `date` column, it's really simple to create an animated map with the standalone Torque library. You need to have a Leaflet map prepared in an HTML page:

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
        attribution: 'CartoDB'
      }).addTo(map);
    </script>
  </body>
```

For Torque to work with your table you only need a username, the name of the table, and a CartoCSS string to style the map. Leaflet's method `addTo` will add the torque layer to the map. `play` runs the animation with the options specified in the torque-specific CartoCSS properties

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

