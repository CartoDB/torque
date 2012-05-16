//========================================
// Core
//
// base classes
//========================================

// create root scope if not exists
var VECNIK = VECNIK || {};

(function(VECNIK) {
  var MM = com.modestmaps;


  //========================================
  // testing provider with mapbox tile layer
  //========================================
  function TileManagerMapBox() {
  }
  TileManagerMapBox.prototype = new VECNIK.TileManager();
  TileManagerMapBox.prototype.url = function(coordinates) {
      return 'http://b.tiles.mapbox.com/v3/mapbox.mapbox-streets/' + coordinates.zoom + '/' + coordinates.row + '/' + coordinates.column + ".png";
  }


  //========================================
  // Canvas provider
  //========================================
  function CanvasProvider(dataSource, shader, renderer, tileSize) {
    this.tileSize = tileSize || new MM.Point(256, 256)
    this.renderer = renderer;
    this.tiles = new VECNIK.TileManager(dataSource)
    this.views = new VECNIK.CanvasMapView(shader);
    this.shader = shader;
  }

  CanvasProvider.prototype.getTile = function(coord) {
      var tile = this.tiles.add(coord);
      var canvas = new VECNIK.CanvasTileView(tile, this.shader, this.renderer);
      this.views.add(canvas);
      return canvas.el;
  }

  CanvasProvider.prototype.releaseTile = function(coordinates) { 
    this.tiles.destroy(coordinates);
  };

  MM.extend(CanvasProvider, MM.MapProvider);

  VECNIK.MM = {
    CanvasProvider: CanvasProvider,
    TileManagerMapBox: TileManagerMapBox
  };

})(VECNIK);

