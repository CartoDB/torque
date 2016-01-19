# Getting Started

Torque.js is a JavaScript library that enables you to animate time series data. Torque.js uses tile cubes, which are JSON representations of multidimensional data with geospatial coordinates. [Tile cube specifications](http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification
) render data on the client, to optimize the transfer of temporal and categorical data for maps.

**Tip:** Torque is both a spatial and temporal aggregator. It does not plot your exact lat/lon points, it lays an invisible grid over your map, and draws one marker for each grid cell that contains points (representing an aggregation of all of the points in the grid cell). You can control the size of this grid with the CartoCSS [`-torque-resolution`](/cartodb-platform/cartocss/properties-for-torque/#torque-resolution-float) property. You are also able to control the type of aggregation with the CartoCSS [`-torque-aggregation-function`](/cartodb-platform/cartocss/properties-for-torque/#torque-aggregation-function-keyword). For more details, see the wiki page about how [Torque aggregates data](https://github.com/CartoDB/torque/wiki/How-spatial-aggregation-works).

## Implementing Torque.js

Although the most straightforward way to use Torque is through either the CartoDB Editor, or by passing the layer's viz.json to [CartoDB.js](http://docs.cartodb.com/cartodb-platform/cartodb-js/getting-started/), many use cases work best with the standalone [Torque.js](https://github.com/CartoDB/torque/tree/master/dist). Assuming you have a public dataset with a `date` column, it is really simple to create an animated map with the library. 

**Pre-requisite:** When visualizing Torque style maps, it is required that you normalize your data to show a total count, or a range, of `0`-`255`. For more details, see this description about [statistical normalization](https://books.google.com/books?id=FrUQHIzXK6EC&pg=PT347&lpg=PT347&dq=choropleth+normalization&source=bl&ots=muDZhsb2jT&sig=DbomJnKedQjaKvcQgm_sVqHBt-8&hl=en&sa=X&ved=0CCYQ6AEwAjgKahUKEwje0ee8qaTHAhUCZj4KHRF5CjM#v=onepage&q=choropleth%20normalization&f=false).

Currently, you can only animate Torque point data. Line, polygon, and multipoint data are not supported for Torque animation.

**Note:** When importing Torque data, CartoDB uploads and assumes timezones are in UTC format by default. To specify a different timezone format, you must use the SQL API to import data into CartoDB.


1.  You need to have a Leaflet map prepared in an HTML page

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

2. Initialize the Torque.js layer

For Torque to work with your table, specify your username, tablename and a CartoCSS string to style the map. Leaflet's method `addTo` adds the Torque layer to the map. `play` runs the animation with the options specified in the CartoCSS properties

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

3.  Install the required CartoDB Torque Libraries  

The Torque.js library interacts with CartoDB to generate the Torque tile format. If you are hosting your data on an external connector, you can modify the input parameters to redirect to any "Torque tiles service".

Torque Library:

- Export Torque tiles from your CartoDB account, or use a local Postgres installation [https://github.com/CartoDB/torque-gen](https://github.com/CartoDB/torque-gen)

- Install [https://github.com/CartoDB/torque/blob/master/dist/torque.js](https://github.com/CartoDB/torque/blob/master/dist/torque.js)

Advanced Torque.js Libraries:

If you are interested in using advanced interaction methods, it is a prerequisite to load the Torque.js library before using the advanced interaction methods.

- Download the [latest release](https://github.com/CartoDB/torque/releases) of the Torque.js source code

4. Include all Torque Tiles Specifications

Torque tile specifications define the TorqueMap Metadata and tileset information. You can use any kind of tile source outside CartoDB, by specifying the location of a [valid TileJSON](https://github.com/mapbox/tilejson-spec) file:

```javascript
  var torqueLayer = new L.TorqueLayer({
    tileJSON: 'http://url.to/tile.json'
    cartocss: CARTOCSS
  });
```
**Note:** All Torque tile fields in the specification are required.

5. Optionally, it is also possible to use a custom SQL query for your visualization:

```javascript
  var torqueLayer = new L.TorqueLayer({
    user       : 'your_username',
    table      : 'your_table_name',
    sql_query  : 'SELECT * FROM your_table_name WHERE whatever'
    cartocss: CARTOCSS
  });
```

Like in a video player, you can use animation control methods such as `play`, `stop` and `pause` at any point. Torque's animator fires a `change:time` event each time the animation "ticks" to the next frame, and there are a number of properties and methods that can be run during playback, which are detailed in the [API documentation](/cartodb-platform/torque/torqueapi/). At any point, for example, the styling of the layer's markers can be changed using the `layer.setCartoCSS('##style##')`.

6. Customize your animation 

Style and customize your animations with [CartoCSS Properties for Torque Style Maps](/cartodb-platform/cartocss/properties-for-torque/)

## Usage Examples
The best way to start learning about the library is by taking a look at some of the examples below:

* A basic example using the WWI British Navy dataset - ([view live](http://cartodb.github.io/torque/examples/navy_leaflet.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html))
* Using tileJSON to fetch tiles - ([view live](http://cartodb.github.io/torque/examples/tilejson.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/tilejson.html))
* A car's route at the Nürburgring track mapped in Torque - ([view live](http://cartodb.github.io/torque/examples/car.html) / [source code](https://github.com/CartoDB/torque/blob/master/examples/car.html))

## Additional Torque Resources

The following links contain examples, and other public information, about using Torque maps.

- Torque [CartoCSS Reference page](https://github.com/cartodb/torque-reference), useful for building parsers, tests, compilers, and syntax highlighting/checking
- CartoDB repository of [examples](https://github.com/CartoDB/torque/tree/master/examples)
- A CartoDB [time example](http://cartodb.github.com/torque/) of a Torque map and data
- CartoDB wiki page describing [how spatial aggregration works](https://github.com/CartoDB/torque/wiki/How-spatial-aggregation-works)
- The [Guardian's Data Blog](http://www.guardian.co.uk/news/datablog/interactive/2012/oct/01/first-world-war-royal-navy-ships-mapped) about Royal Navy ships in WWI using a Torque map
- An example of how to create a [simple Torque visualization](https://github.com/CartoDB/torque#getting-started) and the [source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html) used to create the example
- An example of how to use CartoDB.js to [add a Torque layer from a named map with auth_tokens enabled](https://gist.github.com/chriswhong/a4d1e6305ecaf2ad507a)
