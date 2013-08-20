
# Torque API

Torque provides two kinds of visulizations. 

  - static: provides a way to create heatmap like visualizations (note for Andrew: fon). see ``TorqueLayer``
  - dinamyc: animate points over a map (note for Andrew: Navy) see ``TiledTorqueLayer``


depending on the map provider you are using you need to use different layer type. Currently we provide layers for Google Maps and Leaflet.

## L.TorqueLayer(options)

_Arguments_:
    * options: object that contains the following attributes:
        - user: cartodb username
        - table: table name
        - column: time column
        - countby: aggregation per pixel, e.g: 'count(cartodb_id)',
        - resolution: pixel resolution,
        - is_time: true or false,
        - steps: animation steps, e.g: 750,
        - blendmode: canvas blend mode 'lighter'

## L.TorqueLayer.setKey(time: number)

_Arguments_
    * time: set time to be displayed. Should be a number between [0, steps)
## L.TorqueLayer.setCartoCSS(cartocss: string)
_Arguments_
    * cartocss: cartocss string that contains the point style. Torque does not support the full cartocss spec, only a small subset. 
    ``value`` and ``zoom`` variables can be used. ``value`` is the value of aggregation (see ``countby`` constructor option). ``zoom`` is the current zoom being rendered

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
creates a static visualization
_Arguments_:
    * options:
        - provider: 'url_template',
        - url: tile template url e.g 'http://host.com/{z}/{x}/{y}.json', (note to Andrew: link here to the json data format)
        - resolution: data resolution, e.g 4


## L.TiledTorqueLayer.setKey(keys: number|array)
set keys to show, if it's an array all the keys in that array are accumulated

## L.TiledTorqueLayer.setCartoCSS(cartocss: string)

``value`` and ``zoom`` variables can be used. only ``polygon-fill`` property is supported currently

_Example_:
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
