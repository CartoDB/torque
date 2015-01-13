var gmaps = {};
if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
    gmaps = require('./torque');
    gmaps.GMapsTileLoader = require('./gmaps_tileloader_mixin');
}
module.exports = gmaps;
