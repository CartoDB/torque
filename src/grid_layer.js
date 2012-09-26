/*
 ====================
 this class renders deforestation data in a given time
 ====================
*/


function TimePlayer(min_date, end, step, options) {
    this.time = 0;
    this.step = step;
    this.CAP_UNIT = end;
    this.MIN_DATE = min_date;
    this.MAX_UNITS = options.steps+2;
    this.MAX_VALUE = 0;
    this.BASE_UNIT = 0;
    this.canvas_setup = this.get_time_data;
    this.render = this.render_time;
    this.cells = [];
    this.table = options.table;
    this.user = options.user;
    this.t_column = options.column;
    this.resolution = options.resolution;
    this.countby = options.countby
    //this.base_url = 'http://sql.wri-01.cartodb.com/api/v2/sql';
    this.base_url = 'http://'+this.user+'.cartodb.com/api/v2/sql';
    this.options = options;
}

TimePlayer.prototype = new CanvasTileLayer();

/**
 * change time, t is the month (integer)
 */
TimePlayer.prototype.set_time = function(t) {
    if(this.time != (t>>0)) {
        this.time = t;
        this.redraw();
    }
};
TimePlayer.prototype.reset_max_value = function() {
    this.MAX_VALUE = 0;
};
/**
 * change table where the data is choosen
 */
TimePlayer.prototype.set_table = function(table, size) {
  if(this.table === table) {
      return; // nothing to do
  }
  this.table = table;
  this.pixel_size = size;
  this.recreate();
  this.redraw();
};

/**
 * private
 */

// get data from cartodb
TimePlayer.prototype.sql = function(sql, callback) {
    var self = this;
    $.getJSON(this.base_url  + "?q=" + encodeURIComponent(sql) ,function(data){
        callback(data);
    });
};

var originShift = 2 * Math.PI* 6378137 / 2.0;
var initialResolution = 2 * Math.PI * 6378137 / 256.0;
function meterToPixels(mx, my, zoom) {
  var res = initialResolution / (1 << zoom);
  var px = (mx + originShift) / res;
  var py = (my + originShift) / res;
  return [px, py];
}

// precache data to render fast
TimePlayer.prototype.pre_cache_months = function(rows, coord, zoom) {
    var row;
    var xcoords;
    var ycoords;
    var values;
    if(typeof(ArrayBuffer) !== undefined) {
        xcoords = new Uint8Array(new ArrayBuffer(rows.length));
        ycoords = new Uint8Array(new ArrayBuffer(rows.length));
        values = new Uint8Array(new ArrayBuffer(rows.length*this.MAX_UNITS));// 256 months
    } else {
        // fallback
        xcoords = [];
        ycoords = [];
        values = [];
        // array buffer set by default to 0
        // fucking javascript arrays not
        for(var i = 0; i < rows.length*this.MAX_UNITS; ++i){
            values[i] = 0;
        }
    }
    // base tile x, y
    var tile_base_x = coord.x*256;
    var tile_base_y = coord.y*256;
    var total_pixels = 256 << zoom;
    for(var i in rows) {
      row = rows[i];
      pixels = meterToPixels(row.x, row.y, zoom);
      pixels[1] = total_pixels - pixels[1];
      xcoords[i] = pixels[0];
      ycoords[i] = pixels[1];
      var base_idx = i*this.MAX_UNITS;
      //def[row.sd[0]] = row.se[0];
      for(var j = 0; j < row.dates.length; ++j) {
        values[base_idx + row.dates[j]] = row.vals[j];
        if (row.vals[j] > this.MAX_VALUE) {
            this.MAX_VALUE = row.vals[j];
        }
          
      };
      if (this.options.cumulative){
          for(var j = 1; j < this.MAX_UNITS; ++j) {
            values[base_idx + j] += values[base_idx + j - 1];
            if (values[base_idx + j] > this.MAX_VALUE) {
                this.MAX_VALUE = values[base_idx + j];
            }
          }
      }
    }
    
    return {
        length: rows.length,
        xcoords: xcoords,
        ycoords: ycoords,
        values: values,
        size: 1 << (this.resolution*2)
    };
};

// get time data in json format
TimePlayer.prototype.get_time_data = function(tile, coord, zoom) {
    var self = this;

    if(!self.table) {
        return;
    }

    // get x, y for cells and sd, se for deforestation changes
    // sd contains the months
    // se contains the deforestation for each entry in sd
    // take se and sd as a matrix [se|sd]
    var numTiles = 1<<zoom;
    
    var sql =   "WITH hgrid AS ( "+ 
                "    SELECT CDB_RectangleGrid( "+ 
                "       CDB_XYZ_Extent({0}, {1}, {2}), ".format(coord.x, coord.y, zoom) + 
                "       CDB_XYZ_Resolution({0}) * {1}, ".format(zoom,this.resolution) + 
                "       CDB_XYZ_Resolution({0}) * {1} ".format(zoom,this.resolution) + 
                "    ) as cell "+ 
                " ) "+ 
                " SELECT  "+ 
                "    x, y, array_agg(c) vals, array_agg(d) dates "+ 
                " FROM ( "+ 
                "    SELECT "+ 
                "      st_xmax(hgrid.cell) x, st_ymax(hgrid.cell) y, " + 
                "      {0} c, floor((date_part('epoch',{1})- {2})/{3}) d ".format(this.countby, this.t_column, this.MIN_DATE, this.step) + 
                "    FROM "+ 
                "        hgrid, {0} i ".format(this.table) + 
                "    WHERE "+ 
                "        ST_Intersects(i.the_geom_webmercator, hgrid.cell) "+ 
                "    GROUP BY "+ 
                "        hgrid.cell, floor((date_part('epoch',{0})- {1})/{2})".format(this.t_column, this.MIN_DATE, this.step) + 
                " ) f GROUP BY x, y";
                
    var prof = Profiler.get('tile fetch');
    prof.start();
    this.sql(sql, function(data) {
        if (data.rows){
            prof.end();
            var p = Profiler.get('tile data cache');
            p.start();
            tile.cells = self.pre_cache_months(data.rows, coord, zoom);
            p.end();
            p = Profiler.get('tile render');
            p.start();
            self.redraw_tile(tile);
            p.end();
        }
    });
};
YO = 1;
TimePlayer.prototype.render_time = function(tile, coord, zoom) {
    var self = this;
    //var month = -this.BASE_UNIT + 1 + this.time>>0;
    //var month = Math.ceil(this.MAX_UNITS * (this.time - this.BASE_UNIT)/(this.CAP_UNIT-this.BASE_UNIT));
    var month = this.time;
    var w = tile.canvas.width;
    var h = tile.canvas.height;
    var ctx = tile.ctx;
    var i, x, y, cell, cells;
    cells = tile.cells;

    if(!cells || cells.length === 0) {
      return;
    }

    var colors = [
        //"#FFFFE5",
        //"#FFF7BC",
        "#FEE391",
        "#FEC44F",
        "#FE9929",
        "#EC7014",
        "#CC4C02",
        "#993404",
        "#662506"
    ];

    var fillStyle;
    
    //ctx.fillStyle = '#000';
    // clear canvas
    tile.canvas.width = w;
    var ci = 0;
    var cu = 0;
    ctx.strokeStyle = ctx.fillStyle = colors[cu];
    
    var xc = cells.xcoords;
    var yc = cells.ycoords;
    var vals = cells.values;
    var dz = 256 / Math.pow(2,zoom)
    
    // render cells
    //var data = ctx.getImageData(0, 0, w, h);
    //var pixels = data.data;
    var len = cells.length;
    var pixel_size = cells.size;
    var pixel_size = this.resolution ;
    var numTiles = 1 << zoom;
    
    for(i = 0; i < len; ++i) {
      //var idx = (4*(256*yc[i] + xc[i]))>>0;
      // set pixel by hand
      // faster than doing fill rect (below)
      if(cells.values[this.MAX_UNITS*i + month]) {
          ci = cells.values[this.MAX_UNITS*i + month] == 0 ? 0 : Math.floor((colors.length-1) * (Math.log(cells.values[this.MAX_UNITS*i + month])/Math.log(this.MAX_VALUE)));
          if (ci != cu) {
              cu = ci < colors.length? ci : cu;
              ctx.strokeStyle = ctx.fillStyle = colors[cu];
          }
          ctx.fillRect(xc[i] - Math.floor((pixel_size-1)/2), yc[i] - Math.floor((pixel_size-1)/2), pixel_size, pixel_size);
      }
    }
    //ctx.putImageData(data, 0, 0);
};


/**
 * String formatting for JavaScript.
 *
 * Usage:
 *
 *   "{0} is {1}".format("CartoDB", "epic!");
 *   // CartoDB is epic!
 *
 */
String.prototype.format = (function(i, safe, arg) {
  function format() {
      var str = this,
          len = arguments.length+1;

      for (i=0; i < len; arg = arguments[i++]) {
          safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
          str = str.replace(RegExp('\\{'+(i-1)+'\\}', 'g'), safe);
      }
      return str;
  }
  format.native = String.prototype.format;
  return format;
})();


// =================
// profiler
// =================

function Profiler() {}
Profiler.times = {};
Profiler.new_time = function(type, time) {
    var t = Profiler.times[type] = Profiler.times[type] || {
        max: 0,
        min: 10000000,
        avg: 0,
        total: 0,
        count: 0
    };

    t.max = Math.max(t.max, time);
    t.total += time;
    t.min = Math.min(t.min, time);
    ++t.count;
    t.avg = t.total/t.count;
};

Profiler.print_stats = function() {
    for(k in Profiler.times) {
        var t = Profiler.times[k];
        console.log(" === " + k + " === ");
        console.log(" max: " + t.max);
        console.log(" min: " + t.min);
        console.log(" avg: " + t.avg);
        console.log(" total: " + t.total);
    }
};

Profiler.get = function(type) {
    return {
        t0: null,
        start: function() { this.t0 = new Date().getTime(); },
        end: function() {
            if(this.t0 !== null) {
                Profiler.new_time(type, this.time = new Date().getTime() - this.t0);
                this.t0 = null;
            }
        }
    };
};


