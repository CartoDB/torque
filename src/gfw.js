function GFW() {
  var args = Array.prototype.slice.call(arguments),
  callback = args.pop(),
  modules = (args[0] && typeof args[0] === "string") ? args : args[0],
  config,
  i;

  if (!(this instanceof GFW)) {
    return new GFW(modules, callback);
  }

  if (!modules || modules === '*') {
    modules = [];
    for (i in GFW.modules) {
      if (GFW.modules.hasOwnProperty(i)) {
        modules.push(i);
      }
    }
  }

  for (i = 0; i < modules.length; i += 1) {
    GFW.modules[modules[i]](this);
  }

  callback(this);
  return this;
};

GFW.modules = {};



GFW.modules.app = function(gfw) {

  gfw.app = {};

  gfw.app.Instance = Class.extend(
    {
    init: function(map, options) {
        this.options = _.defaults(options, {
            user       : 'gfw-01',
            layerTable : 'layerinfo',
        });
        
        this._precision = 2;
        
        gfw.log.enabled = options ? options.logging: false;
        
        this._map = map; 
        
        this._map.overlayMapTypes.push(null);
        
        this.lastHash = null;
        
        this._cartodb = Backbone.CartoDB({user: this.options.user});
        
        this.datalayers = new gfw.datalayers.Engine(this._cartodb, options.layerTable, this._map);
        
        this._setHash();
        
        
    },
    run: function() {
        this._setupListeners();
        this.update();
        gfw.log.info('App is now running!');
    },
    _setHash: function(){
        if (location.hash.split("/").length != 3){
            var hash = "#5/0/110"
            location.replace(hash);
            this.lastHash = hash;
        }
    },
    _setupListeners: function(){
        var that = this;
        //setup zoom listener
        google.maps.event.addListener(this._map, 'zoom_changed', function() {
            var hash = "#" + this.getZoom() + "/" + this.getCenter().lat().toFixed(that._precision) +"/" + this.getCenter().lng().toFixed(that._precision);
            if (that.lastHash != hash) {
                location.replace(hash);
                that.lastHash = hash;
            }
        });
        google.maps.event.addListener(this._map, 'center_changed', function() {
            var hash = "#" + this.getZoom() + "/" + this.getCenter().lat().toFixed(that._precision) +"/" + this.getCenter().lng().toFixed(that._precision);
            if (that.lastHash != hash) {
                location.replace(hash);
                that.lastHash = hash;
            }
        });
    },
    parseHash: function(hash) {
        var args = hash.split("/");
        if (args.length == 3) {
            var zoom = parseInt(args[0], 10),
                lat = parseFloat(args[1]),
                lon = parseFloat(args[2]);
            if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
                return false;
            } else {
                return {
                    center: new google.maps.LatLng(lat, lon),
                    zoom: zoom
                }
            }
        } else {
            return false;
        }
    },
    update: function() {
        var hash = location.hash;
        if (hash === this.lastHash) {
            // console.info("(no change)");
            return;
        }
        var sansHash = hash.substr(1),
            parsed = this.parseHash(sansHash);
        if (parsed) {
            this._map.setZoom(parsed.zoom);
            this._map.setCenter(parsed.center);
        }
    }
  }
  );
};

GFW.modules.maplayer = function(gfw) {
    gfw.maplayer = {};
    gfw.maplayer.Engine = Class.extend(
        {
        init: function(layer, map) {
            this.layer = layer;
            this._map = map;
            this._bindDisplay(new gfw.maplayer.Display());
            this._options = this._display.getOptions(this.layer.get('tileurl'), this.layer.get('ispng'));
            // this._boundingbox = this.layer.get('the_geom');
            var sw = new google.maps.LatLng(this.layer.get('ymin'), this.layer.get('xmin'));
            var ne = new google.maps.LatLng(this.layer.get('ymax'),this.layer.get('xmax'));
            this._bounds = new google.maps.LatLngBounds(sw, ne);
            gfw.log.info(this._options.getTileUrl({x: 3, y: 4},3));
            this._displayed = false; 
            this._maptype = new google.maps.ImageMapType(this._options);
            
            this._tileindex = this._map.overlayMapTypes.length;
            this._map.overlayMapTypes.setAt(this._tileindex, null); 
            this._setupListeners();
            
            if (this.layer.get('title') != 'FORMA'){
                this.layer.attributes['visible'] = false;
                //this._toggleLayer();
            }
            this._addControll();
            this._handleLayer();
            
        },
        _setupListeners: function(){
            var that = this;
            //setup zoom listener
            google.maps.event.addListener(this._map, 'zoom_changed', function() {
                that._inZoom(true);
                that._handleLayer();
            });
            google.maps.event.addListener(this._map, 'center_changed', function() {
                that._inBounds(true);
                that._handleLayer();
            });
            this._inZoom(true);
            this._inBounds(true);
        },
        _inZoom: function(reset){
            if (this._inZoomVal==null){
                this._inZoomVal = true;
            }
            if(reset){
                if (this.layer.get('zmin')<=this._map.getZoom() && this._map.getZoom()<=this.layer.get('zmax')) {
                    this._inZoomVal = true;
                } else {
                    this._inZoomVal = false;
                }
            }
            return this._inZoomVal;
        },
        _inBounds: function(reset){
            if (this._inBoundsVal==null){
                this._inBoundsVal = true;
            }
            if(reset){
                var bounds = this._map.getBounds();
                var ne = bounds.getNorthEast();
                var sw = bounds.getSouthWest();
                if (this._bounds.intersects(bounds)){
                    this._inBoundsVal = true;
                } else {
                    this._inBoundsVal = false;
                }
            }
            return this._inBoundsVal;
        },
        _inView: function(){
            if (this._inZoom(false) && this._inBounds(false)) {
                return true;
            } else {
                return false
            }
        },
        _handleLayer: function(){
            if(this.layer.get('visible') && !this._displayed && this._inView()){
                this._displayed = true;
                this._map.overlayMapTypes.setAt(this._tileindex, this._maptype); 
                gfw.log.info(this.layer.get('title')+ " added at "+this._tileindex)
            } else if (this._displayed && !this._inView()){
                this._displayed = false;
                this._map.overlayMapTypes.setAt(this._tileindex, null); 
                gfw.log.info(this.layer.get('title')+ " removed at "+this._tileindex)
            } 
        },
        _addControll: function(){
            var that = this;
            
            this._opacity = {alpha: 100};
            this.toggle = gui.addFolder(this.layer.get('title'));;
            this.toggle
                    .add(this.layer.attributes, 'visible')
                    .onChange(function(value) {
                        gfw.log.info(value);
                        that._toggleLayer();
                    });
            this.toggle
                    .add(this._opacity,'alpha').min(0).max(100).step(5)
                    .name('transparency')
                    .onChange(function(value) {
                        that._maptype.setOpacity(value/100);
                    });
            var zoomTo = function(){
                var self = that;
                this.zoomExtents = function(){
                    self._map.fitBounds(self._bounds);
                }
            }
            this.toggle
                    .add(new zoomTo(), 'zoomExtents')
                    
                    
        },
        _bindDisplay: function(display) {                
            var that = this;
            this._display = display;
            display.setEngine(this);              
        },
        _toggleLayer: function(){
            var that = this;
            if (this.layer.get('visible') == false){
                gfw.log.info('LAYER OFF');
                this._map.overlayMapTypes.setAt(this._tileindex, null); 
                //this._map.overlayMapTypes.setAt(this._tileindex, null); 
            } else {
                gfw.log.info('LAYER ON');
                if(this._inView()){
                    this._displayed = true;
                    this._map.overlayMapTypes.setAt(this._tileindex, this._maptype); 
                }
            }
        }
    });
    gfw.maplayer.Display = Class.extend(
        {
            /**
             * Constructs a new Display with the given DOM element.
             */
            init: function() {
                gfw.log.info('displayed');
            },
            
            /**
             * Sets the engine for this display.
             * 
             * @param engine a mol.ui.Engine subclass
             */
            setEngine: function(engine) {
                this._engine = engine;
            },
            getTileUrl: function(tile, zoom) {
              var that = this;
              var url = that.tileurl.replace(RegExp('\\{Z}', 'g'), zoom);
              url = url.replace(RegExp('\\{X}', 'g'), tile.x);
              url = url.replace(RegExp('\\{Y}', 'g'), tile.y);
              return url;
            },
            getOptions: function(tileurl, ispng){
                var that = this;
                var options = {
                    alt: "MapServer Layer",
                    getTileUrl: this.getTileUrl,
                    tileurl: tileurl,
                    isPng: ispng,
                    maxZoom: 17,
                    minZoom: 1,
                    name: "MapServer Layer",
                    tileSize: new google.maps.Size(256, 256)
                };
                return options;
            }
        }
    );
}

GFW.modules.datalayers = function(gfw) {
  gfw.datalayers = {};
  gfw.datalayers.Engine = Class.extend(
    {
    init: function(CartoDB, layerTable, map) {
        this._map = map;
        this._bycartodbid = {};
        this._bytitle = {};
        this._dataarray = [];
        this._cartodb = CartoDB;
        var LayersColl = this._cartodb.CartoDBCollection.extend({
            sql: function(){
                return "SELECT title, zmin, zmax, ST_XMAX(the_geom) as xmax,ST_XMIN(the_geom) as xmin,ST_YMAX(the_geom) as ymax,ST_YMIN(the_geom) as ymin, tileurl, true as visible FROM " + layerTable + " WHERE display = True ORDER BY displaylayer ASC"
            }
        });
        this.LayersObj = new LayersColl();
        this.LayersObj.fetch();
        this._loadLayers();
    },
    _loadLayers: function(){
        var that = this;
        this.LayersObj.bind('reset', function() {
            that.LayersObj.each(function(p){that._addLayer(p)});
        });
    },
    _addLayer: function(p){
        gfw.log.warn('only showing baselayers for now');
        //if (p.get('category')=='baselayer'){
            var layer = new gfw.maplayer.Engine(p, this._map);
            this._dataarray.push(layer);
            this._bycartodbid[p.get('cartodb_id')] = layer;
            this._bytitle[p.get('title')] = layer;
        //}
    }
  });
};

/**
 * Logging module that gfwtes log messages to the console and to the Speed
 * Tracer API. It contains convenience methods for info(), warn(), error(),
 * and todo().
 *
*/
GFW.modules.log = function(gfw) {
  gfw.log = {};

  gfw.log.info = function(msg) {
    gfw.log._gfwte('INFO: ' + msg);
  };

  gfw.log.warn = function(msg) {
    gfw.log._gfwte('WARN: ' + msg);
  };

  gfw.log.error = function(msg) {
    gfw.log._gfwte('ERROR: ' + msg);
  };

  gfw.log.todo = function(msg) {
    gfw.log._gfwte('TODO: '+ msg);
  };

  gfw.log._gfwte = function(msg) {
    var logger = window.console;
    if (gfw.log.enabled) {
      if (logger && logger.markTimeline) {
        logger.markTimeline(msg);
      }
      console.log(msg);
    }
  };
};