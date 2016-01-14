# Torque API

### L.TorqueLayer(options)

A layer to be added to a Leaflet map. It works as a regular tiled layer within the Leaflet tile pane, but instead of containing `<img>` elements, it's composed of a single [`<canvas>`](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) where all markers are drawn.

```javascript
var torqueLayer = new L.TorqueLayer({
  user: 'viz2',
  table: 'ow',
  cartocss: '<cartocss here>'
});

map.addLayer(torqueLayer);
```

#### Options

Name | Description
--- | ---
cartocss | A string object, the CartoCSS style for the map. Default value is  ```null```
loop | A boolean object that defines the animation loop. Default value is ```true```. If ```false```, the animation is paused when it reaches the last frame
resolution | Spatial resolution in pixels. A resolution of 1 means no spatial aggregation of the data. Its value must be a power of 2
steps | Number of steps that the animation is divided into
animationDuration | Duration, in seconds, of the animation
zIndex | Z-Index CSS property of the layer
attribution | Attribution to be added in the bottom right of the map
maxZoom | Maximum zoom for the layer. 
tileSize | Size, in pixels of the tiles

##### Using a CartoDB table directly

Name | Description
--- | ---
user | A string object, your CartoDB [account name](/cartodb-editor/your-account/#account). Default value is  ```null```
table | A string object, the CartoDB table name where data is found (also known as a dataset.) Default value is  ```null```

##### Using a custom SQL query

Name | Description
--- | ---
query | A string object, the SQL query to be performed to fetch the data. Default value is ```null```.<br/><br/>You must use this param or table, but not at the same time

**Tip:** For a Torque category layer that is created dynamically with `cartodb.createLayer`, the SQL query must explicitly include how to build the torque_category column. You must include both the `sql` and `table_name` parameters. See this [createLayer with torque category layer](https://gist.github.com/danicarrion/dcaf6f00a71aa55134b4) example.

##### Providing a TileJSON file

Name | Description
--- | ---
tileJSON | A URL pointing to a valid [TileJSON](https://github.com/mapbox/tilejson-spec) file from which to get the Torque tile templates

#### Time Methods

Method | Options | Returns | Description |
---|---|---|---|
`setStep(step)` | `time numeric` | `this` | the value must be between 0 and the total number of `steps` in the animation
`play()` | | `this` | starts the animation
`stop()` | | `this` | stops the animation and set time to step 0
`pause()` | | `this` | stops the animation but keep the current time (play enables the animation again)
`toggle()` | | `this` | toggles (pause/play) the animation
`getStep()` | | current animation step (integer) | gets the current animation step. A step is considered an animation frame
`getTime()` | | current animation time (Date) | gets the real animation time
`isRunning()` | | `true`/`false` | describes whether the Torque layer is playing or is stopped

**Note:** Torque.js interprets the beginning and ending date/time from your "Time Column" as one block, then divides that up into [Steps](/cartodb-platform/cartocss/properties-for-torque/#torque-frame-count-number), depending on the number you set. It does not necessarily draw one frame for each row. 

#### Layer Control Methods

 Method | Options | Returns | Description
---|---|---|---
`hide()` | none | `this` | hides the Torque layer
`show()` | none| `this` | shows the Torque layer

#### Style Methods 

Method | Options | Returns | Description
---|---|---|---|
`setCartoCSS(cartocss)` | `cartocss string` | `this` | style the map rendering using client-side CartoCSS (not available with [Named maps](/cartodb-platform/maps-api/named-maps/))

Torque supports a limited subset of CartoCSS parameters, as described in the [torque-reference](https://github.com/cartodb/torque-reference). Alternatively, Mapnik supports the following [mapnik-reference](https://github.com/cartodb/torque-reference) for Torque rendering. 
To see the full list of supported parameters, read the [Torque CartoCSS documentation](/cartodb-platform/cartocss/properties-for-torque/). `value` and `zoom` variables can be used. `value` is the value of aggregation (see `countby` constructor option). `zoom` is the current zoom being rendered.

TorqueLayer currently expects `marker` styling.

#### Example

This CartoCSS example should be `string` encoded in Javascript.

```scss
#layer {
  marker-fill: #662506;
  marker-width: 20;
  [value > 1] { marker-fill: #FEE391; }
  [value > 2] { marker-fill: #FEC44F; }
  [value > 3] { marker-fill: #FE9929; }
  [value > 4] { marker-fill: #EC7014; }
  [value > 5] { marker-fill: #CC4C02; }
  [value > 6] { marker-fill: #993404; }
  [value > 7] { marker-fill: #662506; }
  [frame-offset = 1] {  marker-width: 20; marker-fill-opacity: 0.05;}' // renders the previous frame
  [frame-offset = 2] {  marker-fill: red; marker-width: 30; marker-fill-opacity: 0.02;}' // renders two frames ago from the current being rendered
}
```

### Data Methods

Method | Options | Returns | Description
---|---|---|---
`setSQL(sql statement)` | `SQL string` | `this` | Change the SQL on the data table (not available with named maps)
`error(callback)` | `callback function with a list of errors as argument` | `this` | specifies a callback function to run if there are query errors

#### Example

SQL Example to limit the data used in the Torque map.§

```js
torqueLayer.setSQL("SELECT * FROM table LIMIT 100");
```

### Events

_**Note:** You can only run events after the [required libraries](/cartodb-platform/torque/torquejs-getting-started/#advanced-torquejs-libraries) are loaded. Otherwise, the [interaction methods](/cartodb-platform/torque/torque-interaction-methods/) will not work._

Events in Torque follow the format:

```js
torqueLayer.on('event-type', function([callback_obj]) {
  // do something
});
```

Events | Callback Object | Description
---|---|---
`change:steps` | current step | When a map changes steps, this event is triggered
`change:time` | current time, step number | When a map changes time, this event is triggered
`play` | none | Triggered when the Torque layer is played
`pause` | none | Triggered when the Torque layer is paused
`stop` | none | Triggered when the Torque layer is stopped
`load` | none | Triggered when the Torque layer is loaded

#### Example

An event example to print the current step to the console log.

```js
torqueLayer.on('change:steps', function(step) {
  // do something with step
  console.log('Current step is ' + step);
});
```

## Google Maps Layers

### GMapsTorqueLayer(_options_)

This class does exactly the same as ``L.TorqueLayer`` but using Google Maps instead. The main difference is that this class
is not a layer but is an overlay, so in order to add it to the a map use, ``layer.setMap`` instead of ``overlayMapTypes``. See the [Overlay View](https://developers.google.com/maps/documentation/javascript/reference#OverlayView) reference in Google Maps API doc.

#### Options

Name | Description
--- | ---
map | A google.maps.Map instance


## Torque Functions

Since Torque API methods can be applied when creating a visualization using the [CartoDB.js API methods](/cartodb-platform/cartodb-js/api-methods/), these [Torque Functions](https://github.com/CartoDB/cartodb.js/blob/be76b55caeeb0dfc147e3fa36628d9e215717ce5/src/vis/vis.js#L229) are available.

_**Note:** We are currently in the process of enhancing this functions and returns. A future documentation update will include complete descriptions of these Torque functions._
