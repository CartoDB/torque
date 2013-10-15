(function(exports) {

if(typeof(google) === 'undefined' || typeof(google.maps) === 'undefined') return;

function GMapsTileLoader() {
}


GMapsTileLoader.prototype = {

  _initTileLoader: function(map, projection) {
    this._map = map;
    this._projection = projection;
    this._tiles = {};
    this._tilesToLoad = 0;
    this._updateTiles = this._updateTiles.bind(this);
    this._listeners = [];
    this._listeners.push(
      google.maps.event.addListener(this._map, 'dragend', this._updateTiles),
      google.maps.event.addListener(this._map, 'zoom_changed', this._updateTiles)
    );
    this.tileSize = 256;
    this._updateTiles();
  },

  _removeTileLoader: function() {
    for(var i in this._listeners) {
      google.maps.event.removeListener(this._listeners[i]);
    }
    this._removeTiles();
  },

  _removeTiles: function () {
      for (var key in this._tiles) {
        this._removeTile(key);
      }
  },

  _reloadTiles: function() {
    this._removeTiles();
    this._updateTiles();
  },

  _updateTiles: function () {

      if (!this._map) { return; }

      var bounds = this._map.getBounds();
      var zoom = this._map.getZoom();
      var tileSize = this.tileSize;
      var mzoom = (1 << zoom);

      var topLeft = new google.maps.LatLng(
        bounds.getNorthEast().lat(),
        bounds.getSouthWest().lng()
      );

      var bottomRigth = new google.maps.LatLng(
        bounds.getSouthWest().lat(),
        bounds.getNorthEast().lng()
      );


      this._projection = this._map.getProjection();
      var divTopLeft = this._projection.fromLatLngToPoint(topLeft);
      var divBottomRight = this._projection.fromLatLngToPoint(bottomRigth);


      var nwTilePoint = new google.maps.Point(
              Math.floor(divTopLeft.x*mzoom / tileSize),
              Math.floor(divTopLeft.y*mzoom / tileSize)),
          seTilePoint = new google.maps.Point(
              Math.floor(divBottomRight.x*mzoom / tileSize),
              Math.floor(divBottomRight.y*mzoom / tileSize));


      this._addTilesFromCenterOut(nwTilePoint, seTilePoint);
      this._removeOtherTiles(nwTilePoint, seTilePoint);
  },

  _removeOtherTiles: function (nwTilePoint, seTilePoint) {
      var kArr, x, y, key;

      var zoom = this._map.getZoom();
      for (key in this._tiles) {
          if (this._tiles.hasOwnProperty(key)) {
              kArr = key.split(':');
              x = parseInt(kArr[0], 10);
              y = parseInt(kArr[1], 10);
              z = parseInt(kArr[2], 10);

              // remove tile if it's out of bounds
              if (z !== zoom || x < nwTilePoint.x || x > seTilePoint.x || y < nwTilePoint.y || y > seTilePoint.y) {
                  this._removeTile(key);
              }
          }
      }
  },

  _removeTile: function (key) {
      this.onTileRemoved && this.onTileRemoved(this._tiles[key]); 
      delete this._tiles[key];
  },

  _tileShouldBeLoaded: function (tilePoint) {
      return !((tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom) in this._tiles);
  },

  _tileLoaded: function(tilePoint, tileData) {
    this._tilesToLoad--;
    this._tiles[tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom] = tileData;
    if(this._tilesToLoad === 0) {
      this.onTilesLoaded && this.onTilesLoaded();
    }
  },

  getTilePos: function (tilePoint) {
    var limit = (1 << this._map.getZoom());
    // wrap tile
    tilePoint = {
      x: ((tilePoint.x % limit) + limit) % limit,
      y: tilePoint.y
    };

    tilePoint = new google.maps.Point(
      tilePoint.x * this.tileSize, 
      tilePoint.y * this.tileSize
    );

    var bounds = this._map.getBounds();
    var topLeft = new google.maps.LatLng(
      bounds.getNorthEast().lat(),
      bounds.getSouthWest().lng()
    );

    var divTopLeft = this._map.getProjection().fromLatLngToPoint(topLeft);
    zoom = (1 << this._map.getZoom());
    divTopLeft.x = divTopLeft.x * zoom;
    divTopLeft.y = divTopLeft.y * zoom;

    return new google.maps.Point(
      tilePoint.x - divTopLeft.x,
      tilePoint.y - divTopLeft.y
    );
  },

  _addTilesFromCenterOut: function (nwTilePoint, seTilePoint) {
      var queue = [],
          center = new google.maps.Point(
            (nwTilePoint.x + seTilePoint.x) * 0.5,
            (nwTilePoint.y + seTilePoint.y) * 0.5
          ),
          zoom = this._map.getZoom();

      var j, i, point;

      for (j = nwTilePoint.y; j <= seTilePoint.y; j++) {
          for (i = nwTilePoint.x; i <= seTilePoint.x; i++) {
              point = new google.maps.Point (i, j);
              point.zoom = zoom;

              if (this._tileShouldBeLoaded(point)) {
                  queue.push(point);
              }
          }
      }

      var tilesToLoad = queue.length;

      if (tilesToLoad === 0) { return; }

      function distanceToCenterSq(point) {
        var dx = point.x - center.x;
        var dy = point.y - center.y;
        return dx * dx + dy * dy;
      }

      // load tiles in order of their distance to center
      queue.sort(function (a, b) {
          return distanceToCenterSq(a) - distanceToCenterSq(b);
      });

      this._tilesToLoad += tilesToLoad;

      if (this.onTileAdded) {
        for (i = 0; i < tilesToLoad; i++) {
          this.onTileAdded(queue[i]);
        }
      }
  }

}

torque.GMapsTileLoader = GMapsTileLoader;

})(typeof exports === "undefined" ? this : exports);
