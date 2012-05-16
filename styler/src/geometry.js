
//========================================
// geometry conversion
//========================================

var VECNIK = VECNIK || {};

(function(VECNIK) {

   var LatLng = VECNIK.LatLng;
   var Point = VECNIK.Point;

   //stats 
   var stats = {
      vertices: 0
   };

   var latlng = new LatLng(0, 0);
   var prj = new VECNIK.MercatorProjection();

   function map_latlon(ll, x, y, zoom) {
        latlng.latitude  = ll[1];
        latlng.longitude = ll[0];
        stats.vertices++;
        var point =  prj.latLngToTilePoint(latlng, x, y, zoom);
        //point.x = point.x >> 0;
        //point.y = point.y >> 0;
        return point;
   }

   var primitive_conversion =  {
        'LineString': function(x, y, zoom, coordinates) {
              var converted = [];
              var pc = primitive_conversion['Point'];
              for(var i=0; i < coordinates.length; ++i) {
                  converted.push(pc(x, y, zoom, coordinates[i]));
              }
              return converted;
        },

        'Point': function(x, y, zoom, coordinates) {
            return map_latlon(coordinates, x, y, zoom);
        },

        'MultiPoint': function(x, y, zoom, coordinates) {
              var converted = [];
              var pc = primitive_conversion['Point'];
              for(var i=0; i < coordinates.length; ++i) {
                  converted.push(pc(x, y, zoom, coordinates[i]));
              }
              return converted;
        },
        //do not manage inner polygons!
        'Polygon': function(x, y, zoom, coordinates) {
             if(coordinates[0]) {
               var coords = [];
                for(var i=0; i < coordinates[0].length; ++i) {
                  coords.push(map_latlon(coordinates[0][i], x, y, zoom));
               }
               return [coords];
             }
             return null;
        },
        'MultiPolygon': function(x, y, zoom, coordinates) {
              var polys = [];
              var poly;
              var pc = primitive_conversion['Polygon'];
              for(var i=0; i < coordinates.length; ++i) {
                  poly = pc(x, y, zoom, coordinates[i]);
                  if(poly)
                    polys.push(poly);
              }
              return polys;
        }
    };

   var project_geometry = function(geometry, zoom, x, y) {
      var conversor = primitive_conversion[geometry.type];
      if(conversor) {
          return conversor(x, y , zoom, geometry.coordinates);
      }
   };

   VECNIK.project_geometry = project_geometry;
   VECNIK.geometry_stats = stats;

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
  module.exports.project_geometry = VECNIK.project_geometry;
}
if (typeof self !== 'undefined') {
  self.VECNIK = VECNIK;
}

