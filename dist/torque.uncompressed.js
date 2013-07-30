// =================
// profiler
// =================
//
// Counters
//   pendingJobs.inc();
//   pendingJobs.dec();
//
// Meters
//  A meter measures the rate of events over time
//  requests.mark();
//
// Histograms
//  responseSizes.update(response.getContent().length);
//
// Timers
//  private final Timer responses = metrics.timer(name(RequestHandler.class, "responses"));
// 
//  final Timer.Context context = responses.time();
    //try {
        //return "OK";
    //} finally {
        //context.stop();
    //}

// Health Checks
//
function Profiler() {
}
Profiler.times = {};
Profiler.new_time = function (type, time) {
    var t = Profiler.times[type] = Profiler.times[type] || {
        max:0,
        min:10000000,
        avg:0,
        total:0,
        count:0
    };

    t.max = Math.max(t.max, time);
    t.total += time;
    t.min = Math.min(t.min, time);
    ++t.count;
    t.avg = t.total / t.count;
};

Profiler.print_stats = function () {
    for (k in Profiler.times) {
        var t = Profiler.times[k];
        console.log(" === " + k + " === ");
        console.log(" max: " + t.max);
        console.log(" min: " + t.min);
        console.log(" avg: " + t.avg);
        console.log(" total: " + t.total);
    }
};

Profiler.get = function (type) {
    return {
        t0:null,
        start:function () {
            this.t0 = new Date().getTime();
        },
        end:function () {
            if (this.t0 !== null) {
                Profiler.new_time(type, this.time = new Date().getTime() - this.t0);
                this.t0 = null;
            }
        }
    };
};
(function(exports) {

  exports.torque = exports.torque || {};
  var providers = exports.torque.providers = exports.torque.providers || {};

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

    // check options
    if (options.resolution === undefined ) throw new Error("resolution should be provided");
    if (options.steps === undefined ) throw new Error("steps should be provided");
    if(options.start === undefined) {
      this.getKeySpan();
    } else {
      this._ready = true;
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
        y[r] = row.y__uint8;

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
    sql: function(sql, callback, options) {
      options = options || {};
      torque.net.get(this.url() + "?q=" + encodeURIComponent(sql), function (data) {
          if(options.parseJSON) {
            data = JSON.parse(data.responseText);
          }
          callback(data);
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
        y: coord.y,
        column_conv: column_conv
      });

      var self = this;
      this.sql(query, function (data) {
        var rows = JSON.parse(data.responseText).rows;
        callback(self.proccessTile(rows, coord, zoom));
      });
    },

    //
    // the data range could be set by the user though ``start``
    // option. It can be fecthed from the table when the start
    // is not specified.
    //
    getKeySpan: function() {
      var max_col, min_col, max_tmpl, min_tmpl;

      if (this.options.is_time){
        max_tmpl = "date_part('epoch', max({column}))";
        min_tmpl = "date_part('epoch', min({column}))";
      } else {
        max_tmpl = "max({0})";
        min_tmpl = "min({0})";
      }

      max_col = format(max_tmpl, { column: this.options.column });
      min_col = format(min_tmpl, { column: this.options.column });

      var sql = format("SELECT st_xmax(st_envelope(st_collect(the_geom))) xmax,st_ymax(st_envelope(st_collect(the_geom))) ymax, st_xmin(st_envelope(st_collect(the_geom))) xmin, st_ymin(st_envelope(st_collect(the_geom))) ymin, {max_col} max, {min_col} min FROM {table}", {
        max_col: max_col,
        min_col: min_col,
        table: this.options.table
      })

      var self = this;
      this.sql(sql, function(data) {
        //TODO: manage bounds
        data = data.rows[0];
        self.options.start = data.min;
        self.options.step = (data.max - data.min)/self.options.steps;
        self._setReady(true);
      }, { parseJSON: true });
    }

  };

  torque.providers.json = json


})(typeof exports === "undefined" ? this : exports);
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
    this.options = options;
  };

  json.prototype = {

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
        if(self.options.cummulative) {
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
      var renderData = new Uint8Array(dates);
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

    /**
     * `coord` object like {x : tilex, y: tiley } 
     * `zoom` quadtree zoom level
     */
    getTileData: function(coord, zoom, callback) {
      var template = this.url();
      template = template
        .replace('{x}', coord.x)
        .replace('{y}', coord.y)
        .replace('{z}', zoom);

      var self = this;
      torque.net.get(template, function (data) {
        var processed = null;
        
        try {
          var rows = JSON.parse(data.responseText).rows;
          processed = self.proccessTile(rows, coord, zoom);
        } catch(e) {
          console.log(e.stack);
          console.error("problem parsing JSON on ", coord, zoom);
        }

        if(processed) {
          callback(processed);
        }

      });
    }

  };

  torque.providers.JsonArray = json


})(typeof exports === "undefined" ? this : exports);
(function(exports) {
  var torque = exports.torque = exports.torque || {};
  torque.net = torque.net || {};

  function get(url, callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (req.readyState == 4){
        if (req.status == 200){
          callback(req);
        } else {
          callback(null);
        }
      }
    };

    req.open("GET", url, true);
    //req.responseType = 'arraybuffer';
    req.send(null)
    return req;
  }

  torque.net = {
    get: get
  };

})(typeof exports === "undefined" ? this : exports);
(function(exports) {

  exports.torque = exports.torque || {};

  var TAU = Math.PI*2;
  function renderPoint(ctx, st) {
    ctx.fillStyle = st.fillStyle;
    ctx.strokStyle = st.strokStyle;
    var pixel_size = st['point-radius']
    // render a circle
    ctx.beginPath();
    ctx.arc(0, 0, pixel_size, 0, TAU, true, true);
    ctx.closePath();
    if(st.fillStyle) {
      if(st.fillOpacity) {
        ctx.globalAlpha = st.fillOpacity;
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    if(st.strokeStyle) {
      if(st.strokeOpacity) {
        ctx.globalAlpha = st.strokeOpacity;
      }
      if(st.lineWidth) {
        ctx.lineWidth = st.lineWidth;
      }
      ctx.strokeStyle = st.strokeStyle;
      ctx.stroke();
    }
  }

  exports.torque.cartocss = exports.torque.cartocss|| {};
  exports.torque.cartocss.renderPoint = renderPoint;

})(typeof exports === "undefined" ? this : exports);
(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};

  var TAU = Math.PI * 2;
  var DEFAULT_CARTOCSS = [
    '#layer {',
    '  marker-fill: #662506;',
    '  marker-width: 3;',
    '  [value > 1] { marker-fill: #FEE391; }',
    '  [value > 2] { marker-fill: #FEC44F; }',
    '  [value > 3] { marker-fill: #FE9929; }',
    '  [value > 4] { marker-fill: #EC7014; }',
    '  [value > 5] { marker-fill: #CC4C02; }',
    '  [value > 6] { marker-fill: #993404; }',
    '  [value > 7] { marker-fill: #662506; }',
    '}'
  ].join('\n');

  //
  // this renderer just render points depending of the value
  //
  function PointRenderer(canvas, options) {
    if (!canvas) {
      throw new Error("canvas can't be undefined");
    }
    this.options = options;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._sprites = {};
    this.setCartoCSS(this.options.cartocss || DEFAULT_CARTOCSS);
  }

  PointRenderer.prototype = {

    setCanvas: function(canvas) {
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
    },

    //
    // sets the cartocss style to render stuff
    //
    setCartoCSS: function(cartocss) {
      // clean sprites
      this._sprites = {};
      this._cartoCssStyle = new carto.RendererJS().render(cartocss);
      if(this._cartoCssStyle.getLayers().length > 1) {
        throw new Error("only one CartoCSS layer is supported");
      }
      this._shader = this._cartoCssStyle.getLayers()[0];

    },

    //
    // generate sprite based on cartocss style
    //
    generateSprite: function(value, tile) {
      var st = this._shader.getStyle('canvas-2d', {
        value: value
      }, { zoom: tile.zoom });

      var pointSize = st['point-radius'];
      if(!pointSize) {
        throw new Error("marker-width property should be set");
      }
      var canvasSize = pointSize*2;

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      ctx.width = canvas.width = canvasSize;
      ctx.height = canvas.height = canvasSize;
      ctx.translate(pointSize, pointSize);
      torque.cartocss.renderPoint(ctx, st);
      return canvas;
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    renderTile: function(tile, key) {
      if(!this._canvas) return;
      //var prof = Profiler.get('render').start();
      var ctx = this._ctx;
      var res = this.options.resolution;
      var sprites = this._sprites;
      var activePixels = tile.timeCount[key];
      if(this.options.blendmode) {
        ctx.globalCompositeOperation = this.options.blendmode;
      }
      if(activePixels) {
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if(c) {
           var sp = sprites[c];
           if(!sp) {
             sp = sprites[c] = this.generateSprite(c, tile);
           }
           var x = tile.x[posIdx] - (sp.width >> 1);
           var y = tile.y[posIdx] - (sp.height >> 1);
           ctx.drawImage(sp, x*res, 255 - y*res);
          }
        }
      }
      //prof.end();
    }
  };


  // exports public api
  exports.torque.renderer.Point = PointRenderer;

})(typeof exports === "undefined" ? this : exports);
(function(exports) {
  exports.torque = exports.torque || {};
  exports.torque.renderer = exports.torque.renderer || {};


  function palette(slots) {
    var conds = []
    for(var i = slots.length - 1; i >= 0; --i) {
      conds.push("if( x >= " + slots[i] + ") return " + (i + 1)  + ";");
    }
    conds.push("return 0;");
    var body = conds.join('\n');
    return new Function("x", body);
  }


  var pal = palette([10, 100, 1000, 10000, 100000]);
  console.log(pal(0), pal(11));

  var TAU = Math.PI * 2;
  var DEFAULT_COLORS = [
  "#FFFF00", "#FFCC00", "#FF9900", "#FF6600", "#FF3300", "#CC0000"
  /*
        "#FEE391",
        "#FEC44F",
        "#FE9929",
        "#EC7014",
        "#CC4C02",
        "#993404",
        "#662506"
        */
  ];

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      255
    ] : [0, 0, 0, 0];
  }

  //
  // this renderer just render points depending of the value
  // 
  function RectanbleRenderer(canvas, options) {
    this.options = options;
    this.setCanvas(canvas);
    this._colors = DEFAULT_COLORS;//DEFAULT_COLORS.map(hexToRgb);
  }

  RectanbleRenderer.prototype = {

    setCanvas: function(canvas) {
      if(!canvas) return;
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
    },

    accumulate: function(tile, keys) {
      var x, y, posIdx, p, k, key, activePixels, pixelIndex;
      var res = this.options.resolution;
      var s = 256/res;
      var accum = new Float32Array(s*s);

      if(typeof(keys) !== 'object') {
        keys = [keys];
      }

      for(k = 0; k < keys.length; ++k) {
        key = keys[k];
        activePixels = tile.timeCount[key];
        if(activePixels) {
          pixelIndex = tile.timeIndex[key];
          for(p = 0; p < activePixels; ++p) {
            posIdx = tile.renderDataPos[pixelIndex + p];
            x = tile.x[posIdx]/res;
            y = tile.y[posIdx]/res;
            accum[x*s + y] += tile.renderData[pixelIndex + p];
          }
        }
      }
      return accum;
    },

    renderTileAccum: function(accum, px, py) {
      var res = this.options.resolution;
      var ctx = this._ctx;
      var s = (256/res) | 0;
      var s2 = s*s;
      var colors = this._colors;
      for(var i = 0; i < s2; ++i) {
        var xy = i;
        var value = accum[i];
        if(value) {
          var x = (xy/s) | 0;
          var y = xy % s;
          var color = colors[pal(value)];//Math.min(value|0, colors.length - 1)];
          ctx.fillStyle = color;
          ctx.fillRect(x * res, 256 - res - y * res, res, res);
        }
      }
    },

    //
    // renders a tile in the canvas for key defined in 
    // the torque tile
    //
    renderTile: function(tile, key, px, py) {
      if(!this._canvas) return;

      var res = this.options.resolution;

      //var prof = Profiler.get('render').start();
      var ctx = this._ctx;
      var colors = this._colors;
      var activepixels = tile.timeCount[key];
      if(activepixels) {
        var w = this._canvas.width;
        var h = this._canvas.height;
        //var imageData = ctx.getImageData(0, 0, w, h);
        //var pixels = imageData.data;
        var pixelIndex = tile.timeIndex[key];
        for(var p = 0; p < activePixels; ++p) {
          var posIdx = tile.renderDataPos[pixelIndex + p];
          var c = tile.renderData[pixelIndex + p];
          if(c) {
           var color = colors[Math.min(c, colors.length - 1)];
           var x = tile.x[posIdx];// + px;
           var y = tile.y[posIdx]; //+ py;

           ctx.fillStyle = color;
           ctx.fillRect(x, y, res, res);
           /*

           for(var xx = 0; xx < res; ++xx) {
            for(var yy = 0; yy < res; ++yy) {
              var idx = 4*((x+xx) + w*(y + yy));
              pixels[idx + 0] = color[0];
              pixels[idx + 1] = color[1];
              pixels[idx + 2] = color[2];
              pixels[idx + 3] = color[3];
            }
           }
           */
          }
        }
        //ctx.putImageData(imageData, 0, 0);
      }
      //prof.end();
    }
  };


  // exports public api
  exports.torque.renderer.Rectangle = RectanbleRenderer;

})(typeof exports === "undefined" ? this : exports);
/**
 * @license
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Extends OverlayView to provide a canvas "Layer".
 * @author Brendan Kenny
 */

/**
 * A map layer that provides a canvas over the slippy map and a callback
 * system for efficient animation. Requires canvas and CSS 2D transform
 * support.
 * @constructor
 * @extends google.maps.OverlayView
 * @param {CanvasLayerOptions=} opt_options Options to set in this CanvasLayer.
 */

if(typeof(google) !== 'undefined' && typeof(google.maps) !== 'undefined') {
function CanvasLayer(opt_options) {
  /**
   * If true, canvas is in a map pane and the OverlayView is fully functional.
   * See google.maps.OverlayView.onAdd for more information.
   * @type {boolean}
   * @private
   */
  this.isAdded_ = false;

  /**
   * If true, each update will immediately schedule the next.
   * @type {boolean}
   * @private
   */
  this.isAnimated_ = false;

  /**
   * The name of the MapPane in which this layer will be displayed.
   * @type {string}
   * @private
   */
  this.paneName_ = CanvasLayer.DEFAULT_PANE_NAME_;

  /**
   * A user-supplied function called whenever an update is required. Null or
   * undefined if a callback is not provided.
   * @type {?function=}
   * @private
   */
  this.updateHandler_ = null;

  /**
   * A user-supplied function called whenever an update is required and the
   * map has been resized since the last update. Null or undefined if a
   * callback is not provided.
   * @type {?function}
   * @private
   */
  this.resizeHandler_ = null;

  /**
   * The LatLng coordinate of the top left of the current view of the map. Will
   * be null when this.isAdded_ is false.
   * @type {google.maps.LatLng}
   * @private
   */
  this.topLeft_ = null;

  /**
   * The map-pan event listener. Will be null when this.isAdded_ is false. Will
   * be null when this.isAdded_ is false.
   * @type {?function}
   * @private
   */
  this.centerListener_ = null;

  /**
   * The map-resize event listener. Will be null when this.isAdded_ is false.
   * @type {?function}
   * @private
   */
  this.resizeListener_ = null;

  /**
   * If true, the map size has changed and this.resizeHandler_ must be called
   * on the next update.
   * @type {boolean}
   * @private
   */
  this.needsResize_ = true;

  /**
   * A browser-defined id for the currently requested callback. Null when no
   * callback is queued.
   * @type {?number}
   * @private
   */
  this.requestAnimationFrameId_ = null;

  var canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.pointerEvents = 'none';

  /**
   * The canvas element.
   * @type {!HTMLCanvasElement}
   */
  this.canvas = canvas;

  /**
   * Simple bind for functions with no args for bind-less browsers (Safari).
   * @param {Object} thisArg The this value used for the target function.
   * @param {function} func The function to be bound.
   */
  function simpleBindShim(thisArg, func) {
    return function() { func.apply(thisArg); };
  }

  /**
   * A reference to this.repositionCanvas_ with this bound as its this value.
   * @type {function}
   * @private
   */
  this.repositionFunction_ = simpleBindShim(this, this.repositionCanvas_);

  /**
   * A reference to this.resize_ with this bound as its this value.
   * @type {function}
   * @private
   */
  this.resizeFunction_ = simpleBindShim(this, this.resize_);

  /**
   * A reference to this.update_ with this bound as its this value.
   * @type {function}
   * @private
   */
  this.requestUpdateFunction_ = simpleBindShim(this, this.update_);

  // set provided options, if any
  if (opt_options) {
    this.setOptions(opt_options);
  }
}

CanvasLayer.prototype = new google.maps.OverlayView();

/**
 * The default MapPane to contain the canvas.
 * @type {string}
 * @const
 * @private
 */
CanvasLayer.DEFAULT_PANE_NAME_ = 'overlayLayer';

/**
 * Transform CSS property name, with vendor prefix if required. If browser
 * does not support transforms, property will be ignored.
 * @type {string}
 * @const
 * @private
 */
CanvasLayer.CSS_TRANSFORM_ = (function() {
  var div = document.createElement('div');
  var transformProps = [
    'transform',
    'WebkitTransform',
    'MozTransform',
    'OTransform',
    'msTransform'
  ];
  for (var i = 0; i < transformProps.length; i++) {
    var prop = transformProps[i];
    if (div.style[prop] !== undefined) {
      return prop;
    }
  }

  // return unprefixed version by default
  return transformProps[0];
})();

/**
 * The requestAnimationFrame function, with vendor-prefixed or setTimeout-based
 * fallbacks. MUST be called with window as thisArg.
 * @type {function}
 * @param {function} callback The function to add to the frame request queue.
 * @return {number} The browser-defined id for the requested callback.
 * @private
 */
CanvasLayer.prototype.requestAnimFrame_ =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function(callback) {
      return window.setTimeout(callback, 1000 / 60);
    };

/**
 * The cancelAnimationFrame function, with vendor-prefixed fallback. Does not
 * fall back to clearTimeout as some platforms implement requestAnimationFrame
 * but not cancelAnimationFrame, and the cost is an extra frame on onRemove.
 * MUST be called with window as thisArg.
 * @type {function}
 * @param {number=} requestId The id of the frame request to cancel.
 * @private
 */
CanvasLayer.prototype.cancelAnimFrame_ =
    window.cancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.oCancelAnimationFrame ||
    window.msCancelAnimationFrame ||
    function(requestId) {};

/**
 * Sets any options provided. See CanvasLayerOptions for more information.
 * @param {CanvasLayerOptions} options The options to set.
 */
CanvasLayer.prototype.setOptions = function(options) {
  if (options.animate !== undefined) {
    this.setAnimate(options.animate);
  }

  if (options.paneName !== undefined) {
    this.setPane(options.paneName);
  }

  if (options.updateHandler !== undefined) {
    this.setUpdateHandler(options.updateHandler);
  }

  if (options.resizeHandler !== undefined) {
    this.setResizeHandler(options.resizeHandler);
  }

  if (options.map !== undefined) {
    this.setMap(options.map);
  }
};

/**
 * Set the animated state of the layer. If true, updateHandler will be called
 * repeatedly, once per frame. If false, updateHandler will only be called when
 * a map property changes that could require the canvas content to be redrawn.
 * @param {boolean} animate Whether the canvas is animated.
 */
CanvasLayer.prototype.setAnimate = function(animate) {
  this.isAnimated_ = !!animate;

  if (this.isAnimated_) {
    this.scheduleUpdate();
  }
};

/**
 * @return {boolean} Whether the canvas is animated.
 */
CanvasLayer.prototype.isAnimated = function() {
  return this.isAnimated_;
};

/**
 * Set the MapPane in which this layer will be displayed, by name. See
 * {@code google.maps.MapPanes} for the panes available.
 * @param {string} paneName The name of the desired MapPane.
 */
CanvasLayer.prototype.setPaneName = function(paneName) {
  this.paneName_ = paneName;

  this.setPane_();
};

/**
 * @return {string} The name of the current container pane.
 */
CanvasLayer.prototype.getPaneName = function() {
  return this.paneName_;
};

/**
 * Adds the canvas to the specified container pane. Since this is guaranteed to
 * execute only after onAdd is called, this is when paneName's existence is
 * checked (and an error is thrown if it doesn't exist).
 * @private
 */
CanvasLayer.prototype.setPane_ = function() {
  if (!this.isAdded_) {
    return;
  }

  // onAdd has been called, so panes can be used
  var panes = this.getPanes();
  if (!panes[this.paneName_]) {
    throw new Error('"' + this.paneName_ + '" is not a valid MapPane name.');
  }

  panes[this.paneName_].appendChild(this.canvas);
};

/**
 * Set a function that will be called whenever the parent map and the overlay's
 * canvas have been resized. If opt_resizeHandler is null or unspecified, any
 * existing callback is removed.
 * @param {?function=} opt_resizeHandler The resize callback function.
 */
CanvasLayer.prototype.setResizeHandler = function(opt_resizeHandler) {
  this.resizeHandler_ = opt_resizeHandler;
};

/**
 * Set a function that will be called when a repaint of the canvas is required.
 * If opt_updateHandler is null or unspecified, any existing callback is
 * removed.
 * @param {?function=} opt_updateHandler The update callback function.
 */
CanvasLayer.prototype.setUpdateHandler = function(opt_updateHandler) {
  this.updateHandler_ = opt_updateHandler;
};

/**
 * @inheritDoc
 */
CanvasLayer.prototype.onAdd = function() {
  if (this.isAdded_) {
    return;
  }

  this.isAdded_ = true;
  this.setPane_();

  this.resizeListener_ = google.maps.event.addListener(this.getMap(),
      'resize', this.resizeFunction_);
  this.centerListener_ = google.maps.event.addListener(this.getMap(),
      'center_changed', this.repositionFunction_);

  this.resize_();
  this.repositionCanvas_();
};

/**
 * @inheritDoc
 */
CanvasLayer.prototype.onRemove = function() {
  if (!this.isAdded_) {
    return;
  }

  this.isAdded_ = false;
  this.topLeft_ = null;

  // remove canvas and listeners for pan and resize from map
  this.canvas.parentElement.removeChild(this.canvas);
  if (this.centerListener_) {
    google.maps.event.removeListener(this.centerListener_);
    this.centerListener_ = null;
  }
  if (this.resizeListener_) {
    google.maps.event.removeListener(this.resizeListener_);
    this.resizeListener_ = null;
  }

  // cease canvas update callbacks
  if (this.requestAnimationFrameId_) {
    this.cancelAnimFrame_.call(window, this.requestAnimationFrameId_);
    this.requestAnimationFrameId_ = null;
  }
};

/**
 * The internal callback for resize events that resizes the canvas to keep the
 * map properly covered.
 * @private
 */
CanvasLayer.prototype.resize_ = function() {
  // TODO(bckenny): it's common to use a smaller canvas but use CSS to scale
  // what is drawn by the browser to save on fill rate. Add an option to do
  // this.

  if (!this.isAdded_) {
    return;
  }

  var map = this.getMap();
  var width = map.getDiv().offsetWidth;
  var height = map.getDiv().offsetHeight;
  var oldWidth = this.canvas.width;
  var oldHeight = this.canvas.height;

  // resizing may allocate a new back buffer, so do so conservatively
  if (oldWidth !== width || oldHeight !== height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.needsResize_ = true;
    this.scheduleUpdate();
  }
};

/**
 * @inheritDoc
 */
CanvasLayer.prototype.draw = function() {
  this.repositionCanvas_();
};

/**
 * Internal callback for map view changes. Since the Maps API moves the overlay
 * along with the map, this function calculates the opposite translation to
 * keep the canvas in place.
 * @private
 */
CanvasLayer.prototype.repositionCanvas_ = function() {
  // TODO(bckenny): *should* only be executed on RAF, but in current browsers
  //     this causes noticeable hitches in map and overlay relative
  //     positioning.

  var bounds = this.getMap().getBounds();
  this.topLeft_ = new google.maps.LatLng(bounds.getNorthEast().lat(),
      bounds.getSouthWest().lng());

  // canvas position relative to draggable map's conatainer depends on
  // overlayView's projection, not the map's
  var projection = this.getProjection();
  var divTopLeft = projection.fromLatLngToDivPixel(this.topLeft_);
  this.canvas.style[CanvasLayer.CSS_TRANSFORM_] = 'translate(' +
      Math.round(divTopLeft.x) + 'px,' + Math.round(divTopLeft.y) + 'px)';

  this.scheduleUpdate();
};

/**
 * Internal callback that serves as main animation scheduler via
 * requestAnimationFrame. Calls resize and update callbacks if set, and
 * schedules the next frame if overlay is animated.
 * @private
 */
CanvasLayer.prototype.update_ = function() {
  this.requestAnimationFrameId_ = null;

  if (!this.isAdded_) {
    return;
  }

  if (this.isAnimated_) {
    this.scheduleUpdate();
  }

  if (this.needsResize_ && this.resizeHandler_) {
    this.needsResize_ = false;
    this.resizeHandler_();
  }

  if (this.updateHandler_) {
    this.updateHandler_();
  }
};

/**
 * A convenience method to get the current LatLng coordinate of the top left of
 * the current view of the map.
 * @return {google.maps.LatLng} The top left coordinate.
 */
CanvasLayer.prototype.getTopLeft = function() {
  return this.topLeft_;
};

/**
 * Schedule a requestAnimationFrame callback to updateHandler. If one is
 * already scheduled, there is no effect.
 */
CanvasLayer.prototype.scheduleUpdate = function() {
  if (this.isAdded_ && !this.requestAnimationFrameId_) {
    this.requestAnimationFrameId_ =
        this.requestAnimFrame_.call(window, this.requestUpdateFunction_);
  }
};
}
/**
 * full canvas layer implementation for Leaflet
 */

L.CanvasLayer = L.Class.extend({

  includes: [L.Mixin.Events, L.Mixin.TileLoader],

  options: {
      minZoom: 0,
      maxZoom: 28,
      tileSize: 256,
      subdomains: 'abc',
      errorTileUrl: '',
      attribution: '',
      zoomOffset: 0,
      opacity: 1,
      unloadInvisibleTiles: L.Browser.mobile,
      updateWhenIdle: L.Browser.mobile,
      tileLoader: false // installs tile loading events
  },

  initialize: function (options) { 
    var self = this;
    //this.project = this._project.bind(this);
    this.render = this.render.bind(this);
    L.Util.setOptions(this, options);
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    this.requestAnimationFrame = requestAnimationFrame;
  },

  onAdd: function (map) {
    this._map = map;

    this._staticPane = map._createPane('leaflet-tile-pane', map._container);
    this._staticPane.appendChild(this._canvas);

    map.on({
      'viewreset': this._reset
      //'move': this._render
    }, this);

    map.on('move', this._render, this);//function(){ console.log("a"); }, this);

    if(this.options.tileLoader) {
      this._initTileLoader();
    }

    this._reset();
  },

  getCanvas: function() {
    return this._canvas;
  },

  draw: function() {
    return this._reset();
  },

  onRemove: function (map) {
    map._container.removeChild(this._staticPane);
    map.off({
        'viewreset': this._reset,
        'move': this._render
    }, this);
  },

  addTo: function (map) {
    map.addLayer(this);
    return this;
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },

  bringToFront: function () {
    return this;
  },

  bringToBack: function () {
    return this;
  },

  _reset: function () {
    var size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this.onResize();
    this._render();
  },

  /*
  _project: function(x) {
    var point = this._map.latLngToLayerPoint(new L.LatLng(x[1], x[0]));
    return [point.x, point.y];
  },
  */

  _updateOpacity: function () { },

  _render: function() {
    this.requestAnimationFrame.call(window, this.render);
  },

  redraw: function() {
    this._render();
  },

  onResize: function() {
  },

  render: function() {
    throw new Error('render function should be implemented');
  }

});

L.Mixin.TileLoader = {

  _initTileLoader: function() {
    this._tiles = {}
    this._tilesToLoad = 0;
    this._map.on({
        'moveend': this._updateTiles
    }, this);
    this._updateTiles();
  },

  _removeTileLoader: function() {
    map.off({
        'moveend': this._updateTiles
    }, this);
    //TODO: remove tiles
  },

  _updateTiles: function () {

      if (!this._map) { return; }

      var bounds = this._map.getPixelBounds(),
          zoom = this._map.getZoom(),
          tileSize = this.options.tileSize;

      if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
          return;
      }

      var nwTilePoint = new L.Point(
              Math.floor(bounds.min.x / tileSize),
              Math.floor(bounds.min.y / tileSize)),

          seTilePoint = new L.Point(
              Math.floor(bounds.max.x / tileSize),
              Math.floor(bounds.max.y / tileSize)),

          tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

      this._addTilesFromCenterOut(tileBounds);
      this._removeOtherTiles(tileBounds);
  },

  _removeOtherTiles: function (bounds) {
      var kArr, x, y, key;

      for (key in this._tiles) {
          if (this._tiles.hasOwnProperty(key)) {
              kArr = key.split(':');
              x = parseInt(kArr[0], 10);
              y = parseInt(kArr[1], 10);

              // remove tile if it's out of bounds
              if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
                  this._removeTile(key);
              }
          }
      }
  },

  _removeTile: function (key) {
      this.fire('tileRemoved', this._tiles[key]);
      delete this._tiles[key];
  },

  _tileShouldBeLoaded: function (tilePoint) {
      return !((tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom) in this._tiles);
  },

  _tileLoaded: function(tilePoint, tileData) {
    this._tilesToLoad--;
    this._tiles[tilePoint.x + ':' + tilePoint.y + ':' + tilePoint.zoom] = tileData;
    if(this._tilesToLoad === 0) {
      this.fire("tilesLoaded");
    }
  },

  getTilePos: function (tilePoint) {
    tilePoint = new L.Point(tilePoint.x, tilePoint.y);
    var origin = this._map._getNewTopLeftPoint(this._map.getCenter()),
        tileSize = this.options.tileSize;

    return tilePoint.multiplyBy(tileSize).subtract(origin);
  },

  _addTilesFromCenterOut: function (bounds) {
      var queue = [],
          center = bounds.getCenter(),
          zoom = this._map.getZoom();

      var j, i, point;

      for (j = bounds.min.y; j <= bounds.max.y; j++) {
          for (i = bounds.min.x; i <= bounds.max.x; i++) {
              point = new L.Point(i, j);
              point.zoom =  zoom;

              if (this._tileShouldBeLoaded(point)) {
                  queue.push(point);
              }
          }
      }

      var tilesToLoad = queue.length;

      if (tilesToLoad === 0) { return; }

      // load tiles in order of their distance to center
      queue.sort(function (a, b) {
          return a.distanceTo(center) - b.distanceTo(center);
      });

      this._tilesToLoad += tilesToLoad;

      for (i = 0; i < tilesToLoad; i++) {
        this.fire('tileAdded', queue[i]);
      }

  }
}
/**
 * torque layer
 */
L.TorqueLayer = L.CanvasLayer.extend({

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.jsonarray
  },

  renderers: {
    'point': torque.renderer.Point,
    'pixel': torque.renderer.Rectangle
  },

  initialize: function(options) {
    var self = this;
    options.tileLoader = true;
    this.key = 0;

    L.CanvasLayer.prototype.initialize.call(this, options);

    this.options.renderer = this.options.renderer || 'point';

    this.provider = new this.providers[this.options.provider](options);
    this.renderer = new this.renderers[this.options.renderer](this.getCanvas(), options);

    // for each tile shown on the map request the data
    this.on('tileAdded', function(t) {
      var tileData = this.provider.getTileData(t, t.zoom, function(tileData) {
        self._tileLoaded(t, tileData);
        self.redraw();
      });
    }, this);
  },

  /**
   * render the selectef key
   * don't call this function directly, it's called by
   * requestAnimationFrame. Use redraw to refresh it
   */
  render: function() {
    var t, tile, pos;
    var canvas = this.getCanvas();
    canvas.width = canvas.width;
    var ctx = canvas.getContext('2d');

    if(typeof this.key === 'number') {
      // renders only a "frame"
      for(t in this._tiles) {
        tile = this._tiles[t];
        pos = this.getTilePos(tile.coord);
        ctx.setTransform(1, 0, 0, 1, pos.x, pos.y);
        this.renderer.renderTile(tile, this.key, pos.x, pos.y);
      }
    } else {
      // accumulate more than one
      for(t in this._tiles) {
        tile = this._tiles[t];
        pos = this.getTilePos(tile.coord);
        var accum = this.renderer.accumulate(tile, this.key);
        ctx.setTransform(1, 0, 0, 1, pos.x, pos.y);
        this.renderer.renderTileAccum(accum, 0, 0);
      }
    }

  },

  /**
   * set key to be shown. If it's a single value
   * it renders directly, if it's an array it renders
   * accumulated
   */
  setKey: function(key) {
    this.key = key;
    this.redraw();
  }

});


L.TiledTorqueLayer = L.TileLayer.Canvas.extend({

  providers: {
    'sql_api': torque.providers.json,
    'url_template': torque.providers.JsonArray
  },

  renderers: {
    'point': torque.renderer.Point,
    'pixel': torque.renderer.Rectangle
  },

  initialize: function(options) {
    var self = this;
    this.key = 0;

    options.async = true;
    L.TileLayer.Canvas.prototype.initialize.call(this, options);


    this.options.renderer = this.options.renderer || 'pixel';

    this.provider = new this.providers[this.options.provider](options);
    this.renderer = new this.renderers[this.options.renderer](null, options);

  },

  _tileLoaded: function(tile, tilePoint, tileData) {
    this._tiles[tilePoint.x + ':' + tilePoint.y].data = tileData;
    this.drawTile(tile);
  },

  _loadTile: function(tile, tilePoint) {
    var self = this;
    L.TileLayer.Canvas.prototype._loadTile.apply(this, arguments);
    this.provider.getTileData(tilePoint, this._map.getZoom(), function(tileData) {
      self._tileLoaded(tile, tilePoint, tileData);
      L.DomUtil.addClass(tile, 'leaflet-tile-loaded');
    });
  },

  drawTile: function (tile) {
    var canvas = tile;
    if(!tile.data) return;
    canvas.width = canvas.width;

    this.renderer.setCanvas(canvas);

    var accum = this.renderer.accumulate(tile.data, this.key);
    this.renderer.renderTileAccum(accum, 0, 0);
  },

  setKey: function(key) {
    this.key = key;
    this.redraw();
  }

});

