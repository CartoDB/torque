var carto = global.carto || require('carto');
var torque = require('../');
require('./canvas_layer');

ol.TorqueLayer = function(options){
    var self = this;
    if (!torque.isBrowserSupported()) {
        throw new Error("browser is not supported by torque");
    }
    options.tileLoader = true;
    this.keys = [0];
    Object.defineProperty(this, 'key', {
        get: function() {
            return this.getKey();
        }
    });
    this.prevRenderedKey = 0;
    if (options.cartocss) {
        torque.extend(options, torque.common.TorqueLayer.optionsFromCartoCSS(options.cartocss));
    }

    options.resolution = options.resolution || 2;
    options.steps = options.steps || 100;
    options.visible = options.visible === undefined ? true: options.visible;
    this.hidden = !options.visible;

    this.animator = new torque.Animator(function(time) {
        var k = time | 0;
        if(self.getKey() !== k) {
            self.setKey(k, { direct: true });
        }
    }, torque.extend(torque.clone(options), {
        onPause: function() {
            self.fire('pause');
        },
        onStop: function() {
            self.fire('stop');
        },
        onStart: function() {
            self.fire('play');
        },
        onStepsRange: function() {
            self.fire('change:stepsRange', self.animator.stepsRange());
        }
    }));

    this.play = this.animator.start.bind(this.animator);
    this.stop = this.animator.stop.bind(this.animator);
    this.pause = this.animator.pause.bind(this.animator);
    this.toggle = this.animator.toggle.bind(this.animator);
    this.setDuration = this.animator.duration.bind(this.animator);
    this.isRunning = this.animator.isRunning.bind(this.animator);


    ol.CanvasLayer.call(this, options);

    this.options.renderer = this.options.renderer || 'point';
    this.options.provider = this.options.provider || 'windshaft';

    if (this.options.tileJSON) this.options.provider = 'tileJSON';

    this.provider = new this.providers[this.options.provider](options);
    this.renderer = new this.renderers[this.options.renderer](this.getCanvas(), options);

    options.ready = function() {
        self.fire("change:bounds", {
            bounds: self.provider.getBounds()
        });
        self.animator.steps(self.provider.getSteps());
        self.animator.rescale();
        self.fire('change:steps', {
            steps: self.provider.getSteps()
        });
        self.setKeys(self.getKeys());
    };

    this.renderer.on("allIconsLoaded", this.render.bind(this));


    // for each tile shown on the map request the data
    this.on('tileAdded', function(t) {
        var tileData = this.provider.getTileData(t, t.zoom, function(tileData) {
            self._removeFromTilesLoading(t);
            if (t.zoom !== self._tileGrid.getZForResolution(self._view.getResolution())) return;
            self._tileLoaded(t, tileData);
            self.fire('tileLoaded');
            if (tileData) {
                self.redraw();
            }
        });
    }, this);

    this.on('mapZoomStart', function(){
        this.getCanvas().style.display = "none";
        this._pauseOnZoom();
    }, this);

    this.on('mapZoomEnd', function() {
        this.getCanvas().style.display = "block";
        this._resumeOnZoom();
    }, this);
};

ol.TorqueLayer.prototype = torque.extend({},
    ol.CanvasLayer.prototype,
    torque.Event,
    {
    providers: {
        'sql_api': torque.providers.json,
        'url_template': torque.providers.JsonArray,
        'windshaft': torque.providers.windshaft,
        'tileJSON': torque.providers.tileJSON
    },

    renderers: {
        'point': torque.renderer.Point,
        'pixel': torque.renderer.Rectangle
    },

    onAdd: function(map){
        ol.CanvasLayer.prototype.setMap.call(this, map);
    },

    onRemove: function(map) {
        this.fire('remove');
        this._removeTileLoader();
    },

    _pauseOnZoom: function() {
        this.wasRunning = this.isRunning();
        if (this.wasRunning) {
            this.pause();
        }
    },

    _resumeOnZoom: function() {
        if (this.wasRunning) {
            this.play();
        }
    },

    hide: function() {
        if(this.hidden) return this;
        this.pause();
        this.clear();
        this.hidden = true;
        return this;
    },

    show: function() {
        if(!this.hidden) return this;
        this.hidden = false;
        this.play();
        if (this.options.steps === 1){
            this.redraw();
        }
        return this;
    },

    setSQL: function(sql) {
        if (this.provider.options.named_map) throw new Error("SQL queries on named maps are read-only");
        if (!this.provider || !this.provider.setSQL) {
            throw new Error("this provider does not support SQL");
        }
        this.provider.setSQL(sql);
        this._reloadTiles();
        return this;
    },

    setBlendMode: function(_) {
        this.renderer.setBlendMode(_);
        this.redraw();
    },

    setSteps: function(steps) {
        this.provider.setSteps(steps);
        this._reloadTiles();
    },

    setColumn: function(column, isTime) {
        this.provider.setColumn(column, isTime);
        this._reloadTiles();
    },

    getTimeBounds: function() {
        return this.provider && this.provider.getKeySpan();
    },

    clear: function() {
        var canvas = this.getCanvas();
        canvas.width = canvas.width;
    },

    /**
     * render the selectef key
     * don't call this function directly, it's called by
     * requestAnimationFrame. Use redraw to refresh it
     */
    render: function() {
        if(this.hidden) return;
        var t, tile, pos;
        var canvas = this.getCanvas();
        this.renderer.clearCanvas();
        var ctx = canvas.getContext('2d');

        // renders only a "frame"
        for(t in this._tiles) {
            tile = this._tiles[t];
            if (tile) {
                pos = this.getTilePos(tile.coord);
                ctx.setTransform(1, 0, 0, 1, pos.x, pos.y);
                this.renderer.renderTile(tile, this.keys);
            }
        }
        this.renderer.applyFilters();
    },

    /**
     * set key to be shown. If it's a single value
     * it renders directly, if it's an array it renders
     * accumulated
     */
    setKey: function(key, options) {
        this.setKeys([key], options);
    },

    /**
     * returns the array of keys being rendered
     */
    getKeys: function() {
        return this.keys;
    },

    setKeys: function(keys, options) {
        this.keys = keys;
        this.animator.step(this.getKey());
        this.redraw(options && options.direct);
        this.fire('change:time', {
            time: this.getTime(),
            step: this.getKey(),
            start: this.getKey(),
            end: this.getLastKey()
        });
    },

    getKey: function() {
        return this.keys[0];
    },

    getLastKey: function() {
        return this.keys[this.keys.length - 1];
    },

    /**
     * helper function, does the same than ``setKey`` but only
     * accepts scalars.
     */
    setStep: function(time) {
        if(time === undefined || time.length !== undefined) {
            throw new Error("setTime only accept scalars");
        }
        this.setKey(time);
    },

    renderRange: function(start, end) {
        this.pause();
        var keys = [];
        for (var i = start; i <= end; i++) {
            keys.push(i);
        }
        this.setKeys(keys);
    },

    resetRenderRange: function() {
        this.stop();
        this.play();
    },

    /**
     * transform from animation step to Date object
     * that contains the animation time
     *
     * ``step`` should be between 0 and ``steps - 1``
     */
    stepToTime: function(step) {
        var times = this.provider.getKeySpan();
        var time = times.start + (times.end - times.start)*(step/this.provider.getSteps());
        return new Date(time);
    },

    timeToStep: function(timestamp) {
        if (typeof timestamp === "Date") timestamp = timestamp.getTime();
        if (!this.provider) return 0;
        var times = this.provider.getKeySpan();
        var step = (this.provider.getSteps() * (timestamp - times.start)) / (times.end - times.start);
        return step;
    },

    getStep: function() {
        return this.getKey();
    },

    /**
     * returns the animation time defined by the data
     * in the defined column. Date object
     */
    getTime: function() {
        return this.stepToTime(this.getKey());
    },

    /**
     * returns an object with the start and end times
     */
    getTimeSpan: function() {
        return this.provider.getKeySpan();
    },

    /**
     * set the cartocss for the current renderer
     */
    setCartoCSS: function(cartocss) {
        if (this.provider.options.named_map) throw new Error("CartoCSS style on named maps is read-only");
        if (!this.renderer) throw new Error('renderer is not valid');
        var shader = new carto.RendererJS().render(cartocss);
        this.renderer.setShader(shader);

        // provider options
        var options = torque.common.TorqueLayer.optionsFromLayer(shader.findLayer({ name: 'Map' }));
        this.provider.setCartoCSS && this.provider.setCartoCSS(cartocss);
        if(this.provider.setOptions(options)) {
            this._reloadTiles();
        }

        torque.extend(this.options, options);

        // animator options
        if (options.animationDuration) {
            this.animator.duration(options.animationDuration);
        }
        this.redraw();
        return this;
    },

    /**
     * get active points for a step in active zoom
     * returns a list of bounding boxes [[] , [], []]
     * empty list if there is no active pixels
     */
    getActivePointsBBox: function(step) {
        var positions = [];
        for(var t in this._tiles) {
            var tile = this._tiles[t];
            positions = positions.concat(this.renderer.getActivePointsBBox(tile, step));
        }
        return positions;
    },

    /**
     * return an array with the values for all the pixels active for the step
     */
    getValues: function(step) {
        var values = [];
        step = step === undefined ? this.getKey(): step;
        var t, tile;
        for(t in this._tiles) {
            tile = this._tiles[t];
            this.renderer.getValues(tile, step, values);
        }
        return values;
    },

    /**
     * return the value for position relative to map coordinates. null for no value
     */
    getValueForPos: function(x, y, step) {
        step = step === undefined ? this.getKey(): step;
        var t, tile, pos, value = null, xx, yy;
        for(t in this._tiles) {
            tile = this._tiles[t];
            pos = this.getTilePos(tile.coord);
            xx = x - pos.x;
            yy = y - pos.y;
            if (xx >= 0 && yy >= 0 && xx < this.renderer.TILE_SIZE && yy <= this.renderer.TILE_SIZE) {
                value = this.renderer.getValueFor(tile, step, xx, yy);
            }
            if (value !== null) {
                return value;
            }
        }
        return null;
    },

    getValueForBBox: function(x, y, w, h) {
        var xf = x + w, yf = y + h, _x=x;
        var sum = 0;
        for(_y = y; _y<yf; _y+=this.options.resolution){
            for(_x = x; _x<xf; _x+=this.options.resolution){
                var thisValue = this.getValueForPos(_x,_y);
                if (thisValue){
                    var bb = thisValue.bbox;
                    var xy = this._map.latLngToContainerPoint([bb[1].lat, bb[1].lon]);
                    if(xy.x < xf && xy.y < yf){
                        sum += thisValue.value;
                    }
                }
            }
        }
        return sum;
    },

    /** return the number of points for a step */
    pointCount: function(step) {
        var t, tile;
        step = step === undefined ? this.key: step;
        var c = 0;
        for(t in this._tiles) {
            tile = this._tiles[t];
            if (tile) {
                c += tile.timeCount[step];
            }
        }
        return c;
    },

    invalidate: function() {
        this.provider.reload();
    },

    setStepsRange: function(start, end) {
        this.animator.stepsRange(start, end);
    },

    removeStepsRange: function() {
        this.animator.removeCustomStepsRange();
    },

    getStepsRange: function() {
        return this.animator.stepsRange();
    }
});


module.exports = ol.TorqueLayer;