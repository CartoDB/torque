var torque = require('../');


/** Converts numeric degrees to radians */
Number.prototype.toRad = function () {
    return this * Math.PI / 180;
};

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
            if (this.timestampType === undefined) {
                this.timestampType = "date";
            }
        }
        this.points.push({lat: parseFloat(lat), lon: parseFloat(lon), time: time, value: parseFloat(value) || value});
    },
    getBounds: function() {
      return this.options.bounds;
    },
    setReady: function (ready) {
        if (ready == false) {
            this._ready = false;
        } else {
            var self = this;

            this.points.sort(function (point1, point2) {
                if (self.timestampType == "number") {
                    return point1.time - point2.time;
                } else {
                    if (typeof(point1.time) == "string") {
                        return new Date(point1.time) - new Date(point2.time);
                    } else {
                        return point1.time - point2.time;
                    }
                }
            });

            if (this.timestampType == "date") {
                this.timestamps = {};  // {date: timestamp_id}
                var timestampIdx = 0;
                for (var i = 0; i < this.points.length; i++) {
                    var point = this.points[i];
                    this.timestamps[point.time] || (this.timestamps[point.time] = timestampIdx++);
                }
            }
            if (this.timestampType == "number") {
                this.maxTimestamp = this.points[this.points.length - 1].time;
            } else {
                this.maxTimestamp = this.timestamps[this.points[this.points.length - 1].time];
            }
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
        var bounds = tileBoundsInMeters(tile.zoom, tile.x, tile.y);
        var mins = metersToLatLon(bounds[0]);
        var maxs = metersToLatLon(bounds[1]);

        tile.latLonBounds = {
            minLat: mins[1],
            maxLat: maxs[1],
            minLon: mins[0],
            maxLon: maxs[0]
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

            var tileXY = latLonToTileXY(point.lat, point.lon, tile.latLonBounds);
            var xInTile = tileXY.x;
            var yInTile = tileXY.y;
            x[pointIdx] = xInTile;
            y[pointIdx] = yInTile;

            var pointTimestamp;
            if (this.timestampType == 'date') {
                pointTimestamp = this.timestamps[point.time];
            } else {
                pointTimestamp = point.time;
            }

            if (this.options.cumulative) {
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
             start: this.options.start * 1000,
             end: this.options.end * 1000,
             step: this.options.step,
             steps: this.options.steps,
             columnType: this.timestampType
         };
    },
    getSteps: function () {
        return this.options.steps;
    }
};






function metersToLatLon(coord) {
    var lon = (coord[0] / (2 * Math.PI * 6378137 / 2.0)) * 180.0;

    var lat = (coord[1] / (2 * Math.PI * 6378137 / 2.0)) * 180.0;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);

    return [lon, lat]
}

function tileBoundsInMeters(z, x, y) {
    var mins = pixelsToMeters(z, x * 256, (y + 1) * 256);
    var maxs = pixelsToMeters(z, (x + 1) * 256, y * 256);

    return [mins, maxs];
}


function pixelsToMeters(z, x, y) {
    var res = (2 * Math.PI * 6378137 / 256) / (Math.pow(2, z));
    var mx = x * res - (2 * Math.PI * 6378137 / 2.0);
    var my = y * res - (2 * Math.PI * 6378137 / 2.0);
    my = -my;
    return [mx, my];
}

/*
 * Convert lat and lon into pixels offsets inside the tile
 */
function latLonToTileXY(lat, lon, latLonBounds) {
    return {
        x: parseInt(256 * (lon - latLonBounds.minLon) / (latLonBounds.maxLon - latLonBounds.minLon)),
        y: parseInt(256 * (lat - latLonBounds.minLat) / (latLonBounds.maxLat - latLonBounds.minLat))
    };
}

module.exports = internal;
