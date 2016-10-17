require('./ol_tileloader_mixin');

ol.CanvasLayer = function(options) {
    this.root_ = document.createElement('div');
    this.root_.setAttribute('class', 'ol-heatmap-layer');

    this.options = {
        subdomains: 'abc',
        errorTileUrl: '',
        attribution: '',
        opacity: 1,
        tileLoader: false, // installs tile loading events
        tileSize: 256
    };

    options = options || {};
    torque.extend(this.options, options);

    ol.TileLoader.call(this, this.options.tileSize, this.options.maxZoom);

    this.render = this.render.bind(this);
    this._canvas = this._createCanvas();

    this.root_.appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d');
    this.currentAnimationFrame = -1;
    this.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
        return window.setTimeout(callback, 1000 / 60);
    };
    this.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
    window.webkitCancelAnimationFrame || window.msCancelAnimationFrame || function (id) {
        clearTimeout(id);
    };

    if(options.map){
        this.setMap(options.map);
    }
};

ol.inherits(ol.CanvasLayer, ol.TileLoader);

ol.CanvasLayer.prototype.setMap = function(map){
    if(this._map){
        //remove
        this._map.unByKey(this.pointdragKey_);
        this._map.unByKey(this.sizeChangedKey_);
        this._map.unByKey(this.moveendKey_);
        this._map.getView().unByKey(this.centerChanged_);
    }
    this._map = map;

    if(map){
        var overlayContainer  = this._map.getViewport().getElementsByClassName("ol-overlaycontainer")[0];
        overlayContainer.appendChild(this.root_);

        this.pointdragKey_ = map.on('pointerdrag', this._render, this);
        this.moveendKey_ = map.on("moveend", this._render, this);
        this.centerChanged_ = map.getView().on("change:center", this._render, this);
        this.sizeChangedKey_ = map.on('change:size', this._reset, this);

        if(this.options.tileLoader) {
            ol.TileLoader.prototype._initTileLoader.call(this, map);
        }
        this._reset();
    }
};

ol.CanvasLayer.prototype._createCanvas = function() {
    var canvas;
    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = this.options.zIndex || 0;
    return canvas;
};

ol.CanvasLayer.prototype._reset = function () {
    this._resize();
};

ol.CanvasLayer.prototype._resize =  function() {
    var size = this._map.getSize();
    var width = size[0];
    var height = size[1];
    var oldWidth = this._canvas.width;
    var oldHeight = this._canvas.height;

    // resizing may allocate a new back buffer, so do so conservatively
    if (oldWidth !== width || oldHeight !== height) {
        this._canvas.width = width;
        this._canvas.height = height;
        this._canvas.style.width = width + 'px';
        this._canvas.style.height = height + 'px';
        this.root_.style.width = width + 'px';
        this.root_.style.height = height + 'px';
        this._render();
    }
};

ol.CanvasLayer.prototype._render = function() {
    if (this.currentAnimationFrame >= 0) {
        this.cancelAnimationFrame.call(window, this.currentAnimationFrame);
    }
    this.currentAnimationFrame = this.requestAnimationFrame.call(window, this.render);
};

ol.CanvasLayer.prototype.getCanvas = function() {
        return this._canvas;
};

ol.CanvasLayer.prototype.getAttribution = function() {
        return this.options.attribution;
};

ol.CanvasLayer.prototype.draw = function() {
        return this._render();
};

ol.CanvasLayer.prototype.redraw = function(direct) {
    if (direct) {
        this.render();
    } else {
        this._render();
    }
};

module.exports = ol.CanvasLayer;