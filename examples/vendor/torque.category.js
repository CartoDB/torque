
// histogram widget for torque
// d3 based

function categoryChart() {
  var margin = {top: 0, right: 0, bottom: 20, left: 0},
      width = 960,
      height = 500;

  var histogram = d3.layout.histogram(),
      x = d3.scale.ordinal(),
      y = d3.scale.linear(),
      xAxis = d3.svg.axis().scale(x).orient("bottom").tickSize(6, 0);

  function chart(selection) {

    var colors = ['#0000b4','#0082ca','#0094ff','#0d4bcf','#0066AE','#074285','#00187B','#285964','#405F83','#416545','#4D7069','#6E9985','#7EBC89','#0283AF','#79BCBF','#99C19E'];

    selection.each(function(data) {
      // Compute the histogram.
      // data = histogram(data);

      // Update the x-scale.
      x   .domain(data.map(function(d) { return d[0]; }))
          .rangeRoundBands([0, width - margin.left - margin.right], .1);

      // Update the y-scale.
      y   .domain([])
          .range([height - margin.top - margin.bottom, 0]);

      colorScale = d3.scale.quantize()
						.domain([0,data.map(function(d){return d[0]}).length])
						.range(colors);

      // Select the svg element, if it exists.
      
      var svg = d3.select(this).selectAll("svg")
        .attr('class', 'torque-histogram')
        .data([data]);

      // Otherwise, create the skeletal chart.
      var gEnter = svg.enter().append("svg").append("g");
      gEnter.append("g").attr("class", "bars");
      gEnter.append("g").attr("class", "x axis");

      // Update the outer dimensions.
      svg .attr("width", width)
          .attr("height", height);

      // Update the inner dimensions.
      var g = svg.select("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Update the bars.
      var bar = svg.select(".bars").selectAll(".bar").data(data);
      bar.enter().append("rect").attr('class', 'bar');
      bar.exit().remove();
      bar .attr("width", x.rangeBand())
          .attr("x", function(d) { return x(d[0]); })
          .attr("y", function(d) { return y(d[1]); })
          .attr("height", function(d) { return y.range()[0] - y(d[1]); })
          .order();

      // Update the x-axis.
      g.select(".x.axis")
          .attr("transform", "translate(0," + y.range()[0] + ")")
          .call(xAxis);
    });
  }

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  // Expose the histogram's value, range and bins method.
  d3.rebind(chart, histogram, "value", "range", "bins");

  // Expose the x-axis' tickFormat method.
  d3.rebind(chart, xAxis, "tickFormat");

  return chart;
}

torque.widgets = torque.widgets || {}

/**
 * creates an histogram inside the element based on torque data
 * @id any d3 valid selector
 * @torqueLayer torque layer objecy
 * @returns histogram widget object
 */
torque.widgets.category = function(id, torqueLayer, variable) {

    function updateVategories() {
      var values = torqueLayer.totalHistogramFor(variable, 0);
      var el = d3.select(id)
        .datum(values)

      var size = el.node().getBoundingClientRect()

      el.call(histogramChart()
        .width(size.width)
        .height(size.height)
        .bins(10)
        .tickFormat(d3.format(".0f"))
      );
    };

    // public API
    var h = {
      disable: function() {
        // torqueLayer.off('change:time', updateHistogram);
        // torqueLayer.off('tilesLoaded', updateHistogram);
        // torqueLayer.off('tileLoaded', updateHistogram);
        torqueLayer.off('histLoaded', updateHistogram);
      },
      enable: function() {
        // torqueLayer.on('change:time', updateHistogram);
        // torqueLayer.on('tilesLoaded', updateHistogram);
        // torqueLayer.on('tileLoaded', updateHistogram);
        torqueLayer.on('histLoaded', updateHistogram);
      }
    }
    h.enable();
    return h;
}
