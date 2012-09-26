_.templateSettings = {
  interpolate: /\{\{(.+?)\}\}/g,
  evaluate: /\[(.+?)\]/g

};

String.prototype.truncate = function(n) {
  return this.substr(0, n - 1 ) + ( this.length > n ? '...' : '' );
};

var config = {
  ZOOM:               5,
  MINZOOM:            3,
  MAXZOOM:            16,
  LAT:                3,
  LNG:                120,
  MONTHNAMES:         ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  MONTHNAMES_SHORT:   ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  YEARS:              [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
  DATE_FORMAT:        "yyyy-MM-dd",
  DATE_SUFFIXES:      ["th", "st", "nd", "rd"],
  MIN_PROJECT_RADIUS: 100
};

config.mapLoaded = false;
config.gfwStyle = new google.maps.StyledMapType(config.mapStyles, {name: "GFW Style"});
config.mapStyles = [ { stylers: [ { saturation: -65 }, { gamma: 1.52 } ] }, { featureType: "administrative", stylers: [ { saturation: -95 },{ gamma: 2.26 } ] }, { featureType: "water", elementType: "labels", stylers: [ { visibility: "off" } ] }, { featureType: "administrative.locality", stylers: [ { visibility: 'off' } ] }, { featureType: "road", stylers: [ { visibility: "simplified" }, { saturation: -99 }, { gamma: 2.22 } ] }, { featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] }, { featureType: "road.arterial", stylers: [ { visibility: 'off' } ] }, { featureType: "road.local", elementType: "labels", stylers: [ { visibility: 'off' } ] }, { featureType: "transit", stylers: [ { visibility: 'off' } ] }, { featureType: "road", elementType: "labels", stylers: [ { visibility: 'off' } ] },{ featureType: "poi", stylers: [ { saturation: -55 } ] } ];

config.mapOptions = {
  zoom:               config.ZOOM,
  minZoom:            config.MINZOOM,
  maxZoom:            config.MAXZOOM,
  center:             new google.maps.LatLng(config.LAT, config.LNG),
  mapTypeId:          google.maps.MapTypeId.TERRAIN,
  disableDefaultUI:   true,
  panControl:         false,
  zoomControl:        false,
  mapTypeControl:     false,
  scaleControl:       false,
  streetViewControl:  false,
  overviewMapControl: false,
  scrollwheel:        false
};

config.mapStyles = {};

config.mapStyles.forestHeight = new google.maps.ImageMapType({
  getTileUrl: function(ll, z) {
    var X = ll.x % (1 << z);  // wrap
    return "http://api.tiles.mapbox.com/v3/cartodb.Forest-Height-Test/" + z + "/" + X + "/" + ll.y + ".png";
  },
  tileSize: new google.maps.Size(256, 256),
  isPng: true,
  maxZoom: 7,
  name: "Forest Height",
  alt: "Global forest height"
});

config.mapStyles.forestSoft = new google.maps.ImageMapType({
  getTileUrl: function(ll, z) {
    var X = ll.x % (1 << z);  // wrap
    return "http://api.tiles.mapbox.com/v3/cartodb.global-forest-height/" + z + "/" + X + "/" + ll.y + ".png";
  },
  tileSize: new google.maps.Size(256, 256),
  isPng: true,
  maxZoom: 7,
  name: "Forest Height",
  alt: "Global forest height"
});

var Road = function(){
  this.Road = function(){
    map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    map.setOptions({styles: null});
  };
};

var Satellite = function(){
  this.Satellite = function(){
    map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
    map.setOptions({styles: null});
  };
};

var Forest = function(){
  this.Forest = function(){
    map.setMapTypeId('forests');
    map.setOptions({styles: null});
  };
};

var ForestSoft = function(){
  this.ForestSoft = function(){
    map.setMapTypeId('forests_soft');
    map.setOptions({styles: null});
  };
};

var Soft = function(){
  this.Soft = function(){
    map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    map.setOptions({styles: map_style.google_maps_customization_style});
  };
};


function parseHash(hash) {

  var args = hash.split("/");

  if (args.length >= 3) {

    var zoom = parseInt(args[2], 10),
    lat = parseFloat(args[3]),
    lon = parseFloat(args[4]),
    filters = args[5];

    if (filters) {
      filters.substr(0, filters.indexOf("?"));
    }

    if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
      return false;
    } else {
      return {
        center: new google.maps.LatLng(lat, lon),
        zoom: zoom,
        filters: filters
      };
    }
  } else {
    return false;
  }
}


function monthDiff(d1, d2) {
  var months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth() + 1;
  months += d2.getMonth();
  return months;
}
