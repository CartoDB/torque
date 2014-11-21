
# Torque API


## L.TorqueLayer(options)

One of two core classes for the Torque library - it is used to create an animated torque layer with custom settings.

### Usage example

```js
  // initialize a torque layer that uses the CartoDB account details and SQL API to pull in data
  var torqueLayer = new L.TorqueLayer({
    user       : 'viz2',
    table      : 'ow',
    cartocss:  CARTOCSS
  });
```

### Options

##### Provider options

| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| provider  | string     | ```sql_api```   | Where is the data coming from |

##### CartoDB data options (SQL API provider)

| Option    | type       | Default   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| user      | string     | ```null```      | CartoDB account name. Found as, accountname.cartodb.com|
| table     | string     | ```null```      | CartoDB table name where data is found  |
| sql       | string     | ```null```      | SQL query to be performed to fetch the data. You must use this param or table, not at the same time |


### Time methods

| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```setStep(step)``` | ```time numeric```    | ```this```   | sets the animation to the step indicated by ```step```, must be between 0 and ```steps```|
| ```play()```| | ```this```| starts the animation
| ```stop()```| | ```this```| stops the animation and set time to step 0
| ```pause()```| | ```this```| stops the animation but keep the current time (play enables the animation again)
| ```toggle()```| | ```this```| toggles (pause/play) the animation 
| ```getStep()``` | | current animation step (integer)   | gets the current animation step
| ```getTime()``` | | current animation time (Date) | gets the real animation time



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

### Interaction methods (only available for Leaflet)
| Method    | options    | returns   | Description                            |
|-----------|:-----------|:----------|:---------------------------------------|
| ```getValueForPos(x, y[, step])```| | an object like { bbox:[], value: VALUE } if there is value for the pos, null otherwise | allows to get the value for the coordinate (in map reference system) for a concrete step. If step is not specified the animation one is used. This method is expensive in terms of CPU so be careful. It returns the value from the raster data not the rendered data |
| ```getActivePointsBBox(step)```|  | list of bbox | returns the list of bounding boxes active for ``step``
| ```invalidate()```|  | | forces a reload of the layer data.


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


