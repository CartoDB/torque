var d3 = require('d3');
var jenks = require('turf-jenks');

function TorqueDataSource (tiles) {
  this.tiles = tiles
}

module.exports = TorqueDataSource

TorqueDataSource.prototype.getName = function () {
  return 'TorqueDataSource'
}

TorqueDataSource.prototype.getRamp = function (column, bins, method, callback) {
  var ramp = []
  var error = null
  var values = Object.keys(this.tiles).map(function (t) {
    return this.tiles[t].renderData;
  }.bind(this)).reduce(function (p,c,i) {
    for(var i = 0; i<c.length; i++) {
      p.push(c[i]);
    }
    return p;
  },[]);
  var extent = d3.extent(values);
  if (!method || method === 'equal' || method === 'jenks') {
    var scale = d3.scale.linear().domain([0, bins]).range(extent)
    ramp = d3.range(bins).map(scale)
  } else if (method === 'quantiles') {
    ramp = d3.scale.quantile().range(d3.range(bins)).domain(values).quantiles()
  } else if (method === 'headstails') {
    var sortedValues = values.sort(function(a, b) {
      return a - b;
    });
    if (sortedValues.length < bins) {
      error = 'Number of bins should be lower than total number of rows'
    } else if (sortedValues.length === bins) {
      ramp = sortedValues;
    } else {
      var mean = d3.mean(sortedValues);
      ramp.push(mean);
      for (var i = 1; i < bins; i++) {
        ramp.push(d3.mean(sortedValues.filter(function (v) {
          return v > ramp[length - 1];
        })));
      }
    }
  } else {
    error = new Error('Quantification method ' + method + ' is not supported')
  }
  callback(error, ramp)
}