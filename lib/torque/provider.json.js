(function(exports) {

  var torque = exports.torque = exports.torque || {};
  var providers = exports.torque.providers = exports.torque.providers || {};

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

  var json = function (options) {
    this._ready = false;
    this._tileQueue = [];
    this.options = options;

    this.options.is_time = this.options.is_time === undefined ? true: this.options.is_time;
    this.options.tiler_protocol = options.tiler_protocol || 'http';
    this.options.tiler_domain = options.tiler_domain || 'cartodb.com';
    this.options.tiler_port = options.tiler_port || 80;

    // check options
    if (options.resolution === undefined ) throw new Error("resolution should be provided");
    if (options.steps === undefined ) throw new Error("steps should be provided");
    if(options.start === undefined) {
      this._fetchKeySpan();
    } else {
      this._setReady(true);
    }
  };

  json.prototype = {

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
      var x = new Uint8Array(rows.length);
      var y = new Uint8Array(rows.length);


      // count number of dates
      var dates = 0;
      var maxDateSlots = 0;
      for (r = 0; r < rows.length; ++r) {
        var row = rows[r];
        if(this.options.cumulative) {
          for (var s = 1; s < row.vals__uint8.length; ++s) {
           row.vals__uint8[s] += row.vals__uint8[s - 1];
          }
        }
        dates += row.dates__uint16.length;
        for(var d = 0; d < row.dates__uint16.length; ++d) {
          maxDateSlots = Math.max(maxDateSlots, row.dates__uint16[d]);
        }
      }

      // reserve memory for all the dates
      var timeIndex = new Int32Array(maxDateSlots + 1); //index-size
      var timeCount = new Int32Array(maxDateSlots + 1);
      var renderData = new (this.options.valueDataType || Uint8Array)(dates);
      var renderDataPos = new Uint32Array(dates);

      var rowsPerSlot = {};

      // precache pixel positions
      for (var r = 0; r < rows.length; ++r) {
        var row = rows[r];
        x[r] = row.x__uint8 * this.options.resolution;
        y[r] = row.y__uint8 * this.options.resolution;

        var dates = row.dates__uint16;
        var vals = row.vals__uint8;
        for (var j = 0, len = dates.length; j < len; ++j) {
            var rr = rowsPerSlot[dates[j]] || (rowsPerSlot[dates[j]] = []);
            rr.push([r, vals[j]]);
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

      return {
        x: x,
        y: y,
        coord: {
          x: coord.x,
          y: coord.y,
          z: zoom
        },
        timeCount: timeCount,
        timeIndex: timeIndex,
        renderDataPos: renderDataPos,
        renderData: renderData
      };
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

    // execute actual query
    sql: function(sql, callback, options) {
      options = options || {};
      var subdomains = this.options.subdomains || '0123';
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
      this.table = this.options.table;
      var numTiles = 1 << zoom;

      var column_conv = this.options.column;

      if(this.options.is_time) {
        column_conv = format("date_part('epoch', {column})", this.options);
      }

      var sql = "" +
        "WITH " +
        "par AS (" +
        "  SELECT CDB_XYZ_Resolution({zoom})*{resolution} as res" +
        ", CDB_XYZ_Extent({x}, {y}, {zoom}) as ext "  +
        ")," +
        "cte AS ( "+
        "  SELECT ST_SnapToGrid(i.the_geom_webmercator, p.res) g" +
        ", {countby} c" +
        ", floor(({column_conv} - {start})/{step}) d" +
        "  FROM ({_sql}) i, par p " +
        "  WHERE i.the_geom_webmercator && p.ext " +
        "  GROUP BY g, d" +
        ") " +
        "" +
        "SELECT least((st_x(g)-st_xmin(p.ext))/p.res, 255) x__uint8, " +
        "       least((st_y(g)-st_ymin(p.ext))/p.res, 255) y__uint8," +
        " array_agg(c) vals__uint8," +
        " array_agg(d) dates__uint16" +
        " FROM cte, par p GROUP BY x__uint8, y__uint8";

      var query = format(sql, this.options, {
        zoom: zoom,
        x: coord.x,
        y: coord.y,
        column_conv: column_conv,
        _sql: this.getSQL()
      });

      var self = this;
      this.sql(query, function (data) {
        if (data) {
          var rows = JSON.parse(data.responseText).rows;
          callback(self.proccessTile(rows, coord, zoom));
        } else {
          callback(null);
        }
      });
    },

    getKeySpan: function() {
      return {
        start: this.options.start * 1000,
        end: this.options.end * 1000,
        step: this.options.step,
        steps: this.options.steps
      };
    },

    setColumn: function(column, isTime) {
      this.options.column = column;
      this.options.is_time = isTime === undefined ? true: false;
      this._ready = false;
      this._fetchKeySpan();
    },

    setSQL: function(sql) {
      if (this.options.sql != sql) {
        this.options.sql = sql;
        this._ready = false;
        this._fetchKeySpan();
      }
    },

    getSteps: function() {
      return Math.min(this.options.steps, this.options.data_steps);
    },

    setSteps: function(steps) {
      if (this.options.steps !== steps) {
        this.options.steps = steps;
        this.options.step = (this.options.end - this.options.start)/this.getSteps();
        this.options.step = this.options.step || 1;
        this._ready = false;
        this._fetchKeySpan();
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

    _fetchUpdateAt: function(callback) {
      var self = this;
      var layergroup = {
        "version": "1.0.1",
        "stat_tag": this.options.stat_tag || 'torque',
        "layers": [{
          "type": "cartodb",
          "options": {
            "cartocss_version": "2.1.1", 
            "cartocss": "#layer {}",
            "sql": this.getSQL()
          }
        }]
      };
      var url = this._tilerHost() + "/tiles/layergroup";
      var extra = this._extraParams();
      torque.net.post( url + (extra ? "?" + extra: ''), JSON.stringify(layergroup) , function (req) {
        var query = format("select * from ({sql}) __torque_wrap_sql limit 0", { sql: self.getSQL() });
        self.sql(query, function (queryData) {
          callback({
            updated_at: JSON.parse(req.response).last_updated,
            fields: queryData.fields
          });
        }, { parseJSON: true });
      });
    },

    //
    // the data range could be set by the user though ``start``
    // option. It can be fecthed from the table when the start
    // is not specified.
    //
    _fetchKeySpan: function() {
      var self = this;
      var max_col, min_col, max_tmpl, min_tmpl;

      this._fetchUpdateAt(function(data) {
        if (!data) return;
        self.options.extra_params = self.options.extra_params || {};
        self.options.extra_params.last_updated = data.updated_at || 0;
        self.options.is_time = data.fields[self.options.column].type === 'date';

        var column_conv = self.options.column;
        if (self.options.is_time){
          max_tmpl = "date_part('epoch', max({column}))";
          min_tmpl = "date_part('epoch', min({column}))";
          column_conv = format("date_part('epoch', {column})", self.options);
        } else {
          max_tmpl = "max({column})";
          min_tmpl = "min({column})";
        }

        max_col = format(max_tmpl, { column: self.options.column });
        min_col = format(min_tmpl, { column: self.options.column });

        /*var sql_stats = "" +
        "WITH summary_groups as ( " +
          "WITH summary as ( " +
           "select   (row_number() over (order by __time_col asc nulls last)+1)/2 as rownum, __time_col " +
            "from (select *, {column} as __time_col from ({sql}) __s) __torque_wrap_sql " +
            "order by __time_col asc " +
          ") " +
          "SELECT " +
          "max(__time_col) OVER(PARTITION BY rownum) -  " +
          "min(__time_col) OVER(PARTITION BY rownum) diff " +
          "FROM summary " +
        "), subq as ( " +
        " SELECT " +
            "st_xmax(st_envelope(st_collect(the_geom))) xmax, " +
            "st_ymax(st_envelope(st_collect(the_geom))) ymax, " +
            "st_xmin(st_envelope(st_collect(the_geom))) xmin, " +
            "st_ymin(st_envelope(st_collect(the_geom))) ymin, " +
            "{max_col} max, " +
            "{min_col} min FROM  ({sql}) __torque_wrap_sql " +
        ")" +
        "SELECT " +
        "xmax, xmin, ymax, ymin, a.max as max_date, a.min as min_date, " +
        "avg(diff) as diffavg," +
        "(a.max - a.min)/avg(diff) as num_steps " +
        "FROM summary_groups, subq a  " +
        "WHERE diff > 0 group by xmax, xmin, ymax, ymin, max_date, min_date";
        */
        var sql_stats = " SELECT " +
            "st_xmax(st_envelope(st_collect(the_geom))) xmax, " +
            "st_ymax(st_envelope(st_collect(the_geom))) ymax, " +
            "st_xmin(st_envelope(st_collect(the_geom))) xmin, " +
            "st_ymin(st_envelope(st_collect(the_geom))) ymin, " +
            "count(*) as num_steps, " +
            "{max_col} max_date, " +
            "{min_col} min_date FROM  ({sql}) __torque_wrap_sql ";

        var sql = format(sql_stats, {
          max_col: max_col,
          min_col: min_col,
          column: column_conv,
          sql: self.getSQL()
        });

        self.sql(sql, function(data) {
          //TODO: manage bounds
          data = data.rows[0];
          self.options.start = data.min_date;
          self.options.end = data.max_date;
          self.options.step = (data.max_date - data.min_date)/Math.min(self.options.steps, data.num_steps>>0);
          self.options.data_steps = data.num_steps >> 0;
          // step can't be 0
          self.options.step = self.options.step || 1;
          self.options.bounds = [
            [data.ymin, data.xmin],
            [data.ymax, data.xmax]
          ];
          self._setReady(true);
        }, { parseJSON: true, no_cdn: true });
      }, { parseJSON: true, no_cdn: true})
    }

  };

  torque.providers.json = json;


})(typeof exports === "undefined" ? this : exports);
