(function(exports) {


  var torque = exports.torque = exports.torque || {};
  var providers = exports.torque.providers = exports.torque.providers || {};

  var Uint8Array = torque.types.Uint8Array;
  var Int32Array = torque.types.Int32Array;
  var Uint32Array = torque.types.Uint32Array;

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
    this.options = options;
  };


  json.prototype = {

    //
    // return the data aggregated by key:
    // {
    //  key0: 12,
    //  key1: 32
    //  key2: 25
    // }
    //
    aggregateByKey: function(rows) {
      function getKeys(row) {
        var HEADER_SIZE = 3;
        var valuesCount = row.data[2];
        var keys = {};
        for (var s = 0; s < valuesCount; ++s) {
          keys[row.data[HEADER_SIZE + s]] = row.data[HEADER_SIZE + valuesCount + s];
        }
        return keys;
      }
      var keys = {};
      for (r = 0; r < rows.length; ++r) {
        var rowKeys = getKeys(rows[r]);
        for(var k in rowKeys) {
          keys[k] = keys[k] || 0;
          keys[k] += rowKeys[k];
        }
      }
      return keys;
    },
    



    /**
     *
     */
    proccessTile: function(rows, coord, zoom) {
      var r;
      var x = new Uint8Array(rows.length);
      var y = new Uint8Array(rows.length);
      var self = this;

      // decode into a javascript strcuture the array
      function decode_row(row) {
        var HEADER_SIZE = 3;
        var o = {
          x: row.data[0] * self.options.resolution,
          y: row.data[1] * self.options.resolution,
          valuesCount: row.data[2],
          times: [],
          values: [],
        };
        for (var s = 0; s < o.valuesCount; ++s) {
           o.times.push(row.data[HEADER_SIZE + s]);
           o.values.push(row.data[HEADER_SIZE + o.valuesCount + s]);
        }
        if(self.options.cumulative) {
          for (var s = 1; s < o.valuesCount; ++s) {
           o.values[s] += o.values[s - 1];
          }
        }
        return o
      }

      // decode all the rows
      for (r = 0; r < rows.length; ++r) {
        rows[r] = decode_row(rows[r]);
      }

      // count number of dates
      var dates = 0;
      var maxDateSlots = 0;
      for (r = 0; r < rows.length; ++r) {
        var row = rows[r];
        dates += row.times.length;
        for(var d = 0; d < row.times.length; ++d) {
          maxDateSlots = Math.max(maxDateSlots, row.times[d]);
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
        x[r] = row.x;
        y[r] = row.y;

        var dates = row.times;
        var vals = row.values;
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

    url: function() {
      return this.options.url;
    },


    tileUrl: function(coord, zoom) {
      var template = this.url();
      var s = (this.options.subdomains || 'abcd')[(coord.x + coord.y + zoom) % 4];
      return template
        .replace('{x}', coord.x)
        .replace('{y}', coord.y)
        .replace('{z}', zoom)
        .replace('{s}', s);
    },

    getTile: function(coord, zoom, callback) {
      var template = this.tileUrl(coord, zoom);

      var self = this;
      var fetchTime = Profiler.metric('jsonarray:fetch time');
      fetchTime.start();
      torque.net.get(template, function (data) {
        fetchTime.end();
        if(data) {
          data = JSON.parse(data.responseText);
        }
        callback(data);
      });
    },

    /**
     * `coord` object like {x : tilex, y: tiley } 
     * `zoom` quadtree zoom level
     */
    getTileData: function(coord, zoom, callback) {
      var template = this.tileUrl(coord, zoom);

      var self = this;
      var fetchTime = Profiler.metric('jsonarray:fetch time');
      fetchTime.start();
      torque.net.get(template, function (data) {
        fetchTime.end();
        var processed = null;
        
        var processingTime = Profiler.metric('jsonarray:processing time');
        var parsingTime = Profiler.metric('jsonarray:parsing time');
        try {
          processingTime.start();
          parsingTime.start();
          var rows = JSON.parse(data.responseText || data.response).rows;
          parsingTime.end();
          processed = self.proccessTile(rows, coord, zoom);
          processingTime.end();
        } catch(e) {
          console.error("problem parsing JSON on ", coord, zoom);
        }

        callback(processed);

      });
    }

  };

  torque.providers.JsonArray = json


})(typeof exports === "undefined" ? this : exports);
