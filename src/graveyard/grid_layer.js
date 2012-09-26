/*
 ====================
 this class renders deforestation data in a given time
 ====================
*/

var MAX_MONTHS = 128;
var BASE_MONTH = 71;

function TimePlayer(table,version,cloudfront_url) {
    this.time = 71;
    this.stored_time = 71;
    this.canvas_setup = this.get_time_data;
    this.render = this.render_time;
    this.cells = [];
    this.table = table;
    this._version = version;
    //this.base_url = 'http://sql.wri-01.cartodb.com/api/v2/sql';
    this.base_url = 'http://'+cloudfront_url+'/api/v2/sql';
    this.options = {};
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
TimePlayer.prototype.cache_time = function(t) {
    if (t) {
     this.stored_time = this.time;
    } else {
        return this.stored_time;
    }
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
 * change shown country
 * @param country country iso
 */
TimePlayer.prototype.set_country_iso = function(country) {
  this.country = country;
  this.recreate();
  this.redraw();
};


/**
 * private
 */

// get data from cartodb
TimePlayer.prototype.sql = function(sql, callback) {
    var self = this;
    $.getJSON(this.base_url  + "?q=" + encodeURIComponent(sql)+"&v="+this._version ,function(data){
        callback(data);
    });
};

// precache data to render fast
TimePlayer.prototype.pre_cache_months = function(rows, coord, zoom, zoom_diff) {
    var row;
    var xcoords;
    var ycoords;
    var deforestation;

    if(typeof(ArrayBuffer) !== undefined) {
        xcoords = new Uint8Array(new ArrayBuffer(rows.length));
        ycoords = new Uint8Array(new ArrayBuffer(rows.length));
        deforestation = new Uint8Array(new ArrayBuffer(rows.length*MAX_MONTHS));// 256 months
    } else {
        // fallback
        xcoords = [];
        ycoords = [];
        deforestation = [];
        // array buffer set by default to 0
        // fucking javascript arrays not
        for(var i = 0; i < rows.length*MAX_MONTHS; ++i){
            deforestation[i] = 0;
        }
    }

    // base tile x, y
    var tile_base_x = coord.x*256;
    var tile_base_y = coord.y*256;
    for(var i in rows) {
      row = rows[i];
      xcoords[i] = (row.x - tile_base_x) << zoom_diff;
      ycoords[i] = (row.y - tile_base_y) << zoom_diff;
      var base_idx = i*MAX_MONTHS;
      //def[row.sd[0]] = row.se[0];
      for(var j = 0; j < row.sd.length; ++j) {
          deforestation[base_idx + row.sd[j] - BASE_MONTH] = row.se[j];
      };
      for(var j = 1; j < MAX_MONTHS; ++j) {
        deforestation[base_idx + j] += deforestation[base_idx + j - 1];
      }
    }
    return {
        length: rows.length,
        xcoords: xcoords,
        ycoords: ycoords,
        deforestation: deforestation,
        size: 1 << zoom_diff
    };
    /*var row;
    var cells = [];
    var d;
    for(var i in rows) {
      row = rows[i];
      // filter the spikes in deforestation change


      var acumm_normalized = [];
      var cumm = row.cummulative;
      var max = this.pixel_size*this.pixel_size;
      var max_p = max >>4;

      for(d = 0, l = cumm.length; d < l; ++d) {
          //acumm_normalized[d] = (4*((cumm[d] - cumm[0])/(max - cumm[0]))) >> 0;
          if((cumm[d] - cumm[0]) > max_p) {
            acumm_normalized[d] = 1 + ((3*((cumm[d] - cumm[0])/(max - cumm[0]))) >> 0);
          } else {
            acumm_normalized[d] = 0;
          }
      }

      // steps!
      var def = row.time_series;
      var steps = row.time_series;
      var last = -10;

      steps[0] = 0;
      steps[1] = 0;
      for(d = 2; d < def.length; ++d) {
        if(def[d] > 0) {
          last = d;
        }
        steps[d] = 0;
        if(acumm_normalized[d] > 0) {
            steps[d] = Math.max(0, 3 - (d - last));
        }
      }

      //var buffer = new ArrayBuffer(row.);

      cells[i] = {
        x: row.upper_left_x,
        y: row.upper_left_y,
        w: row.cell_width,
        h: row.cell_width,
        months_accum: acumm_normalized,//row.cummulative,
        months: row.time_series
      }
    }
    return cells;
    */
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
    var sql = "SELECT x, y, sd, se FROM {0} WHERE".format(this.table);

    // inside the country
    //sql += " WHERE iso = '{0}'".format(self.country);

    // for current zoom
    // zoom + 8 is get because a tile in "zoom" zoom level is a pixel in "zoom + 8"
    // level. Remember, it is a quadtree, 1^8 = 256 and tile size is 256px
    var pixel_zoom = Math.min(zoom + 8, 16);
    //pixel_zoom = zoom + 8;
    sql += " z = {0} ".format(pixel_zoom);

    var zoom_diff =  zoom + 8 - pixel_zoom;
    var cx = (coord.x*256)>>zoom_diff;
    var cy = (coord.y*256)>>zoom_diff;
    var cx1 = ((coord.x + 1)*256)>>zoom_diff;
    var cy1 = ((coord.y + 1)*256)>>zoom_diff;
    // get cells inside the tile
    sql += " AND x >= {0} AND x < {1}".format(cx, cx1);
    sql += " AND y >= {0} AND y < {1}".format(cy, cy1);

    var prof = Profiler.get('tile fetch');
    prof.start();
    this.sql(sql, function(data) {
        prof.end();
        var p = Profiler.get('tile data cache');
        p.start();
        tile.cells = self.pre_cache_months(data.rows, coord, zoom, zoom_diff);
        p.end();
        p = Profiler.get('tile render');
        p.start();
        self.redraw_tile(tile);
        p.end();
    });
};

TimePlayer.prototype.render_time = function(tile, coord, zoom) {
    var self = this;
    var month = -BASE_MONTH + 1 + this.time>>0;
    var w = tile.canvas.width;
    var h = tile.canvas.height;
    var ctx = tile.ctx;
    var i, x, y, cell, cells;
    cells = tile.cells;

    if(!cells || cells.length === 0) {
      return;
    }

    var colors = [
        'rgba(84, 48, 59, 0.6)',
        'rgba(104, 48, 59, 0.6)',
        'rgba(170, 52, 51, 0.6)',
        'rgba(255, 51, 51, 0.9)'
    ];

    var fillStyle;


    //ctx.fillStyle = '#000';
    // clear canvas
    tile.canvas.width = w;
    ctx.fillStyle = '#F13689';
    
    var xc = cells.xcoords;
    var yc = cells.ycoords;
    var defor = cells.deforestation;
    var dz = 256 / Math.pow(2,zoom)
    
    // render cells
    //var data = ctx.getImageData(0, 0, w, h);
    //var pixels = data.data;
    var len = cells.length;
    var pixel_size = cells.size;
    for(i = 0; i < len; ++i) {
      var idx = (4*(256*yc[i] + xc[i]))>>0;
      // set pixel by hand
      // faster than doing fill rect (below)
      if(cells.deforestation[MAX_MONTHS*i + month]) {
          /*pixels[idx + 0] = 247;
          pixels[idx + 1] = 104;
          pixels[idx + 2] = 161;
          pixels[idx + 3] = 255;
          */
              
          ctx.fillRect(xc[i], yc[i], pixel_size, pixel_size);
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


