
//========================================
// shader
//========================================

(function(VECNIK) {

  var mapper = {
      'point-color': 'fillStyle',
      'line-color': 'strokeStyle',
      'line-width': 'lineWidth',
      'line-opacity': 'globalAlpha',
      'polygon-fill': 'fillStyle',
      'polygon-opacity': 'globalAlpha'
  };

  function CartoShader(shader) {
      this.compiled = {};
      this.shader_src = null;
      this.compile(shader)
  }

  CartoShader.prototype = new VECNIK.Event();

  CartoShader.prototype.compile = function(shader) {
      if(typeof shader === 'string') {
          shader = eval("(function() { return " + shader +"; })()");
      }
      this.shader_src = shader;
      for(var attr in shader) {
          var c = mapper[attr];
          if(c) {
              this.compiled[c] = eval("(function() { return shader[attr]; })();");
          }
      }

      this.emit('change');
  };

  var needed_settings = {
    'LineString': [ 
        'line-color', 
        'line-width',
        'line-opacity'
    ],
    'Polygon': [ 
        'polygon-fill'
    ],
    'MultiPolygon': [ 
        'polygon-fill'
    ]
  };
  var defaults = {
    'LineString': {
      'strokeStyle': '#000',
      'lineWidth': 1,
      'globalAlpha': 1.0,
      'lineCap': 'round'
    },
    'Polygon': {
      'strokeStyle': '#000',
      'lineWidth': 1,
      'globalAlpha': 1.0
    },
    'MultiPolygon': {
      'strokeStyle': '#000',
      'lineWidth': 1,
      'globalAlpha': 1.0
    }
  };

  CartoShader.prototype.needs_render = function(data, render_context, primitive_type) {
      var variables = needed_settings[primitive_type];
      var shader = this.compiled;
      for(var attr in variables) {
          var style_attr = variables[attr];
          var attr_present = this.shader_src[style_attr];
          if(attr_present !== undefined) {
            var fn = shader[mapper[style_attr]];
            if(typeof fn === 'function') {
                fn = fn(data, render_context);
            } 
            if(fn !== null && fn !== undefined) {
              return true;
            }
          } 
      }
      return false;
    
  }

  CartoShader.prototype.reset = function(ctx, primitive_type) {
      var def = defaults[primitive_type];
      for(var attr in def) {
        ctx[attr] = def[attr];
      }
  }

  CartoShader.prototype.apply = function(canvas_ctx, data, render_context) {
      var shader = this.compiled;
      for(var attr in shader) {
          var fn = shader[attr];
          if(typeof fn === 'function') {
              fn = fn(data, render_context);
          } 
          if(fn !== null && canvas_ctx[attr] != fn) {
            canvas_ctx[attr] = fn;
          }
      }
  };

  VECNIK.CartoShader = CartoShader;

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
  module.exports.CartoShader = CartoShader;
}


