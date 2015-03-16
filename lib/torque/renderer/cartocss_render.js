  var TAU = Math.PI*2;
  // min value to render a line. 
  // it does not make sense to render a line of a width is not even visible
  var LINEWIDTH_MIN_VALUE = 0.05; 

  function renderPoint(ctx, st) {
    ctx.fillStyle = st['marker-fill'];
    var pixel_size = st['marker-width'];

    // render a circle
    // TODO: fill and stroke order should depend on the order of the properties
    // in the cartocss.

    // fill
    ctx.beginPath();
    ctx.arc(0, 0, pixel_size, 0, TAU, true, true);
    ctx.closePath();
    if (st['marker-fill']) {
      if (st['marker-fill-opacity'] !== undefined || st['marker-opacity'] !== undefined) {
        ctx.globalAlpha = st['marker-fill-opacity'] >=0 ? st['marker-fill-opacity']: st['marker-opacity'];
      }
      ctx.fill();
    }

    // stroke
    ctx.globalAlpha = st['marker-opacity'] >=0 ? st['marker-opacity']: 1;
    if (st['marker-line-color'] && st['marker-line-width'] && st['marker-line-width'] > LINEWIDTH_MIN_VALUE) {
      if (st['marker-line-opacity'] !== undefined) {
        ctx.globalAlpha = st['marker-line-opacity'];
      }
      if (st['marker-line-width'] !== undefined) {
        ctx.lineWidth = st['marker-line-width'];
      }
      ctx.strokeStyle = st['marker-line-color'];

      // do not render for alpha = 0
      if (ctx.globalAlpha > 0) {
        ctx.stroke();
      }
    }
  }

  function renderRectangle(ctx, st) {
    ctx.fillStyle = st['marker-fill'];
    var pixel_size = st['marker-width'];
    var w = pixel_size * 2;

    // fill
    if (st['marker-fill']) {
      if (st['marker-fill-opacity'] !== undefined || st['marker-opacity'] !== undefined) {
        ctx.globalAlpha = st['marker-fill-opacity'] || st['marker-opacity'];
      }
      ctx.fillRect(-pixel_size, -pixel_size, w, w)
    }

    // stroke
    ctx.globalAlpha = 1.0;
    if (st['marker-line-color'] && st['marker-line-width']) {
      if (st['marker-line-opacity']) {
        ctx.globalAlpha = st['marker-line-opacity'];
      }
      if (st['marker-line-width']) {
        ctx.lineWidth = st['marker-line-width'];
      }
      ctx.strokeStyle = st['marker-line-color'];

      // do not render for alpha = 0
      if (ctx.globalAlpha > 0) {
        ctx.strokeRect(-pixel_size, -pixel_size, w, w)
      }
    }
  }

  function renderSprite(ctx, img, st) {

    if(img.complete){
      if (st['marker-fill-opacity'] !== undefined || st['marker-opacity'] !== undefined) {
        ctx.globalAlpha = st['marker-fill-opacity'] || st['marker-opacity'];
      }
      ctx.drawImage(img, 0, 0, img.width, img.height);
    }
  }

module.exports = {
    renderPoint: renderPoint,
    renderSprite: renderSprite,
    renderRectangle: renderRectangle
};
