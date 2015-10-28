
/**
 *  Default widget view:
 *
 *  It contains:
 *  - view model (viewModel)
 *  - data model (dataModel)
 *
 *  It will offet to the user:
 *  - get current data (getData)
 *  - filter the current datasource (filter), each view will let
 *  different possibilities.
 *  - Sync or unsync widget (sync/unsync), making the proper view
 *  listen or not changes from the current datasource.
 *
 */
cdb ={core:{}, geo:{ui: {Widget:{}}}}



cdb._debugCallbacks= function(o) {
  var callbacks = o._callbacks;
  for(var i in callbacks) {
    var node = callbacks[i];
    console.log(" * ", i);
    var end = node.tail;
    while ((node = node.next) !== end) {
      console.log("    - ", node.context, (node.context && node.context.el) || 'none');
    }
  }
}

/**
 * Base Model for all CartoDB model.
 * DO NOT USE Backbone.Model directly
 * @class cdb.core.Model
 */
var Model = cdb.core.Model = Backbone.Model.extend({

  initialize: function(options) {
    _.bindAll(this, 'fetch',  'save', 'retrigger');
    return Backbone.Model.prototype.initialize.call(this, options);
  },
  /**
  * We are redefining fetch to be able to trigger an event when the ajax call ends, no matter if there's
  * a change in the data or not. Why don't backbone does this by default? ahh, my friend, who knows.
  * @method fetch
  * @param args {Object}
  */
  fetch: function(args) {
    var self = this;
    // var date = new Date();
    this.trigger('loadModelStarted');
    $.when(this.elder('fetch', args)).done(function(ev){
      self.trigger('loadModelCompleted', ev);
      // var dateComplete = new Date()
      // console.log('completed in '+(dateComplete - date));
    }).fail(function(ev) {
      self.trigger('loadModelFailed', ev);
    })
  },
  /**
  * Changes the attribute used as Id
  * @method setIdAttribute
  * @param attr {String}
  */
  setIdAttribute: function(attr) {
    this.idAttribute = attr;
  },
  /**
  * Listen for an event on another object and triggers on itself, with the same name or a new one
  * @method retrigger
  * @param ev {String} event who triggers the action
  * @param obj {Object} object where the event happens
  * @param obj {Object} [optional] name of the retriggered event;
  * @todo [xabel]: This method is repeated here and in the base view definition. There's should be a way to make it unique
  */
  retrigger: function(ev, obj, retrigEvent) {
    if(!retrigEvent) {
      retrigEvent = ev;
    }
    var self = this;
    obj.bind && obj.bind(ev, function() {
      self.trigger(retrigEvent);
    }, self)
  },

  /**
   * We need to override backbone save method to be able to introduce new kind of triggers that
   * for some reason are not present in the original library. Because you know, it would be nice
   * to be able to differenciate "a model has been updated" of "a model is being saved".
   * TODO: remove jquery from here
   * @param  {object} opt1
   * @param  {object} opt2
   * @return {$.Deferred}
   */
  save: function(opt1, opt2) {
    var self = this;
    if(!opt2 || !opt2.silent) this.trigger('saving');
    var promise = Backbone.Model.prototype.save.apply(this, arguments);
    $.when(promise).done(function() {
      if(!opt2 || !opt2.silent) self.trigger('saved');
    }).fail(function() {
      if(!opt2 || !opt2.silent) self.trigger('errorSaving')
    })
    return promise;
  }
});



 var View = cdb.core.View = Backbone.View.extend({
    classLabel: 'cdb.core.View',
    constructor: function(options) {
      this.options = _.defaults(options, this.options);
      this._models = [];
      this._subviews = {};
      Backbone.View.call(this, options);
      View.viewCount++;
      View.views[this.cid] = this;
      this._created_at = new Date();
    },

    add_related_model: function(m) {
      if(!m) throw "added non valid model"
      this._models.push(m);
    },

    addView: function(v) {
      this._subviews[v.cid] = v;
      v._parent = this;
    },

    removeView: function(v) {
      delete this._subviews[v.cid];
    },

    clearSubViews: function() {
      _(this._subviews).each(function(v) {
        v.clean();
      });
      this._subviews = {};
    },

    /**
     * this methid clean removes the view
     * and clean and events associated. call it when
     * the view is not going to be used anymore
     */
    clean: function() {
      var self = this;
      this.trigger('clean');
      this.clearSubViews();
      // remove from parent
      if(this._parent) {
        this._parent.removeView(this);
        this._parent = null;
      }
      this.remove();
      this.unbind();
      // remove this model binding
      if (this.model && this.model.unbind) this.model.unbind(null, null, this);
      // remove model binding
      _(this._models).each(function(m) {
        m.unbind(null, null, self);
      });
      this._models = [];
      View.viewCount--;
      delete View.views[this.cid];
      return this;
    },

    /**
     * utility methods
     */

    getTemplate: function(tmpl) {
      if(this.options.template) {
        return  _.template(this.options.template);
      }
      return cdb.templates.getTemplate(tmpl);
    },

    show: function() {
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    },

    /**
    * Listen for an event on another object and triggers on itself, with the same name or a new one
    * @method retrigger
    * @param ev {String} event who triggers the action
    * @param obj {Object} object where the event happens
    * @param obj {Object} [optional] name of the retriggered event;
    */
    retrigger: function(ev, obj, retrigEvent) {
      if(!retrigEvent) {
        retrigEvent = ev;
      }
      var self = this;
      obj.bind && obj.bind(ev, function() {
        self.trigger(retrigEvent);
      }, self)
      // add it as related model//object
      this.add_related_model(obj);
    },
    /**
    * Captures an event and prevents the default behaviour and stops it from bubbling
    * @method killEvent
    * @param event {Event}
    */
    killEvent: function(ev) {
      if(ev && ev.preventDefault) {
        ev.preventDefault();
      };
      if(ev && ev.stopPropagation) {
        ev.stopPropagation();
      };
    },

    /**
    * Remove all the tipsy tooltips from the document
    * @method cleanTooltips
    */
    cleanTooltips: function() {
      this.$('.tipsy').remove();
    }




  }, {
    viewCount: 0,
    views: {},

    /**
     * when a view with events is inherit and you want to add more events
     * this helper can be used:
     * var MyView = new core.View({
     *  events: cdb.core.View.extendEvents({
     *      'click': 'fn'
     *  })
     * });
     */
    extendEvents: function(newEvents) {
      return function() {
        return _.extend(newEvents, this.constructor.__super__.events);
      };
    },

    /**
     * search for views in a view and check if they are added as subviews
     */
    runChecker: function() {
      _.each(cdb.core.View.views, function(view) {
        _.each(view, function(prop, k) {
          if( k !== '_parent' &&
              view.hasOwnProperty(k) &&
              prop instanceof cdb.core.View &&
              view._subviews[prop.cid] === undefined) {
            console.log("=========");
            console.log("untracked view: ");
            console.log(prop.el);
            console.log('parent');
            console.log(view.el);
            console.log(" ");
          }
        });
      });
    }
  });


  /**
 *  Default widget content view:
 *
 */

cdb.geo.ui.Widget.Content = cdb.core.View.extend({

  className: 'Widget-body',

  _TEMPLATE: ' ' +
    '<div class="Widget-header">'+
      '<div class="Widget-title Widget-contentSpaced">'+
        '<h3 class="Widget-textBig"><%= title %></h3>'+
      '</div>'+
      '<dl class="Widget-info">'+
        '<dt class="Widget-infoItem Widget-textSmaller Widget-textSmaller--upper"><%= itemsCount %> items</dt>'+
      '</dl>'+
    '</div>'+
    '<div class="Widget-content js-content"></div>',

  _PLACEHOLDER: ' ' +
    '<ul class="Widget-list Widget-list--withBorders">' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
    '</ul>',

  initialize: function() {
    this.dataModel = this.options.dataModel;
    this.viewModel = this.options.viewModel;
    this._initBinds();
  },

  render: function() {
    this.clearSubViews();

    var template = _.template(this._TEMPLATE);
    var data = this.dataModel.getData();
    var isDataEmpty = _.isEmpty(data) || _.size(data) === 0;
    this.$el.html(
      template({
        title: this.viewModel.get('title'),
        itemsCount: !isDataEmpty ? data.length : '-'
      })
    );

    if (isDataEmpty) {
      this._addPlaceholder();
    }

    return this;
  },

  _initBinds: function() {
    this.dataModel.once('error', this._onFirstLoad, this);
    this.dataModel.once('change:data', this._onFirstLoad, this);
    this.viewModel.bind('change:sync', this._checkBinds, this);
    this.add_related_model(this.dataModel);
    this.add_related_model(this.viewModel);
  },

  _onFirstLoad: function() {
    this.render();
    this._unbindEvents(); // Remove any old dataModel binding
    this._checkBinds();
  },

  _checkBinds: function() {
    var isSync = this.viewModel.get('sync');
    this[ isSync ? '_bindEvents' : '_unbindEvents']();
  },

  _bindEvents: function() {
    this.dataModel.bind('change:data', this.render, this);
  },

  _unbindEvents: function() {
    this.dataModel.unbind(null, null, this);
  },

  _addPlaceholder: function() {
    var placeholderTemplate = _.template(this._PLACEHOLDER);
    this.$('.js-content').append(placeholderTemplate());
  }

});


cdb.geo.ui.Widget.View = cdb.core.View.extend({

  className: 'Widget Widget--light',

  options: {
    columns_title: [],
    sync: true
  },

  initialize: function() {
    this.dataModel = this.model;
    this.viewModel = new cdb.core.Model({
      title: this.model.get('options').title,
      type: this.model.get('options').type,
      sync: this.model.get('options').sync,
      columns_title: this.model.get('options').columns_title
    });
  },

  render: function() {
    this._initViews();
    return this;
  },

  _initViews: function() {
    this._loader = new cdb.geo.ui.Widget.Loader({
      viewModel: this.viewModel,
      dataModel: this.dataModel
    });
    this.$el.append(this._loader.render().el);
    this.addView(this._loader);

    this._error = new cdb.geo.ui.Widget.Error({
      viewModel: this.viewModel,
      dataModel: this.dataModel
    });
    this._error.bind('refreshData', function() {
      console.log("refresh data man!");
    }, this);
    this.$el.append(this._error.render().el);
    this.addView(this._error);

    var content = this._createContentView();
    this.$el.append(content.render().el);
    this.addView(content);
  },

  // Generate and return content view.
  // In this case it will be the standard widget content.
  _createContentView: function() {
    return new cdb.geo.ui.Widget.Content({
      viewModel: this.viewModel,
      dataModel: this.dataModel
    });
  }
});



cdb.geo.ui.Widget.Collection = Backbone.Collection.extend({

  model: cdb.geo.ui.Widget.Model

});


cdb.geo.ui.Widget.Model = cdb.core.Model.extend({

});


/**
 *  Histogram widget view
 *
 */

cdb.geo.ui.Widget.Histogram = {};

cdb.geo.ui.Widget.Histogram.View = cdb.geo.ui.Widget.View.extend({

  _createContentView: function() {
    return new cdb.geo.ui.Widget.Histogram.Content({
      viewModel: this.viewModel,
      dataModel: this.dataModel
    });
  }

});


cdb.geo.ui.Widget.HistogramModel = cdb.geo.ui.Widget.Model.extend({

  options: {
    page: 0,
    per_page: 100
  },

  defaults: {
    data: [],
    columns: []
  },

  url: function() {
    // TODO: Change this once the histogram endpoint is ready!
    return this.get('dashboardBaseURL') + '/list/' + this.get('id');
  },

  initialize: function() {
    this._data = new Backbone.Collection(this.get('data'));
    this._initBinds();
  },

  _initBinds: function() {
    this.bind('change:dashboardBaseURL', function(){
      var self = this;
      this.fetch({
        error: function() {
          self.trigger('error');
        }
      });
    }, this);
  },

  _createUrlOptions: function() {
    return _.compact(_(this.options).map(
      function(v, k) {
        return k + "=" + encodeURIComponent(v);
      }
    )).join('&');
  },

  getData: function() {
    return this._data;
  },

  getSize: function() {
    return this._data.size();
  },

  getDataSerialized: function() {
    return this.get('data');
  },

  fetch: function(opts) {
    this.trigger("loading", this);
    return cdb.core.Model.prototype.fetch.call(this,opts);
  },

  parse: function(r) {
    this._data.reset(r);
    return {
      data: r.data
    };
  }

});


/**
 *  Default widget content view:
 *
 *
 */

cdb.geo.ui.Widget.Histogram.Chart = cdb.core.View.extend({

  defaults: {
    duration: 750,
    handleWidth: 6,
    handleHeight: 23,
    handleRadius: 3,
    transitionType: 'elastic'
  },

  initialize: function() {

    _.bindAll(this, '_selectBars', '_adjustBrushHandles', '_onBrushMove', '_onBrushStart', '_onMouseMove', '_onMouseEnter', '_onMouseOut');

    this._setupModel();
    this._setupDimensions();
  },

  render: function() {
    this._generateChart();

    this._generateHorizontalLines();
    this._generateVerticalLines();

    this._generateBars();

    this._generateHandles();

    this._setupBrush();
    this._generateXAxis();

    return this;
  },

  _removeBars: function() {
    this.chart.selectAll('.Bar').remove();
  },

  _removeBrush: function() {
    this.brush
    .clear()
    .event(this.chart.select('.Brush'));
    this.chart.classed('is-selectable', false);
  },

  reset: function(data) {
    this.loadData(data);
    this._removeBrush();
    this.model.set({ a: 0, b: this.model.get('data').values.length });
  },

  _generateVerticalLines: function() {
    var range = d3.range(0, this.chartWidth + this.chartWidth / 4, this.chartWidth / 4);

    var lines = this.chart.select('.Lines');

    lines.append('g')
    .attr('class', 'y')
    .selectAll('.x')
    .data(range.slice(1, range.length - 1))
    .enter().append('svg:line')
    .attr('y1', 0)
    .attr('x1', function(d) { return d; })
    .attr('y2', this.chartHeight)
    .attr('x2', function(d) { return d; });
  },

  _generateHorizontalLines: function() {
    var range = d3.range(0, this.chartHeight + this.chartHeight / 2, this.chartHeight / 2);

    var lines = this.chart.append('g')
    .attr('class', 'Lines');

    lines.append('g')
    .attr('class', 'y')
    .selectAll('.y')
    .data(range)
    .enter().append('svg:line')
    .attr('class', 'y')
    .attr('x1', 0)
    .attr('y1', function(d) { return d; })
    .attr('x2', this.chartWidth)
    .attr('y2', function(d) { return d; });

    this.bottomLine = lines
    .append('line')
    .attr('class', 'l_bottom')
    .attr('x1', 0)
    .attr('y1', this.chartHeight)
    .attr('x2', this.chartWidth - 1)
    .attr('y2', this.chartHeight);
  },

  _setupModel: function() {
    this.model = new cdb.core.Model({ data: this.options.data });
    this.model.bind('change:a change:b', this._onChangeRange, this);
    this.model.bind('change:data', this._onChangeData, this);
    this.model.bind('change:dragging', this._onChangeDragging, this);
  },

  _setupDimensions: function() {
    var data = this.model.get('data').values;

    this.margin = { top: 0, right: 10, bottom: 20, left: 10 };

    this.canvasWidth  = this.options.width;
    this.canvasHeight = this.options.height;

    this.chartWidth  = this.canvasWidth - this.margin.left - this.margin.right;
    this.chartHeight = this.options.height;

    this._setupScales();
  },

  _setupScales: function() {
    var data = this.model.get('data').values;
    this.xScale = d3.scale.linear().domain([0, 100]).range([0, this.chartWidth]);
    this.yScale = d3.scale.linear().domain([0, d3.max(data, function(d) { return d; } )]).range([this.chartHeight, 0]);
    this.zScale = d3.scale.ordinal().domain(d3.range(data.length)).rangeRoundBands([0, this.chartWidth]);
  },

  _calcBarWidth: function() {
    this.barWidth = this.chartWidth / this.model.get('data').values.length;
  },

  _generateChart: function() {
    this.chart = d3.select(this.options.el[0])
    .selectAll('.Canvas')
    .append('g')
    .attr('class', 'Chart')
    .attr('opacity', 0)
    .attr('transform', 'translate(0, ' + this.options.y + ')');

    this.chart.classed(this.options.className || '', true);
  },

  hide: function() {
    this.chart
    .transition()
    .duration(150)
    .attr('opacity', 0)
    .attr('transform', 'translate(0, ' + (this.options.y - 10) + ')');
  },

  show: function() {
    this.chart
    .attr('transform', 'translate(0, ' + (this.options.y + 10) + ')')
    .transition()
    .duration(150)
    .attr('opacity', 1)
    .attr('transform', 'translate(0, ' + (this.options.y) + ')');
  },

  move: function() {
    this.chart
    .transition()
    .duration(2500)
    .attr('transform', 'translate(0, ' + (this.options.y + 90) + ')');
  },

  _onBrushStart: function() {
    this.chart.classed('is-selectable', true);
  },

  _selectBars: function() {
    var self = this;
    var extent = this.brush.extent();
    var lo = extent[0];
    var hi = extent[1];

    this.model.set({ a: this._getLoBarIndex(), b: this._getHiBarIndex() });

    this.chart.selectAll('.Bar').classed('is-selected', function(d, i) {
      var a = Math.floor(i * self.barWidth);
      var b = Math.floor(a + self.barWidth);
      var LO = Math.floor(self.xScale(lo));
      var HI = Math.floor(self.xScale(hi));
      var isIn = (a > LO && a < HI) || (b > LO && b < HI) || (a <= LO && b >= HI);
      return !isIn;
    });
  },

  _onChangeDragging: function() {
    this.chart.classed('is-dragging', this.model.get('dragging'));
  },

  _onBrushMove: function() {
    this.model.set({ dragging: true });
    this._selectBars();
    this._adjustBrushHandles();
  },

  _onMouseEnter: function(d) {
  },

  _onMouseOut: function(d) {
    var bars = this.chart.selectAll('.Bar');
    bars.classed('is-highlighted', false);
    this.trigger('hover', { value: null });
  },

  _onMouseMove: function(d) {
    var x = d3.event.offsetX;
    var a =  Math.ceil(x / this.barWidth);
    var data = this.model.get('data').values;

    var format = d3.format("0,000");
    var bar = this.chart.select('.Bar:nth-child(' + a + ')');

    if (bar && bar.node() && !bar.classed('is-selected')) {
      var left = ((a - 1) * this.barWidth);
      if (!this._isDragging()) {
        this.trigger('hover', { left: left, value: data[a - 1] });
      }
    } else {
      this.trigger('hover', { value: null });
    }

    this.chart.selectAll('.Bar')
    .classed('is-highlighted', false);

    if (bar && bar.node()) {
      bar.classed('is-highlighted', true);
    }
  },

  _isDragging: function() {
    return this.model.get('dragging');
  },

  selectRange: function(a, b) {
    var data = this.model.get('data').values;
    var start = a * (100 / data.length);
    var end = b * (100 / data.length);

    this.chart.select('.Brush').transition()
    .duration(this.brush.empty() ? 0 : 100)
    .call(this.brush.extent([start, end]))
    .call(this.brush.event);
  },

  _selectRange: function(start, end) {
    this.chart.select('.Brush').transition()
    .duration(this.brush.empty() ? 0 : 150)
    .call(this.brush.extent([start, end]))
    .call(this.brush.event);
  },

  _getLoBarIndex: function() {
    var extent = this.brush.extent();
    return Math.round(this.xScale(extent[0]) / this.barWidth);
  },

  _getHiBarIndex: function() {
    var extent = this.brush.extent();
    return Math.round(this.xScale(extent[1]) / this.barWidth);
  },

  _getBarIndex: function() {
    var x = d3.event.sourceEvent.offsetX - this.margin.left;
    return Math.ceil(x / this.barWidth);
  },

  _setupBrush: function() {
    var self = this;

    var xScale = this.xScale;
    var brush = this.brush = d3.svg.brush().x(this.xScale);

    function onBrushEnd() {
      var data = self.model.get('data').values;
      var labels = self.model.get('data').labels;

      var a, b;

      self.model.set({ dragging: false });

      if (brush.empty()) {
        self.chart.selectAll('.Bar').classed('is-selected', false);
        d3.select(this).call(brush.extent([0, 0]));
      } else {

        var loBarIndex = self._getLoBarIndex();
        var hiBarIndex = self._getHiBarIndex();

        a = loBarIndex * (100 / data.length);
        b = hiBarIndex * (100 / data.length);

        if (!d3.event.sourceEvent) {
          return;
        }

        self._selectRange(a, b);
        self.model.set({ a: loBarIndex, b: hiBarIndex });
        self._adjustBrushHandles();
        self._selectBars();

        self.trigger('on_brush_end', self.model.get('a'), self.model.get('b'));
        self.trigger('fliterChanged', labels[self.model.get('a')], labels[self.model.get('b')]);
      }

      if (d3.event.sourceEvent && a === undefined && b === undefined) {
        var barIndex = self._getBarIndex();
        a = (barIndex - 1) * (100 / data.length);
        b = (barIndex) * (100 / data.length);
        self.model.set({ a: barIndex - 1, b: barIndex });
        self._selectRange(a, b);
      }
    }

    var data = this.model.get('data').values;

    this.brush
    .on('brushstart', this._onBrushStart)
    .on('brush', this._onBrushMove)
    .on('brushend', onBrushEnd);

    this.chart.append('g')
    .attr('class', 'Brush')
    .call(this.brush)
    .selectAll('rect')
    .attr('y', 0)
    .attr('height', this.chartHeight)
    .on('mouseenter', this._onMouseEnter)
    .on('mouseout', this._onMouseOut)
    .on('mousemove', this._onMouseMove);
  },

  _adjustBrushHandles: function() {
    var extent = this.brush.extent();
    var lo = extent[0];
    var hi = extent[1];

    this.leftHandleLine
    .attr('x1', this.xScale(lo))
    .attr('x2', this.xScale(lo));

    this.rightHandleLine
    .attr('x1', this.xScale(hi))
    .attr('x2', this.xScale(hi));

    if (this.options.handles) {
      this.leftHandle
      .attr('x', this.xScale(lo) - this.defaults.handleWidth / 2);

      this.rightHandle
      .attr('x', this.xScale(hi) - this.defaults.handleWidth / 2);
    }
  },

  _generateHandle: function() {
    var handle = { width: this.defaults.handleWidth, height: this.defaults.handleHeight, radius: this.defaults.handleRadius };
    var yPos = (this.chartHeight / 2) - (this.defaults.handleHeight / 2);

    return this.chart.select('.Handles').append('rect')
    .attr('class', 'Handle')
    .attr('transform', 'translate(0, ' + yPos + ')')
    .attr('width', handle.width)
    .attr('height', handle.height)
    .attr('rx', handle.radius)
    .attr('ry', handle.radius);
  },

  _generateHandleLine: function() {
    return this.chart.select('.Handles').append('line')
    .attr('class', 'HandleLine')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', this.chartHeight);
  },

  _removeHandles: function() {
    this.chart.select('.Handles').remove();
  },

  _generateHandles: function() {
    this.chart.append('g').attr('class', 'Handles');
    this.leftHandleLine  = this._generateHandleLine();
    this.rightHandleLine = this._generateHandleLine();

    if (this.options.handles) {
      this.leftHandle      = this._generateHandle();
      this.rightHandle     = this._generateHandle();
    }
  },

  _removeXAxis: function() {
    d3.select('.axis').remove();
  },

  _generateXAxis: function() {
    var data = this.model.get('data').labels;

    var format = d3.format('0,000');

    var xAxis = d3.svg.axis()
    .scale(this.zScale)
    .orient('bottom')
    .innerTickSize(0)
    .tickFormat(function(d, i) {
      if(i%1==0){
        return data[d]
      }
      else{
        return ''
      }
    });

    this.chart.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(0,' + (this.chartHeight + 5) + ')')
    .call(xAxis);
  },

  refreshData: function(data, a, b) {
    if (data && data.length > 0) {
      this.model.set({ data: data, a: a, b: data.length - 1 });
    }
  },

  loadData: function(data) {
    this.model.set({ a: 0, b: 0 }, { silent: true });
    this.model.set('data', data);
    this._onChangeData();
  },

  _onChangeData: function() {
    this._removeBrush();
    this._removeBars();
    this._removeHandles();

    this._setupDimensions();
    this._generateBars();
    this._generateHandles();

    this._removeXAxis();
    this._generateXAxis();

    this._setupBrush();
  },

  _generateBars: function() {
    var self = this;
    var data = this.model.get('data').values;

    this._calcBarWidth();

    var bars = this.chart.append('g')
    .attr('class', 'Bars')
    .selectAll('.Bar')
    .data(data);

    bars
    .enter()
    .append('rect')
    .attr('class', 'Bar')
    .attr('data', function(d) { return d; })
    .attr('transform', function(d, i) {
      return 'translate(' + (i * self.barWidth) + ', 0 )';
    })
    .attr('y', self.chartHeight)
    .attr('height', 0)
    .attr('width', this.barWidth - 1);

    bars.transition()
    .ease(this.defaults.transitionType)
    .duration(self.defaults.duration)
    .delay(function(d, i) {
      return Math.random() * (100 + i * 10);
    })
    .attr('height', function(d) {
      return d ? self.chartHeight - self.yScale(d) : 0;
    })
    .attr('y', function(d) {
      return d ? self.yScale(d) : self.chartHeight;
    });
  },

  _onChangeRange: function() {
    if (this.model.get('a') === 0 && this.model.get('b') === 0) {
      return;
    }
    this.trigger('range_updated', this.model.get('a'), this.model.get('b'));
  },

  _formatNumber: function(value, unit) {
    var format = d3.format("0,000");
    return format(value + unit ? ' ' + unit : '');
  },

});

cdb.geo.ui.Widget.Histogram.Content = cdb.geo.ui.Widget.Content.extend({

  defaults: {
    chartHeight: 48
  },

  events: {
    'click .js-clear': '_reset',
    'click .js-zoom': '_zoom'
  },

  _TEMPLATE: ' ' +
   '<div class="Widget-header">'+
      '<div class="Widget-title Widget-contentSpaced">'+
        '<h3 class="Widget-textBig"><%= title %></h3>'+
      '</div>'+
     '<dl class="Widget-info Widget-textSmaller Widget-textSmaller--upper">'+
       '<dt class="Widget-infoItem js-null">0 NULL ROWS</dt>'+
       '<dt class="Widget-infoItem js-min">0 MIN</dt>'+
       '<dt class="Widget-infoItem js-avg">0 AVG</dt>'+
       '<dt class="Widget-infoItem js-max">0 MAX</dt>'+
     '</dl>'+
   '</div>'+
   '<div class="Widget-content js-content">'+
   '<div class="Tooltip js-tooltip"></div>'+
   '  <div class="Widget-filter Widget-contentSpaced js-filter">'+
   '    <p class="Widget-textSmaller Widget-textSmaller--bold Widget-textSmaller--upper js-val"></p>'+
   '    <div class="Widget-filterButtons">'+
   '      <button class="Widget-link Widget-filterButton js-zoom">zoom</button>'+
   '      <button class="Widget-link Widget-filterButton js-clear">clear</button>'+
   '    </div>'+
   '  </div>'+
   '  <svg class="Widget-chart js-chart"></svg>',

  _PLACEHOLDER: ' ' +
    '<ul class="Widget-list Widget-list--withBorders">' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
    '</ul>',

  _initViews: function() {
    this._generateData();
    this._setupDimensions();
    this._generateCanvas();
    this._renderMainChart();
    this._renderMiniChart();
  },

  render: function() {

    this.clearSubViews();

    var template = _.template(this._TEMPLATE);
    var data = this.dataModel.getData();
    var isDataEmpty = _.isEmpty(data) || _.size(data) === 0;

    this.$el.html(
      template({
        title: this.viewModel.get('title'),
        itemsCount: !isDataEmpty ? data.length : '-'
      })
    );

    if (isDataEmpty) {
      this._addPlaceholder();
    } else {
      this._setupBindings();
      this._initViews();
    }

    return this;
  },

  _renderMainChart: function() {
    this.chart = new cdb.geo.ui.Widget.Histogram.Chart(({
      el: this.$('.js-chart'),
      y: 0,
      handles: true,
      width: this.canvasWidth,
      height: this.defaults.chartHeight,
      data: this.dataModel.get('data')
    }));
    this.chart.bind('range_updated', this._onRangeUpdated, this);
    this.chart.bind('hover', this._onValueHover, this);
    this.chart.render().show();

    this._updateStats();
  },

  _renderMiniChart: function() {
    this.miniChart = new cdb.geo.ui.Widget.Histogram.Chart(({
      className: 'mini',
      el: this.$('.js-chart'),
      handles: false,
      width: this.canvasWidth,
      y: 90,
      height: 20,
      data: this.dataModel.get('data')
    }));

    this.miniChart.bind('on_brush_end', this._onMiniRangeUpdated, this);

    this.miniChart.render();
  },

  _setupBindings: function() {
    this.viewModel.bind('change:zoom_enabled', this._onChangeZoomEnabled, this);
    this.viewModel.bind('change:total', this._onChangeTotal, this);
    this.viewModel.bind('change:max',   this._onChangeMax, this);
    this.viewModel.bind('change:min',   this._onChangeMin, this);
    this.viewModel.bind('change:avg',   this._onChangeAvg, this);
  },

  _setupDimensions: function() {
    this.margin = { top: 0, right: 10, bottom: 20, left: 10 };

    this.canvasWidth  = this.$('.js-chart').width();
    this.canvasHeight = this.defaults.chartHeight + this.margin.top + this.margin.bottom;
  },

  _onValueHover: function(info) {
    var $tooltip = this.$(".js-tooltip");
    if (info.value) {
      $tooltip.css({ top: 0, left: info.left });
      $tooltip.text(info.value);
      $tooltip.show();
    } else {
      $tooltip.hide();
    }
  },

  _onMiniRangeUpdated: function(a, b) {
    this.viewModel.set({ a: a, b: b });
    var data = this._getData();
    var self = this;

    var refreshData = _.debounce(function() {
      self.chart.refreshData(data, a, b);
      self._updateStats();
    }, 100);

    refreshData();
  },

  _onRangeUpdated: function(a, b) {
    this.$(".js-filter").animate({ opacity: 1 }, 250);
    this.viewModel.set({ a: a, b: b });
    this._updateStats();
  },

  _onChangeZoomEnabled: function() {
    this.$(".js-zoom").toggleClass('is-hidden', !this.viewModel.get('zoom_enabled'));
  },

  _onChangeTotal: function() {
    this._animateValue('.js-val', 'total', ' SELECTED');
  },

  _onChangeMax: function() {
    this._animateValue('.js-max', 'max', 'MAX');
  },

  _onChangeMin: function() {
    this._animateValue('.js-min', 'min', 'MIN');
  },

  _onChangeAvg: function() {
    this._animateValue('.js-avg', 'avg', 'AVG');
  },

  _generateData: function() {
    var data = _.map(d3.range(Math.round(Math.random() * 80) + 2), function(d) {
      return Math.round(Math.random() * 1000);
    });

    this.dataModel.set('data', data);
  },

  _animateValue: function(className, what, unit) {
    var self = this;
    var format = d3.format("0,000");

    var from = this.viewModel.previous(what) || 0;
    var to = this.viewModel.get(what);

    if (!to) return;

    $(className).prop('counter', from).stop().animate({ counter: to }, {
      duration: 500,
      easing: 'swing',
      step: function (i) {
        $(this).text(format(Math.floor(i)) + ' ' + unit);
      }
    });
  },

  _getData: function(full) {
    var data = this.dataModel.get('data');
    if (full) {
      return data;
    }
    return data.slice(this.viewModel.get('a'), this.viewModel.get('b'));
  },

  _updateStats: function() {
    var data = this._getData();
    var sum = _.reduce(data, function(t, j) {
      return j + t;
    });

    var max = d3.max(data);
    var avg = Math.round(d3.mean(data));
    var min = d3.min(data);

    this.viewModel.set({ total: sum, min: min, max: max, avg: avg });
  },

  _zoom: function() {
    this._expand();
    this.viewModel.set({ zoom_enabled: false });
    this.chart.loadData(this._getData());
    this.miniChart.selectRange(this.viewModel.get('a'), this.viewModel.get('b'));
    this.miniChart.show();
  },

  _reset: function() {
    this._contract();
    this.viewModel.set({ zoom_enabled: true, a: 0, b: 100 });
    this.chart.reset(this._getData());
    this.$(".js-filter").animate({ opacity: 0 }, 0);
    this.miniChart.hide();
  },

  _contract: function() {
    this.canvas
    .attr('height', this.canvasHeight);
  },

  _expand: function() {
    this.canvas
    .attr('height', this.canvasHeight + 60);
  },

  _generateCanvas: function() {
    this.canvas = d3.select(this.$el.find('.js-chart')[0])
    .attr('width',  this.canvasWidth)
    .attr('height', this.canvasHeight)

    this.canvas
    .append('g')
    .attr('class', 'Canvas');

    this.canvas
    .attr('transform', 'translate(10, 0)');
  }
});
