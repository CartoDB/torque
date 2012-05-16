
//========================================
// CartoDB data provider 
//========================================

(function(VECNIK) {

  function CartoDBSQLAPI(opts) {
      this.projection = new VECNIK.MercatorProjection();
      this.opts = opts;
      this.base_url = 'http://' + opts.user + ".cartodb.com/api/v2/sql";

      //set defaults
      this.opts.ENABLE_SIMPLIFY = VECNIK.settings.get('ENABLE_SIMPLIFY');
      this.opts.ENABLE_SNAPPING = VECNIK.settings.get('ENABLE_SNAPPING');
      this.opts.ENABLE_CLIPPING = VECNIK.settings.get('ENABLE_CLIPPING');
      this.opts.ENABLE_FIXING = VECNIK.settings.get('ENABLE_FIXING');
  }

  CartoDBSQLAPI.prototype.debug = function(w) {
    if(this.opts.debug) {
      //console.log(w);
    }
  }

  CartoDBSQLAPI.prototype._sql_url = function(sql) {
      var self = this;
      this.debug(sql);
      return this.base_url  + "?q=" + encodeURIComponent(sql) + "&format=geojson&dp=6";
  }

  CartoDBSQLAPI.prototype.get_tile_data_sql = function(projection, table, x, y, zoom) {
      return VECNIK.CartoDB.SQL(projection, table, x, y, zoom, this.opts);
  };

  CartoDBSQLAPI.prototype.url = function(coordinates) {
      var projection = this.projection;
      var opts = this.opts;
      var table = opts.table;
      var prj = this.projection;
      var sql = this.get_tile_data_sql(prj, table, coordinates.column, coordinates.row, coordinates.zoom);
      var sql_url = this._sql_url(sql);
      return sql_url;
  }
  
  VECNIK.CartoDB = VECNIK.CartoDB || {};
  VECNIK.CartoDB.API = CartoDBSQLAPI;

})(VECNIK);
