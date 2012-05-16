importScripts('../js/mercator.js');
importScripts('../js/geometry.js');

self.onmessage = function(event) {
      var data = event.data;
      var primitives = data.primitives;
      var geometry = [];
      for(var i = 0; i < primitives.length; ++i) {
          var p = primitives[i];
          if(p.geometry) {
            var converted = VECNIK.project_geometry(p.geometry, 
              data.zoom, data.x, data.y);
            if(converted && converted.length !== 0) {
               geometry.push({
                 vertexBuffer: converted,
                 type: p.geometry.type,
                 metadata: p.properties
               });
            }
          }
      }
      self.postMessage({geometry: geometry});
};
