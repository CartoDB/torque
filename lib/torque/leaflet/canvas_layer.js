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
    this._canvas = this._createCanvas();
    this._ctx = this._canvas.getContext('2d');
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
                                    return window.setTimeout(callback, 1000 / 60);
                                };
    this.requestAnimationFrame = requestAnimationFrame;
  },

  _createCanvas: function() {
    var canvas;
    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = this.options.zIndex || 0;
    var className = 'leaflet-tile-container leaflet-zoom-animated';
    canvas.setAttribute('class', className);
    return canvas;
  },

  onAdd: function (map) {
    this._map = map;
    var tilePane = this._map._panes.tilePane;

    var _container = L.DomUtil.create('div', 'leaflet-layer');

    _container.appendChild(this._canvas);
    tilePane.appendChild(_container);

    this._container = _container;

    map.dragging._draggable.on('predrag', function() {
      var d = map.dragging._draggable;
      L.DomUtil.setPosition(this._canvas, { x: -d._newPos.x, y: -d._newPos.y });
    }, this);

    map.on({ 'viewreset': this._reset }, this);
    map.on('move', this.render, this);
    map.on('resize', this._reset, this);
    map.on({
        'zoomanim': this._animateZoom,
        'zoomend': this._endZoomAnim
    }, this);

    if(this.options.tileLoader) {
      this._initTileLoader();
    }

    this._reset();
  },

  _animateZoom: function (e) {
      if (!this._animating) {
          this._animating = true;
      }

      var back = this._createCanvas();
      back.width = this._canvas.width;
      back.height = this._canvas.height;
      // paint current canvas in back canvas with trasnformation
      var pos = this._canvas._leaflet_pos || { x: 0, y: 0 };
      //back.getContext('2d').drawImage(this._canvas, -pos.x, -pos.y);
      back.getContext('2d').drawImage(this._canvas, 0, 0);
      // hide
      this._container.appendChild(back);
      this._canvas.style.visibility = 'hidden';


      var bg = back,
          transform = L.DomUtil.TRANSFORM,
          initialTransform = e.delta ? L.DomUtil.getTranslateString(e.delta) : bg.style[transform],
          scaleStr = L.DomUtil.getScaleString(e.scale, e.origin);

      //scaleStr = ' scale(' + e.scale + ') ';
      bg.style[transform] = scaleStr;
        bg.style[transform] = e.backwards ?
                scaleStr + ' ' + initialTransform :
                initialTransform + ' ' + scaleStr;
  },

  _endZoomAnim: function () {
      this._animating = false;
      //this._canvas.style.visibility = 'block';
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
    this._container.parentNode.removeChild(this._container);
    map.off({
      'viewreset': this._reset,
      'move': this._render,
      'resize': this._reset
      //'zoomanim': this._animateZoom,
      //'zoomend': this._endZoomAnim
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

  // use direct: true if you are inside an animation frame call
  redraw: function(direct) {
    if (direct) {
      this.render();
    } else {
      this._render();
    }
  },

  onResize: function() {
  },

  render: function() {
    throw new Error('render function should be implemented');
  }

});

} //L defined
