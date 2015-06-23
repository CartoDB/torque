var torque = require('../');


/** Converts numeric degrees to radians */
Number.prototype.toRad = function () {
    return this * Math.PI / 180;
};


var internal = function (options) {
    this.setReady(false);
    this.options = options;
    this.points = [];
    this._tileQueue = [];
};


internal.prototype = {
    addPoint: function (lat, lon, time, value) {
        this.points.push({lat: parseFloat(lat), lon: parseFloat(lon), time: parseInt(time), value: parseFloat(value)});
    },
    getBounds: function() {
      return this.options.bounds;
    },
    setReady: function (ready) {
        if (ready == false) {
            this._ready = false;
        } else {
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
    processTile: function (tile, pointsInTile) {
        /*
         * For each this.points[i], x[i] and y[i] are the offsets in pixels from the tile boundaries.
         */
        var x = [];
        var y = [];

        /*
         * timeSlots:
         */
        var timeSlots = {};
        var timeCount = [];
        var timeIndex = [];
        var renderData = [];
        var renderDataPos = [];

        for (var pointIdx = 0; pointIdx < pointsInTile.length; pointIdx++) {
            var point = pointsInTile[pointIdx];

            var tileXY = latLonToTileXY(point.lat, point.lon, tile.latLonBounds);
            x[pointIdx] = tileXY.x;
            y[pointIdx] = tileXY.y;

            var timeSlot = timeSlots[point.time] || (timeSlots[point.time] = []);
            timeSlot.push([pointIdx, point.value]);
        }

        var times = Object.keys(timeSlots);
        var maxTime = times && times.length ? times[times.length - 1] : null;

        var renderDataIndex = 0;
        var timeSlotIndex = 0;
        for (var timestamp = 0; timestamp <= maxTime; ++timestamp) {
            timeSlot = timeSlots[timestamp];
            if (timeSlot) {
                for (var pointInTimeSlotIdx = 0; pointInTimeSlotIdx < timeSlot.length; pointInTimeSlotIdx++) {
                    var pointInTimeSlot = timeSlot[pointInTimeSlotIdx];
                    renderDataPos[renderDataIndex] = pointInTimeSlot[0];
                    renderData[renderDataIndex] = pointInTimeSlot[1];
                    ++renderDataIndex;
                }
            }
            timeIndex[timestamp] = timeSlotIndex;
            var increase = timeSlot ? timeSlot.length : 0;
            timeCount[timestamp] = increase;
            timeSlotIndex += increase;
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
            maxDate: maxTime
        };
    },
    getKeySpan: function () {
         return {
             start: this.options.start * 1000,
             end: this.options.end * 1000,
             step: this.options.step,
             steps: this.options.steps,
             columnType: this.options.is_time ? 'date': 'number'
         };
    },
    getSteps: function () {
        return Math.min(this.options.steps, this.options.steps);
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
