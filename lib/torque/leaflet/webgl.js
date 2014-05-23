
function glGetError(gl) {
        var ctx, error;
        ctx = gl.getCurrentContext();
        error = ctx.errorValue;
        ctx.errorValue = GL_NO_ERROR;
        return error;
}

// webgl utils
function shaderProgram(gl, vs, fs) {
  var prog = gl.createProgram();
  var addshader = function(type, source) {
    var s = gl.createShader((type == 'vertex') ?
      gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw "Could not compile "+type+
        " shader:\n\n"+gl.getShaderInfoLog(s);
    }
    gl.attachShader(prog, s);
  };
  addshader('vertex', vs);
  addshader('fragment', fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw "Could not link the shader program!";
  }
  return prog;
}

function createVertexBuffer(gl, rsize, arr) {
  var buff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  buff.vSize = rsize;
  return buff;
}

function setBufferData(gl, prog, attr_name, buff) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buff);
  var attr = gl.getAttribLocation(prog, attr_name);
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, buff.vSize, gl.FLOAT, false, 0, 0);
}

function initFB() {
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    fb.width = 512;
    fb.height = 512;
}

function WebGLRenderer(el) {
  this.gl = el.getContext('webgl');
  this._init();
  this.width = el.width;
  this.height = el.height;
  this.image_cache = {}
}


/*
 * #mn_mappluto_13v1{
  line-color: #FFF;
  line-width: 1;
  line-opacity: 1;
  [numfloors<=104]{building-height:52;}[numfloors<=100]{building-height:50;}[numfloors<=96]{building-height:48;}[numfloors<=92]{building-height:46;}[numfloors<=88]{building-height:44;}[numfloors<=84]{building-height:42;}[numfloors<=80]{building-height:40;}[numfloors<=76]{building-height:38;}[numfloors<=72]{building-height:36;}[numfloors<=68]{building-height:34;}[numfloors<=64]{building-height:32;}[numfloors<=60]{building-height:30;}[numfloors<=56]{building-height:28;}[numfloors<=52]{building-height:26;}[numfloors<=48]{building-height:24;}[numfloors<=44]{building-height:22;}[numfloors<=40]{building-height:20;}[numfloors<=36]{building-height:18;}[numfloors<=32]{building-height:16;}[numfloors<=28]{building-height:14;}[numfloors<=24]{building-height:12;}[numfloors<=20]{building-height:10;}[numfloors<=16]{building-height:8;}[numfloors<=12]{building-height:0;}
}
#mn_mappluto_13v1 [ spiderman <= 576] {
   building-fill: #B10026;
}
#mn_mappluto_13v1 [ spiderman <= 168] {
   building-fill: #E31A1C;
}
#mn_mappluto_13v1 [ spiderman <= 98] {
   building-fill: #FC4E2A;
}
#mn_mappluto_13v1 [ spiderman <= 73] {
   building-fill: #FD8D3C;
}
#mn_mappluto_13v1 [ spiderman <= 45] {
   building-fill: #FEB24C;
}
#mn_mappluto_13v1 [ spiderman <= 29] {
   building-fill: #FED976;
}
#mn_mappluto_13v1 [ spiderman <= 14] {
   building-fill: #FFFFB2;
}
*/
//256/EARTH_RADIUS * 2 * Math.PI
//6378137

WebGLRenderer.prototype._init = function() {
        var gl = this.gl;
        var prog = shaderProgram(gl,
          "precision highp float;\n"+
          //"#define M_PI 3.1415926535897932384626433832795\n" +
          //"uniform float zoom;" +
          "uniform vec2 tilePos;" +
          "uniform vec2 mapSize;" +
          "uniform float pSize;" +
          "attribute vec2 pos;"+
          "void main() {"+
          //" float er = 6378137.0;" +
          //" float s = (256.0*pow(2.0, zoom))/(er*M_PI*2.0);"+
          " gl_PointSize = pSize;" +
          " vec2 p = vec2(pos.x, -pos.y);" +
          " gl_Position = vec4((2.0*(p + tilePos)/mapSize), 0.0, 1.0);"+
          //" gl_Position = vec4((2.0*pos/mapSize) - vec2(1.0, 1.0), 0.0, 1.0);"+
          //" gl_Position = vec4(0.0, 0.0, 0.0, 1.0);"+
          "}",
          "precision highp float;"+
          "void main() {"+
          "float d = 1.0 - pow(length(2.0*vec2(gl_PointCoord.s - 0.5, gl_PointCoord.t - 0.5)), 5.0);" +
          "gl_FragColor = vec4(d, 0.0, 0.0, d);" +
          "}"
        );
        this.program = prog;
        gl.useProgram(prog);
        /*this.vertexBuffer = createVertexBuffer(gl, 2, [
          -1, -1,
          -1, 1,
          1, -1,
          1, 1
        ]);
        setBufferData(gl, prog, "pos", this.vertexBuffer);
        */
        var err = gl.errorValue;
        if(err !== 0) {
          console.log(err);
        }
};

function uploadTexture(gl, img) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

WebGLRenderer.prototype.activeProgram = function() {
  return this.program;
}

WebGLRenderer.prototype.createVertexBuffer = function(data) {
  return createVertexBuffer(this.gl, 2, data);
}

/*
WebGLRenderer.prototype.loadImageTile = function(tile) {
    var self = this;
    //var layer = 'http://b.tiles.mapbox.com/v3/mapbox.mapbox-light/{{z}}/{{x}}/{{y}}.png64';
    layer = 'http://tile.stamen.com/toner/{{z}}/{{x}}/{{y}}.png';
    var url = layer.replace('{{z}}', tile.zoom).replace('{{x}}', tile.i).replace('{{y}}', tile.j);
    var k = tile.zoom + '-' + tile.i + '-' + tile.j;
    var i = this.image_cache[k];
    if(i === undefined) {
        self.image_cache[k] = null;
        var img = new Image();
        img.crossOrigin = "*";  
        img.onload = function() {
            self.image_cache[k] = uploadTexture(self.gl, img);
            console.log(k + " loaded");
            //requestAnimationFrame(self.render);
        };
        img.src = url;
    }
}

WebGLRenderer.prototype.renderTiles = function(tiles, center, zoom) {
        var gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        var mapSize = gl.getUniformLocation(this.program, "mapSize");
        gl.uniform2fv(mapSize, [this.width, this.height]);
        var zoom = gl.getUniformLocation(this.program, "zoom");
        gl.uniform1f(zoom, zoom);
        var mapPos = gl.getUniformLocation(this.program, "mapPos");
        gl.uniform2fv(mapPos, [center.x, center.y]);
        var tileImage = gl.getUniformLocation(this.program, "tileImage");

        
        for(var i = 0; i < tiles.length; ++i) {
            var tile = tiles[i];
            this.loadImageTile(tile);
            var k = tile.zoom + '-' + tile.i + '-' + tile.j;
            var img = this.image_cache[k];
            if(img) {
               gl.activeTexture(gl.TEXTURE0);
               gl.bindTexture(gl.TEXTURE_2D, img);
               gl.uniform1i(tileImage, 0);
               var tilePos = gl.getUniformLocation(this.program, "tilePos");
               gl.uniform2fv(tilePos, [tile.x, tile.y]);
               gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        }


        var err = gl.errorValue;
        if(err !== 0) {
          console.log(err);
        }
};
*/
