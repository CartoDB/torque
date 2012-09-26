
var Navigation = (function() {

  var
  mapAnimationPID      = null,
  mapAnimationInterval = 50;

  function _select(name) {
    $("nav li a").removeClass("selected");
    $("nav ." + name).addClass("selected");
  }

  function _showState(state) {
    if (state === 'home') {
      _showHomeState();
    } else if (state === "map") {
      _showMapState();
    }
  }

  var lastCountryClass;

  $("#countries .disabled").on("mouseenter", function() {
    $(".select").hide();
  });

  $("#countries h1").on("mouseenter", function() {
    $(".select").hide();
  });

  $("#countries").on("mouseleave", function() {
    $(".select").hide();
  });

  $("#countries .country").on("mouseenter", function() {

    if ($(this).hasClass("disabled")) {
      return;
    }

    var // selection box dimensions
    h = $("#countries .select").height(),
    w = $("#countries .select").width();

    var top = $(this).position().top - (h/2 - $(this).height()/2);
    var left = $(this).position().left - (w/2 - $(this).width()/2);

    $("#countries .select").css({ top: top , left: left });
    var c = $(this).attr("class").replace(/country/, "");

    if (lastCountryClass) {
      $("#countries .select").removeClass(lastCountryClass);
    }

    $("#countries .select").addClass(c);
    lastCountryClass = c;
    $("#countries .select").html($(this).html());
    $("#countries .select").show();
  });

  function _showHomeState() {
    showMap = false;

    _hideOverlays();

    Legend.hide();
    Navigation.select("home");

    Filter.hide(function() {

      $("header").animate({height: "247px" }, 250, function() {
        $("hgroup h1").animate({ top: 29, opacity: 1 }, 250);
      });
    });

    this.time_layer.cache_time(true);
    Timeline.hide();
    self.time_layer.set_time(128);

    _animateMap();

    GFW.app.close(function() {
      Circle.show(250);
      $("footer, .actions").fadeIn(250);
    });
  }

  function _animateMap() {
    mapAnimationPID = setInterval(function() {
      map.panBy(-1, 0);
    }, mapAnimationInterval);
  }

  function _stopMapAnimation() {
    clearInterval(mapAnimationPID);
  }

  function _hideOverlays() {
    $("#subscribe").fadeOut(250);
    $("#share").fadeOut(250);
    $(".backdrop").fadeOut(250);
    $("#countries").fadeOut(250);
  }

  function _showMapState() {
    showMap = true;

    _hideOverlays();


    Navigation.select("map");

    Circle.hide();
    Legend.show();

    _stopMapAnimation();

    self.time_layer.set_time(self.time_layer.cache_time());
    Timeline.show(); // TODO: don't show the timeline if FORMA is not selected



    $("footer, .actions").fadeOut(250);
    $("header").animate({height: "220px"}, 250, function() {
      GFW.app.open();
    });

    $("hgroup h1").animate({ top: "50px", opacity: 0 }, 250, function() {
      Filter.show();
    });
  }

  // Init method
  $(function() {
    $(document).on("click", ".radio", function(e) {
      e.preventDefault();
      e.stopPropagation();

      $('.radio[data-name="' + $(this).attr('data-name') + '"]').removeClass("checked");
      $(this).addClass("checked");
    });

    $(document).on("click", ".checkbox", function(e) {
      e.preventDefault();
      e.stopPropagation();

      $(this).toggleClass("checked");
    });
  }());

  return {
    select: _select,
    showState: _showState,
    animateMap: _animateMap,
    stopMapAnimation: _stopMapAnimation,
    hideOverlays: _hideOverlays
  };

}());

var Filter = (function() {

  var
  pids,
  filters    = [],
  lastClass  =  null,
  categories = [],
  $filters   = $(".filters"),
  $advance   = $filters.find(".advance"),
  $layer     = $("#layer");


  function _updateHash(id, visible) {

    var zoom = map.getZoom();
    var lat  = map.getCenter().lat().toFixed(2);
    var lng  = map.getCenter().lng().toFixed(2);

    var hash = "/map/" + zoom + "/" + lat + "/" + lng + "/" + filters.join(",");

    History.pushState({ state: 3 }, "Map", hash);
  }

  function _toggle(id) {
    if (_.include(filters, id)) {
      filters = _.without(filters, id);
    } else {
      filters.push(id);
    }
    _updateHash(id);
  }

  function _show(callback) {

    if (!$filters.hasClass("hide")) return;

    var count = categories.length;

    $filters.fadeIn(150, function() {

      $filters.find("li").slice(0, count).each(function(i, el) {
        $(el).delay(i * 50).animate({ opacity: 1 }, 150, "easeInExpo", function() {
          $(this).find("a").animate({ top: "-15px"}, 150);
          count--;

          if (count <= 0) {

            if (categories.length > 7) { // TODO: calc this number dynamically
              $advance.delay(200).animate({ top: "20px", opacity: 1 }, 200);
            }

            $filters.removeClass("hide");

            $filters.find("li").css({opacity:1});
            $filters.find("li a").css({top:"-15px"});

            if (callback) callback();
            _calcFiltersPosition();
          }
        });
      });
    });
  }

  function _hide(callback) {

    _hideLayer();

    if ($filters.hasClass("hide")) return;

    var count = categories.length;

    $advance.animate({ top: "40px", opacity: 0 }, 200, function() {

      $($filters.find("li a").slice(0, count).get().reverse()).each(function(i, el) {

        $(el).delay(i * 50).animate({ top: "15px" }, 150, function() {
          $(this).parent().animate({ opacity: "0"}, 150, function() {

            --count;

            if (count <= 0) {
              $filters.fadeOut(150, function() {
                $filters.addClass("hide");

                $filters.find("li a").css({top:"15px"});
                $filters.find("li").css({opacity:0});

                if (callback) callback();
              });
            }
          });
        });
      });
    });
  }

  function _calcFiltersPosition() {
    $filters.find("li").each(function(i, el) {
      $(el).data("left-pos", $(el).offset().left);
    });
  }

  function _advanceFilter(e) {
    e.preventDefault();

    _closeOpenFilter();

    var
    $inner = $filters.find(".inner"),
    $el    = $inner.find("li:first"),
    width  = $el.width() + 1;

    $filters.find(".inner").animate({ left:"-=" + width }, 250, "easeInExpo", function() {
      $(this).find('li:last').after($el);
      $(this).css("left", 0);

      _calcFiltersPosition();
    });
  }

  function _hideLayer() {
    $layer.animate({ opacity: 0 }, 70, function() {
      $layer.css("left", -10000);
    });
  }

  function _closeOpenFilter() {
    var c = $layer.attr("class");

    if (c === undefined) return;

    clearTimeout(pids);

    pids = setTimeout(function() {
      _close(c);
    }, 100);
  }

  function _close(c) {
    $layer.animate({ opacity: 0 }, 70, function() {
      $layer.css("left", -10000);
      $layer.removeClass(c);
    });
  }

  function _open() {

    var
    $li          = $(this),
    lw           = $layer.width(),
    liClass      = $li.attr("data-id"),
    l            = $li.data("left-pos"),
    $line        = $li.find(".line"),
    lineWidth    = $line.width();

    cancelClose();

    $layer.removeClass(lastClass);

    var name = $li.find("a").text();
    $layer.find("a.title").text(name);

    $layer.find(".links li.last").removeClass('last');
    $layer.find(".links li").hide();
    $layer.find(".links li." + liClass).show();
    $layer.find(".links li." + liClass).last().addClass("last");

    $layer.addClass(liClass);
    lastClass = liClass;

    var width = $li.width() < 170 ? 170 : $li.width();
    var left  = (l + $li.width() / 2) - (width / 2);

    $layer.find("li").css({ width:width - 20});
    $layer.css({ left: left, width:width, height: $layer.find(".links").height() + 93, top: -80});
    $layer.animate({ opacity: 1 }, 250);
  }

  function cancelClose() {
    clearTimeout(pids);
  }

  function _onMouseEnter() {
    $layer.animate({ opacity: 1 }, 150);
  }

  function _init() {

    // Bindings
    $(document).on("click", ".filters .advance", _advanceFilter);
    $(document).on("mouseenter", ".filters li", _open);
    $layer.on("mouseleave", _closeOpenFilter);
  }

  function _check(id) {
    $("#layer a[data-id=" + id +"]").addClass("checked");
    filters.push(id);
  }

  function _addFilter(id, category, name, options) {

    var
    zoomEvent  = options.zoomEvent  || null,
    clickEvent = options.clickEvent || null,
    disabled   = options.disabled   || false;
    source     = options.source     || null;

    if (category === null || !category) {
      category = 'Other layers';
    }

    var
    cat  = category.replace(/ /g, "_").toLowerCase(),
    slug = name.replace(/ /g, "_").replace("-", "_").toLowerCase();

    if (!_.include(categories, cat)) {
      var
      template = _.template($("#filter-template").html()),
      $filter  = $(template({ name: category, category: cat, data: cat }));

      $filters.find("ul").append($filter);
      categories.push(cat);
    }

    var
    layerItemTemplate = null,
    $layerItem        = null;

    // Select the kind of input (radio or checkbox) depending on the category
    if (cat === 'forest_clearing') {

      layerItemTemplate = _.template($("#layer-item-radio-template").html());
      $layerItem = $(layerItemTemplate({ name: name, id: id, category: cat, disabled: disabled, source: source }));

      if (!disabled) { // click binding
        $layerItem.find("a:not(.source)").on("click", function() {
          if (!$(this).find(".radio").hasClass("checked")) {
            clickEvent();
            zoomEvent();
          }
        });
      }

    } else {
      layerItemTemplate = _.template($("#layer-item-checkbox-template").html());
      $layerItem = $(layerItemTemplate({ name: name, id: id, category: cat, disabled: disabled, source: source }));

      if (!disabled) { // click binding
        $layerItem.find("a:not(.source)").on("click", function() {
          console.log($(this));
          clickEvent();
          zoomEvent();
        });
      }

    }

    $layer.find(".links").append($layerItem);
    $layerItem.find(".checkbox").addClass(cat);

    // We select the FORMA layer by default
    if ( slug == "semi_monthly" ) {
      $layerItem.find(".radio").addClass('checked');
    }
  }

  return {
    init: _init,
    show: _show,
    hide: _hide,
    addFilter: _addFilter,
    toggle: _toggle,
    closeOpenFilter:_closeOpenFilter,
    calcFiltersPosition: _calcFiltersPosition,
    check: _check
  };

}());

/* Legend
 * Shows a list of the selected layers
 */
var Legend = (function() {

  var
  template,
  $legend;

  function _init() {

    if (_build()) {

      // Makes it draggable
      $legend.draggable({
        containment: "#map-container .map",
        handle: ".header",
        stop: function() {
          $.jStorage.set("legend", [$legend.offset().top, $legend.offset().left]);
        }
      });

      // Adds close binding
      $legend.find(".close").on("click", _hide);
    }

  }

  function _build() {

    if ( $("#legend-template").length > 0 ) {

      template = _.template($("#legend-template").html());
      $legend  = $(template({ layers: "" }));

      var position = $.jStorage.get("legend");

      if (position) {
        var
        top  = position[0],
        left = position[1];

        $legend.css({ top: top, left: left, opacity:0 });
      }

      $("#content").append($legend);

      return true;
    }

    return false;
  }

  function _add(id, name, category, title_color, title_subs) {

    if (category === null || !category) {
      category = 'Other layers';
    }

    var
    slug = name.replace(/ /g, "_").toLowerCase(),
    cat  = category.replace(/ /g, "_").toLowerCase();

    template = _.template($("#legend-item-template").html());

    var
    color = null,
    extra = null;

    if (title_color) {
      color = title_color;
    } else {
        var subs = eval(title_subs);
        var icons = _.map(subs, function(e) { return '<div class="layer"><div class="icon" style="background-color:' + e.color + ';"></div> <a href="#">' + e.title + '</a></div>'; }).join("\n");
        var parts = "<div class='extra'>" + icons + "</div>";
      }

    $item = $(template({ color:color, parts: parts, category: cat, id: id, name: name.truncate(32) }));

    $item.hide();

    var $ul = null;

    if ( $(".legend").find("ul." + cat).length > 0 ) {

      $ul = $(".legend").find("ul." + cat);
      $ul.append($item);

      $item.fadeIn(250);
      $ul.fadeIn(250);
    } else {
      $ul = $("<ul class='"+cat+"' />");
      $ul.append($item);
      $(".legend").find(".content").append($ul);

      $ul.fadeIn(250);
      $item.fadeIn(250);
    }

    if ( $(".legend").find("li").length >= 1 && showMap === true) {
      Legend.show();
    }
  }

  function _remove(id, name, category) {

    var
    slug  = name.replace(/ /g, "_").toLowerCase(),
    cat = category.replace(/ /g, "_").toLowerCase(),
    $li = $(".legend").find("ul li#" + id),
    $ul = $li.parent();

    $li.remove();

    if (cat == 'deforestation') {
      return;
    }

    if ($ul.find("li").length <= 0) {

      if ($(".legend").find("ul").length > 1) {

        $ul.fadeOut(150, function() {
          $(this).remove();
        });

      } else {
        $(".legend").fadeOut(150, function() {
          $ul.remove();
        });
      }
    }
  }

  function _reset(id, name, category, title_color, title_subs) {
    var cat = category.replace(/ /g, "_").toLowerCase(),
    $ul = $(".legend ul." + cat);

    $ul.find("li").remove();

    _add(id, name, category, title_color, title_subs);

  }

  function _toggleItem(id, name, category, title_color, title_subs, add) {
    add ? _add(id, name, category, title_color, title_subs) : _remove(id, name, category);

    if (GFW && GFW.app.infowindow) {
      GFW.app.infowindow.close();
    }

  }

  function _show(e) {
    if ( $(".legend").find("li").length >= 1 && showMap === true) {
      $(".legend").show();
      $(".legend").animate({ opacity: 1 }, 250, "easeInExpo");
    }
  }

  function _hide(e, callback) {

    $(".legend").animate({ marginTop: 50, opacity: 0 }, 250, "easeOutExpo", function() {
      $(this).hide();

      if (callback) {
        callback();
      }

    });
  }

  return {
    init: _init,
    hide: _hide,
    show: _show,
    toggleItem: _toggleItem,
    add: _add,
    remove: _remove,
    reset: _reset
  };

}());

var Circle = (function() {

  var template, $circle, $title, $counter, $background, $explore, animating = true;

  function _build(){

    if ( $("#circle-template").length > 0 ) {

      template    = _.template($("#circle-template").html());
      $circle     = $(template({ count: summary.count, title: summary.title}));

      $title      = $circle.find(".title");
      $counter    = $circle.find(".counter");
      $background = $circle.find(".background");
      $explore    = $circle.find(".explore");

      $("#map").append($circle);

      return true;
    }

    return false;
  }

  function _show(delay) {

    if (!delay) {
      delay = 0;
    }
    var $circle = $(".circle");
    $circle.show();

    $circle.delay(delay).animate({ top:'50%', marginTop:-1*($circle.height() / 2), opacity: 1 }, 250, function() {
      $title.animate({ opacity: 0.75 }, 150, "easeInExpo");
      $counter.animate({ opacity: 1 }, 150, "easeInExpo");
      animating = false;

      _onMouseLeave();
    });
  }

  function _onMouseEnter() {
    if (animating) return;

    var $circle = $(".circle");
    $circle.find(".title, .counter").stop().animate({ opacity: 0 }, 100, "easeInExpo", function() {
      $circle.find(".explore, .background").stop().animate({ opacity: 1 }, 100, "easeOutExpo");
      $circle.addClass("selected");
    });
  }

  function _onMouseLeave() {
    if (animating) return;

    $circle.find(".explore, .background").stop().animate({ opacity: 0 }, 100, "easeOutExpo", function(){
      $title.animate({ opacity: 0.75 }, 100, "easeOutExpo");
      $counter.animate({ opacity: 1 }, 100, "easeOutExpo");
      $circle.removeClass("selected");
    });
  }

  function _hide(e) {
    if (e) {
      e.preventDefault();
    }

    animating = true;

    var _afterHide = function() {
      $circle.animate({ marginTop:0, opacity: 0 }, 250, function() {
        $(this).hide();
      });
    };

    if ($circle) {
      $circle.find(".title, .counter").animate({ opacity: 0 }, 150, "easeOutExpo", _afterHide);
    }
  }

  function _onClick(e) {
    if (e) {
      e.preventDefault();
    }

    History.pushState({ state: 1 }, "Map", "/map");
  }

  function _init() {
    if (_build()) {

      // Bindings
      $circle.die("click");
      $circle.die("mouseenter");
      $circle.die("mouseleave");

      $circle.on("click", _onClick);
      $circle.on("mouseenter", _onMouseEnter);
      $circle.on("mouseleave", _onMouseLeave);

    }
  }

  return {
    init: _init,
    show: _show,
    hide: _hide
  };

})();

var Timeline = (function() {

  var
  $timeline      = $(".timeline"),
  $handle        = $timeline.find(".handle"),
  $play          = $timeline.find(".handle .play"),
  animationPid   = null,
  animationDelay = 500,
  animationSpeed = 120,
  advance        = "10px",
  playing        = false,
  instance       = null,
  dates = [
    [0,  110, 2006],
    [120, 140, null],
    [150, 260, 2007],
    [270, 290, null],
    [300, 410, 2008],
    [420, 440, null],
    [450, 560, 2009],
    [570, 590, null],
    [600, 710, 2010],
    [720, 740, null],
    [750, 860, 2011]
  ];

  function _togglePlayState() {
    $play.fadeOut(100, "easeOutExpo", function() {
      $(this).toggleClass("playing");
      $(this).fadeIn(100, "easeInExpo");
    });
  }

  function _play(e) {
    if (e) {
      e.preventDefault();
    }

    playing = !playing;

    if ($handle.position().left >= dates[dates.length - 1][1]) {
      playing = false;

      // Fake toggle
      $play.fadeOut(100, "easeOutExpo", function() {
        $(this).fadeIn(100, "easeInExpo");
      });

    } else {
      _togglePlayState();
    }

    if (playing) {
      advance = "10px";
      _animate();
    } else {
      _stopAnimation(true);
    }
  }

  function _stopAnimation(animated) {
    advance = "0";
    playing = false;
    clearTimeout(animationPid);

    if (animated) {
      $play.fadeOut(100, "easeOutExpo", function() {
        $(this).removeClass("playing");
        $(this).fadeIn(100, "easeInExpo");
      });
    } else {
      $play.removeClass("playing");
    }
  }

  function _animate() {

    if (!playing) return;

    clearTimeout(animationPid);

    animationPid = setTimeout(function() {

      $handle.animate({ left: "+=" + advance }, animationSpeed, "easeInExpo", function() {

        if ($handle.position().left >= dates[dates.length - 1][1]) {
          _stopAnimation(true);
          _setDate($handle.position().left);
        }

        if (!playing) return;

        _setDate($handle.position().left);
        _animate();
      });

    }, animationDelay);
  }

  function _gotoDate(e) {
    e.preventDefault();
    e.stopPropagation();

    var
    year     = parseInt($(this).text(), 10),
    lastYear = parseInt($timeline.find(".years li:last-child a").text(), 10);

    // if the user clicked on the last year of the timeline
    if (year === lastYear) {
      var pos = dates[ dates.length - 1 ][1];

      $handle.animate({ left: pos }, 150, "easeOutExpo");
      _changeDate(pos, dates[ dates.length - 1 ]);

      return;
    }

    // if the user clicked on another year
    _.each(dates, function(date, j) {

      if (date[2] === year) {
        var pos = date[0];

        $handle.animate({ left: pos }, 150, "easeOutExpo");
        _changeDate(pos, date);
        return;
      }

    });
  }

  function _changeDate(pos, date) {
    var
    monthPos = ( -1 * date[0] + pos) / 10,
    month    = config.MONTHNAMES_SHORT[monthPos];
    $handle.find("div").html("<strong>" + month + "</strong> " + date[2]);
    // year 2000 is base year
    instance.trigger('change_date', date, monthPos + (date[2] - 2000)*12);
  }

  function _setDate(pos, stop) {
    _.each(dates, function(date, j) {

      if (pos >= date[0] && pos <= date[1]) {

        if ( date[2] ) {

          _changeDate(pos, date);

        } else {

          var
          newDate     = (dates[ j + 1 ]) ? dates[ j + 1 ] : dates[ j - 1 ],
          newPosition = (dates[ j + 1 ]) ? newDate[0] : newDate[1];

          $handle.css("left", newPosition);
          _changeDate(newPosition, newDate);
        }

        return;
      }
    });
  }

  function _show() {

    if (_isHidden()) {
      $timeline.removeClass("hidden");
      $timeline.animate({ bottom: parseInt($timeline.css("bottom"), 10) + 20, opacity: 1 }, 150, _afterShow);
    }

  }

  function _hide() {

    if (!_isHidden()) {
      $handle.fadeOut(250, function() {
        $timeline.animate({ bottom: parseInt($timeline.css("bottom"), 10) - 20, opacity: 0 }, 150, _afterHide);
      });
    }

  }

  function _afterShow() {
    $handle.delay(250).fadeIn(250);
  }

  function _afterHide() {
    $timeline.addClass("hidden");
  }

  function _isHidden() {
    return $timeline.hasClass("hidden");
  }

  /*
   * Init function
   **/
  function _init() {

    // Bindings
    $timeline.find(".years a").on("click", _gotoDate);
    $timeline.find(".play").on("click", _play);

    $handle.draggable({
      containment: "parent",
      grid: [10, 0],
      axis: "x",
      drag: function() {
        var left = $(this).position().left;
        _setDate(left);

        if (playing) {
          _stopAnimation(false);
        }
      },
      stop: function() {
        var left = $(this).position().left;
        _setDate(left, true);
      }
    });
  }

  // hack, sorry arce
  // create a temporally object to give Backbone.Events features
  // see _changeDate
  function obj() {}
  _.extend(obj.prototype, Backbone.Events);
  instance = new obj();
  _.extend(instance, {
    init: _init,
    hide: _hide,
    show: _show,
    isHidden: _isHidden
  });
  return instance;

})();


function updateFeed(options) {
  var
  countryCode       = options.countryCode || 'MYS',
  n                 = options.n || 4;
  var url = "https://wri-01.cartodb.com/api/v2/sql?q=SELECT%20to_char(gfw2_forma_datecode.date,%20'dd,%20FMMonth,%20yyyy')%20as%20date,alerts%20FROM%20gfw2_forma_graphs,gfw2_forma_datecode%20WHERE%20gfw2_forma_datecode.n%20=%20gfw2_forma_graphs.date%20AND%20iso%20=%20'"+countryCode+"'%20order%20by%20gfw2_forma_datecode.date%20desc%20LIMIT%20"+n;
  $.ajax({
    dataType: "jsonp",
    jsonpCallback:'iwcallback',
    url: url,
    success: function(json) {
      if (0<json.rows.length){
        $('.alerts ul').html("");
      }
      for (var i=0; i<json.rows.length; i++){
        $('.alerts ul').append(
          $('<li></li>')
          .append(
            $('<span></span>').addClass('data').html(json.rows[i].date))
            .append(
              $('<span></span>').addClass('count').html(json.rows[i].alerts+' Alerts'))
        );
      }
    }
  });
}
function addCircle(id, type, options) {

  var
  countryCode       = options.countryCode || 'MYS',
  width             = options.width      || 300,
  height            = options.height     || width,
  barWidth          = options.barWidth   || 5,
  title             = options.title      || "",
  subtitle          = options.subtitle   || "",
  legend            = options.legend     || "",
  h                 = 100, // maxHeight
  legendUnit        = options.legendUnit || "",
  unit              = options.unit       || "",
  color             = options.color      || "#75ADB5",
  hoverColor        = options.hoverColor || "#427C8D",
  radius            = width / 2,
  mouseOverDuration = 10,
  mouseOutDuration  = 700;

  var graph = d3.select(".circle." + type)
  .append("svg:svg")
  .attr("class", id)
  .attr("width", width)
  .attr("height", height);

  var dashedLines = [
    { x1:45, y:height/4,   x2:270,   color: "#ccc" },
    { x1:2,  y:height/2,   x2:width, color: color },
    { x1:45, y:3*height/4, x2:270,   color: "#ccc" }
  ];

  // Adds the dotted lines
  _.each(dashedLines, function(line) {
    graph.append("svg:line")
    .attr("x1", line.x1)
    .attr("y1", line.y)
    .attr("x2", line.x2)
    .attr("y2", line.y)
    .style("stroke-dasharray", "2,2")
    .style("stroke", line.color);
  });

  // Internal circle
  graph.append("circle")
  .attr("width", width)
  .attr("height", height)
  .style("stroke", color)
  .attr("r", function(d) { return radius - 15.5; })
  .attr("transform", "translate(" + radius + "," + radius + ")");

  // External circle
  graph.append("circle")
  .attr("width", width)
  .attr("height", height)
  .style("stroke", "white")
  .attr("r", function(d) { return radius - 5.5; })
  .attr("transform", "translate(" + radius + "," + radius + ")")
  .on("mouseout", function(d) {
  });

  function addText(opt) {
    graph.append("foreignObject")
    .attr('x', opt.x)
    .attr('y', opt.y)
    .attr('width', opt.width)
    .attr('height', opt.height)
    .attr('class', opt.c)
    .append("xhtml:div")
    .html(opt.html)
  }


  // Content selection: lines or bars
  if (type == 'lines') {

    d3.json("https://wri-01.cartodb.com/api/v2/sql?q=SELECT date_part('year',gfw2_forma_datecode.date) as y, date_part('month',gfw2_forma_datecode.date) as m,alerts FROM gfw2_forma_graphs,gfw2_forma_datecode WHERE  71<gfw2_forma_datecode.n AND gfw2_forma_datecode.n = gfw2_forma_graphs.date AND iso = '" + countryCode + "' order by gfw2_forma_datecode.date asc", function(json) {

      var data = json.rows.slice(1,json.rows.length);

      var x = d3.scale.linear()
      .domain([0, data.length - 1])
      .range([0, width - 80]);

      var y = d3.scale.linear()
      .domain([0, d3.max(data, function(d) {return d.alerts})])
      .range([0, h]);

      var line = d3.svg.line()
      .x(function(d,i)  { return x(i); })
      .y(function(d, i) { return h-y(d.alerts); })
      .interpolate("basis");

      // Adds the line graph
      var marginLeft = 40;
      var marginTop = radius - h/2;

      var p = graph.append("svg:path")
      .attr("transform", "translate(" + marginLeft + "," + marginTop + ")")
      .attr("d", line(data))
      .on("mousemove", function(d) {

        var index = Math.round(x.invert(d3.mouse(this)[0]));

        if (data[index]) { // if there's data
          var val = data[index].alerts + " <small>" + unit + "</small>";
          $(".amount." + id + " .text").html(val);

          var date = new Date(data[index].y, data[index].m);
          months = monthDiff(date, new Date());

          if (months === 0) {
            val = "in this month";
          } else if (months == 1) {
            val = "in the last month";
          } else {
            val = "in the last " + months + " months";
          }

          $(".graph_legend." + id + " .text").html(val);

          d3.select(this).transition().duration(mouseOverDuration).style("fill", hoverColor);

          var cx = d3.mouse(this)[0]+marginLeft;
          var cy = h-y(data[index].alerts)+marginTop;

          graph.select("#marker")
          .attr("cx",cx)
          .attr("cy",cy)
        }
      })

      graph.append("circle")
      .attr("id", "marker")
      .attr("cx", -10000)
      .attr("cy",100)
      .attr("r", 5);

    });


  } else if (type == 'bars') {

    d3.json("https://wri-01.cartodb.com/api/v2/sql?q=SELECT area_sqkm,height_m FROM gfw2_forest_heights WHERE iso = '"+ countryCode +"' ORDER BY height_m ASC", function(json) {

      var data = json.rows;

      var x = d3.scale.linear()
      .domain([0, 1])
      .range([0, barWidth]);

      var y = d3.scale.linear()
      .domain([0, d3.max(data, function(d) {return d.area_sqkm})])
      .rangeRound([0, h]); //rangeRound is used for antialiasing

      var marginLeft = width/2 - data.length * barWidth/2;
      var marginTop = height/2 - h/2;

      graph.selectAll("rect")
      .data(data).enter()
      .append("rect")
      .attr("x", function(d, i) { return x(i) - .5; })
      .attr("y", function(d) {
        var l = y(d.area_sqkm);
        if (l<3) l = 3;
        return h - l - .3; }
           )
           .attr("width", barWidth)
           .attr("height", function(d) {
             var l = y(d.area_sqkm);
             if (l<3) l = 3;
             return l; }
                )
                .attr("transform", "translate(" + marginLeft + "," + marginTop + ")")
                .on("mouseover", function(d) {

                  var val = Math.floor(d.area_sqkm) + " <small>" + unit + "</small>";
                  $(".amount." + id + " .text").html(val);

                  var t = _.template(legend);
                  val = t({ n: Math.floor(d.height_m) + legendUnit });
                  $(".graph_legend." + id + " .text").html(val);

                  d3.select(this).transition().duration(mouseOverDuration).style("fill", hoverColor);
                })
                .on("mouseout", function() { d3.select(this).transition().duration(mouseOutDuration).style("fill", color); })
    });

  }

  // Adds texts

  if (title) {
    addText({ x: 0, y: 40, width: width, height: 50, c:"title", html: '<div class="text">' + title + '</div>' });
  }

  if (subtitle) {
    addText({ x: 0, y: height/4 - 10, width: width, height: 50, c:"subtitle", html: '<div class="text">' + subtitle + '</div>' });
  }

  addText({ x: 0, y: 3*height/4 - 13, width: width, height: 50, c:"amount " + id, html: '<div class="text"></div>' });

  if (legend) {
    addText({ x: 0, y: 3*height/4 + 15, width: width, height: 50, c:"graph_legend " + id, html: '<div class="text"></div>' });
  }
}

