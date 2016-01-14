# Getting Started with Torque.js

Torque.js is a JavaScript library that enables you to display animated maps using time series data. Torque.js uses a [special tile specification](https://github.com/cartodb/torque-tiles), which consists of JSON representations of multidimensional data with geospatial coordinates.

**Tip:** Torque is both a spatial and temporal aggregator. It does not plot your exact lat/lon points, it lays an invisible grid over your map, and draws one marker for each grid cell that contains points (representing an aggregation of all of the points in the grid cell). You can control the size of this grid with the CartoCSS [`-torque-resolution`](/cartodb-platform/cartocss/properties-for-torque/#torque-resolution-float) property. You are also able to control the type of aggregation with the CartoCSS [`-torque-aggregation-function`](/cartodb-platform/cartocss/properties-for-torque/#torque-aggregation-function-keyword). For more details, see the wiki page about how [Torque aggregates data](https://github.com/CartoDB/torque/wiki/How-spatial-aggregation-works).


## Implementing Torque.js

The following workflow describes how to implement Torque.js:

Workflow | Details
--- | ---
Preparing your Torque Data | When visualizing Torque style maps, it is required that you normalize your data to show a total count, or a range, of `0`-`255`. For more details, see this description about [statistical normalization](https://books.google.com/books?id=FrUQHIzXK6EC&pg=PT347&lpg=PT347&dq=choropleth+normalization&source=bl&ots=muDZhsb2jT&sig=DbomJnKedQjaKvcQgm_sVqHBt-8&hl=en&sa=X&ved=0CCYQ6AEwAjgKahUKEwje0ee8qaTHAhUCZj4KHRF5CjM#v=onepage&q=choropleth%20normalization&f=false).<br /><br />Currently, you can only animate Torque point data. Line, polygon, and multipoint data are not supported for Torque animation.<br /><br />**Note:** When importing Torque data, CartoDB uploads and assumes timezones are in UTC format by default. To specify a different timezone format, you must use the SQL API to import data into CartoDB.
Initialize the Torque.js Layer | Specify your username, tablename and date column to add a Torque layer to your map<br /><br /><span class="wrap-border"><img src="/img/layout/torque/initialize_torquejs.jpg" alt="Intialize Torque.js" /></span>
Install the required CartoDB Torque Libraries | The Torque.js library interacts with CartoDB to generate the Torque tile format. If you are hosting your data on an external connector, you can modify the input parameters to redirect to any "Torque tiles service".<br /><br />- For [basic Torque.js](#torque-library), you can export Torque tiles from your CartoDB account or use a local Postgres installation<br /><br />- For [advanced interaction methods](#advanced-torquejs-libraries), you must download the latest Torque.js source code
Include all Torque Tiles Specifications | [Torque tile specifications](#torque-tiles-specifications) define the TorqueMap Metadata and tileset information.<br /><br />**Note:** All Torque tile fields in the specification are required.
Customize your Animation | Style and customize your animations with [CartoCSS Properties for Torque Style Maps](/cartodb-platform/cartocss/properties-for-torque/)


## Torque Library

Torque lets you render bigdata&trade;, time series or categorical data interactively. This is useful when you need to go beyond a static map, and create visualizations from temporal datasets. You can customize how your animated data appears in order to map such things as human movement, Twitter activity, biodiversity data, and other large-scale datasets. 

- Export Torque tiles from your CartoDB account, or use a local Postgres installation [https://github.com/CartoDB/torque-gen](https://github.com/CartoDB/torque-gen)

- Install [https://github.com/CartoDB/torque/blob/master/dist/torque.js](https://github.com/CartoDB/torque/blob/master/dist/torque.js)


## Advanced Torque.js Libraries

If you are interested in using advanced interaction methods, it is a prerequisite to load the Torque.js library before using the advanced interaction methods.

- Download the [latest registry version](https://www.npmjs.com/package/torque.js) of the Torque.js source code


## Torque Tiles Specifications

Torque tiles are JSON representations of multidimensional data, with geospatial coordinates, that utilizes client-side resolution for rendering data. This optimizes the transfer of data for your Torque maps. Torque tile specifications are defined by two document types, Metadata and Tiles. The Metadata document describes the shared information across the Torque tile dataset. For each tile requested, there is a Tile document returned, which describes the data for that tile.

### Metadata

The TorqueMap Metadata document describes key tileset information, and includes the following fields:

Metadata Field | Description
--- | ---
`start`| start time, in steps or unix timestamp
`end`| end time, in steps or unix timestamp
`resolution`| the pixel resolution,by the power of two (1/4, 1/2,... 2, 4, 16), for a scale of 256 x 256 pixels<br /><br />**Note:** TileCubes are typically rendered on tiles of 256 x 256 pixels. It is recommended that you choose a scale that renders perfectly along the borders of the 256 x 256 tile, otherwise there may be issues rendering artifacts. The available pixel resolutions are: `1, 2, 4, 8, 16, 32, 64, 128, 256`
`data_steps`| number of steps (in integer format)
`column_type`| "integer" or "date", default "integer"
`minzoom`| minimum zoom level, optional
`maxzoom`| max zoom level, optional
`tiles`| tile array for this set, **required**
`bounds`| [bounding box](http://wiki.openstreetmap.org/wiki/Bounding_Box) for tileset, optional

#### Example of Metadata Document

{% highlight js %}
{
  start: 0,
  end: 100, 
  resolution: 2
  # scale: 1/resolution,
  data_steps: 365,
  column_type: "number"
  "minzoom": 0,
  "maxzoom": 11,
  "tiles": [
    'http://a.host.com/{z}/{x}/{y}.torque.json',
    'http://b.host.com/{z}/{x}/{y}.torque.json',
    'http://c.host.com/{z}/{x}/{y}.torque.json',
    'http://d.host.com/{z}/{x}/{y}.torque.json'
  ],
  "bounds": [ -180, -85.05112877980659, 180, 85.0511287798066 ]
}
{% endhighlight %}

### Tiles

The TorqueMap Tiles document contains the required, core set of information to be rendered. This includes the number of pixels for the data, and the x and y values for each pixel.

#### The URL Schema

`http://host.com/{z}/{x}/{y}.torque.[json|bin]`

#### Tile Format

Each Torque tile is a JSON document containing an array, each of whose elements represents a point within the tile. The tile format is notated using the following format:

Tile Format | Type | Description
--- | --- |
`x`| ` integer` | x pixel coordinate in tile system reference
`y`| `integer` | y pixel coordinate in tile system reference
`steps` | | time slots when this pixel is **active**, there is data at that time
`values` | | values for each time slot<br /><br />**Tip:** You can use the values column to store encoding categories for your data

#### Extracting Tile Results for Calculations

You can extract the pixel position, and the current time, with the Tile document results.

##### Extract the Pixel Position

To extract the pixel position for the tile, use the following calculation:

`pixel_x = x * resolution`
`pixel_y = y * resolution`

Where:

`x` and `y` are in range [0, 256/resolution] to render the final pixel position (based on 256 x2 56 tiles).

The coordinate origin for Torque tiles is the bottom left corner of the grid.

##### Extract the Current Time

To extract the current time from the Tile document, use the following calculation:

`current_time = translate.start  + step * (translate.end - translate.start)/data_steps;`

Where:

The `current_time`, `translate.start, translate.end`, and `data_steps` values are used to extract the time.

##### Tile Format Example

{% highlight js %}
[
  {
    x: 25,
    y: 77,
    values: [ 1, 10 ],
    steps: [214, 215]
  },
...
]
{% endhighlight %}

### Errors

All Torque tile fields in the specification are required. If a tile returns with no data or no value, _Uncaught TypeErrors_ may appear. For example, suppose you have `x, y, values` and `steps` defined, but `data_steps` are not defined in integer format, you will receive an error.


## Additional Torque Resources

The following links contain examples, and other public information, about using Torque maps.

- Torque [CartoCSS Reference page](https://github.com/cartodb/torque-reference), useful for building parsers, tests, compilers, and syntax highlighting/checking
- CartoDB repository of [examples](https://github.com/CartoDB/torque/tree/master/examples)
- A CartoDB [time example](http://cartodb.github.com/torque/) of a Torque map and data
- CartoDB wiki page describing [how spatial aggregration works](https://github.com/CartoDB/torque/wiki/How-spatial-aggregation-works)
- The [Guardian's Data Blog](http://www.guardian.co.uk/news/datablog/interactive/2012/oct/01/first-world-war-royal-navy-ships-mapped) about Royal Navy ships in WWI using a Torque map
- An example of how to create a [simple Torque visualization](https://github.com/CartoDB/torque#getting-started) and the [source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html) used to create the example
- An example of how to use CartoDB.js to [add a Torque layer from a named map with auth_tokens enabled](https://gist.github.com/chriswhong/a4d1e6305ecaf2ad507a)
