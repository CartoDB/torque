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
}

GFW.modules = {};

GFW.modules.app = function(gfw) {

  gfw.app = {};

  gfw.app.Instance = Class.extend({

    init: function(map, options) {
      this.options = _.defaults(options, {
        user       : 'gfw-01',
        layerTable : 'layerinfo'
      });

      this._precision = 2;
      this._layers = [];
      this._cloudfront_url = "dyynnn89u7nkm.cloudfront.net";
      this._global_version = 3;

      gfw.log.enabled = options ? options.logging: false;

      this._map = map;
      this.infowindow = new CartoDBInfowindow(map);

      this.queries = {};
      // we can stop loading the blank (see limit=0 below) tileset here now that we are loading the animation. see todo on line 347
      this.queries.semi_monthly  = "SELECT cartodb_id,alerts,z,the_geom_webmercator FROM gfw2_forma WHERE z=CASE WHEN 8 < {Z} THEN 16 ELSE {Z}+8 END limit 0";
      this.queries.annual     = "SELECT cartodb_id,alerts,z,the_geom_webmercator FROM gfw2_hansen WHERE z=CASE WHEN 9 < {Z} THEN 17 ELSE {Z}+8 END";
      this.queries.brazilian_amazon = "SELECT CASE WHEN {Z}<12 THEN st_buffer(the_geom_webmercator,(16-{Z})^3.8) ELSE the_geom_webmercator END the_geom_webmercator, stage, cartodb_id FROM gfw2_imazon WHERE year = 2012";

      this.lastHash = null;

      this._cartodb = Backbone.CartoDB({user: this.options.user});
      this.datalayers = new gfw.datalayers.Engine(this._cartodb, options.layerTable, this._map);

      // Layers
      this.mainLayer        = null;
      this.specialLayer     = null;
      this.currentBaseLayer = "semi_monthly";

      this._loadBaseLayer();
      this._setupZoom();
      this._setupTypeControls();
    },
    run: function() {
      this._setupListeners();
      gfw.log.info('App is now running!');
    },

    open: function() {
      var that = this;

      var
      dh = $(window).height(),
      hh = $("header").height();

      $("#map").animate({ height: dh - hh }, 250, function() {
        google.maps.event.trigger(that._map, "resize");
        that._map.setOptions({ scrollwheel: true });
        $("body").css({overflow:"hidden"});
      });
    },

    close: function(callback) {
      var that = this;

      $("#map").animate({height: 400 }, 250, function() {

        google.maps.event.trigger(that._map, "resize");
        that._map.setOptions({ scrollwheel: false });
        $("body").css({ overflow:"auto" });

        if (callback) {
          callback();
        }

      });

    },

    _setupTypeControls:function() {
      var that = this;

      $("#type_controls .satellite").on("click", function() {
        $("#type_controls").find("a.selected").removeClass("selected");
        $(this).addClass("selected");
       that._map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
      });

      $("#type_controls .terrain").on("click", function() {
        $("#type_controls").find("a.selected").removeClass("selected");
        $(this).addClass("selected");
       that._map.setMapTypeId(google.maps.MapTypeId.TERRAIN);
      });

    },

    _setupZoom:function() {
      var overlayID =  document.getElementById("zoom_controls");
      // zoomIn
      var zoomInControlDiv = document.createElement('DIV');
      overlayID.appendChild(zoomInControlDiv);

      var zoomInControl = new this._zoomIn(zoomInControlDiv, map);
      zoomInControlDiv.index = 1;

      // zoomOut
      var zoomOutControlDiv = document.createElement('DIV');
      overlayID.appendChild(zoomOutControlDiv);

      var zoomOutControl = new this._zoomOut(zoomOutControlDiv, map);
      zoomOutControlDiv.index = 2;
    },

    _zoomIn: function(controlDiv, map) {
      controlDiv.setAttribute('class', 'zoom_in');

      google.maps.event.addDomListener(controlDiv, 'mousedown', function() {
        var zoom = map.getZoom() + 1;
        if (zoom < 20) {
          map.setZoom(zoom);
        }
      });
    },

    _zoomOut: function(controlDiv, map) {
      controlDiv.setAttribute('class', 'zoom_out');

      google.maps.event.addDomListener(controlDiv, 'mousedown', function() {
        var zoom = map.getZoom() - 1;

        if (zoom > 2) {
          map.setZoom(zoom);
        }

      });
    },

    _setupListeners: function(){
      var that = this;

      Legend.init();

      // Setup listeners
      google.maps.event.addListener(this._map, 'zoom_changed', function() {
        that._updateHash(that);
        that._refreshBaseLayer();
      });

      google.maps.event.addListener(this._map, 'dragend', function() {
        that._updateHash(that);
      });

      google.maps.event.addListener(this._map, 'click', function(event) {

            that.infowindow.close();
        if (!that.specialLayer) { return; }

        var // get click coordinates
        lat = event.latLng.lat(),
        lng = event.latLng.lng(),
        url = 'http://protectedplanet.net/api/sites_by_point/'+lng+'/'+lat;

        $.ajax({
          async: false,
          dataType: "jsonp",
          jsonpCallback:'iwcallback',
          url: url,
          success: function(json) {
            var data = json[0];

            if (data) {
              that.infowindow.setContent(data);
              that.infowindow.setPosition(event.latLng);
              that.infowindow.open();
            }

          }
        });
      });

      google.maps.event.addListenerOnce(this._map, 'tilesloaded', this._mapLoaded);

    },

    _removeLayer: function(layer) {
      if (!layer.get('external')) {
        this._layers = _.without(this._layers, layer.get("table_name"));
        this._renderLayers();
      } else {
        this._removeExternalLayer();
      }
    },

    _addLayer: function(layer) {
      if (!layer.get('external')) {
        this._layers.push(layer.get('table_name'));
        this._renderLayers();
      } else {
        this._renderExternalLayer(layer);
      }
    },

    _removeExternalLayer: function(layer) {
      if (this.specialLayer) this.specialLayer.setMap(null);
    },

    _renderExternalLayer: function(layer) {
      var that = this;

        var query = layer.get('tileurl');

        if (this.specialLayer) this.specialLayer.setMap(null);

        this.specialLayer = new CartoDBLayer({
          map: map,
          user_name:'',
          tiler_domain:'184.73.201.235',
          sql_domain:'184.73.201.235',
          tiler_path:'/',
          tiler_suffix:'',
          tiler_grid:'',
          table_name: layer.get("table_name"),
          query: query,
          layer_order: "bottom",
          opacity: 1,
          auto_bound: false
        });


    },
    _renderLayers: function() {
      var that = this;

      if (this._layers.length > 0) {

        var template = "SELECT cartodb_id||':' ||'{{ table_name }}' as cartodb_id, the_geom_webmercator, '{{ table_name }}' AS name FROM {{ table_name }}";

        var queryArray = _.map(this._layers, function(layer) {
          return _.template(template, { table_name: layer });
        });
        queryArray.push("(SELECT cartodb_id||':' ||'caf_lc_1' as cartodb_id, the_geom_webmercator, 'caf_lc_1' AS name FROM caf_lc_1 LIMIT 0)") //a hack for the stupid layer show hide discoloration thing I found
        var query = queryArray.join(" UNION ALL ");

        if (this.mainLayer) this.mainLayer.setMap(null);

        //var layer = (this._layers.length > 1) ? "gfw2_layerstyles_v2" : this._layers[0];
        //console.log(layer);

        var layer = "gfw2_layerstyles_v4";
        this.mainLayer = new CartoDBLayer({
          map: map,
          user_name:'',
          tiler_domain:this._cloudfront_url,
          sql_domain:this._cloudfront_url,
          extra_params:{v:this._global_version}, //define a verison number on requests
          tiler_path:'/tiles/',
          tiler_suffix:'.png',
          tiler_grid: '.grid.json',
          table_name: layer,
          query: query,
          layer_order: "bottom",
          opacity: 1,
          interactivity:"cartodb_id",
          featureMouseClick: function(ev, latlng, data) {
            //we needed the cartodb_id and table name
            var pair = data.cartodb_id.split(':');
            //here i make a crude request for the columns of the table
            //nulling out the geoms to save payload
            var request_sql = "SELECT *, null as the_geom, null as the_geom_webmercator FROM " + pair[1] + " WHERE cartodb_id = " + pair[0];
            $.ajax({
              async: false,
              dataType: 'json',
              jsonp:false,
              jsonpCallback:'iwcallback',
              url: 'http://dyynnn89u7nkm.cloudfront.net/api/v2/sql?q=' + encodeURIComponent(request_sql),
              success: function(json) {
                delete json.rows[0]['cartodb_id'],
                delete json.rows[0]['the_geom'];
                delete json.rows[0]['the_geom_webmercator'];
                delete json.rows[0]['created_at'];
                delete json.rows[0]['updated_at'];
                var data = json.rows[0];
                for (var key in data) {
                  var temp;
                  if (data.hasOwnProperty(key)) {
                    temp = data[key];
                    delete data[key];
                    key = key.replace(/_/g,' '); //add spaces to key names
                    data[key.charAt(0).toUpperCase() + key.substring(1)] = temp; //uppercase
                  }
                }
                that.infowindow.setContent(data);
                that.infowindow.setPosition(latlng);
                that.infowindow.open();
              }
            });
          },
          featureMouseOver: function(ev, latlng, data) {
            map.setOptions({draggableCursor: 'pointer'});
          },
          featureMouseOut: function() {
            map.setOptions({draggableCursor: 'default'});
          },
          debug:false,
          auto_bound: false
        });

        this.mainLayer.setInteraction(true);

      } else {
        this.mainLayer.setOpacity(0);
        this.mainLayer.setInteraction(false);
      }

    },

    _refreshBaseLayer: function() {
      var query = GFW.app.queries[GFW.app.currentBaseLayer].replace(/{Z}/g, GFW.app._map.getZoom());
      GFW.app.baseLayer.setQuery(query);
    },

    _getTableName: function(layerName) {

      if (layerName === "semi_monthly") {
        return 'gfw2_forma';
      } else if (layerName === "annual") {
        return 'gfw2_hansen';
      } else if (layerName === "brazilian_amazon") {
        return 'gfw2_imazon';
      }
      return null;
    },

    _updateBaseLayer: function() {
      if (this.currentBaseLayer != "semi_monthly"){
          map.overlayMapTypes.setAt(0, null);
      } else {
          map.overlayMapTypes.setAt(0, this.time_layer);
      }
      GFW.app.baseLayer.options.table_name = this._getTableName(this.currentBaseLayer);
      GFW.app.baseLayer.setQuery(GFW.app.queries[GFW.app.currentBaseLayer].replace(/{Z}/g, GFW.app._map.getZoom()));
    },
    _loadBaseLayer: function() {
      var self = this;
      var table_name = null;

      if (this.currentBaseLayer === "semi_monthly") {
        table_name = 'gfw2_forma';
        this.time_layer = new TimePlayer('gfw2_forma',this._global_version,this._cloudfront_url);
        this.time_layer.options.table_name = table_name;
        window.time_layer = this.time_layer;
        map.overlayMapTypes.setAt(0, this.time_layer);
        Timeline.bind('change_date', function(date, month_number) {
            self.time_layer.set_time(month_number);
        });
      } else if (this.currentBaseLayer === "annual") {
        table_name = 'gfw2_hansen';
      } else if (this.currentBaseLayer === "brazilian_amazon") {
        table_name = 'gfw2_imazon';
      }

      this.baseLayer = new CartoDBLayer({
        map: map,
        user_name:'',
        tiler_domain:'dyynnn89u7nkm.cloudfront.net',
        sql_domain:'dyynnn89u7nkm.cloudfront.net',
        tiler_path:'/tiles/',
        extra_params:{v:this._global_version}, //define a verison number on requests
        tiler_suffix:'.png',
        table_name: this._getTableName(this.currentBaseLayer),
        query: this.queries[this.currentBaseLayer].replace(/{Z}/g, this._map.getZoom()),
        layer_order: "top",
        auto_bound: false
      });

    },

    _mapLoaded: function(){
      config.mapLoaded = true;

      Circle.init();
      Timeline.init();
      Filter.init();

      showMap ? Navigation.showState("map") : Navigation.showState("home");
    },

    _updateHash: function(self) {

      var
      State = History.getState(),
      hash  = parseHash(State.hash),
      zoom = self._map.getZoom(),
      lat  = self._map.getCenter().lat().toFixed(GFW.app._precision),
      lng  = self._map.getCenter().lng().toFixed(GFW.app._precision);

      filters = hash.filters || "";
      if (filters) {
        var filters = filters.substr(0, filters.indexOf("?"));
      }

      if (filters) {
        hash = "/map/" + zoom + "/" + lat + "/" + lng + "/" + filters;
      } else {
        hash = "/map/" + zoom + "/" + lat + "/" + lng;
      }

      History.pushState({ state: 3 }, "Map", hash);
    },

    _parseHash: function(hash) {

      var args = hash.split("/");

      if (args.length >= 3) {

        var
        zoom = parseInt(args[2], 10),
        lat  = parseFloat(args[3]),
        lon  = parseFloat(args[4]);

        if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
          return false;
        }

        return {
          center: new google.maps.LatLng(lat, lon),
          zoom: zoom
        };
      }

      return false;
    },

    update: function() {
      var hash = location.hash;

      if (hash === this.lastHash) {
        return;
      }

      var
      State  = History.getState(),
      parsed = this._parseHash(State.hash);

      if (parsed) {
        this._map.setZoom(parsed.zoom);
        this._map.setCenter(parsed.center);
      }

    }
  });
};

GFW.modules.maplayer = function(gfw) {
  gfw.maplayer = {};
  gfw.maplayer.Engine = Class.extend(
    {
    init: function(layer, map) {
      this.layer = layer;
      this._map = map;

      var sw = new google.maps.LatLng(this.layer.get('ymin'), this.layer.get('xmin'));
      var ne = new google.maps.LatLng(this.layer.get('ymax'),this.layer.get('xmax'));
      this._bounds = new google.maps.LatLngBounds(sw, ne);

      if (this.layer.get('title') != 'Semi-monthly'){
        this.layer.attributes['visible'] = false;
      }

      var
      State   = History.getState(),
      hash    = parseHash(State.hash),
      filters = [];

      if (hash.filters) {
        filters = _.map(hash.filters.split(","), function(i) { return parseInt(i, 10); });
      }

      this._addControl(filters);

    },
    _addControl: function(filters){
      var that = this;

      var clickEvent = function() {
        that._toggleLayer(GFW.app);
      };

      var zoomEvent = function() {
        if (that.layer.attributes['visible']) {
          //that._map.fitBounds(that._bounds);
        }
      };

      Filter.addFilter(this.layer.get('id'), this.layer.get('category_name'), this.layer.get('title'), { clickEvent: clickEvent, zoomEvent: zoomEvent, source: this.layer.get('source') });

      // Adds the layers from the hash
      if (filters && _.include(filters, this.layer.get('id'))) {
        GFW.app._addLayer(this.layer);
        this.layer.attributes["visible"] = true;

        Filter.check(this.layer.get('id'));
        Legend.toggleItem(this.layer.get('id'), this.layer.get('title'), this.layer.get('category_name'), this.layer.get('title_color'), this.layer.get('title_subs'), true);
      } else if (this.layer.get('table_name') == 'gfw2_forma') {
          //show the legend on map start for forma
          Legend.toggleItem(this.layer.get('id'), this.layer.get('title'), this.layer.get('category_name'), this.layer.get('title_color'), this.layer.get('title_subs'), true);
      }

    },
    _bindDisplay: function(display) {
      var that = this;
      display.setEngine(this);
    },

    _hideLayer: function(layer) {
      if (layer.get('visible') == false){
        gfw.log.info('LAYER OFF');
        this._map.overlayMapTypes.setAt(this._tileindex, null);
      }
    },

    _toggleLayer: function(that){

      this.layer.attributes['visible'] = !this.layer.attributes['visible'];

      var
      title       = this.layer.get('title'),
      title_color = this.layer.get('title_color'),
      title_subs  = this.layer.get('title_subs'),
      slug        = title.replace(/ /g, "_").replace("-", "_").toLowerCase(),
      visible     = this.layer.get('visible'),
      tableName   = this.layer.get('table_name'),
      category    = this.layer.get('category_name'),
      visibility  = this.layer.get('visible');
      id          = this.layer.get('id');

      if (category === null || !category) {
        category = 'Other layers';
      }


      var // special layers
      semi_monthly  = GFW.app.datalayers.LayersObj.get(569),
      annual        = GFW.app.datalayers.LayersObj.get(568),
      sad           = GFW.app.datalayers.LayersObj.get(567);

      if (category != 'Forest clearing') {
        Legend.toggleItem(id, title, category, title_color, title_subs, visible);
      }

      if (slug === 'semi_monthly' || slug === "annual" || slug === "brazilian_amazon") {

        if (slug === 'semi_monthly' && showMap ) {
          Timeline.show();
        } else {
          Timeline.hide();
        }

        GFW.app.currentBaseLayer = slug;

        GFW.app._updateBaseLayer();

        if ( slug == 'semi_monthly') {
          semi_monthly.attributes['visible']  = true;
        } else if (slug == 'annual') {
          annual.attributes['visible']  = true;
        } else if (slug == 'brazilian_amazon') {
          sad.attributes['visible']  = true;
        }

        Legend.reset(id, title, category, title_color, title_subs);

      } else {

        if (visible) {
          GFW.app._addLayer(this.layer);
        } else {
          GFW.app._removeLayer(this.layer);
        }
        Filter.toggle(id);
      }

    }
  });

};

GFW.modules.datalayers = function(gfw) {
  gfw.datalayers = {};

  gfw.datalayers.Engine = Class.extend(
    {
    init: function(CartoDB, layerTable, map) {

      this._map         = map;
      this._bycartodbid = {};
      this._bytitle     = {};
      this._dataarray   = [];
      this._cartodb     = CartoDB;

      var LayersColl    = this._cartodb.CartoDBCollection.extend({
        sql: function(){
          return "SELECT cartodb_id AS id, title, title_color, title_subs, table_name, source, category_name, external, zmin, zmax, ST_XMAX(the_geom) AS xmax, \
          ST_XMIN(the_geom) AS xmin, ST_YMAX(the_geom) AS ymax, ST_YMIN(the_geom) AS ymin, tileurl, true AS visible \
          FROM " + layerTable + " \
          WHERE display = TRUE ORDER BY displaylayer,title ASC";
        }
      });

      this.LayersObj = new LayersColl();
      this.LayersObj.fetch();
      this._loadLayers();
    },
    _loadLayers: function(){
      var that = this;

      this.LayersObj.bind('reset', function() {
        that.LayersObj.each(function(p) {
          that._addLayer(p);
        });

        // TODO: remove the below when real layers arrive
        Filter.addFilter(0, 'Regrowth', 'Coming soon...', { disabled: true });

      });

    },
    _addLayer: function(p){
      var layer = new gfw.maplayer.Engine(p, this._map);
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
      //console.log(msg);
    }
  };
};
