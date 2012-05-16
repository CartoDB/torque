
//========================================
// Global settings
//========================================

var VECNIK = VECNIK || {};

(function(VECNIK) {

  function Settings(defaults) {
    this.set(defaults);
  }

  Settings.prototype = new VECNIK.Model();

  // default settings
  VECNIK.settings = new Settings({
    WEBWORKERS: false,
    BACKBUFFER: true,
    ENABLE_SIMPLIFY: true,
    ENABLE_SNAPPING: true,
    ENABLE_CLIPPING: true,
    ENABLE_FIXING: true
  });

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
  module.exports.settings = VECNIK.settings;
}
if (typeof self !== 'undefined') {
  self.VECNIK = VECNIK;
}
