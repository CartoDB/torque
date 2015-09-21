var torque = require('../');

var mercatorUtils = new torque.Mercator();

/*
 * Options:
 * steps:
 */
var internal = function (options) {
    this.setReady(false);
    this.options = options;
    if (this.options.data_aggregation) {
        this.options.cumulative = this.options.data_aggregation === 'cumulative';
    }
    this.points = [];
    this._tileQueue = [];
    this.options.bounds = [
        [Number.MAX_VALUE, Number.MAX_VALUE],
        [Number.MIN_VALUE, Number.MIN_VALUE]
    ];
};


internal.prototype = {
    addPoint: function (lat, lon, time, value) {
        if (typeof(time) == "number") {
            time = parseInt(time);
            if (this.timestampType === undefined) {
                this.timestampType = "number";
            }
        } else {
            time = new Date(Date.parse(time));
            if (this.timestampType === undefined) {
                this.timestampType = "date";
            }
        }
        this.points.push({lat: parseFloat(lat), lon: parseFloat(lon), time: time, value: parseFloat(value) || value});
    },
    getBounds: function () {
      return this.options.bounds;
    },
    getCategories: function () {
        if (!this.options.countby) {
            return [];
        }

        var self = this;

        var checkCategoryExists = function (category) {
            return category.name == self.points[i].value;
        };

        var categories = [];
        for (var i = 0; i < this.points.length; i++) {
            if (!categories.some(checkCategoryExists)) {
                var randomColor = 0x1000000 + Math.floor(Math.random() * 0xffffff);
                randomColor = "#" + randomColor.toString(16).slice(1, 7);
                categories.push({
                    value: this.points[i].value,
                    name: this.points[i].value,
                    color: randomColor
                });
            }
        }

        return categories;
    },
    setOptions: function(opt) {
      var refresh = false;

      if (opt.resolution !== undefined && opt.resolution !== this.options.resolution) {
        this.options.resolution = opt.resolution;
        refresh = true;
      }

      if (opt.steps !== undefined && opt.steps !== this.options.steps) {
        this.setSteps(opt.steps, { silent: true });
        refresh = true;
      }

      if (opt.column !== undefined && opt.column !== this.options.column) {
        this.options.column = opt.column;
        refresh = true;
      }

      if (opt.countby !== undefined && opt.countby !== this.options.countby) {
        this.options.countby = opt.countby;
        refresh = true;
      }

      if (opt.data_aggregation !== undefined) {
        var c = opt.data_aggregation === 'cumulative';
        if (this.options.cumulative !== c) {
          this.options.cumulative = c;
          refresh = true;
        }
      }

      if (refresh) {
          this.reload();
      }

      return refresh;
    },
    setReady: function (ready) {
        if (ready == false) {
            this._ready = false;
        } else {
            var self = this;

            this.options.data_steps = this.points.length;

            this.points.sort(function (point1, point2) {
                return point1.time - point2.time;
            });

            if (this.timestampType == "number") {
                this.options.start = this.points[0].time;
                this.options.end = this.points[this.points.length - 1].time;
            } else {
                this.options.start = this.points[0].time.getTime();
                this.options.end = this.points[this.points.length - 1].time.getTime();
            }

            this.timestamps = {};  // {date: timestamp_id}
            for (var i = 0; i < this.points.length; i++) {
                var point = this.points[i];
                if ((this.options.end - this.options.start) != 0) {
                    this.timestamps[point.time] || (this.timestamps[point.time] = parseInt(this.getSteps() * (point.time - this.options.start) / (this.options.end - this.options.start)));
                } else {
                    this.timestamps[point.time] || (this.timestamps[point.time] = 0);
                }
            }

            this.maxTimestamp = this.timestamps[this.points[this.points.length - 1].time];

            this._ready = true;
            this._processQueue();
            this.options.ready && this.options.ready();
        }
    },
    getTileData: function (coord, zoom, callback) {
        if(!this._ready) {
            this._tileQueue.push([coord, callback]);
        } else {
            this._getTileData(coord, callback);
        }
    },
    _getTileData: function (tile, callback) {
        this.prepareTile(tile);

        var pointsInTile = this.getPointsInTile(tile);

        callback(this.processTile(tile, pointsInTile));
    },
    _processQueue: function() {
        var item;
        while (item = this._tileQueue.pop()) {
            this._getTileData.apply(this, item);
        }
    },
    prepareTile: function (tile) {
        /* Calculate tile bounds in lat/lon */
        var bounds = mercatorUtils.tileBBox(tile.x, tile.y, tile.zoom);

        tile.latLonBounds = {
            minLat: bounds[0].lat,
            maxLat: bounds[1].lat,
            minLon: bounds[0].lon,
            maxLon: bounds[1].lon
        };

        /* Update total bounds */
        if (tile.latLonBounds.maxLat > this.options.bounds[1][0]) this.options.bounds[1][0] = tile.latLonBounds.maxLat;
        if (tile.latLonBounds.minLat < this.options.bounds[0][0]) this.options.bounds[0][0] = tile.latLonBounds.minLat;
        if (tile.latLonBounds.maxLon > this.options.bounds[1][1]) this.options.bounds[1][1] = tile.latLonBounds.maxLon;
        if (tile.latLonBounds.minLon < this.options.bounds[0][1]) this.options.bounds[0][1] = tile.latLonBounds.minLon;

        /* Function to find out if a point falls into this tile */
        tile.contains = function (point) {
            return point.lat < tile.latLonBounds.maxLat && point.lat > tile.latLonBounds.minLat && point.lon < tile.latLonBounds.maxLon && point.lon > tile.latLonBounds.minLon;
        }
    },
    /*
     * Get the all the data points, no matter their timestamp, that fall into the tile
     */
    getPointsInTile: function (tile) {
        var pointsInTile = [];

        for (var i = 0; i < this.points.length; i++) {
            if (tile.contains(this.points[i])) {
                pointsInTile.push(this.points[i]);
            }
        }

        return pointsInTile;
    },
    processTile: function (tile, pointsInThisTile) {
        /*
         * For each this.points[i], x[i] and y[i] are the offsets in pixels from the tile boundaries.
         */
        var x = [];
        var y = [];

        /*
         * pointsInTilePerTimestamp:
         */
        var pointsInThisTileByTimestamp = [];

        var timeCount = [];
        var timeIndex = [];
        var renderData = [];
        var renderDataPos = [];

        var accumulatedValues = [];

        for (var pointIdx = 0; pointIdx < pointsInThisTile.length; pointIdx++) {
            var point = pointsInThisTile[pointIdx];

            var tileXY = mercatorUtils.latLonToTilePoint(point.lat, point.lon, tile.x, tile.y, tile.zoom);

            var xInTile = tileXY.x;
            var yInTile = tileXY.y;
            x[pointIdx] = xInTile;
            y[pointIdx] = yInTile;

            var pointTimestamp = this.timestamps[point.time];

            if (this.options.cumulative && this.maxTimestamp > 0) {
                if (accumulatedValues[xInTile] === undefined) {
                    accumulatedValues[xInTile] = [];
                }
                if (accumulatedValues[xInTile][yInTile] === undefined) {
                    accumulatedValues[xInTile][yInTile] = 0;
                }
                accumulatedValues[xInTile][yInTile] += point.value;
                point.value = accumulatedValues[xInTile][yInTile];
                for (var futureTimestamps = pointTimestamp; futureTimestamps < this.maxTimestamp; futureTimestamps++) {
                    var pointsInTileForFutureTimestamp = pointsInThisTileByTimestamp[futureTimestamps] || (pointsInThisTileByTimestamp[futureTimestamps] = []);
                    pointsInTileForFutureTimestamp.push({idx: pointIdx, value: point.value});
                }
            } else {
                var pointsInTileForThisTimestamp = pointsInThisTileByTimestamp[pointTimestamp] || (pointsInThisTileByTimestamp[pointTimestamp] = []);
                pointsInTileForThisTimestamp.push({idx: pointIdx, value: point.value});
            }
        }

        var pointsInThisTileByTimestamp_keys = Object.keys(pointsInThisTileByTimestamp);
        var maxTileTimestamp = pointsInThisTileByTimestamp_keys[pointsInThisTileByTimestamp_keys.length - 1] || 0;

        var renderDataIndex = 0;
        var timeStampIndex = 0;
        for (var timestamp = 0; timestamp <= maxTileTimestamp; timestamp++) {
            var pointsInThisTileForThisTimestamp = pointsInThisTileByTimestamp[timestamp];
            if (pointsInThisTileForThisTimestamp) {
                for (var i = 0; i < pointsInThisTileForThisTimestamp.length; i++) {
                    var point = pointsInThisTileForThisTimestamp[i];
                    renderDataPos[renderDataIndex] = point.idx;
                    renderData[renderDataIndex] = point.value;
                    ++renderDataIndex;
                }
            }
            timeIndex[timestamp] = timeStampIndex;
            var increase = pointsInThisTileForThisTimestamp ? pointsInThisTileForThisTimestamp.length : 0;
            timeCount[timestamp] = increase;
            timeStampIndex += increase;
        }
        return {
            x: x,
            y: y,
            z: tile.zoom,
            coord: {
                x: tile.x,
                y: tile.y,
                z: tile.zoom
            },
            timeCount: timeCount,
            timeIndex: timeIndex,
            renderDataPos: renderDataPos,
            renderData: renderData,
            maxDate: maxTileTimestamp
        };
    },
    getKeySpan: function () {
        return {
            start: this.options.start,
            end: this.options.end,
            step: this.options.step || ((this.options.end - this.options.start) / this.getSteps()),
            steps: this.getSteps(),
            columnType: this.timestampType
        };
    },
    getSteps: function () {
        return this.options.steps;
    },
    setSteps: function(steps, opt) {
        opt = opt || {};
        if (this.options.steps !== steps) {
            this.options.steps = steps;
            this.options.step = (this.options.end - this.options.start) / this.getSteps();
            this.options.step = this.options.step || 1;
            if (!opt.silent) this.reload();
        }
    }
};

module.exports = internal;
