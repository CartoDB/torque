L.TileLayer.Canvas = L.TileLayer.extend({
    options: {
        async: false
    },

    initialize: function (options) {
      this.tileSize = tileSize || new MM.Point(256, 256)
      this.tiles = new CartoDBSQLAPI({
         user: 'vizzuality',
         table: 'countries_final',
         columns: ['admin'],
      });
      this.views = new CanvasMapView();
    },

    redraw: function () {
    },


    _createTileProto: function () {
        var proto = this._canvasProto = L.DomUtil.create('canvas', 'leaflet-tile');

        var tileSize = this.options.tileSize;
        proto.width = tileSize;
        proto.height = tileSize;
    },

    _createTile: function () {
        var tile = this._canvasProto.cloneNode(false);
        tile.onselectstart = tile.onmousemove = L.Util.falseFn;
        return tile;
    },

    _loadTile: function (tile, tilePoint, zoom) {
        tile._layer = this;
        tile._tilePoint = tilePoint;
        tile._zoom = zoom;

        this.drawTile(tile, tilePoint, zoom);

        if (!this.options.async) {
            this.tileDrawn(tile);
        }
    },
    _resetTile: function (tile) {
    },

    drawTile: function (tile, tilePoint, zoom) {
        // override with rendering code
    },

    tileDrawn: function (tile) {
        this._tileOnLoad.call(tile);
    }
});
