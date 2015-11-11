var torque = require('../');
var _ = require('underscore');
var Profiler = require('../profiler');

  var Uint8Array = torque.types.Uint8Array;
  var Int32Array = torque.types.Int32Array;
  var Uint32Array = torque.types.Uint32Array;

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

  var filterableJson = function (options) {
    this._ready = false;
    this._tileQueue = [];
    this.options = options;
    this._filters = {};
    this._tileProcessingQueue=[]
    this._workers = [];
    this._maxWorkerNo = this.options.maxWorkerNo || 4;

    this.setupWorkerPool()
    // category mapping for each column
    this.categoryMapping = {}
    this.categoryMappingSize = {}

    // generate the mapping, global for all the tiles
    var fields = this.options.fields;
    for (var i = 0 ; i < fields.length; ++i) {
      if (fields[i].type === 'cat') {
        this.categoryMapping[fields[i].name] = {}
        this.categoryMappingSize[fields[i].name] = 0;
      }
    }

    this.options.tiler_protocol = options.tiler_protocol || 'http';
    this.options.tiler_domain = options.tiler_domain || 'cartodb.com';
    this.options.tiler_port = options.tiler_port || 80;

    // check options
    if (options.resolution === undefined ) throw new Error("resolution should be provided");
    if(options.start === undefined) {
      this._fetchKeySpan();
    } else {
      this._setReady(true);
    }
  };



  filterableJson.prototype = {

    setupWorkerPool:function(){
      for(var i=0; i< this._maxWorkerNo; i++){
        this._workers.push(this.createProccessTileWorker())
      }
    },

    getAvalaibleWorker:function(){
      return this._workers.pop()
    },
    releaseWorker:function(worker){
      console.log("releasing worker ", worker)
      this._workers.push(worker)
      this.processNextTileRequestInQueue()
    },
    processNextTileRequestInQueue:function(){
      console.log("processing next ",this._tileProcessingQueue.length, this._workers.length )
      if(this._tileProcessingQueue.length>0){
        job = this._tileProcessingQueue.pop()
        this.requestWorker(job.rows,job.coord,job.zoom, job.options, job.callback)
      }
    },
    requestWorker:function(rows,coord,zoom,options,callback){
      worker = this.getAvalaibleWorker()
      self = this
      if(worker){
        worker.onmessage = function(e){
          callback(e.data)
          self.releaseWorker(this)
        }
        worker.postMessage(JSON.stringify({rows: rows, coord: {x:coord.x,y:coord.y}, zoom:zoom, options: options}))
      }
      else{
        this.addToTileProcessingQueue(rows,coord,zoom,options,callback)
      }
    },
    addToTileProcessingQueue:function(rows,coord,zoom, options, callback){
      this._tileProcessingQueue.push({rows:rows, coord:coord, zoom:zoom, options: options, callback:callback})
    },
    /**
     * Creates a worker to process the tile
     */

    createProccessTileWorker:function(){
      var workerFunction = "var proccessTile ="+ this.proccessTileSerial.toString()
      var wrapper = "; self.onmessage = function(e){var data = JSON.parse(e.data); JSON.stringify(self.postMessage(proccessTile(data.rows,data.coord, data.zoom, data.options)))}"
      var script = workerFunction + wrapper;
      var blob = new Blob([script], {type: "text/javascript"})
      var worker  = new Worker(window.URL.createObjectURL(blob))
      return worker
    },

    proccessTile:function(rows,coord,zoom,callback){
      if(typeof(Worker) === "undefined"){
        callback(this.proccessTileSerial(rows,coord,zoom, this.options))
      }
      else{


        var workerSafeOptions= {
          x : new Uint8Array(rows.length),
          y : new Uint8Array(rows.length),
          resolution: this.options.resolution,
          fields: this.options.fields
        }
        this.requestWorker(rows,coord,zoom,workerSafeOptions,callback)
      }
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
    proccessTileSerial: function(rows, coord, zoom, options) {
      var r;
      var x = new Uint8Array(rows.length);
      var y = new Uint8Array(rows.length);

      if(typeof(Profiler) != 'undefined') {
        var prof_mem = Profiler.metric('ProviderJSON:mem');
        var prof_point_count = Profiler.metric('ProviderJSON:point_count');
        var prof_process_time = Profiler.metric('ProviderJSON:process_time').start()
      }

      // count number of steps
      var maxDateSlots = Object.keys(rows[0].d).length;
      var steps = maxDateSlots;


      // reserve memory for all the steps
      var timeIndex = new Int32Array(maxDateSlots + 1); //index-size
      var timeCount = new Int32Array(maxDateSlots + 1);
      var renderData = new Float32Array(rows.length * steps); //(this.options.valueDataType || type)(steps);
      var renderDataPos = new Uint32Array(rows.length * steps);

      if(typeof(Profiler) !='undefined'){
        prof_mem.inc(
          4 * maxDateSlots + // timeIndex
          4 * maxDateSlots + // timeCount
          steps + //renderData
          steps * 4
        ); //renderDataPos

        prof_point_count.inc(rows.length);
      }

      var rowsPerSlot = {};
      // var steps = _.range(maxDateSlots);
      var steps = []

      for(var i=0 ; i< maxDateSlots; i++){
        steps.push(i)
      }

      // precache pixel positions
      for (var r = 0; r < rows.length; ++r) {
        var row = rows[r];
        x[r] = row.x * options.resolution;
        // fix value when it's in the tile EDGE
        // TODO: this should be fixed in SQL query
        if (row.y === -1) {
          y[r] = 0;
        } else {
          y[r] = row.y * options.resolution;
        }

        var vals = row.d;

        for (var j = 0, len = steps.length; j < len; ++j) {
            var rr = rowsPerSlot[steps[j]] || (rowsPerSlot[steps[j]] = []);
            var k = 'f' + (j + 1)
            var v = vals[k];
            if (options.fields[j].type === 'cat') {
              var mapping = this.categoryMapping[options.fields[j].name];
              var m = mapping[v]
              if (!m) {
                var count = this.categoryMappingSize[options.fields[j].name];
                if (count < 100) {
                  ++this.categoryMappingSize[options.fields[j].name];
                  v = mapping[v] = count;
                } else {
                  v = 0;
                }
              } else {
                v = m;
              }
            }
            rr.push([r, v]);
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

      if(typeof(Profiler) !='undefined'){
        prof_process_time.end();
      }

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

    _generateFilterSQLForCat: function(name, categories, exclusive) {
      return name + (exclusive ? " not in ": " in") + '(' + categories.map(function(c) {
        return "''" + c + "''";
      }).join(',') + ')';
    },

    _generateFilterSQLForRange: function(name,range) {
      var result = ""
      if (range.start) {
        result += " " + name + " > " + range.start;
      }
      if (range.end) {
        if (range.start) {
          result += " and "
        }
        result += " " + name + " < " + range.end;
      }
      return result
    },

    _setFilters:function(filters){
      this.filters = filters
    },

    _generateFiltersSQL: function() {
      var self = this;
      return Object.keys(this._filters).map(function(filterName){
        var filter = self._filters[filterName]
        if (filter) {
          if (filter.type == 'range') {
            return  self._generateFilterSQLForRange(filterName, filter.range)
          }
          else if (filter.type == 'cat' && filter.categories.length) {
            return self._generateFilterSQLForCat(filterName, filter.categories, filter.exclusive)
          }
          else {
            return ""
          }
        }
        else{
          return ""
        }
      }).filter(function(f) {
        return f.length > 0;
      }).map(function(f) {
        return "(" + f + ")";
      }).join(' and ')
    },

    _host: function() {
      var opts = this.options;
      var port = opts.sql_api_port;
      var domain = ((opts.user_name || opts.user) + '.' + (opts.sql_api_domain || 'cartodb.com')) + (port ? ':' + port: '');
      var protocol = opts.sql_api_protocol || 'http';
      return this.options.url || protocol + '://' + domain + '/api/v2/sql';
    },

    url: function(subhost) {
      var opts = this.options;
      var protocol = opts.sql_api_protocol || 'http';
      if (!this.options.cdn_url) {
        return this._host();
      }
      var h = protocol+ "://";
      if (subhost) {
        h += subhost + ".";
      }
      var cdn_host = opts.cdn_url;
      if(!cdn_host.http && !cdn_host.https) {
        throw new Error("cdn_host should contain http and/or https entries");
      }
      h += cdn_host[protocol] + "/" + (opts.user_name || opts.user) + '/api/v2/sql';
      return h;
    },

    _hash: function(str) {
      var hash = 0;
      if (!str || str.length == 0) return hash;
      for (var i = 0, l = str.length; i < l; ++i) {
          hash = (( (hash << 5 ) - hash ) + str.charCodeAt(i)) | 0;
      }
      return hash;
    },

    _extraParams: function() {
      if (this.options.extra_params) {
        var p = [];
        for(var k in this.options.extra_params) {
          var v = this.options.extra_params[k];
          if (v) {
            p.push(k + "=" + encodeURIComponent(v));
          }
        }
        return p.join('&');
      }
      return null;
    },

    isHttps: function() {
      return this.options.sql_api_protocol && this.options.sql_api_protocol === 'https';
    },

    // execute actual query
    sql: function(sql, callback, options) {
      options = options || {};
      var subdomains = this.options.subdomains || '0123';
      if(this.isHttps()) {
        subdomains = [null]; // no subdomain
      }


      var url;
      if (options.no_cdn) {
        url = this._host();
      } else {
        url = this.url(subdomains[Math.abs(this._hash(sql))%subdomains.length]);
      }
      var extra = this._extraParams();
      torque.net.get( url + "?q=" + encodeURIComponent(sql) + (extra ? "&" + extra: ''), function (data) {
          if(options.parseJSON) {
            data = JSON.parse(data && data.responseText);
          }
          callback && callback(data);
      });
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
      var prof_fetch_time = Profiler.metric('ProviderJSON:tile_fetch_time').start()
      this.table = this.options.table;
      var numTiles = 1 << zoom;

      var column_conv = this.options.column;

      var sql = "select * from torque_tile_json({x}, {y}, {zoom}, ARRAY[{fields}], {table}, '{filters}')";
      var table_sql = format("(WITH opt as ( SELECT table_name as tt FROM selectivity(x:={x}, y:={y}, z:={z}, tables:=ARRAY['yodlee_1', 'yodlee_2', 'yodlee_4', 'yodlee_16', 'yodlee_64', 'yodlee_128', 'yodlee_256'], where_clause:='{filters}') where nrows > 5000 order by nrows asc limit 1) select (CASE WHEN EXISTS(select 1 from opt) THEN (select tt from opt) else 'yodlee_1' END))", {
        z: zoom,
        x: coord.x,
        y: coord.y,
        filters: this._generateFiltersSQL()
      })

      var query = format(sql, {
        zoom: zoom,
        x: coord.x,
        y: coord.y,
        fields: _.map(this.options.fields, function(f) {
          if (f.type === 'cat') {
            return "'mode() within group (order by " + f.name + ")'";
          }
          return "'avg(" + f.name + ")'";
        }).join(','),
        column: column_conv,
        table: table_sql,
        filters: this._generateFiltersSQL()
      });


      var self = this;
      this.sql(query, function (data) {
        if (data) {
          var rows = JSON.parse(data.responseText).rows;
          if (rows.length !== 0) {
            self.proccessTile(rows, coord, zoom,callback);
          } else {
            callback(null);
          }
        } else {
          callback(null);
        }
        prof_fetch_time.end();
      });
    },

    getKeySpan: function() {
      return {
        start: this.options.start * 1000,
        end: this.options.end * 1000,
        step: this.options.step,
        steps: this.options.steps,
        columnType: this.options.is_time ? 'date': 'number'
      };
    },

    setColumn: function(column, isTime) {
      this.options.column = column;
      this.options.is_time = isTime === undefined ? true: false;
      this.reload();
    },

    setResolution: function(res) {
      this.options.resolution = res;
    },

    // return true if tiles has been changed
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

    reload: function() {
      this._ready = false;
      this._fetchKeySpan();
    },

    setSQL: function(sql) {
      if (this.options.sql != sql) {
        this.options.sql = sql;
        this.reload();
      }
    },

    getSteps: function() {
      return Math.min(this.options.steps, this.options.data_steps);
    },

    setSteps: function(steps, opt) {
      opt = opt || {};
      if (this.options.steps !== steps) {
        this.options.steps = steps;
        this.options.step = (this.options.end - this.options.start)/this.getSteps();
        this.options.step = this.options.step || 1;
        if (!opt.silent) this.reload();
      }
    },

    getBounds: function() {
      return this.options.bounds;
    },

    getSQL: function() {
      return this.options.sql || "select * from " + this.options.table;
    },

    _tilerHost: function() {
      var opts = this.options;
      var user = (opts.user_name || opts.user);
      return opts.tiler_protocol +
           "://" + (user ? user + "." : "")  +
           opts.tiler_domain +
           ((opts.tiler_port != "") ? (":" + opts.tiler_port) : "");
    },

    _fetchKeySpan: function() {
      this._setReady(true);
    },

    getHistogram: function(varName, callback) {

      var sql = [
      'with width as (',
         'select min({column}) as min,',
                 'max({column}) as max,',
                '20 as buckets',
                'from {table}',
      '),',
      '_bw as ( select (max - min)/buckets as bw from width ),',
      'histogram as (',
        'select width_bucket({column}, min, max, buckets) as bucket,',
               'numrange(min({column})::numeric, max({column})::numeric, \'[]\') as range,',
               'count(*) as freq',
          'from {table}, width ',
          //'where trip_time_in_secs between min and max',
        'group by bucket',
        'order by bucket',
      ')',
      'select bucket*bw as start, (bucket+1)*bw as end, bucket as bin, lower(range) as min, upper(range) as max, freq from histogram, _bw;'
      ]


      var query = format(sql.join('\n'), this.options, {
        column: this.options.column,
        table: this.options.table, 
        filters: this._generateFiltersSQL()
      });

      var self = this;
      this.sql(query, function (data) {
        if (data) {
          var rows = JSON.parse(data.responseText).rows;
          callback(null, rows);
        } else {
          callback(null);
        }
      });
    }

  };

module.exports = filterableJson;
