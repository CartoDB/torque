L.TorqueLayer.extend({

  initialize: function(options) {
    this._filters = {}
    L.TorqueLayer.prototype.initialize.call(this, options);
  },

  setFilters: function() {
    this.provider.setFilters(this._filters);
    this._reloadTiles();
    return this;
  },

  filterByRange: function(variableName, start, end) {
    this._filters[variableName] = {type: 'range',  range: {start: start, end: end} }
    this._filtersChanged()
    this.fire('dataUpdate')
    return this
  },

  filterByCat: function(variableName, categories, exclusive) {
    this._filters[variableName] = {type: 'cat',  categories: categories, exclusive: !!exclusive };
    this._filtersChanged()
    return this
  },

  clearFilter: function(name){
    if(name) {
      delete this._filters[name]
    }
    else {
      this._filters = {}
    }
    this._filtersChanged()
    return this
  },

  _filtersChanged:function(){
    this.provider._filters = this._filters;
    this._clearTileCaches()
    this._render()
  },

  getHistogramForDataset: function(varName, start, end, bins, own_filter, callback) {
    var tiles = [{x: 0, y: 0, z: 0}];
    this.provider.getHistogramForTiles(varName, start, end, bins, tiles, own_filter, callback);
  },

  getAggregationForVisibleRegion: function(varName, agg, own_filter, callback) {
    var tiles = this.visibleTiles();
    this.provider.getAggregationForTiles(varName, agg, tiles, own_filter, callback);
  },

  getHistogramForVisibleRegion: function(varName, start, end, bins, own_filter, callback) {
    var tiles = this.visibleTiles();
    this.provider.getHistogramForTiles(varName, start, end, bins, tiles, own_filter, callback);
  },

  getCategoriesForVisibleRegion: function(varName, callback){
    var tiles = this.visibleTiles();
    this.provider.getCategoriesForTiles(varName, tiles, callback);
  },

  // override default getValues to be able to handle categories
  getValues: function(step) {
    var values = [];
    var idx = 0;
    var mappedValues = [];
    step = step === undefined ? this.key: step;
    var t, tile;
    for(t in this._tiles) {
      tile = this._tiles[t];
      if (tile) {
        this.renderer.getValues(tile, step, values);
        // map the categories
        var mapping = tile.categories[step];
        if (mapping) {
          for (var i = idx; i <= values.length - idx; ++i) {
            mappedValues.push(mapping[values[i]]);
          }
          idx = values.length;
        }
      }
    }
    if (mappedValues.length) {
      return mappedValues;
    }
    return values;
  },

});
