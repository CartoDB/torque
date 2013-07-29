(function(exports) {

  exports.torque = exports.torque || {};

  var TAU = Math.PI*2;
  function renderPoint(ctx, st) {
    ctx.fillStyle = st.fillStyle;
    ctx.strokStyle = st.strokStyle;
    var pixel_size = st['point-radius']
    // render a circle
    ctx.beginPath();
    ctx.arc(0, 0, pixel_size, 0, TAU, true, true);
    ctx.closePath();
    if(st.fillStyle) {
      if(st.fillOpacity) {
        ctx.globalAlpha = st.fillOpacity;
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    if(st.strokeStyle) {
      if(st.strokeOpacity) {
        ctx.globalAlpha = st.strokeOpacity;
      }
      if(st.lineWidth) {
        ctx.lineWidth = st.lineWidth;
      }
      ctx.strokeStyle = st.strokeStyle;
      ctx.stroke();
    }
  }

  exports.torque.cartocss = exports.torque.cartocss|| {};
  exports.torque.cartocss.renderPoint = renderPoint;

})(typeof exports === "undefined" ? this : exports);
