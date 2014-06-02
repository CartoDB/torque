(function(exports) {

  exports.torque = exports.torque || {};

  var TAU = Math.PI*2;
  function renderPoint(ctx, st) {
    ctx.fillStyle = st.fillStyle;
    ctx.strokStyle = st.strokStyle;
    var pixel_size = st['point-radius'];

    // render a circle

    // fill
    ctx.beginPath();
    ctx.arc(0, 0, pixel_size, 0, TAU, true, true);
    ctx.closePath();
    if (st.fillStyle) {
      if (st.fillOpacity) {
        ctx.globalAlpha = st.fillOpacity;
      }
      ctx.fill();
    }

    // stroke
    ctx.globalAlpha = 1.0;
    if (st.strokeStyle && st.lineWidth) {
      if (st.strokeOpacity) {
        ctx.globalAlpha = st.strokeOpacity;
      }
      if (st.lineWidth) {
        ctx.lineWidth = st.lineWidth;
      }
      ctx.strokeStyle = st.strokeStyle;

      // do not render for alpha = 0
      if (ctx.globalAlpha > 0) {
        ctx.stroke();
      }
    }
  }

  function renderRectangle(ctx, st) {
    ctx.fillStyle = st.fillStyle;
    ctx.strokStyle = st.strokStyle;
    var pixel_size = st['point-radius'];
    var w = pixel_size * 2;

    // fill
    if (st.fillStyle && st.fillOpacity) {
      ctx.globalAlpha = st.fillOpacity;
    }
    ctx.fillRect(-pixel_size, -pixel_size, w, w)

    // stroke
    ctx.globalAlpha = 1.0;
    if (st.strokeStyle && st.lineWidth) {
      if (st.strokeOpacity) {
        ctx.globalAlpha = st.strokeOpacity;
      }
      if (st.lineWidth) {
        ctx.lineWidth = st.lineWidth;
      }
      ctx.strokeStyle = st.strokeStyle;

      // do not render for alpha = 0
      if (ctx.globalAlpha > 0) {
        ctx.strokeRect(-pixel_size, -pixel_size, w, w)
      }
    }
  }

  function renderSprite(ctx, st) {
    var img = st['point-file'] || st['marker-file'];
    var ratio = img.height/img.width;
    var w = st['point-radius'] || img.width;
    var h = st['point-radius'] || st['marker-height'] || w*ratio;
    ctx.drawImage(img, 0, 0, w, h);
  }

  exports.torque.cartocss = exports.torque.cartocss || {};
  exports.torque.cartocss = {
    renderPoint: renderPoint,
    renderSprite: renderSprite,
    renderRectangle: renderRectangle
  };

})(typeof exports === "undefined" ? this : exports);
