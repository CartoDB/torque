Torque
==

Render big, timeseries data in the client. Uses CartoDB to generate a datacube format. For a brief introduction to the format and methods, see our [presentation slides](http://gijs.github.com/images/cartodb_datacubes.pdf)

CartoDB users can use this code right away. Specify your username/tablename and datecolumn to get mapping time immediatley.

Have fun!

* Play with your own data: http://cartodb.github.com/torque/
* The Guardian's Data Blog write-up of Royal Navy ships in WWI: http://www.guardian.co.uk/news/datablog/interactive/2012/oct/01/first-world-war-royal-navy-ships-mapped
* A car in Nürburgring track: http://cartodb.github.com/torque/examples/car.html

## Torque library reference

Torque lets you render big, timeseries or categorical data in the client. This is useful for many modern applications that need more than just a static map. Early versions of Torque have been used to visualize human movement, Twitter activity, biodiversity data, and many more large-scale datasets.

The library uses CartoDB to generate a [layercube]() format. For a brief introduction to the format and methods, see our [presentation slides](http://gijs.github.com/images/cartodb_datacubes.pdf). If you are not using CartoDB to host your data, you can modify the input parameters to point toward any layercube service.

### Getting started

The simplest way to use a visualization with Torque is...

<div class="margin20"></div>
<div class="code_title">Create a simple Torque visualization</div>
  ``` javascript
      ...
        <body>
          <div id="map"></div>
        </body>
      ...
      // define the torque layer style using cartocss
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

        
      var map = new L.Map('map', {
        zoomControl: true,
        center: [40, 0],
        zoom: 3
      });

      L.tileLayer('http://{s}.api.cartocdn.com/base-dark/{z}/{x}/{y}.png', {
        attribution: 'CartoDB'
      }).addTo(map);

      var torqueLayer = new L.TorqueLayer({
        user       : 'viz2',
        table      : 'ow',
        cartocss: CARTOCSS
      });
      torqueLayer.addTo(map);
      torqueLayer.play()

    <script>
  ```
[Grab the complete example source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html)
<div class="margin20"></div>

### API
[see reference](https://github.com/CartoDB/torque/blob/master/doc/API.md)

