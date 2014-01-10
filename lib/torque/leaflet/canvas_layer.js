if(typeof(L) !== 'undefined') {
/**
 * full canvas layer implementation for Leaflet
 */

L.CanvasLayer = L.Class.extend({

  includes: [L.Mixin.Events, L.Mixin.TileLoader],

  options: {
      minZoom: 0,
      maxZoom: 28,
      tileSize: 256,
      subdomains: 'abc',
      errorTileUrl: '',
      attribution: '',
      zoomOffset: 0,
      opacity: 1,
      unloadInvisibleTiles: L.Browser.mobile,
      updateWhenIdle: L.Browser.mobile,
      tileLoader: false // installs tile loading events
  },

  initialize: function (options) {
    var self = this;
    options = options || {};
    //this.project = this._project.bind(this);
    this.render = this.render.bind(this);
    L.Util.setOptions(this, options);
    this._canvas = document.createElement('canvas');
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = 0;
    this._canvas.style.left = 0;
    this._canvas.style.zIndex = options.zIndex || 0;

    this._ctx = this._canvas.getContext('2d');
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
                                    return window.setTimeout(callback, 1000 / 60);
                                };
    this.requestAnimationFrame = requestAnimationFrame;
  },

  onAdd: function (map) {
    this._map = map;

    //this._staticPane = map._createPane('leaflet-tile-pane', map._container);
    if (!map._panes.staticPane) {
      map._panes.staticPane = map._createPane('leaflet-tile-pane', map._container);
    }
    this._staticPane = map._panes.staticPane
    this._staticPane.appendChild(this._canvas);

    map.on({
      'viewreset': this._reset
      //'move': this._render
    }, this);

    map.on('move', this._render, this);//function(){ console.log("a"); }, this);
    map.on('resize', this._reset, this);

    if(this.options.tileLoader) {
      this._initTileLoader();
    }

    this._reset();
  },

  getCanvas: function() {
    return this._canvas;
  },

  getAttribution: function() {
    return this.options.attribution;
  },

  draw: function() {
    return this._reset();
  },

  onRemove: function (map) {
    this._staticPane.removeChild(this._canvas);
    map.off({
        'viewreset': this._reset,
        'move': this._render,
        'resize': this._reset
    }, this);
  },

  addTo: function (map) {
    map.addLayer(this);
    return this;
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },

  setZIndex: function(zIndex) {
    this._canvas.style.zIndex = zIndex;
  },

  bringToFront: function () {
    return this;
  },

  bringToBack: function () {
    return this;
  },

  _reset: function () {
    var size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this.onResize();
    this._render();
  },

  /*
  _project: function(x) {
    var point = this._map.latLngToLayerPoint(new L.LatLng(x[1], x[0]));
    return [point.x, point.y];
  },
  */

  _updateOpacity: function () { },

  _render: function() {
    this.requestAnimationFrame.call(window, this.render);
  },

  redraw: function() {
    this._render();
  },

  onResize: function() {
  },

  render: function() {
    throw new Error('render function should be implemented');
  }

});

} //L defined
