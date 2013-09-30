
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

##### Dynamic/static options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| is_time   | boolean    | ```true```   | Determines if the drawing is static or dynamic/animated |


##### Display options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| resolution| numeric    | ```2```   | The x and y dimensions of each pixel as returned by the data|
| blendmode | boolean    | ```source-over```   | The HTML5 Canvas composite operation for when multiple pixels overlap on the canvas |

##### Time options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| steps     | integer    | ```100```   | The number of steps to divide the data into for animated renderings |
| animationDuration | integer    | ```null```   | time in seconds the animation last |

### Time methods

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setStep(step)``` | ```time numeric```    | ```this```   | sets the animation to the step indicated by ```step```, must be between 0 and ```steps```|
| ```play```| | ```this```| starts the animation
| ```stop```| | ```this```| stops the animation and set time to step 0
| ```pause```| | ```this```| stops the animation but keep the current time (play enables the animation again)


### Style methods 

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setCartoCSS(cartocss)``` | ```cartocss string```    | ```this```   | style the map rendering using client-side cartocss | 

The full CartoCSS spec is not supported by Torque but instead only a limited subset with some additions related to torque rendering. To see the full list of supported parameters, read the [Torque CartoCSS documentation here](CartoCSS.md). ``value`` and ``zoom`` variables can be used. ``value`` is the value of aggregation (see ``countby`` constructor option). ``zoom`` is the current zoom being rendered

TorqueLayer currently expects ```marker``` styling

##### CartoCSS Example

This should be ```string``` encoded in Javascript

```css
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
  [frame-offset = 1] {  marker-width: 20; marker-fill-opacity: 0.05;}', // renders the previos frame
  [frame-offset = 2] {  marker-fill: red; marker-width: 30; marker-fill-opacity: 0.02;}', // renders two frames ago from the current being rendered
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
| blendmode | boolean    | ```source-over```   | The HTML5 Canvas composite operation for when multiple pixels overlap on the canvas |

### Filtering options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setKey(keys)``` | ```keys numeric/array```    | ```this```   | which data categories to display on the map |

### Style options

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setCartoCSS(cartocss)``` | ```cartocss string```    | ```this```   | style the map rendering using client-side cartocss | 

``value`` and ``zoom`` variables can be used. only ``polygon-fill`` and ``polygon-opacity`` properties are supported currently. To see the full list of supported parameters, read the [Torque CartoCSS documentation here](CartoCSS.md).

TorqueLayer currently expects ```polygon``` styling

##### CartoCSS Example

This should be ```string``` encoded in Javascript

```css
#layer {
  polygon-fill: #FFFF00;
  [value >= 10] { polygon-fill: #FFCC00; }
  [value >= 100] { polygon-fill: #FF9900; }
  [value >= 1000] { polygon-fill: #FF6600; }
  [value >= 10000] { polygon-fill: #FF3300; }
  [value > 100000] { polygon-fill: #C00; }
}
```

# Google Maps Layers

## GMapsTorqueLayer(options) 
This class does exactly the same than ``L.TorqueLayer`` but using Google Maps. The main difference is that this class
is not a layer is a overlay so in order to add it to the map use ``layer.setMap`` instead of ``overlayMapTypes``. See [Overlay view](https://developers.google.com/maps/documentation/javascript/reference#OverlayView) reference in Google Maps API doc. 

### Options

##### options
| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| map | google.maps.Map |    | google.maps.Map instance |

see ``L.TorqueLayer`` for the rest of the options.


## GMapsTiledTorqueLayer(options) 
creates a static _overlay_ to use it with google maps. 

```js
  var torqueLayer = new torque.GMapsTiledTorqueLayer({
    provider: 'url_template',
    url: GBIF_URL,
    resolution: 4,
  });

  torqueLayer.setMap(map);

  torqueLayer.setKey([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
```

see ``L.TiledTorqueLayer`` for options reference
