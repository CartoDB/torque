  var torque = require('../');
  var Profiler = require('../profiler');

  var Uint8Array = torque.types.Uint8Array;
  var Int32Array = torque.types.Int32Array;
  var Uint32Array = torque.types.Uint32Array;
  var Uint8ClampedArray = torque.types.Uint8ClampedArray;

  /** Converts numeric degrees to radians */
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }

  var guides=true; //for drawing boxes

  // format('hello, {0}', 'rambo') -> "hello, rambo"
  function format(str) {
    for(var i = 1; i < arguments.length; ++i) {
      var attrs = arguments[i];
      for(var attr in attrs) {
        str = str.replace(RegExp('\\{' + attr + '\\}', 'g'), attrs[attr]);
      }
    }
    return str;
  }

  var splunk = function (options) {

    this._ready = false;
    this._tileQueue = [];
    this.options = options;

    this.options.is_time = this.options.is_time === undefined ? true: this.options.is_time;
    this.options.tiler_protocol = options.tiler_protocol || 'http';
    this.options.tiler_domain = options.tiler_domain || 'cartodb.com';
    this.options.tiler_port = options.tiler_port || 80;

    // backwards compatible
    if (!options.maps_api_template) {
      this._buildMapsApiTemplate(this.options);
    } else {
      this.options.maps_api_template =  options.maps_api_template;
    }

    this.options.coordinates_data_type = this.options.coordinates_data_type || Uint8Array;

    if (this.options.data_aggregation) {
      this.options.cumulative = this.options.data_aggregation === 'cumulative';
    }
    if (this.options.auth_token) {
      var e = this.options.extra_params || (this.options.extra_params = {});
      e.auth_token = this.options.auth_token;
    }
    if (!this.options.no_fetch_map) {
      this._fetchMap();
    }
  };

  splunk.prototype = {

    setManager: function (SearchManager, searchQuery, span) {
      //this.searchManagerId = managerId;
      this.managerClass = SearchManager;
      this.managers = [];
      this.searchQuery = searchQuery;
      this.span = span;
    },

    setMap: function(map,rectsLayer) {
      this.map=map;
      this.rectsLayer=rectsLayer;
    },

    /**
     * return the torque tile encoded in an efficient javascript
     * structure:
     * {
     *   x:Uint8Array x coordinates in tile reference system, normally from 0-255
     *   y:Uint8Array y coordinates in tile reference system
     *   Index: Array index to the properties
     * }
     */
    proccessTile: function(rows, coord, zoom) {
      var r;
      var x = new this.options.coordinates_data_type(rows.length);
      var y = new this.options.coordinates_data_type(rows.length);

      var prof_mem = Profiler.metric('torque.provider.splunk.mem');
      var prof_point_count = Profiler.metric('torque.provider.splunk.points');
      var prof_process_time = Profiler.metric('torque.provider.splunk.process_time').start();

      // count number of dates
      var dates = 0;
      var maxDateSlots = -1;
      for (r = 0; r < rows.length; ++r) {
        var row = rows[r];
        dates += row.dates__uint16.length;
        for(var d = 0; d < row.dates__uint16.length; ++d) {
          maxDateSlots = Math.max(maxDateSlots, row.dates__uint16[d]);
        }
      }

      if(this.options.cumulative) {
        dates = (1 + maxDateSlots) * rows.length;
      }

      var type = this.options.cumulative ? Uint32Array: Uint8ClampedArray;

      // reserve memory for all the dates
      var timeIndex = new Int32Array(maxDateSlots + 1); //index-size
      var timeCount = new Int32Array(maxDateSlots + 1);
      var renderData = new (this.options.valueDataType || type)(dates);
      var renderDataPos = new Uint32Array(dates);

      prof_mem.inc(
        4 * maxDateSlots + // timeIndex
        4 * maxDateSlots + // timeCount
        dates + //renderData
        dates * 4
      ); //renderDataPos

      prof_point_count.inc(rows.length);

      var rowsPerSlot = {};

      // precache pixel positions
      for (var r = 0; r < rows.length; ++r) {
        var row = rows[r];
        x[r] = row.x__uint8 * this.options.resolution;
        y[r] = row.y__uint8 * this.options.resolution;

        var dates = row.dates__uint16;
        var vals = row.vals__uint8;
        if (!this.options.cumulative) {
          for (var j = 0, len = dates.length; j < len; ++j) {
              var rr = rowsPerSlot[dates[j]] || (rowsPerSlot[dates[j]] = []);
              if(this.options.cumulative) {
                  vals[j] += prev_val;
              }
              prev_val = vals[j];
              rr.push([r, vals[j]]);
          }
        } else {
          var valByDate = {}
          for (var j = 0, len = dates.length; j < len; ++j) {
            valByDate[dates[j]] = vals[j];
          }
          var accum = 0;

          // extend the latest to the end
          for (var j = dates[0]; j <= maxDateSlots; ++j) {
              var rr = rowsPerSlot[j] || (rowsPerSlot[j] = []);
              var v = valByDate[j];
              if (v) {
                accum += v;
              }
              rr.push([r, accum]);
          }

          /*var lastDateSlot = dates[dates.length - 1];
          for (var j = lastDateSlot + 1; j <= maxDateSlots; ++j) {
            var rr = rowsPerSlot[j] || (rowsPerSlot[j] = []);
            rr.push([r, prev_val]);
          }
          */
        }

      }

      // for each timeslot search active buckets
      var renderDataIndex = 0;
      var timeSlotIndex = 0;
      var i = 0;
      for(var i = 0; i <= maxDateSlots; ++i) {
        var c = 0;
        var slotRows = rowsPerSlot[i]
        if(slotRows) {
          for (var r = 0; r < slotRows.length; ++r) {
            var rr = slotRows[r];
            ++c;
            renderDataPos[renderDataIndex] = rr[0]
            renderData[renderDataIndex] = rr[1];
            ++renderDataIndex;
          }
        }
        timeIndex[i] = timeSlotIndex;
        timeCount[i] = c;
        timeSlotIndex += c;
      }

      prof_process_time.end();

      return {
        x: x,
        y: y,
        z: zoom,
        coord: {
          x: coord.x,
          y: coord.y,
          z: zoom
        },
        timeCount: timeCount,
        timeIndex: timeIndex,
        renderDataPos: renderDataPos,
        renderData: renderData,
        maxDate: maxDateSlots
      };
    },

    /*setCartoCSS: function(c) {
      this.options.cartocss = c;
    },*/

    setSteps: function(steps, opt) {
      opt = opt || {};
      if (this.options.steps !== steps) {
        this.options.steps = steps;
        this.options.step = (this.options.end - this.options.start)/this.getSteps();
        this.options.step = this.options.step || 1;
        if (!opt.silent) this.reload();
      }
    },

    setOptions: function(opt) {
      var refresh = false;

      if(opt.resolution !== undefined && opt.resolution !== this.options.resolution) {
        this.options.resolution = opt.resolution;
        refresh = true;
      }

      if(opt.steps !== undefined && opt.steps !== this.options.steps) {
        this.setSteps(opt.steps, { silent: true });
        refresh = true;
      }

      if(opt.column !== undefined && opt.column !== this.options.column) {
        this.options.column = opt.column;
        refresh = true;
      }

      if(opt.countby !== undefined && opt.countby !== this.options.countby) {
        this.options.countby = opt.countby;
        refresh = true;
      }

      if(opt.data_aggregation !== undefined) {
        var c = opt.data_aggregation === 'cumulative';
        if (this.options.cumulative !== c) {
          this.options.cumulative = c;
          refresh = true;
        }
      }

      if (refresh) this.reload();
      return refresh;
    },

    _extraParams: function(e) {
      e = torque.extend(torque.extend({}, e), this.options.extra_params);
      if (e) {
        var p = [];
        for(var k in e) {
          var v = e[k];
          if (v) {
            if (torque.isArray(v)) {
              for (var i = 0, len = v.length; i < len; i++) {
                p.push(k + "[]=" + encodeURIComponent(v[i]));
              }
            } else {
              p.push(k + "=" + encodeURIComponent(v));
            }
          }
        }
        return p.join('&');
      }
      return null;
    },

    getTileData: function(coord, zoom, callback) {
      if(!this._ready) {

        this._tileQueue.push([coord, zoom, callback]);
      } else {

        this._getTileData(coord, zoom, callback);
      }
    },

    _setReady: function(ready) {
      this._ready = true;
      this._processQueue();
      this.options.ready && this.options.ready();
    },

    _processQueue: function() {
      var item;
      while (item = this._tileQueue.pop()) {
        this._getTileData.apply(this, item);
      }
    },

    /**
     * `coord` object like {x : tilex, y: tiley }
     * `zoom` quadtree zoom level
     */
    _getTileData: function(coord, zoom, callback) {
      console.log("Fetching tile " + coord.zoom + '/' + coord.x + '/' + coord.y);


      var self = this;


      getSplunkData(function(data){
        //parseData converts splunk results into a valid torque tile
        var tile = parseData(data);



        if (tile) {
          var rows = tile;

        


          callback(self.proccessTile(rows, coord, zoom));
        } else {
          Profiler.metric('torque.provider.splunk.tile.error').inc();
          callback(null);
        }
      })


    function getSplunkData(callback) {
     

    var tileBounds = boundsFromTile(coord.zoom,coord.x,coord.y);

 

    self.latspan = 0.70312500000000,
    self.lonspan = 1.40625000000000;

    for(var i=0;i<coord.zoom;i++) {
      self.latspan = self.latspan/2;
      self.lonspan = self.lonspan/2;
    }

    // //validate bounds
    if(
        tileBounds.minLat > -86 &&
        tileBounds.maxLat < 86 &&
        tileBounds.minLng >= -180 &&
        tileBounds.maxLng <= 180
    ) {

      if (!self.managers[coord.zoom + "_" + coord.x + "_" + coord.y]) {
     
        var tileQuery = self.searchQuery + " | search longitude > " 
          + tileBounds.minLng.toFixed(3) 
          + " latitude > " + tileBounds.minLat.toFixed(3)
          + " longitude < " + tileBounds.maxLng.toFixed(3) 
          + " latitude < " + tileBounds.maxLat.toFixed(3) + "| bucket _time span=" + self.span + " | eval lat = floor(('latitude' + 90.000000) / " + self.latspan + " ) | eval lon = floor(('longitude' + 180.000000) / " + self.lonspan + ") | eval latlon = lat.\"-\".lon | chart count by latlon,_time limit=128"


        self.managers[coord.zoom + "_" + coord.x + "_" + coord.y] = new self.managerClass({
          id: self.searchQuery + Date.now() + "::" + coord.zoom + "_" + coord.x + "_" + coord.y,
          cache: 86400,
          timeout: 86400,
          search: tileQuery
        });

        self.managers[coord.zoom + "_" + coord.x + "_" + coord.y].data("results", {count: 0, output_mode: 'json_rows'}).on("data", function (results) {
          console.log("Got " + (results.data().rows.length) + " bins for tile " + coord.zoom + '/' + coord.x + '/' + coord.y);
        
          callback(results.data());
        });

    
      }

      console.log('Starting Search for ' + coord.zoom + "_" + coord.x + "_" + coord.y);
      self.managers[coord.zoom + "_" + coord.x + "_" + coord.y].startSearch();

 

      }
    }


    function boundsFromTile(z,x,y) {
    var bounds = tileBounds(z,x,y);
        mins = metersToLatLng(bounds[0]);
        maxs = metersToLatLng(bounds[1]);

        bounds={
          minLat:mins[1],
          maxLat:maxs[1],
          minLng:mins[0],
          maxLng:maxs[0]
        };

        return bounds;
    }

    function metersToLatLng(coord) {
      lng = (coord[0] / (2 * Math.PI * 6378137 / 2.0)) * 180.0

      lat = (coord[1] / (2 * Math.PI * 6378137 / 2.0)) * 180.0
      lat = 180 / Math.PI * (2 * Math.atan( Math.exp( lat * Math.PI / 180.0)) - Math.PI / 2.0)

      return [lng,lat]
    }

    function tileBounds(z,x,y) {
      var mins = pixelsToMeters( z, x*256, (y+1)*256 )
      var maxs = pixelsToMeters( z, (x+1)*256, y*256 )

      return [mins,maxs];
    }


    function pixelsToMeters(z,x,y) {
      var res = (2 * Math.PI * 6378137 / 256) / (Math.pow(2,z));
      mx = x * res - (2 * Math.PI * 6378137 / 2.0);
      my = y * res - (2 * Math.PI * 6378137 / 2.0);
      my = -my;
      return [mx, my];
    }
    //end boundsFromTile


    //converts data returned from splunk into a valid torque tile.
    function parseData(data) {
        // data = '[' + data.split('}}').join('}},').replace(/,\s*$/, "") + ']';

        // data = JSON.parse(data);



        // //get indices of boundfields (for some reason they like to move around)
        // var f=data.fields;

        // var boundFields = {
        //   south: f.indexOf("_geo_bounds_south"),
        //   north: f.indexOf("_geo_bounds_north"),
        //   east: f.indexOf("_geo_bounds_east"),
        //   west: f.indexOf("_geo_bounds_west"),
        // }

 


        var torqueTile = [];

        //iterate over bounding boxes
        data.rows.forEach(function(bin) {


            torqueTile.push(torqueTransform(bin));


            function torqueTransform(bin){

              // [[y1, x1], [y2, x2]];

              
              // var b = boundFields;
              // var bounds = [[bin[b.south],bin[b.west]],[bin[b.north],bin[b.east]]];

          
              var latlon = bin[0];

              lat = latlon.split('-')[0];
              lon = latlon.split('-')[1];


              lat = ( lat * self.latspan ) - 90;
              lon = ( lon * self.lonspan ) - 180;

              lat = parseFloat(lat.toFixed(6));
              lon = parseFloat(lon.toFixed(6));



              

              //draw an orange rectangle using the tile bounds to see what we're getting back
              // L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(self.rectsLayer);

              var torqueBin = {};

            
           

              //convert bin lat/lng to tile x/y
              var point = latLngToTileXY(lat,lon,zoom)

            

              torqueBin.x__uint8 = point.x;
              torqueBin.y__uint8 = point.y;



              //iterate over remaining rows minus the last 6
              var dates = [],
                vals = [];
              for(var i=2;i<bin.length-6;i++) {
                if(bin[i] !== null) {
                  dates.push(i);
                  vals.push(bin[i]);
                }
              }

              torqueBin.vals__uint8 = vals;
              torqueBin.dates__uint16 = dates;

          
              return torqueBin;

            }

          function latLngToTileXY(lat,lng,zoom) {
          


            var MinLatitude = -85.05112878,
                MaxLatitude = 85.05112878,
                MinLongitude = -180,
                MaxLongitude = 180,
                mapSize = Math.pow(2, zoom) * 256;



            latitude = clip(lat, MinLatitude, MaxLatitude)
            longitude = clip(lng, MinLongitude, MaxLongitude)

            var p = {};
            p.x = (longitude + 180.0) / 360.0 * (1 << zoom)
            p.y = (1.0 - Math.log(Math.tan(latitude * Math.PI / 180.0) + 1.0 / Math.cos(lat.toRad())) / Math.PI) / 2.0 * (1 << zoom)



            var tilex  = parseInt(Math.trunc(p.x));
            var tiley  = parseInt(Math.trunc(p.y));



            var pixelX = clipByRange((tilex * 256) + ((p.x - tilex) * 256), mapSize - 1)/2 //<-- divide by 2 because we only have 128 bins
            var pixelY = (256 - clipByRange((tiley * 256) + ((p.y - tiley) * 256), mapSize - 1))/2

            var result =  {
                x:parseInt(parseInt(pixelX)),
                y:parseInt(parseInt(pixelY))
            }
            return result
            function clip(n,minValue,maxValue) {
                return Math.min(Math.max(n, minValue), maxValue);
            }

            function clipByRange(n,range) {

                return n % range;
            }
        }

        });

        guides=true;

        return torqueTile;
    }


    },



    getKeySpan: function() {
      return {
        start: this.options.start,
        end: this.options.end,
        step: this.options.step,
        steps: this.options.steps,
        columnType: this.options.column_type
      };
    },

    setColumn: function(column, isTime) {
      this.options.column = column;
      this.options.is_time = isTime === undefined ? true: false;
      this.reload();
    },

    reload: function() {
      this._ready = false;
      this._fetchMap();
    },

    getSteps: function() {
      return Math.min(this.options.steps, this.options.data_steps);
    },

    getBounds: function() {
      return this.options.bounds;
    },

    getSQL: function() {
      return this.options.sql || "select * from " + this.options.table;
    },

    setSQL: function(sql) {
      if (this.options.sql != sql) {
        this.options.sql = sql;
        this.reload();
      }
    },

    _buildMapsApiTemplate: function(opts) {
       var user = opts.user_name || opts.user;
       opts.maps_api_template = opts.tiler_protocol +
           "://" + ((user) ? "{user}.":"")  +
           opts.tiler_domain +
           ((opts.tiler_port != "") ? (":" + opts.tiler_port) : "");
    },

    _tilerHost: function() {
      var opts = this.options;
      var user = opts.user_name || opts.user;
      return opts.maps_api_template.replace('{user}', user);
    },

    url: function () {
      var opts = this.options;
      var cdn_host = opts.cdn_url;
      var has_empty_cdn = !cdn_host || (cdn_host && (!cdn_host.http && !cdn_host.https));

      if (opts.no_cdn || has_empty_cdn) {
        return this._tilerHost();
      } else {
        var protocol = this.isHttps() ? 'https': 'http';
        var h = protocol + "://";
        if (!this.isHttps()) {
          h += "{s}.";
        }
        var cdn_url = cdn_host[protocol];
        // build default template url if the cdn url is not templatized
        // this is for backwards compatiblity, ideally we should use the url
        // that tiler sends to us right away
        if (!this._isUserTemplateUrl(cdn_url)) {
          cdn_url = cdn_url  + "/{user}";
        }
        var user = opts.user_name || opts.user;
        h += cdn_url.replace('{user}', user)
        return h;
      }

    },

    _isUserTemplateUrl: function(t) {
      return t && t.indexOf('{user}') !== -1;
    },

    isHttps: function() {
      return this.options.maps_api_template.indexOf('https') === 0;
    },

    _generateCartoCSS: function() {
      var attr = {
        '-torque-frame-count': this.options.steps,
        '-torque-resolution': this.options.resolution,
        '-torque-aggregation-function': "'" + this.options.countby + "'",
        '-torque-time-attribute': "'" + this.options.column + "'",
        '-torque-data-aggregation': this.options.cumulative ? 'cumulative': 'linear',
      };
      var st = 'Map{';
      for (var k in attr) {
        st += k + ":" + attr[k] + ";";
      }
      return st + "}";
    },


    _fetchMap: function(callback) {

      var self = this;
      var layergroup = {};
      var host = this.options.dynamic_cdn ? this.url().replace('{s}', '0'): this._tilerHost();
      var url = host + "/api/v1/map";
      var named = this.options.named_map;
      var allParams = {};

      if(named) {
        //tiles/template
        url = host + "/api/v1/map/named/" + named.name + "/jsonp";
        if(typeof named.params !== "undefined"){
          layergroup = named.params;
        }
      } else {
        layergroup = {
          "version": "1.0.1",
          "stat_tag": this.options.stat_tag || 'torque',
          "layers": [{
            "type": "torque",
            "options": {
              "cartocss_version": "1.0.0",
              "cartocss": this._generateCartoCSS(),
              "sql": this.getSQL()
            }
          }]
        };
      }

      if(this.options.stat_tag){
        allParams["stat_tag"] = this.options.stat_tag;
      }

      extra = this._extraParams(allParams);

      // tiler needs map_key instead of api_key
      // so replace it
      if (extra) {
        extra = extra.replace('api_key=', 'map_key=');
      }

      url = url +
        "?config=" + encodeURIComponent(JSON.stringify(layergroup)) +
        "&callback=?" + (extra ? "&" + extra: '');

      var map_instance_time = Profiler.metric('torque.provider.windshaft.layergroup.time').start();

      // var opt = {start: 1000, end: 5000, data_steps: 5, column_type: "number"};

      var opt = {start: 1262311701000,
        end: 1391640787000,
        data_steps: 8247,
        column_type: "date"};

      for(var k in opt) {
        self.options[k] = opt[k];
      }
    }
  };

  module.exports = splunk;
