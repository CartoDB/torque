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
    <script>
      window.onload = function() {
	      // Create a Leaflet map
	      var map = new L.Map('map', {
	        zoomControl: true,
	        center: [40, 0],
	        //center: [36.60670888641815,  38.627929687],
	        zoom: 3
	      });

	      // Add a basemap, here we use one provided by Stamen
	      L.tileLayer('http://tile.stamen.com/toner/{z}/{x}/{y}.png', {
	        attribution: 'Stamen'
	      }).addTo(map);



	      // Add Torque visualization
	      // - create the torqueLayer object
	      // - add the torqueLayer to the map
	      var torqueLayer = new L.TorqueLayer({
	        provider: 'sql_api',
	        user       : 'viz2',
	        table      : 'ow',
	        column     : 'date',
	        countby    : 'count(cartodb_id)',
	        resolution: 1,
	        is_time: true,
	        steps: 750,
	        pixel_size: 4,
	        blendmode  : 'lighter'
	      });

	      torqueLayer.addTo(map);
	      var t = 0;
	      setInterval(function() {
	        torqueLayer.setKey((t++%750));
	      }, 100);
      }
    </script>
  ```
[Grab the complete example source code](https://github.com/CartoDB/torque/blob/master/examples/navy_leaflet.html)
<div class="margin20"></div>

### API
[see reference](https://github.com/CartoDB/torque/blob/master/doc/API.md)

