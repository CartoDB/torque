//========================================
// vecnik views 
//========================================

(function(VECNIK) {

  function Renderer() {
      var self = this;
      var primitive_render = this.primitive_render = {
          'Point': function(ctx, coordinates) {
                    ctx.save();
                    var radius = 2;
                    var p = coordinates;
                    ctx.translate(p.x, p.y);
                    ctx.beginPath();
                    ctx.arc(radius, radius, radius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
          },
          'MultiPoint': function(ctx, coordinates) {
                var prender = primitive_render['Point'];
                for(var i=0; i < coordinates.length; ++i) {
                    prender(ctx, coordinates[i]);
                }
          },
          'Polygon': function(ctx, coordinates) {
                ctx.beginPath();
                var p = coordinates[0][0];
                ctx.moveTo(p.x, p.y);
                for(var i=0; i < coordinates[0].length; ++i) {
                  p = coordinates[0][i];
                  ctx.lineTo(p.x, p.y);
               }
               ctx.closePath();
               ctx.fill();
               //ctx.stroke();
          },
          'MultiPolygon': function(ctx, coordinates) {
                var prender = primitive_render['Polygon'];
                for(var i=0; i < coordinates.length; ++i) {
                    prender(ctx, coordinates[i]);
                }
          },
          'LineString': function(ctx, coordinates) {
                ctx.beginPath();
                var p = coordinates[0];
                ctx.moveTo(p.x, p.y);
                for(var i=0; i < coordinates.length; ++i) {
                  p = coordinates[i];
                  ctx.lineTo(p.x, p.y);
               }
               ctx.stroke();
          }
      };
  }

  Renderer.prototype.render = function(ctx, geometry, zoom, shader) {
    var primitive_render = this.primitive_render;
    ctx.canvas.width = ctx.canvas.width;
    var primitive_type;
    if(geometry && geometry.length) {
        for(var i = 0; i < geometry.length; ++i) {
            var geo = geometry[i];
            var primitive_type = geo.type;
            var renderer = primitive_render[primitive_type];
            if(renderer) {
                // render visible tile
                var render_context = {
                    zoom: zoom,
                    id: i
                };
                var is_active = true;
                if(shader) {
                  is_active = shader.needs_render(geo.metadata, render_context, primitive_type);
                  if(is_active) {
                    shader.reset(ctx, primitive_type);
                    shader.apply(ctx, geo.metadata, render_context);
                  }
                }
                if (is_active) {
                  renderer(ctx, geo.vertexBuffer);
                }
            }
        }
    }
  };

  //========================================
  // Canvas tile view 
  //========================================
  function CanvasTileView(tile, shader, renderer) {
      this.tileSize = new VECNIK.Point(256, 256);
      var canvas = document.createElement('canvas');
      canvas.width = this.tileSize.x;
      canvas.height = this.tileSize.y;
      this.ctx = canvas.getContext('2d');
      this.canvas = canvas;

      var backCanvas = document.createElement('canvas');
      backCanvas.width = this.tileSize.x;
      backCanvas.height = this.tileSize.y;
      this.backCtx = backCanvas.getContext('2d');
      this.backCanvas = backCanvas;

      this.el = canvas;
      this.id = tile.key();
      this.el.setAttribute('id', tile.key());
      var self = this;
      this.tile = tile;
      var render =  function(){self.render();};
      tile.on('geometry_ready', render);

      // shader
      this.shader = shader;
      if(shader) {
          shader.on('change', render);
      }
      this.renderer = renderer || new Renderer();

      this.profiler = new VECNIK.Profiler('tile_render');
      this.stats = {
        rendering_time: 0
      }
  }

  CanvasTileView.prototype.remove = function() {
  }

  CanvasTileView.prototype.render = function() {
    var ctx = this.ctx;

    this.profiler.start('render');
    var BACKBUFFER = true;
    if(BACKBUFFER) {
        this.backCanvas.width = this.backCanvas.width;
        this.renderer.render(this.backCtx, this.tile.geometry(), this.tile.zoom, this.shader);
        this.canvas.width = this.canvas.width;
        this.ctx.drawImage(this.backCanvas, 0, 0);
    } else {
      this.renderer.render(ctx, this.tile.geometry(), this.tile.zoom, this.shader);
    }

    this.stats.rendering_time = this.profiler.end();
  }


  //========================================
  // Map view
  // manages the list of tiles
  //========================================
  function CanvasMapView() {
    this.tile_views = {};
  }

  CanvasMapView.prototype.add = function(canvasview) {
    this.tile_views[canvasview.id] = canvasview;
  }

  CanvasMapView.prototype.getByElement = function(el) {
    return this.tile_views[el.getAttribute('id')];
  }


  VECNIK.Renderer = Renderer;
  VECNIK.CanvasTileView = CanvasTileView;
  VECNIK.CanvasMapView = CanvasMapView;

})(VECNIK);

if (typeof module !== 'undefined' && module.exports) {
}


