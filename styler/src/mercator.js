
//========================================
// Mercator projection
//========================================
//
var VECNIK = VECNIK || {};

(function(VECNIK) {

    var TILE_SIZE = 256;

    // todo: move outside
    function Point(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    function LatLng(lat, lon) {
        this.latitude = lat || 0;
        this.longitude = lon || 0;
    }

    LatLng.prototype.lat = function() {
        return this.latitude;
    }

    LatLng.prototype.lng = function() {
        return this.longitude;
    }

    function bound(value, opt_min, opt_max) {
        if (opt_min != null) value = Math.max(value, opt_min);
        if (opt_max != null) value = Math.min(value, opt_max);
        return value;
    }

    function degreesToRadians(deg) {
        return deg * (Math.PI / 180);
    }

    function radiansToDegrees(rad) {
        return rad / (Math.PI / 180);
    }

    function MercatorProjection() {
        this.pixelOrigin_ = new Point(TILE_SIZE / 2, TILE_SIZE / 2);
        this.pixelsPerLonDegree_ = TILE_SIZE / 360;
        this.pixelsPerLonRadian_ = TILE_SIZE / (2 * Math.PI);
    }

    MercatorProjection.prototype.fromLatLngToPoint = function (latLng, opt_point) {
        var me = this;
        var point = opt_point || new Point(0, 0);
        var origin = me.pixelOrigin_;

        point.x = origin.x + latLng.lng() * me.pixelsPerLonDegree_;

        // NOTE(appleton): Truncating to 0.9999 effectively limits latitude to
        // 89.189.  This is about a third of a tile past the edge of the world
        // tile.
        var siny = bound(Math.sin(degreesToRadians(latLng.lat())), -0.9999,
            0.9999);
        point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) *
            -me.pixelsPerLonRadian_;
        return point;
    };

    MercatorProjection.prototype.fromPointToLatLng = function (point) {
        var me = this;
        var origin = me.pixelOrigin_;
        var lng = (point.x - origin.x) / me.pixelsPerLonDegree_;
        var latRadians = (point.y - origin.y) / -me.pixelsPerLonRadian_;
        var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) -
            Math.PI / 2);
        return new LatLng(lat, lng);
    };

    MercatorProjection.prototype.tileBBox = function(x, y, zoom) {
        var numTiles = 1 << zoom;
        var inc = TILE_SIZE/numTiles;
        var px = x*TILE_SIZE/numTiles;
        var py = y*TILE_SIZE/numTiles;
        return [
            this.fromPointToLatLng(new Point(px, py + inc)),
            this.fromPointToLatLng(new Point(px + inc, py))
        ];
    };

    MercatorProjection.prototype.tilePoint = function(x, y, zoom) {
            var numTiles = 1 << zoom;
            var px = x*TILE_SIZE;
            var py = y*TILE_SIZE;
            return [px, py];
    };

    MercatorProjection.prototype.latLngToTilePoint = function(latLng, x, y, zoom) {
        var numTiles = 1 << zoom;
        var projection = this;
        var worldCoordinate = projection.fromLatLngToPoint(latLng);
        var pixelCoordinate = new Point(
                worldCoordinate.x * numTiles,
                worldCoordinate.y * numTiles);
        var tp = this.tilePoint(x, y, zoom);
        return new Point(
                Math.floor(pixelCoordinate.x - tp[0]),
                Math.floor(pixelCoordinate.y - tp[1]));
    };

    MercatorProjection.prototype.latLngToTile = function(latLng, zoom) {
        var numTiles = 1 << zoom;
        var projection = this;
        var worldCoordinate = projection.fromLatLngToPoint(latLng);
        var pixelCoordinate = new Point(
                worldCoordinate.x * numTiles,
                worldCoordinate.y * numTiles);
        return new Point(
                Math.floor(pixelCoordinate.x / TILE_SIZE),
                Math.floor(pixelCoordinate.y / TILE_SIZE));
    };

    VECNIK.LatLng = LatLng;
    VECNIK.Point = Point;
    VECNIK.MercatorProjection = MercatorProjection;

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
  module.exports.MercatorProjection = VECNIK.MercatorProjection;
  module.exports.LatLng = VECNIK.LatLng;
  module.exports.Point = VECNIK.Point;
}

if (typeof self !== 'undefined') {
  self.VECNIK = VECNIK;
}
