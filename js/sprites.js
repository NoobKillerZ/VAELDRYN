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

  function has(kind, name) { return !!img[kind + ':' + name]; }

  // Blit simple anclado abajo-centro. Devuelve true si dibujó.
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

  // Unidad animada: sombra + bob de marcha + balanceo + embestida de ataque
  // + squash de daño. opts: { walk, atk, hurt, face, flying, death }
  function drawUnit(ctx, kind, name, x, y, h, o) {
    var i = img[kind + ':' + name];
    if (!i || !i.complete || !i.naturalWidth) return false;
    o = o || {};
    var face = o.face || 1;
    var walk = o.walk || 0;
    var atk = o.atk || 0;
    var hurt = Math.max(0, Math.min(1, o.hurt || 0));
    var s = h / i.naturalHeight;
    var w = i.naturalWidth * s;

    // sombra de contacto
    ctx.save();
    ctx.globalAlpha = o.flying ? 0.14 : 0.24;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.32, h * 0.07, 0, 0, 6.28);
    ctx.fill();
    ctx.restore();

    // cinética: bob de paso, balanceo, embestida al golpear
    var bob = -Math.abs(Math.sin(walk)) * h * 0.055;
    var rot = Math.sin(walk) * 0.055 * face;
    var ap = (typeof ART !== 'undefined' && ART.atkPose) ? ART.atkPose(atk) : { reach: 0 };
    var lunge = ap.reach * face * w * 0.16;
    var breathe = 1 + Math.sin(walk * 0.5) * 0.012;

    ctx.save();
    ctx.translate(x + lunge, y + bob);
    ctx.rotate(rot);
    ctx.scale(breathe * (1 + hurt * 0.12), (2 - breathe) * (1 - hurt * 0.14));
    if (o.death != null && o.death >= 0) {
      var dd = o.death;
      ctx.rotate(face * dd * dd * 1.2);
      ctx.globalAlpha *= Math.max(0, 1 - dd * 1.1);
    }
    if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= Math.max(0, o.alpha);
    if (hurt > 0) ctx.filter = 'brightness(' + (1 + hurt * 1.5).toFixed(2) + ') saturate(' + (1 - hurt * 0.65).toFixed(2) + ')';
    ctx.drawImage(i, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }

  return { preload: preload, draw: draw, drawUnit: drawUnit, has: has };
})();
