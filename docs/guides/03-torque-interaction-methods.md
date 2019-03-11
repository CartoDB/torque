## Advanced Torque.js Interaction Methods

### Torque Layers

While you can add multiple layers with Torque.js, this is not recommended as it effects performance.

#### Torque Layer Source Object (_type: 'torque'_)

This layer source object is used for Torque maps. Note that it does not allow sublayers.

##### Example

```javascript
{
  type: 'torque', // Required
  order: 1, // Optional
  options: {
    query: "SQL statement",   // Required if table_name is not given
    table_name: "table_name",   // Required if query is not given
    user_name: "your_user_name", // Required
    cartocss: "CartoCSS styles" // Required
  }
}
```


### Interaction Methods for a Torque Layer

Used to create an animated torque layer with customized settings.

```javascript
// initialize a torque layer that uses the CARTO account details and SQL API to pull in data
var torqueLayer = new L.TorqueLayer({
  user : 'viz2',
  table : 'ow',
  cartocss: CARTOCSS
});
```

#### getValueForPos(_x, y[, step]_)

##### Arguments

Name | Description
--- | --- 
`getValueForPos(_x, y[, step]_)` |  Allows to get the value for the coordinate (in map reference system) for a concrete step. If a step is not specified, the animation step is used. Use caution, as this method increases CPU usage

##### Returns

An object, such as a { bbox:[], value: VALUE } if there is value for the pos, otherwise, it is null. 
 It returns the value from the raster data, not the rendered data.

#### getValueForBBox(_xstart, ystart, xend, yend_)

##### Arguments

Name | Description
--- | --- 
`getValueForBBox(_xstart, ystart, xend, yend_)` |  An accumulated numerical value from all the torque areas, within the specified bounds

##### Returns

Returns a number.

#### getActivePointsBBox(_step_)

##### Arguments

Name | Description
--- | --- 
`getActivePointsBBox(_step_)` |  The list of bounding boxes active for `step`

##### Returns

Returns a list of values.

#### invalidate()

##### Arguments

Name | Description
--- | --- 
`invalidate()` | Forces a reload of the layer data

**Tip:** All of these interaction methods are available for Google Map layers, with the exception of `invalidate`.

##### Example of Interaction Methods for a Torque Layer

```javascript
<script>
// define the torque layer style using cartocss
// this creates a kind of density map
// color scale from http://colorbrewer2.org/
var CARTOCSS = [
  'Map {',
  '-torque-time-attribute: "date";',
  '-torque-aggregation-function: "avg(temp::float)";',
  '-torque-frame-count: 1;',
  '-torque-animation-duration: 15;',
  '-torque-resolution: 16',
  '}',
  '#layer {',
  '  marker-width: 8;',
  '  marker-fill-opacity: 1.0;',
  '  marker-fill: #fff5eb; ',
  '  marker-type: rectangle;',
  '  [value > 1] { marker-fill: #fee6ce; }',
  '  [value > 2] { marker-fill: #fdd0a2; }',
  '  [value > 4] { marker-fill: #fdae6b; }',
  '  [value > 10] { marker-fill: #fd8d3c; }',
  '  [value > 15] { marker-fill: #f16913; }',
  '  [value > 20] { marker-fill: #d94801; }',
  '  [value > 25] { marker-fill: #8c2d04; }',
  '}'
].join('\n');

var map = new L.Map('map', {
  zoomControl: true,
  center: [40, 0],
  zoom: 3
});
L.tileLayer('http://{s}.api.cartocdn.com/base-dark/{z}/{x}/{y}.png', {
  attribution: 'CARTO'
}).addTo(map);
var torqueLayer = new L.TorqueLayer({
  user : 'viz2',
  table : 'ow',
  cartocss: CARTOCSS
});
torqueLayer.addTo(map);
map.on('click', function(e) {
  var p = e.containerPoint
  var value = torqueLayer.getValueForPos(p.x, p.y);
  if (value !== null) {
    map.openPopup('average temperature: ' + value.value + "C", e.latlng);
  }
});
```
