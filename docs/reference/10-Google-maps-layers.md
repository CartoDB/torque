### Google Maps Layers

#### GMapsTorqueLayer(_options_)

This class does exactly the same as ``L.TorqueLayer`` but using Google Maps instead. The main difference is that this class
is not a layer but is an overlay, so in order to add it to the a map use, ``layer.setMap`` instead of ``overlayMapTypes``. See the [Overlay View](https://developers.google.com/maps/documentation/javascript/reference#OverlayView) reference in Google Maps API doc.

##### Options

Name | Description
--- | ---
map | A google.maps.Map instance
