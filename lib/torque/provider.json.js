(function(exports) {

  exports.torque = exports.torque || {};
  var providers = exports.torque.providers = exports.torque.providers || {};

  // format('hello, {0}', 'rambo') -> "hello, rambo"
  function format(str, attrs) {
    for(var i = 1; i < arguments.length; ++i) {
      var attrs = arguments[i];
      for(var attr in attrs) {
        str = str.replace(RegExp('\\{' + attr + '\\}', 'g'), attrs[attr]);
      }
    }
    return str;

  }

  var json = function (options) {
    // check options
    //if(!options.user) throw new Error("user should be provided");
    if (options.resolution === undefined ) throw new Error("resolution should be provided");
    this.options = options;
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
      var x = new Uint8Array(rows.length);
      var y = new Uint8Array(rows.length);

      // count number of dates
      var dates = 0;
      var maxDateSlots = 0;
      for (var r = 0; r < rows.length; ++r) {
        var row = rows[r];
        dates += row['dates__uint16'].length;
        maxDateSlots = Math.max(maxDateSlots, row.dates__uint16.length);
      }

      // reserve memory for all the dates
      var timeIndex = new Int32Array(maxDateSlots); //index-size
      var timeCount = new Int32Array(maxDateSlots);
      var renderData = new Uint8Array(dates);
      var renderDataPos = new Uint32Array(dates);

      var rowsPerSlot = [];

      // precache pixel positions
      for (var r = 0; r < rows.length; ++r) {
        var row = rows[r];
        x[r] = row.x__uint8;
        y[r] = 255 - row.y__uint8;

        var dates = rows[r]['dates__uint16'];
        var vals = rows[r]['vals__uint8'];
        for (var j = 0, len = dates.length; j < len; ++j) {
            var rr = rowsPerSlot[dates[j]] || (rowsPerSlot[dates[j]] = []);
            rr.push([r, vals[j]]);
        }
      }

      // for each timeslot search active buckets
      var renderDataIndex = 0;
      var timeSlotIndex = 0;
      for(var i = 0; i < maxDateSlots; ++i) {
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
        /*
        for (var r = 0; r < rows.length; ++r) {
          var dates = rows.get('dates__uint16')[r];
          var vals = rows.get('vals__uint8')[r];
          for (var j = 0, len = dates.length; j < len; ++j) {
            if(dates[j] == i) {
              ++c;
              renderData[renderDataIndex] = vals[j];
              renderDataPos[renderDataIndex] = r;
              ++renderDataIndex;
            }
          }
        }
        */
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
          z: zoom,
        },
        timeCount: timeCount,
        timeIndex: timeIndex,
        renderDataPos: renderDataPos,
        renderData: renderData
      };
    },

    url: function() {
      return this.options.url || 'http://' + this.options.user + '.cartodb.com/api/v2/sql';
    },

    // execute actual query
    sql: function(sql, callback) {
      torque.net.get(this.url() + "?q=" + encodeURIComponent(sql), function (data) {
          callback(data);
      });
    },

    /**
     * `coord` object like {x : tilex, y: tiley } 
     * `zoom` quadtree zoom level
     */
    getTileData: function(coord, zoom, callback) {
      this.table = this.options.table;
      var numTiles = 1 << zoom;

      var sql = "" +
        "WITH " +
        "par AS (" +
        "  SELECT CDB_XYZ_Resolution({zoom})*{resolution} as res" +
        ", CDB_XYZ_Extent({x}, {y}, {zoom}) as ext "  +
        ")," +
        "cte AS ( "+
        "  SELECT ST_SnapToGrid(i.the_geom_webmercator, p.res) g" +
        ", {countby} c" +
        ", floor(({column} - {start_date})/{step}) d" +
        "  FROM {table} i, par p " +
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
        y: coord.y
      });

      var self = this;
      this.sql(query, function (data) {
        var rows = JSON.parse(data.responseText).rows;
        callback(self.proccessTile(rows, coord, zoom));
      });
    }

  };

  torque.providers.json = json


})(typeof exports === "undefined" ? this : exports);
