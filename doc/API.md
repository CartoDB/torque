
# Torque API

Torque provides two kinds of visualizations. 

  - static: provides a way to create heatmap like visualizations (note for Andrew: fon). see ``TorqueLayer``
  - dynamic: animate points over a map (note for Andrew: Navy) see ``TiledTorqueLayer``


depending on the map provider you are using you need to use different layer type. Currently we provide layers for Google Maps and Leaflet.

## L.TorqueLayer(options)

One of two core classes for the Torque library - it is used to create an animated torque layer with custom settings.

### Usage example

```js
  // initialize a torque layer that uses the CartoDB account details and SQL API to pull in data
  var torqueLayer = new L.TorqueLayer({
    user       : 'viz2',
    table      : 'ow',
    column     : 'date',
    countby    : 'count(cartodb_id)',
    resolution : 1,
    is_time    : true,
    steps      : 750,
    pixel_size : 3,
    blendmode  : 'lighter'
  });
```

### Options

##### Provider options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| provider  | string     | ```sql_api```   | Where is the data coming from? Alternative is 'url_template'|

##### CartoDB data options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| user      | string     | ```null```      | CartoDB account name. Found as, accountname.cartodb.com|
| table     | string     | ```null```      | CartoDB table name where data is found |
| column    | string     | ```null```      | CartoDB table's column name where date information is found (for dynamic type torque layer only)|
| countby   | string     | ```null```      | The aggregation method to use for each pixel displayed where multiple data are found. Any valid PostgreSQL aggregate function |

##### Dynamic/static options (Note for Santana: we can remove this option?)
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| is_time   | boolean    | ```true```   | Determines if the drawing is static or dynamic/animated |


##### Display options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| steps     | integer    | ```100```   | The number of steps to divide the data into for animated renderings |
| resolution| numeric    | ```2```   | The x and y dimensions of each pixel as returned by the data|
| blendmode | boolean    | ```null```   | The HTML5 Canvas composite operation for when multiple pixels overlap on the canvas |

### Play options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setKey(time)``` | ```time numeric```    | ```this```   | sets the animation to the step indicated by ```time```, must be between 0 and N where N equals the number of steps|


### Style options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setCartoCSS(cartocss)``` | ```cartocss string```    | ```this```   | style the map rendering using client-side cartocss | 

The full CartoCSS spec is not supported by Torque but instead only a limited subset with some additions related to torque rendering. To see the full list of supported parameters, read the [Torque CartoCSS documentation here](CartoCSS.md). ``value`` and ``zoom`` variables can be used. ``value`` is the value of aggregation (see ``countby`` constructor option). ``zoom`` is the current zoom being rendered

TorqueLayer currently expects ```marker``` styling

##### CartoCSS Example

    ```
    #layer {,
      marker-fill: #662506;
      marker-width: 20;
      [value > 1] { marker-fill: #FEE391; }
      [value > 2] { marker-fill: #FEC44F; }
      [value > 3] { marker-fill: #FE9929; }
      [value > 4] { marker-fill: #EC7014; }
      [value > 5] { marker-fill: #CC4C02; }
      [value > 6] { marker-fill: #993404; }
      [value > 7] { marker-fill: #662506; }
    }
    ```

## L.TiledTorqueLayer(options)

One of two core classes for the Torque library - it is used to create a static torque layer with client side filtering.

##### Provider options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| provider  | string     | ```sql_api```   | Where is the data coming from? Alternative is 'url_template'|
| url  | string     | ```null```   | Tile template URL for fetching data e.g 'http://host.com/{z}/{x}/{y}.json'|

##### CartoDB data options (Note to Santana: are these really here?)
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| user      | string     | ```null```      | CartoDB account name. Found as, accountname.cartodb.com|
| table     | string     | ```null```      | CartoDB table name where data is found |
| column    | string     | ```null```      | CartoDB table's column name where date information is found (for dynamic type torque layer only)|
| countby   | string     | ```null```      | The aggregation method to use for each pixel displayed where multiple data are found. Any valid PostgreSQL aggregate function |


##### Display options (Note to Santana: is blendmode here? or above even?)
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| resolution| numeric    | ```2```   | The x and y dimensions of each pixel as returned by the data|
| blendmode | boolean    | ```null```   | The HTML5 Canvas composite operation for when multiple pixels overlap on the canvas |

### Filtering options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setKey(keys)``` | ```keys numeric|array```    | ```this```   | which data categories to display on the map |

### Style options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setCartoCSS(cartocss)``` | ```cartocss string```    | ```this```   | style the map rendering using client-side cartocss | 

``value`` and ``zoom`` variables can be used. only ``polygon-fill`` property is supported currently

TorqueLayer currently expects ```polygon``` styling

##### CartoCSS Example

    ```
    #layer {
      polygon-fill: #FFFF00;
      [value >= 10] { polygon-fill: #FFCC00; }
      [value >= 100] { polygon-fill: #FF9900; }
      [value >= 1000] { polygon-fill: #FF6600; }
      [value >= 10000] { polygon-fill: #FF3300; }
      [value > 100000] { polygon-fill: #C00; }
    }
    ```


# gmaps layers (TODO)
