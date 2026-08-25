'use strict';
// SPRITES — carga y dibujo de los retratos/sprites de art/.
// Fallback automático: si un sprite no está cargado, el juego usa el arte procedural.
var SPRITES = (function () {
  var img = {}; // clave 'kind:name' -> Image
  var KINDS = { e: 'art/enemies/', t: 'art/towers/', s: 'art/soldiers/' };

  function preload(list) {
    list.forEach(function (key) {
      var kind = key[0], name = key[1];
      var path = KINDS[kind] + name + '.png';
      var i = new Image();
      i.onload = function () { img[kind + ':' + name] = i; };
      i.src = path;
    });
  }

  // Dibuja el sprite anclado abajo-centro en (x, y) con altura visual h.
  // flash>0 aplica sobreexposición (golpe). Devuelve true si dibujó.
  function draw(ctx, kind, name, x, y, h, flash, alpha) {
    var i = img[kind + ':' + name];
    if (!i || !i.complete || !i.naturalWidth) return false;
    var s = h / i.naturalHeight;
    var w = i.naturalWidth * s;
    ctx.save();
    if (alpha != null && alpha < 1) ctx.globalAlpha *= Math.max(0, alpha);
    if (flash > 0) ctx.filter = 'brightness(' + (1 + flash * 1.6).toFixed(2) + ') saturate(' + (1 - flash * 0.7).toFixed(2) + ')';
    ctx.drawImage(i, x - w / 2, y - h, w, h);
    ctx.restore();
    return true;
  }

  function has(kind, name) { return !!img[kind + ':' + name]; }

  return { preload: preload, draw: draw, has: has };
})();
