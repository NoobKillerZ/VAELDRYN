'use strict';

// ============================================================
//  ARTKIT — Motor de arte procedural 2D de VAELDRYN
//  Figuras humanoides animadas, bestias, jefes, armas y
//  elementos orgánicos reutilizables.
// ============================================================

var ART = (function () {

  function hex2rgb(h) {
    var s = String(h);
    if (s[0] === 'r') { // 'rgb(r,g,b)' / 'rgba(r,g,b,a)'
      var m = s.match(/[\d.]+/g);
      return [+m[0], +m[1], +m[2]];
    }
    s = s.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
  }

  function shade(hex, amt) {
    if (hex[0] === 'r') return hex;
    var c = hex2rgb(hex);
    return 'rgb(' + Math.max(0, Math.min(255, c[0] + amt)) + ',' + Math.max(0, Math.min(255, c[1] + amt)) + ',' + Math.max(0, Math.min(255, c[2] + amt)) + ')';
  }

  function rgba(hex, a) {
    if (hex[0] === 'r') return hex;
    var c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(a, b, t) {
    var ca = hex2rgb(a), cb = hex2rgb(b);
    return 'rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * t) + ',' + Math.round(ca[1] + (cb[1] - ca[1]) * t) + ',' + Math.round(ca[2] + (cb[2] - ca[2]) * t) + ')';
  }

  // ---- Primitivas orgánicas ------------------------------------

  // Segmento de extremidad con articulación (hueso → nudillo).
  function limb(c, x1, y1, x2, y2, x3, y3, w, col, dark) {
    c.strokeStyle = dark; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = w + 1.4;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke();
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke();
    c.fillStyle = shade(col, 18);
    c.beginPath(); c.arc(x2, y2, w * 0.62, 0, 6.28); c.fill();
  }

  // Línea simple redondeada con sombreado inferior.
  function rod(c, x1, y1, x2, y2, w, col, dark) {
    c.strokeStyle = dark; c.lineCap = 'round';
    c.lineWidth = w + 1.2;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  // Segmento de extremidad cónico: raíz gruesa → extremo fino,
  // con contorno oscuro e interior con sombreado de perfil.
  function taper(c, x1, y1, x2, y2, w1, w2, col, dark) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var h1 = w1 * 0.5, h2 = w2 * 0.5;
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x1 + nx * h1, y1 + ny * h1);
    c.lineTo(x2 + nx * h2, y2 + ny * h2);
    c.lineTo(x2 - nx * h2, y2 - ny * h2);
    c.lineTo(x1 - nx * h1, y1 - ny * h1);
    c.closePath(); c.fill();
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x1 + nx * (h1 - 1), y1 + ny * (h1 - 1));
    c.lineTo(x2 + nx * (h2 - 1), y2 + ny * (h2 - 1));
    c.lineTo(x2 - nx * (h2 - 1), y2 - ny * (h2 - 1));
    c.lineTo(x1 - nx * (h1 - 1), y1 - ny * (h1 - 1));
    c.closePath(); c.fill();
    // franja de sombra en el borde opuesto a la luz
    c.fillStyle = rgba(dark, 0.5);
    c.beginPath();
    c.moveTo(x1 - nx * (h1 * 0.35), y1 - ny * (h1 * 0.35));
    c.lineTo(x2 - nx * (h2 * 0.35), y2 - ny * (h2 * 0.35));
    c.lineTo(x2 - nx * (h2 - 1), y2 - ny * (h2 - 1));
    c.lineTo(x1 - nx * (h1 - 1), y1 - ny * (h1 - 1));
    c.closePath(); c.fill();
    // brillo de articulación
    c.fillStyle = shade(col, 22);
    c.beginPath(); c.arc(x1 + nx * (h1 * 0.2), y1 + ny * (h1 * 0.2), Math.max(h1 * 0.5, 1.2), 0, 6.28); c.fill();
  }

  function orb(c, x, y, r, col, glowCol) {
    var g = c.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, col);
    g.addColorStop(1, glowCol || rgba(col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  }

  function eyes(c, x1, y1, x2, y2, col, glow) {
    c.fillStyle = col;
    c.beginPath(); c.arc(x1, y1, 1.6, 0, 6.28); c.fill();
    c.beginPath(); c.arc(x2, y2, 1.6, 0, 6.28); c.fill();
    if (glow) {
      c.fillStyle = rgba(col, 0.4);
      c.beginPath(); c.arc(x1, y1, 2.8, 0, 6.28); c.fill();
      c.beginPath(); c.arc(x2, y2, 2.8, 0, 6.28); c.fill();
    }
  }

  // Ala membranosa con brazo, dedos óseos y borde festoneado.
  // flap ∈ [-1, 1]: bate la geometría completa del ala.
  function wing(c, x, y, dir, len, flap, col, dark) {
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    var lift = flap * len * 0.26;
    // articulaciones del ala
    var ex = len * 0.44, ey = -len * 0.46 - lift;            // codo (muñeca)
    var t1x = len * 1.05, t1y = -len * 0.92 - lift * 1.5;    // dedo 1 — punta del ala
    var t2x = len * 1.0, t2y = -len * 0.34 - lift * 0.9;     // dedo 2
    var t3x = len * 0.82, t3y = len * 0.16 - lift * 0.35;    // dedo 3
    var bx = len * 0.1, by = len * 0.34;                     // anclaje inferior al cuerpo
    // membrana con borde festoneado entre los dedos
    var mg = c.createLinearGradient(0, 0, len, -len * 0.6);
    mg.addColorStop(0, mix(dark, col, 0.45));
    mg.addColorStop(0.55, col);
    mg.addColorStop(1, shade(col, 16));
    c.fillStyle = mg;
    c.beginPath();
    c.moveTo(0, -len * 0.04);
    c.lineTo(ex, ey);
    c.lineTo(t1x, t1y);
    c.quadraticCurveTo(len * 0.82, -len * 0.44 - lift * 1.05, t2x, t2y);
    c.quadraticCurveTo(len * 0.74, -len * 0.06 - lift * 0.5, t3x, t3y);
    c.quadraticCurveTo(len * 0.44, len * 0.34, bx, by);
    c.closePath(); c.fill();
    c.strokeStyle = rgba(dark, 0.85); c.lineWidth = Math.max(1, len * 0.032); c.lineJoin = 'round'; c.stroke();
    // estrías radiales de la membrana
    c.strokeStyle = rgba(dark, 0.32); c.lineWidth = Math.max(0.7, len * 0.018);
    c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(len * 0.62, -len * 0.4 - lift * 0.8, len * 0.88, -len * 0.38 - lift * 0.95); c.stroke();
    c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(len * 0.58, -len * 0.16 - lift * 0.45, len * 0.86, -len * 0.08 - lift * 0.42); c.stroke();
    c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(len * 0.5, len * 0.08, len * 0.5, len * 0.2); c.stroke();
    // huesos: brazo + tres dedos
    c.strokeStyle = dark; c.lineCap = 'round';
    c.lineWidth = Math.max(1.6, len * 0.062);
    c.beginPath(); c.moveTo(0, -len * 0.04); c.lineTo(ex, ey); c.stroke();
    c.lineWidth = Math.max(1.2, len * 0.045);
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(t1x, t1y); c.stroke();
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(t2x, t2y); c.stroke();
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(t3x, t3y); c.stroke();
    // nudillo del codo + garra
    c.fillStyle = shade(dark, 14);
    c.beginPath(); c.arc(ex, ey, Math.max(1.4, len * 0.055), 0, 6.28); c.fill();
    c.fillStyle = shade(dark, 30);
    c.beginPath();
    c.moveTo(ex + len * 0.01, ey - len * 0.02);
    c.lineTo(ex + len * 0.1, ey - len * 0.12);
    c.lineTo(ex + len * 0.04, ey + len * 0.03);
    c.closePath(); c.fill();
    c.restore();
  }

  // ---- Cabeza del dragón (perfil, mirando a +x) --------------------
  // Cráneo con ceja, hocico alargado, cuernos barridos hacia atrás,
  // mandíbula articulada con colmillos y lengua bífida.

  function dragonHead(c, r, col, dark, glowCol, jaw) {
    c.save();
    var open = Math.max(0, Math.min(1, jaw)) * 0.52; // apertura de mandíbula (rad)

    // ---------- CUERNOS (barridos hacia atrás, con anillos) ----------
    var horn = shade(dark, -12), hornHi = shade(dark, 22);
    // cuerno principal
    c.fillStyle = horn;
    c.beginPath();
    c.moveTo(-r * 0.42, -r * 0.62);
    c.quadraticCurveTo(-r * 0.85, -r * 1.12, -r * 1.42, -r * 1.34);
    c.quadraticCurveTo(-r * 0.95, -r * 0.98, -r * 0.52, -r * 0.42);
    c.closePath(); c.fill();
    // cuerno secundario (sobre la ceja)
    c.beginPath();
    c.moveTo(-r * 0.02, -r * 0.74);
    c.quadraticCurveTo(-r * 0.32, -r * 1.18, -r * 0.72, -r * 1.38);
    c.quadraticCurveTo(-r * 0.34, -r * 1.0, -r * 0.12, -r * 0.62);
    c.closePath(); c.fill();
    // anillos del cuerno
    c.strokeStyle = rgba(hornHi, 0.55); c.lineWidth = Math.max(0.8, r * 0.045); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.62, -r * 0.86); c.quadraticCurveTo(-r * 0.55, -r * 0.78, -r * 0.46, -r * 0.7); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.82, -r * 1.04); c.quadraticCurveTo(-r * 0.74, -r * 0.94, -r * 0.63, -r * 0.85); c.stroke();
    // púa de mejilla y cuerno nasal
    c.fillStyle = horn;
    c.beginPath(); c.moveTo(-r * 0.62, -r * 0.1); c.lineTo(-r * 1.06, -r * 0.34); c.lineTo(-r * 0.58, -r * 0.3); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(r * 0.98, -r * 0.4); c.lineTo(r * 1.12, -r * 0.62); c.lineTo(r * 1.1, -r * 0.36); c.closePath(); c.fill();

    // ---------- MANDÍBULA INFERIOR (rota en la articulación) ----------
    c.save();
    c.translate(-r * 0.05, r * 0.16);
    c.rotate(open);
    var jg = c.createLinearGradient(0, -r * 0.1, 0, r * 0.4);
    jg.addColorStop(0, shade(col, 6));
    jg.addColorStop(1, shade(col, -26));
    c.fillStyle = jg;
    c.beginPath();
    c.moveTo(-r * 0.28, r * 0.02);
    c.quadraticCurveTo(r * 0.35, r * 0.22, r * 1.06, r * 0.08);
    c.quadraticCurveTo(r * 1.2, r * 0.16, r * 1.05, r * 0.26);
    c.quadraticCurveTo(r * 0.4, r * 0.44, -r * 0.2, r * 0.34);
    c.quadraticCurveTo(-r * 0.34, r * 0.18, -r * 0.28, r * 0.02);
    c.closePath(); c.fill();
    c.strokeStyle = rgba(dark, 0.7); c.lineWidth = Math.max(1, r * 0.04); c.stroke();
    // lengua bífida (visible al abrir)
    if (jaw > 0.25) {
      c.strokeStyle = '#a03434'; c.lineWidth = r * 0.09; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(r * 0.25, r * 0.12);
      c.quadraticCurveTo(r * 0.7, r * 0.1, r * 1.0, r * 0.02);
      c.stroke();
      c.lineWidth = r * 0.05;
      c.beginPath(); c.moveTo(r * 1.0, r * 0.02); c.lineTo(r * 1.14, -r * 0.04); c.stroke();
      c.beginPath(); c.moveTo(r * 1.0, r * 0.02); c.lineTo(r * 1.12, r * 0.1); c.stroke();
    }
    // dientes inferiores
    c.fillStyle = '#f2ecd8';
    for (var lt = 0; lt < 3; lt++) {
      var lx = r * (0.4 + lt * 0.28);
      c.beginPath();
      c.moveTo(lx - r * 0.05, r * 0.12);
      c.lineTo(lx, -r * 0.02 - (lt === 1 ? r * 0.06 : 0));
      c.lineTo(lx + r * 0.06, r * 0.12);
      c.closePath(); c.fill();
    }
    c.restore();

    // ---------- CRÁNEO + HOCICO ----------
    var g = c.createLinearGradient(-r * 0.8, -r * 0.9, r * 1.2, r * 0.2);
    g.addColorStop(0, shade(col, 30));
    g.addColorStop(0.5, col);
    g.addColorStop(1, shade(col, -20));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-r * 0.78, r * 0.12);                     // unión con el cuello
    c.quadraticCurveTo(-r * 0.86, -r * 0.42, -r * 0.5, -r * 0.66);
    c.quadraticCurveTo(-r * 0.2, -r * 0.84, r * 0.1, -r * 0.74);   // cráneo
    c.quadraticCurveTo(r * 0.22, -r * 0.72, r * 0.3, -r * 0.62);   // ceja
    c.quadraticCurveTo(r * 0.72, -r * 0.52, r * 1.08, -r * 0.34);  // puente del hocico
    c.quadraticCurveTo(r * 1.32, -r * 0.24, r * 1.34, -r * 0.1);   // punta
    c.quadraticCurveTo(r * 1.3, r * 0.02, r * 1.12, r * 0.04);     // borde de boca
    c.lineTo(r * 0.28, r * 0.1);
    c.quadraticCurveTo(-r * 0.1, r * 0.16, -r * 0.3, r * 0.34);
    c.quadraticCurveTo(-r * 0.6, r * 0.3, -r * 0.78, r * 0.12);
    c.closePath(); c.fill();
    c.strokeStyle = rgba(dark, 0.55); c.lineWidth = Math.max(1, r * 0.045); c.lineJoin = 'round'; c.stroke();
    // placa de la ceja (sombra dura sobre el ojo)
    c.fillStyle = rgba(dark, 0.4);
    c.beginPath();
    c.moveTo(-r * 0.14, -r * 0.52);
    c.quadraticCurveTo(r * 0.14, -r * 0.62, r * 0.38, -r * 0.5);
    c.quadraticCurveTo(r * 0.16, -r * 0.44, -r * 0.1, -r * 0.4);
    c.closePath(); c.fill();
    // escamas del puente nasal
    c.strokeStyle = rgba(dark, 0.3); c.lineWidth = Math.max(0.7, r * 0.03);
    for (var ns = 0; ns < 3; ns++) {
      c.beginPath();
      c.arc(r * (0.52 + ns * 0.26), -r * (0.44 - ns * 0.05), r * 0.12, 3.4, 5.9);
      c.stroke();
    }
    // fosa nasal con brillo de calor
    c.fillStyle = rgba(dark, 0.9);
    c.beginPath(); c.ellipse(r * 1.08, -r * 0.22, r * 0.07, r * 0.045, -0.3, 0, 6.28); c.fill();
    if (jaw > 0.4) {
      c.fillStyle = rgba(glowCol || '#ffc06a', 0.5);
      c.beginPath(); c.ellipse(r * 1.08, -r * 0.22, r * 0.11, r * 0.07, -0.3, 0, 6.28); c.fill();
    }
    // interior de la boca cuando abre
    if (jaw > 0.15) {
      c.fillStyle = '#3a0e08';
      c.beginPath();
      c.moveTo(r * 0.24, r * 0.08);
      c.lineTo(r * 1.14, r * 0.0);
      c.lineTo(r * 1.05, r * 0.1 + open * r * 0.7);
      c.lineTo(r * 0.2, r * 0.18 + open * r * 0.5);
      c.closePath(); c.fill();
    }
    // dientes superiores (colmillo delantero mayor)
    c.fillStyle = '#f2ecd8';
    var ut = [[0.42, 0.1], [0.66, 0.13], [0.92, 0.2]];
    for (var u = 0; u < ut.length; u++) {
      var ux = r * ut[u][0], ulen = r * ut[u][1];
      c.beginPath();
      c.moveTo(ux - r * 0.05, r * 0.07);
      c.lineTo(ux, r * 0.07 + ulen);
      c.lineTo(ux + r * 0.06, r * 0.07);
      c.closePath(); c.fill();
    }
    // ---------- OJO (almendrado, pupila vertical, halo) ----------
    c.fillStyle = rgba(glowCol || '#ffd24a', 0.35);
    c.beginPath(); c.ellipse(r * 0.12, -r * 0.34, r * 0.2, r * 0.13, -0.15, 0, 6.28); c.fill();
    c.fillStyle = glowCol || '#ffd24a';
    c.beginPath(); c.ellipse(r * 0.12, -r * 0.34, r * 0.13, r * 0.085, -0.15, 0, 6.28); c.fill();
    c.fillStyle = '#160a04';
    c.beginPath(); c.ellipse(r * 0.14, -r * 0.34, r * 0.028, r * 0.08, -0.15, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(r * 0.09, -r * 0.37, r * 0.02, 0, 6.28); c.fill();
    c.restore();
  }

  // ---- Figuras humanoides ---------------------------------------

  // Dibuja una criatura humanoide completa.
  // spec: colores y accesorios. st: {r, walk, atk, anim, freeze, flying, flap, enraged, ghost}
  function figure(c, spec, st) {
    var r = st.r;
    c.save();
    if (st.ghost) c.globalAlpha = st.ghost;

    // sombra inferior suave (doble capa)
    if (!st.flying) {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath(); c.ellipse(0, r * 1.22, r * 0.55, r * 0.14, 0, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.beginPath(); c.ellipse(0, r * 1.28, r * 0.45, r * 0.08, 0, 0, 6.28); c.fill();
    }

    var skin = spec.skin, skinDark = shade(skin, -30);
    var tunic = spec.tunic || '#5a4a2a', tunicDark = shade(tunic, -34);
    var pant = spec.pant || '#3a2f22', boot = spec.boot || '#241d12';
    var armor = spec.armor, armorDark = armor ? shade(armor, -40) : null;
    var trim = spec.trim || '#c9a54a';
    var headR = spec.headR || 0.52;

    var walk = st.walk, atk = st.atk || 0;
    var sw = Math.sin(walk), cw = Math.cos(walk);
    var bob = Math.abs(sw) * -r * 0.12 * (st.freeze ? 0.2 : 1);
    var breath = Math.sin(st.anim * 1.35) * r * 0.025;
    var attackLean = atk > 0.05 ? Math.sin(Math.min(1, atk) * Math.PI) * r * 0.035 : 0;
    var hipY = r * 0.62 + bob + breath, shoulderY = r * 0.62 - spec.torso * r + bob + breath;
    var ground = r * 1.25;
    var lean = sw * 0.04;

    c.rotate(lean + attackLean);
    c.translate(0, bob);

    // ---------- ALAS ----------
    if (spec.wings) {
      var wc = spec.wingCol || '#4a4a52', wd = shade(wc, -35);
      var flap = st.flap != null ? st.flap : Math.sin(walk);
      wing(c, -r * 0.3, shoulderY, -1, r * 1.35, flap, wc, wd);
      wing(c, r * 0.3, shoulderY, 1, r * 1.35, flap, wc, wd);
    }

    // ---------- PIERNAS ----------
    var legL = ground - hipY;
    var legShade = shade(pant, -30);
    for (var side = 0; side < 2; side++) {
      var ph = walk + (side ? Math.PI : 0);
      var sp = Math.sin(ph);
      var lift = Math.max(0, Math.cos(ph)) * r * 0.22;
      var fx = (side ? 1 : -1) * r * 0.3 + sp * r * 0.14;
      var fy = ground - lift;
      var kx = fx * 0.45 + sp * r * 0.18, ky = hipY + legL * 0.52 - lift * 0.5;
      var hipX = (side ? 1 : -1) * r * 0.26;
      // muslo (ancho) → rodilla
      taper(c, hipX, hipY + r * 0.06, kx, ky, r * 0.34, r * 0.2, pant, legShade);
      // espinilla → tobillo
      taper(c, kx, ky, fx, fy - r * 0.08, r * 0.2, r * 0.1, pant, legShade);
      // botín con empeine
      var sh = sp * 0.18;
      c.fillStyle = boot;
      c.beginPath();
      c.ellipse(fx + sp * r * 0.1, fy - r * 0.04, r * 0.28, r * 0.14, sh, 0, 6.28);
      c.fill();
      c.fillStyle = shade(boot, 22);
      c.beginPath();
      c.ellipse(fx + sp * r * 0.1, fy - r * 0.08, r * 0.13, r * 0.06, sh, 0, 6.28);
      c.fill();
    }

    // ---------- CUERPO ----------
    var bodyW = spec.bodyW || 0.85;
    if (spec.body === 'robe') {
      var rg = c.createLinearGradient(-r * 0.8, shoulderY, r * 0.8, ground);
      rg.addColorStop(0, tunic);
      rg.addColorStop(1, tunicDark);
      c.fillStyle = rg;
      c.beginPath();
      c.moveTo(-r * 0.55, shoulderY - r * 0.1);
      c.lineTo(r * 0.55, shoulderY - r * 0.1);
      c.quadraticCurveTo(r * 0.75, hipY, r * 0.85, ground);
      c.quadraticCurveTo(0, ground + r * 0.12, -r * 0.85, ground);
      c.quadraticCurveTo(-r * 0.75, hipY, -r * 0.55, shoulderY - r * 0.1);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(18,12,18,0.9)'; c.lineWidth = Math.max(1.2, r * 0.055); c.stroke();
      // pliegues
      c.strokeStyle = rgba(0, 0, 0, 0.22); c.lineWidth = 1.2;
      for (var f = 0; f < 3; f++) {
        var px = -r * 0.5 + f * r * 0.5;
        c.beginPath();
        c.moveTo(px, hipY + r * 0.1);
        c.quadraticCurveTo(px + r * 0.1, hipY + r * 0.5, px - r * 0.05, ground);
        c.stroke();
      }
      // borde dorado
      c.strokeStyle = trim; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-r * 0.85, ground); c.quadraticCurveTo(0, ground + r * 0.12, r * 0.85, ground); c.stroke();
    } else {
      var bg = c.createLinearGradient(-r * 0.62, shoulderY, r * 0.62, hipY);
      bg.addColorStop(0, shade(tunic, 20));
      bg.addColorStop(0.55, tunic);
      bg.addColorStop(1, tunicDark);
      c.fillStyle = bg;
      // torso con hombros redondeados y cintura marcada
      c.beginPath();
      c.moveTo(-r * 0.6, shoulderY - r * 0.06);
      c.quadraticCurveTo(-r * 0.64, shoulderY + r * 0.2, -r * bodyW * 0.42, hipY);
      c.lineTo(r * bodyW * 0.42, hipY);
      c.quadraticCurveTo(r * 0.64, shoulderY + r * 0.2, r * 0.6, shoulderY - r * 0.06);
      c.quadraticCurveTo(r * 0.38, shoulderY - r * 0.24, 0, shoulderY - r * 0.22);
      c.quadraticCurveTo(-r * 0.38, shoulderY - r * 0.24, -r * 0.6, shoulderY - r * 0.06);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(18,12,12,0.9)'; c.lineWidth = Math.max(1.2, r * 0.055); c.stroke();
      // deltoides
      c.fillStyle = shade(tunic, 10);
      c.beginPath(); c.arc(-r * 0.52, shoulderY + r * 0.04, r * 0.2, 0, 6.28); c.fill();
      c.beginPath(); c.arc(r * 0.52, shoulderY + r * 0.04, r * 0.2, 0, 6.28); c.fill();
      // pliegue central
      c.strokeStyle = rgba(0, 0, 0, 0.1); c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(0, shoulderY - r * 0.18);
      c.quadraticCurveTo(-r * 0.06, hipY - r * 0.12, -r * 0.02, hipY);
      c.stroke();
      // cinturón curvo con hebilla
      c.fillStyle = spec.belt || '#2e2010';
      c.beginPath();
      c.moveTo(-r * bodyW * 0.42, hipY - r * 0.12);
      c.quadraticCurveTo(0, hipY - r * 0.19, r * bodyW * 0.42, hipY - r * 0.12);
      c.lineTo(r * bodyW * 0.4, hipY + r * 0.07);
      c.quadraticCurveTo(0, hipY + r * 0.13, -r * bodyW * 0.4, hipY + r * 0.07);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(18,12,12,0.88)'; c.lineWidth = Math.max(1.1, r * 0.05); c.stroke();
      c.fillStyle = trim;
      c.fillRect(-r * bodyW * 0.42, hipY - r * 0.12, r * bodyW * 0.84, r * 0.045);
      c.strokeStyle = shade(trim, -36); c.lineWidth = 1.1;
      c.strokeRect(-r * 0.07, hipY - r * 0.16, r * 0.14, r * 0.19);
      // falda de cuero/metal
      if (spec.skirt) {
        c.fillStyle = spec.skirt;
        c.beginPath();
        c.moveTo(-r * 0.42, hipY);
        c.lineTo(r * 0.42, hipY);
        c.lineTo(r * 0.32, ground);
        c.lineTo(-r * 0.32, ground);
        c.closePath(); c.fill();
        c.strokeStyle = rgba(0, 0, 0, 0.3); c.lineWidth = 1;
        for (var sl = -1; sl <= 1; sl += 2) {
          c.beginPath(); c.moveTo(sl * r * 0.13, hipY); c.lineTo(sl * r * 0.1, ground); c.stroke();
        }
      }
    }

    // ---------- COSTILLAS ----------
    if (spec.bones) {
      c.strokeStyle = rgba(0, 0, 0, 0.35); c.lineWidth = 1.4;
      for (var rb = 0; rb < 3; rb++) {
        var ry = shoulderY + r * 0.12 + rb * r * 0.24;
        var hw = r * (0.42 - rb * 0.07);
        c.beginPath();
        c.moveTo(-hw, ry);
        c.quadraticCurveTo(0, ry - r * 0.08, hw, ry);
        c.stroke();
      }
      c.fillStyle = trim;
      c.beginPath(); c.arc(0, shoulderY + r * 0.1, r * 0.09, 0, 6.28); c.fill();
    }

    // ---------- PECHERA / ARMADURA ----------
    if (armor) {
      var ag = c.createLinearGradient(-r * 0.5, shoulderY, r * 0.5, hipY);
      ag.addColorStop(0, shade(armor, 20));
      ag.addColorStop(0.5, armor);
      ag.addColorStop(1, armorDark);
      c.fillStyle = ag;
      c.beginPath();
      c.moveTo(-r * 0.5, shoulderY - r * 0.02);
      c.quadraticCurveTo(-r * 0.55, shoulderY + r * 0.35, -r * 0.34, hipY - r * 0.06);
      c.lineTo(r * 0.34, hipY - r * 0.06);
      c.quadraticCurveTo(r * 0.55, shoulderY + r * 0.35, r * 0.5, shoulderY - r * 0.02);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(12,12,18,0.9)'; c.lineWidth = Math.max(1.2, r * 0.05); c.stroke();
      c.strokeStyle = rgba(0, 0, 0, 0.35); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-r * 0.5, shoulderY - r * 0.02); c.lineTo(r * 0.5, shoulderY - r * 0.02); c.stroke();
      // remaches
      c.fillStyle = trim;
      for (var rv = -1; rv <= 1; rv += 2) {
        c.beginPath(); c.arc(rv * r * 0.36, shoulderY + r * 0.3, 1.4, 0, 6.28); c.fill();
      }
      // hombreras
      c.fillStyle = shade(armor, -16);
      c.beginPath(); c.arc(-r * 0.52, shoulderY, r * 0.22, 0, 6.28); c.fill();
      c.beginPath(); c.arc(r * 0.52, shoulderY, r * 0.22, 0, 6.28); c.fill();
      c.fillStyle = shade(armor, 26);
      c.beginPath(); c.arc(-r * 0.52, shoulderY, r * 0.12, 0, 6.28); c.fill();
      c.beginPath(); c.arc(r * 0.52, shoulderY, r * 0.12, 0, 6.28); c.fill();
    }

    // ---------- BRAZOS ----------
    var armCol = spec.sleeve || skin;
    for (var a = 0; a < 2; a++) {
      var aph = walk + (a ? Math.PI : 0);
      var asp = Math.sin(aph);
      var ax = (a ? 1 : -1) * r * 0.52;
      var attackReach = a === 1 && atk > 0.05 ? Math.sin(Math.min(1, atk) * Math.PI) : 0;
      var handY = shoulderY + r * 0.58 + asp * r * 0.18 - attackReach * r * 0.12;
      var handX = ax + asp * r * 0.14 + attackReach * r * 0.18;
      var elbowX = ax * 0.82 + asp * r * 0.08 + attackReach * r * 0.08, elbowY = shoulderY + r * 0.26 - attackReach * r * 0.06;
      taper(c, ax, shoulderY, elbowX, elbowY, r * 0.26, r * 0.18, armCol, shade(armCol, -26));
      taper(c, elbowX, elbowY, handX, handY, r * 0.18, r * 0.11, armCol, shade(armCol, -34));
      // mano
      c.fillStyle = shade(armCol, 18);
      c.beginPath(); c.arc(handX, handY, r * 0.13, 0, 6.28); c.fill();
      // brillo de nudillo
      c.fillStyle = shade(armCol, 30);
      c.beginPath(); c.arc(handX - r * 0.02, handY - r * 0.02, r * 0.05, 0, 6.28); c.fill();
      if (spec.bracer || spec.armor) {
        c.fillStyle = spec.bracer || shade(spec.armor || armCol, -18);
        c.beginPath(); c.ellipse(handX - asp * r * 0.04, handY - r * 0.04, r * 0.15, r * 0.09, asp * 0.3, 0, 6.28); c.fill();
        c.strokeStyle = 'rgba(18,12,12,0.7)'; c.lineWidth = Math.max(0.8, r * 0.03); c.stroke();
      }
    }

    // ---------- CABEZA ----------
    var headY = shoulderY - r * 0.35 - headR * r * 0.6 - (atk > 0.35 ? r * 0.025 : 0);
    drawHead(c, spec, headY, headR, skin, skinDark, st);
    // luz de borde superior-izquierda (acabado ilustrado)
    c.strokeStyle = 'rgba(255,246,220,0.16)'; c.lineWidth = Math.max(1, r * 0.05); c.lineCap = 'round';
    c.beginPath(); c.arc(0, headY, headR * r * 0.85, Math.PI * 1.02, Math.PI * 1.55); c.stroke();
    c.strokeStyle = 'rgba(255,246,220,0.1)';
    c.beginPath(); c.arc(0, shoulderY + r * 0.08, r * 0.6, Math.PI * 1.05, Math.PI * 1.5); c.stroke();

    // ---------- CAPA ----------
    if (spec.cape) {
      c.fillStyle = spec.cape;
      c.beginPath();
      c.moveTo(-r * 0.42, shoulderY - r * 0.02);
      c.quadraticCurveTo(-r * 0.72, shoulderY + r * 0.5, -r * 0.6, ground);
      c.lineTo(-r * 0.3, ground + r * 0.05);
      c.quadraticCurveTo(-r * 0.35, shoulderY + r * 0.4, -r * 0.3, shoulderY);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(12,8,18,0.85)'; c.lineWidth = Math.max(1, r * 0.045); c.stroke();
      // pliegues de la capa
      var capeDark = shade(spec.cape, -30);
      for (var cf = 0; cf < 2; cf++) {
        var cx2 = -r * 0.4 - cf * r * 0.12;
        c.strokeStyle = rgba(capeDark, cf === 0 ? 0.18 : 0.13);
        c.beginPath();
        c.moveTo(cx2, shoulderY + r * 0.1);
        c.lineTo(cx2 - r * 0.08, ground - r * 0.1);
        c.stroke();
      }
    }

    // ---------- ARMA ----------
    if (spec.weapon) drawWeapon(c, spec, r, shoulderY, walk, atk, st);

    c.restore();
  }

  function drawHead(c, spec, headY, headR, skin, skinDark, st) {
    var r = st.r;
    var head = spec.head || 'human';
    var hy = headY;
    if (head === 'skull' || head === 'rot') {
      // cráneo
      c.fillStyle = skin;
      c.beginPath();
      c.moveTo(-headR * r * 0.8, hy);
      c.quadraticCurveTo(-headR * r * 0.9, hy - headR * r * 0.95, 0, hy - headR * r);
      c.quadraticCurveTo(headR * r * 0.9, hy - headR * r * 0.95, headR * r * 0.8, hy);
      c.lineTo(headR * r * 0.55, hy + headR * r * 0.75);
      c.lineTo(-headR * r * 0.55, hy + headR * r * 0.75);
      c.closePath(); c.fill();
      // mandíbula
      c.fillStyle = shade(skin, -18);
      c.fillRect(-headR * r * 0.55, hy + headR * r * 0.4, headR * r * 1.1, headR * r * 0.38);
      // cuencas
      c.fillStyle = '#1a1410';
      c.beginPath(); c.ellipse(-headR * r * 0.32, hy - headR * r * 0.2, headR * r * 0.2, headR * r * 0.24, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.32, hy - headR * r * 0.2, headR * r * 0.2, headR * r * 0.24, 0, 0, 6.28); c.fill();
      // arco de cejas sombreado
      c.fillStyle = shade(skin, -16);
      c.beginPath(); c.ellipse(-headR * r * 0.32, hy - headR * r * 0.42, headR * r * 0.3, headR * r * 0.12, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.32, hy - headR * r * 0.42, headR * r * 0.3, headR * r * 0.12, 0, 0, 6.28); c.fill();
      // pómulos hundidos
      c.fillStyle = rgba(0, 0, 0, 0.12);
      c.beginPath(); c.ellipse(-headR * r * 0.55, hy + headR * r * 0.1, headR * r * 0.16, headR * r * 0.26, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.55, hy + headR * r * 0.1, headR * r * 0.16, headR * r * 0.26, 0, 0, 6.28); c.fill();
      // fosas nasales
      c.fillStyle = '#1a1410';
      c.beginPath(); c.moveTo(-headR * r * 0.12, hy + headR * r * 0.1); c.lineTo(0, hy + headR * r * 0.28); c.lineTo(headR * r * 0.12, hy + headR * r * 0.1); c.closePath(); c.fill();
      // dientes
      c.fillStyle = '#e8e0c8';
      c.fillRect(-headR * r * 0.5, hy + headR * r * 0.4, headR * r * 1.0, headR * r * 0.12);
      for (var t = 0; t < 5; t++) {
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(-headR * r * 0.4 + t * headR * r * 0.2, hy + headR * r * 0.4, headR * r * 0.02, headR * r * 0.12);
      }
      // brillo
      c.fillStyle = rgba(255, 255, 255, 0.2);
      c.beginPath(); c.ellipse(-headR * r * 0.3, hy - headR * r * 0.6, headR * r * 0.16, headR * r * 0.1, -0.4, 0, 6.28); c.fill();
      if (st.enraged || spec.eyeGlow) {
        c.fillStyle = spec.eyeCol || '#e83838';
        c.beginPath(); c.arc(-headR * r * 0.32, hy - headR * r * 0.2, headR * r * 0.09, 0, 6.28); c.fill();
        c.beginPath(); c.arc(headR * r * 0.32, hy - headR * r * 0.2, headR * r * 0.09, 0, 6.28); c.fill();
      }
    } else if (head === 'orc') {
      // ORCO — cráneo ancho, prognatismo marcado, colmillos y ceño pesado
      var s = headR * r;
      var skinHi = shade(skin, 16), skinLo = shade(skin, -26);
      // orejas puntiagudas en abanico (detrás del cráneo)
      c.fillStyle = skinLo;
      c.beginPath(); c.moveTo(-s * 0.78, hy - s * 0.22); c.lineTo(-s * 1.44, hy - s * 0.64); c.lineTo(-s * 0.76, hy - s * 0.56); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.78, hy - s * 0.22); c.lineTo(s * 1.44, hy - s * 0.64); c.lineTo(s * 0.76, hy - s * 0.56); c.closePath(); c.fill();
      c.fillStyle = skin;
      c.beginPath(); c.moveTo(-s * 0.78, hy - s * 0.26); c.lineTo(-s * 1.3, hy - s * 0.58); c.lineTo(-s * 0.76, hy - s * 0.5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.78, hy - s * 0.26); c.lineTo(s * 1.3, hy - s * 0.58); c.lineTo(s * 0.76, hy - s * 0.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(50,24,14,0.55)';
      c.beginPath(); c.moveTo(-s * 0.86, hy - s * 0.34); c.lineTo(-s * 1.14, hy - s * 0.52); c.lineTo(-s * 0.84, hy - s * 0.46); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.86, hy - s * 0.34); c.lineTo(s * 1.14, hy - s * 0.52); c.lineTo(s * 0.84, hy - s * 0.46); c.closePath(); c.fill();
      // aro de guerra en la oreja
      if (spec.earring) {
        c.strokeStyle = '#e0b84a'; c.lineWidth = Math.max(1, s * 0.06);
        c.beginPath(); c.arc(s * 1.04, hy - s * 0.3, s * 0.1, 0, 6.28); c.stroke();
        c.fillStyle = '#e0b84a';
        c.beginPath(); c.arc(s * 1.04, hy - s * 0.18, s * 0.035, 0, 6.28); c.fill();
      }
      // cráneo: frente ancha, pómulos y mandíbula masiva
      var og = c.createLinearGradient(0, hy - s, 0, hy + s * 0.95);
      og.addColorStop(0, skinHi); og.addColorStop(0.55, skin); og.addColorStop(1, skinLo);
      c.fillStyle = og;
      c.beginPath();
      c.moveTo(-s * 0.76, hy - s * 0.32);
      c.quadraticCurveTo(-s * 0.82, hy - s * 0.95, 0, hy - s);
      c.quadraticCurveTo(s * 0.82, hy - s * 0.95, s * 0.76, hy - s * 0.32);
      c.quadraticCurveTo(s * 0.94, hy + s * 0.02, s * 0.68, hy + s * 0.3);
      c.lineTo(s * 0.62, hy + s * 0.72);
      c.quadraticCurveTo(s * 0.32, hy + s * 0.94, 0, hy + s * 0.94);
      c.quadraticCurveTo(-s * 0.32, hy + s * 0.94, -s * 0.62, hy + s * 0.72);
      c.lineTo(-s * 0.68, hy + s * 0.3);
      c.quadraticCurveTo(-s * 0.94, hy + s * 0.02, -s * 0.76, hy - s * 0.32);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(20,12,8,0.85)'; c.lineWidth = Math.max(1.2, r * 0.055); c.stroke();
      // plano de la mandíbula (sombra bajo el labio superior)
      c.fillStyle = 'rgba(0,0,0,0.16)';
      c.beginPath(); c.ellipse(0, hy + s * 0.6, s * 0.52, s * 0.3, 0, 0, 6.28); c.fill();
      // brillo de frente y sombras de pómulo
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.beginPath(); c.ellipse(-s * 0.22, hy - s * 0.62, s * 0.22, s * 0.12, -0.3, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.13)';
      c.beginPath(); c.ellipse(s * 0.55, hy + s * 0.05, s * 0.2, s * 0.28, -0.2, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(-s * 0.55, hy + s * 0.05, s * 0.2, s * 0.28, 0.2, 0, 6.28); c.fill();
      // ceño pesado (banda ósea en sombra)
      c.fillStyle = shade(skin, -30);
      c.beginPath();
      c.moveTo(-s * 0.72, hy - s * 0.52);
      c.quadraticCurveTo(-s * 0.3, hy - s * 0.66, 0, hy - s * 0.58);
      c.quadraticCurveTo(s * 0.3, hy - s * 0.66, s * 0.72, hy - s * 0.52);
      c.lineTo(s * 0.66, hy - s * 0.36);
      c.quadraticCurveTo(s * 0.3, hy - s * 0.46, 0, hy - s * 0.4);
      c.quadraticCurveTo(-s * 0.3, hy - s * 0.46, -s * 0.66, hy - s * 0.36);
      c.closePath(); c.fill();
      // ojos hundidos bajo el ceño
      c.fillStyle = 'rgba(10,6,4,0.6)';
      c.beginPath(); c.ellipse(-s * 0.3, hy - s * 0.32, s * 0.17, s * 0.11, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(s * 0.3, hy - s * 0.32, s * 0.17, s * 0.11, 0, 0, 6.28); c.fill();
      c.fillStyle = st.enraged ? '#ff3a2a' : (spec.eyeCol || '#e8d42a');
      c.beginPath(); c.ellipse(-s * 0.3, hy - s * 0.31, s * 0.09, s * 0.055, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(s * 0.3, hy - s * 0.31, s * 0.09, s * 0.055, 0, 0, 6.28); c.fill();
      c.fillStyle = '#160a04';
      c.beginPath(); c.arc(-s * 0.29, hy - s * 0.31, s * 0.028, 0, 6.28); c.fill();
      c.beginPath(); c.arc(s * 0.29, hy - s * 0.31, s * 0.028, 0, 6.28); c.fill();
      if (st.enraged) {
        c.fillStyle = 'rgba(255,58,42,0.4)';
        c.beginPath(); c.arc(-s * 0.3, hy - s * 0.31, s * 0.15, 0, 6.28); c.fill();
        c.beginPath(); c.arc(s * 0.3, hy - s * 0.31, s * 0.15, 0, 6.28); c.fill();
      }
      // nariz ancha y chata
      c.fillStyle = shade(skin, -14);
      c.beginPath();
      c.moveTo(-s * 0.18, hy - s * 0.12);
      c.quadraticCurveTo(0, hy - s * 0.02, s * 0.18, hy - s * 0.12);
      c.quadraticCurveTo(s * 0.26, hy + s * 0.16, 0, hy + s * 0.2);
      c.quadraticCurveTo(-s * 0.26, hy + s * 0.16, -s * 0.18, hy - s * 0.12);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.ellipse(-s * 0.1, hy + s * 0.1, s * 0.055, s * 0.035, 0.3, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(s * 0.1, hy + s * 0.1, s * 0.055, s * 0.035, -0.3, 0, 6.28); c.fill();
      // boca: labio superior en sombra y comisuras
      c.strokeStyle = 'rgba(24,10,6,0.8)'; c.lineWidth = Math.max(1.1, s * 0.05); c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-s * 0.4, hy + s * 0.42);
      c.quadraticCurveTo(0, hy + s * 0.5, s * 0.4, hy + s * 0.42);
      c.stroke();
      // colmillos inferiores (raíz oscura + marfil)
      c.fillStyle = shade('#e8dfc2', -60);
      c.beginPath(); c.moveTo(-s * 0.36, hy + s * 0.6); c.lineTo(-s * 0.24, hy + s * 0.16); c.lineTo(-s * 0.1, hy + s * 0.6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.36, hy + s * 0.6); c.lineTo(s * 0.24, hy + s * 0.16); c.lineTo(s * 0.1, hy + s * 0.6); c.closePath(); c.fill();
      c.fillStyle = '#efe8ce';
      c.beginPath(); c.moveTo(-s * 0.33, hy + s * 0.58); c.lineTo(-s * 0.25, hy + s * 0.22); c.lineTo(-s * 0.14, hy + s * 0.58); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.33, hy + s * 0.58); c.lineTo(s * 0.25, hy + s * 0.22); c.lineTo(s * 0.14, hy + s * 0.58); c.closePath(); c.fill();
      // dientes superiores pequeños
      c.fillStyle = '#e8dfc2';
      c.beginPath(); c.moveTo(-s * 0.08, hy + s * 0.44); c.lineTo(-s * 0.04, hy + s * 0.56); c.lineTo(s * 0.0, hy + s * 0.44); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.08, hy + s * 0.44); c.lineTo(s * 0.04, hy + s * 0.56); c.lineTo(s * 0.0, hy + s * 0.44); c.closePath(); c.fill();
      // cicatriz de guerra
      if (spec.scar) {
        c.strokeStyle = 'rgba(232,196,170,0.75)'; c.lineWidth = Math.max(1, s * 0.04);
        c.beginPath(); c.moveTo(-s * 0.58, hy - s * 0.05); c.lineTo(-s * 0.34, hy + s * 0.3); c.stroke();
        c.strokeStyle = 'rgba(120,60,40,0.5)'; c.lineWidth = Math.max(0.8, s * 0.025);
        c.beginPath(); c.moveTo(-s * 0.6, hy + s * 0.02); c.lineTo(-s * 0.5, hy + s * 0.1); c.stroke();
        c.beginPath(); c.moveTo(-s * 0.5, hy + s * 0.18); c.lineTo(-s * 0.4, hy + s * 0.26); c.stroke();
      }
      // verruga
      c.fillStyle = shade(skin, -34);
      c.beginPath(); c.arc(s * 0.42, hy + s * 0.34, s * 0.045, 0, 6.28); c.fill();
      // cabello
      if (spec.hair === 'topknot') {
        c.fillStyle = '#1c1410';
        c.beginPath();
        c.moveTo(-s * 0.6, hy - s * 0.72);
        c.quadraticCurveTo(0, hy - s * 1.05, s * 0.6, hy - s * 0.72);
        c.quadraticCurveTo(0, hy - s * 0.88, -s * 0.6, hy - s * 0.72);
        c.closePath(); c.fill();
        c.beginPath(); c.arc(0, hy - s * 1.08, s * 0.17, 0, 6.28); c.fill();
        c.strokeStyle = '#1c1410'; c.lineWidth = s * 0.08; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, hy - s * 1.18); c.quadraticCurveTo(s * 0.1, hy - s * 1.34, s * 0.24, hy - s * 1.3); c.stroke();
        c.strokeStyle = '#8a2a20'; c.lineWidth = s * 0.05;
        c.beginPath(); c.arc(0, hy - s * 1.0, s * 0.1, 0.2, Math.PI - 0.2); c.stroke();
      } else if (spec.hair === 'wild') {
        c.fillStyle = '#241812';
        for (var wh = -2; wh <= 2; wh++) {
          c.beginPath();
          c.moveTo(wh * s * 0.3 - s * 0.14, hy - s * 0.7);
          c.lineTo(wh * s * 0.3, hy - s * (1.05 + (wh % 2 ? 0.12 : 0)));
          c.lineTo(wh * s * 0.3 + s * 0.14, hy - s * 0.7);
          c.closePath(); c.fill();
        }
      }
    } else if (head === 'demon') {
      c.fillStyle = skin;
      c.beginPath();
      c.moveTo(-headR * r * 0.8, hy - headR * r * 0.1);
      c.quadraticCurveTo(-headR * r * 0.7, hy - headR * r * 1.0, 0, hy - headR * r * 0.95);
      c.quadraticCurveTo(headR * r * 0.7, hy - headR * r * 1.0, headR * r * 0.8, hy - headR * r * 0.1);
      c.quadraticCurveTo(headR * r * 0.6, hy + headR * r * 0.85, 0, hy + headR * r * 0.8);
      c.quadraticCurveTo(-headR * r * 0.6, hy + headR * r * 0.85, -headR * r * 0.8, hy - headR * r * 0.1);
      c.closePath(); c.fill();
      // sombras de mejilla y mandíbula
      c.fillStyle = rgba(0, 0, 0, 0.16);
      c.beginPath(); c.ellipse(-headR * r * 0.4, hy + headR * r * 0.15, headR * r * 0.26, headR * r * 0.4, 0, 0, 6.28); c.fill();
      c.fillStyle = shade(skin, -24);
      c.beginPath(); c.ellipse(0, hy + headR * r * 0.5, headR * r * 0.4, headR * r * 0.24, 0, 0, 6.28); c.fill();
      // cuernos
      c.fillStyle = '#d8cba8';
      c.beginPath(); c.moveTo(-headR * r * 0.55, hy - headR * r * 0.7); c.quadraticCurveTo(-headR * r * 0.8, hy - headR * r * 1.7, -headR * r * 0.3, hy - headR * r * 1.5); c.quadraticCurveTo(-headR * r * 0.35, hy - headR * r * 1.0, -headR * r * 0.4, hy - headR * r * 0.7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(headR * r * 0.55, hy - headR * r * 0.7); c.quadraticCurveTo(headR * r * 0.8, hy - headR * r * 1.7, headR * r * 0.3, hy - headR * r * 1.5); c.quadraticCurveTo(headR * r * 0.35, hy - headR * r * 1.0, headR * r * 0.4, hy - headR * r * 0.7); c.closePath(); c.fill();
      // ojos brillantes
      c.fillStyle = st.enraged ? '#ff5a2a' : '#ffd24a';
      c.beginPath(); c.ellipse(-headR * r * 0.3, hy - headR * r * 0.25, headR * r * 0.16, headR * r * 0.1, 0.4, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.3, hy - headR * r * 0.25, headR * r * 0.16, headR * r * 0.1, -0.4, 0, 6.28); c.fill();
      c.fillStyle = '#1a0505';
      c.beginPath(); c.ellipse(-headR * r * 0.26, hy - headR * r * 0.25, headR * r * 0.05, headR * r * 0.09, 0.4, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.26, hy - headR * r * 0.25, headR * r * 0.05, headR * r * 0.09, -0.4, 0, 6.28); c.fill();
      // colmillos
      c.fillStyle = '#f4f0e0';
      c.beginPath(); c.moveTo(-headR * r * 0.3, hy + headR * r * 0.35); c.lineTo(-headR * r * 0.18, hy + headR * r * 0.6); c.lineTo(-headR * r * 0.06, hy + headR * r * 0.35); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(headR * r * 0.3, hy + headR * r * 0.35); c.lineTo(headR * r * 0.18, hy + headR * r * 0.6); c.lineTo(headR * r * 0.06, hy + headR * r * 0.35); c.closePath(); c.fill();
    } else if (head === 'hood') {
      // capucha con cara oscura
      c.fillStyle = spec.hoodCol || '#241a30';
      c.beginPath();
      c.moveTo(-headR * r * 0.9, hy - headR * r * 0.1);
      c.quadraticCurveTo(-headR * r * 0.85, hy - headR * r * 1.15, 0, hy - headR * r * 1.2);
      c.quadraticCurveTo(headR * r * 0.85, hy - headR * r * 1.15, headR * r * 0.9, hy - headR * r * 0.1);
      c.quadraticCurveTo(headR * r * 0.7, hy + headR * r * 0.7, 0, hy + headR * r * 0.75);
      c.quadraticCurveTo(-headR * r * 0.7, hy + headR * r * 0.7, -headR * r * 0.9, hy - headR * r * 0.1);
      c.closePath(); c.fill();
      // interior oscuro
      c.fillStyle = '#0a0612';
      c.beginPath();
      c.ellipse(0, hy - headR * r * 0.1, headR * r * 0.5, headR * r * 0.62, 0, 0, 6.28);
      c.fill();
      // ojos brillantes
      c.fillStyle = spec.eyeCol || '#c890ff';
      c.beginPath(); c.arc(-headR * r * 0.2, hy - headR * r * 0.15, headR * r * 0.08, 0, 6.28); c.fill();
      c.beginPath(); c.arc(headR * r * 0.2, hy - headR * r * 0.15, headR * r * 0.08, 0, 6.28); c.fill();
      c.fillStyle = rgba(spec.eyeCol || '#c890ff', 0.4);
      c.beginPath(); c.arc(-headR * r * 0.2, hy - headR * r * 0.15, headR * r * 0.18, 0, 6.28); c.fill();
      c.beginPath(); c.arc(headR * r * 0.2, hy - headR * r * 0.15, headR * r * 0.18, 0, 6.28); c.fill();
    } else {
      // humano / goblin (cabeza redondeada con mentón y volumen)
      c.fillStyle = skin;
      c.beginPath();
      c.moveTo(-headR * r * 0.82, hy - headR * r * 0.12);
      c.quadraticCurveTo(-headR * r * 0.92, hy - headR * r * 1.02, 0, hy - headR * r * 1.08);
      c.quadraticCurveTo(headR * r * 0.92, hy - headR * r * 1.02, headR * r * 0.82, hy - headR * r * 0.12);
      c.quadraticCurveTo(headR * r * 0.74, hy + headR * r * 0.42, headR * r * 0.44, hy + headR * r * 0.68);
      c.quadraticCurveTo(0, hy + headR * r * 0.82, -headR * r * 0.44, hy + headR * r * 0.68);
      c.quadraticCurveTo(-headR * r * 0.74, hy + headR * r * 0.42, -headR * r * 0.82, hy - headR * r * 0.12);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(16,12,12,0.92)'; c.lineWidth = Math.max(1.2, r * 0.055); c.stroke();
      // sombreado lateral para dar volumen
      c.fillStyle = rgba(0, 0, 0, 0.12);
      c.beginPath(); c.ellipse(headR * r * 0.52, hy - headR * r * 0.05, headR * r * 0.34, headR * r * 0.55, 0, 0, 6.28); c.fill();
      // brillo de frente
      c.fillStyle = rgba(255, 255, 255, 0.1);
      c.beginPath(); c.ellipse(-headR * r * 0.22, hy - headR * r * 0.6, headR * r * 0.26, headR * r * 0.14, -0.3, 0, 6.28); c.fill();
      // orejas
      if (spec.ears === 'elf') {
        c.fillStyle = skin;
        c.beginPath(); c.moveTo(-headR * r * 0.78, hy - headR * r * 0.3); c.lineTo(-headR * r * 1.2, hy - headR * r * 0.6); c.lineTo(-headR * r * 0.7, hy - headR * r * 0.5); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(headR * r * 0.78, hy - headR * r * 0.3); c.lineTo(headR * r * 1.2, hy - headR * r * 0.6); c.lineTo(headR * r * 0.7, hy - headR * r * 0.5); c.closePath(); c.fill();
        c.strokeStyle = rgba(0, 0, 0, 0.2); c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(-headR * r * 0.92, hy - headR * r * 0.42); c.lineTo(-headR * r * 0.78, hy - headR * r * 0.45); c.stroke();
        c.beginPath(); c.moveTo(headR * r * 0.92, hy - headR * r * 0.42); c.lineTo(headR * r * 0.78, hy - headR * r * 0.45); c.stroke();
      } else if (spec.ears === 'goblin') {
        c.fillStyle = shade(skin, 6);
        c.beginPath(); c.moveTo(-headR * r * 0.72, hy - headR * r * 0.4); c.lineTo(-headR * r * 1.25, hy - headR * r * 0.1); c.lineTo(-headR * r * 0.62, hy + headR * r * 0.05); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(headR * r * 0.72, hy - headR * r * 0.4); c.lineTo(headR * r * 1.25, hy - headR * r * 0.1); c.lineTo(headR * r * 0.62, hy + headR * r * 0.05); c.closePath(); c.fill();
        c.fillStyle = rgba('#7a4a3a', 0.5);
        c.beginPath(); c.arc(-headR * r * 0.9, hy - headR * r * 0.2, headR * r * 0.1, 0, 6.28); c.fill();
        c.beginPath(); c.arc(headR * r * 0.9, hy - headR * r * 0.2, headR * r * 0.1, 0, 6.28); c.fill();
      }
      // ojos con blancos y pupilas
      var eyeOpen = st.blink ? 0.16 : 1;
      c.fillStyle = '#f8f8f4';
      c.beginPath(); c.ellipse(-headR * r * 0.3, hy - headR * r * 0.22, headR * r * 0.16, headR * r * 0.13 * eyeOpen, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.3, hy - headR * r * 0.22, headR * r * 0.16, headR * r * 0.13 * eyeOpen, 0, 0, 6.28); c.fill();
      c.fillStyle = spec.eyeCol || '#2a2018';
      c.beginPath(); c.ellipse(-headR * r * 0.3, hy - headR * r * 0.2, headR * r * 0.08, headR * r * 0.08 * eyeOpen, 0, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(headR * r * 0.3, hy - headR * r * 0.2, headR * r * 0.08, headR * r * 0.08 * eyeOpen, 0, 0, 6.28); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(-headR * r * 0.33, hy - headR * r * 0.25, headR * r * 0.028, 0, 6.28); c.fill();
      c.beginPath(); c.arc(headR * r * 0.27, hy - headR * r * 0.25, headR * r * 0.028, 0, 6.28); c.fill();
      if (spec.eyeGlow) {
        c.fillStyle = rgba(spec.eyeCol || '#e8d42a', 0.5);
        c.beginPath(); c.arc(-headR * r * 0.3, hy - headR * r * 0.22, headR * r * 0.24, 0, 6.28); c.fill();
        c.beginPath(); c.arc(headR * r * 0.3, hy - headR * r * 0.22, headR * r * 0.24, 0, 6.28); c.fill();
      }
      // brillo puntual de mirada para el acabado ilustrado
      if (spec.eyeCol && !st.blink) {
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(-headR * r * 0.33, hy - headR * r * 0.25, headR * r * 0.028, 0, 6.28); c.fill();
        c.beginPath(); c.arc(headR * r * 0.27, hy - headR * r * 0.25, headR * r * 0.028, 0, 6.28); c.fill();
      }
      // cejas (enojadas para enraged)
      if (st.enraged || spec.brows) {
        c.strokeStyle = shade(skin, -32); c.lineWidth = 1.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-headR * r * 0.48, hy - headR * r * 0.46); c.quadraticCurveTo(-headR * r * 0.3, hy - headR * r * 0.38, -headR * r * 0.12, hy - headR * r * 0.36); c.stroke();
        c.beginPath(); c.moveTo(headR * r * 0.48, hy - headR * r * 0.46); c.quadraticCurveTo(headR * r * 0.3, hy - headR * r * 0.38, headR * r * 0.12, hy - headR * r * 0.36); c.stroke();
      } else {
        c.strokeStyle = shade(skin, -26); c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(-headR * r * 0.46, hy - headR * r * 0.4); c.quadraticCurveTo(-headR * r * 0.3, hy - headR * r * 0.35, -headR * r * 0.14, hy - headR * r * 0.4); c.stroke();
        c.beginPath(); c.moveTo(headR * r * 0.46, hy - headR * r * 0.4); c.quadraticCurveTo(headR * r * 0.3, hy - headR * r * 0.35, headR * r * 0.14, hy - headR * r * 0.4); c.stroke();
      }
      // nariz con sombra
      c.fillStyle = shade(skin, -18);
      c.beginPath();
      c.moveTo(-headR * r * 0.09, hy - headR * r * 0.12);
      c.quadraticCurveTo(-headR * r * 0.03, hy + headR * r * 0.26, 0, hy + headR * r * 0.32);
      c.quadraticCurveTo(headR * r * 0.03, hy + headR * r * 0.26, headR * r * 0.09, hy - headR * r * 0.12);
      c.closePath(); c.fill();
      // boca
      c.strokeStyle = rgba(80, 40, 24, 0.65); c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-headR * r * 0.18, hy + headR * r * 0.48); c.quadraticCurveTo(0, hy + headR * r * 0.55, headR * r * 0.18, hy + headR * r * 0.48); c.stroke();
      // sonrisa con dientes (goblin)
      if (spec.smile) {
        c.fillStyle = '#2a0a08';
        c.beginPath(); c.ellipse(0, hy + headR * r * 0.42, headR * r * 0.3, headR * r * 0.13, 0, 0, 6.28); c.fill();
        c.fillStyle = '#f4f0d8';
        c.fillRect(-headR * r * 0.22, hy + headR * r * 0.35, headR * r * 0.44, headR * r * 0.09);
      }
    }

    // casco
    if (spec.helmet) {
      c.fillStyle = spec.helmet;
      c.beginPath();
      c.arc(0, hy - headR * r * 0.3, headR * r * 0.95, Math.PI, 0);
      c.closePath(); c.fill();
      c.fillStyle = shade(spec.helmet, 20);
      c.fillRect(-headR * r * 0.95, hy - headR * r * 0.3, headR * r * 1.9, headR * r * 0.14);
    }
    // barba
    if (spec.beard) {
      c.fillStyle = spec.beard;
      c.beginPath();
      c.moveTo(-headR * r * 0.55, hy + headR * r * 0.2);
      c.quadraticCurveTo(-headR * r * 0.45, hy + headR * r * 1.0, 0, hy + headR * r * 1.05);
      c.quadraticCurveTo(headR * r * 0.45, hy + headR * r * 1.0, headR * r * 0.55, hy + headR * r * 0.2);
      c.closePath(); c.fill();
    }
    // corona
    if (spec.crown) {
      c.fillStyle = spec.crown;
      c.beginPath();
      c.moveTo(-headR * r * 0.6, hy - headR * r * 0.7);
      c.lineTo(-headR * r * 0.6, hy - headR * r * 1.15);
      c.lineTo(-headR * r * 0.3, hy - headR * r * 0.85);
      c.lineTo(0, hy - headR * r * 1.25);
      c.lineTo(headR * r * 0.3, hy - headR * r * 0.85);
      c.lineTo(headR * r * 0.6, hy - headR * r * 1.15);
      c.lineTo(headR * r * 0.6, hy - headR * r * 0.7);
      c.closePath(); c.fill();
      c.fillStyle = shade(spec.crown, -30);
      c.fillRect(-headR * r * 0.6, hy - headR * r * 0.7, headR * r * 1.2, headR * r * 0.12);
    }
  }

  // ---- Armas -----------------------------------------------

  function drawWeapon(c, spec, r, shoulderY, walk, atk, st) {
    var w = spec.weapon;
    var swing = Math.sin(walk) * 0.2;
    var atkSwing = 0;
    if (atk > 0.05) {
      // preparación → golpe → recuperación (más amplio y dramático)
      if (atk < 0.35) atkSwing = -0.2 + atk / 0.35 * -0.8;
      else if (atk < 0.55) atkSwing = -1.0 + (atk - 0.35) / 0.2 * 2.2;
      else if (atk < 0.8) atkSwing = 1.2 - (atk - 0.55) / 0.25 * 0.6;
      else atkSwing = 0.6 - (atk - 0.8) * 0.4;
    }
    var handX = r * 0.45, handY = shoulderY + r * 0.55 + swing * r * 0.1;
    // estela de corte durante el golpe
    if (atk > 0.35 && atk < 0.62) {
      var a2 = (atk - 0.35) / 0.27;
      c.save();
      c.translate(handX, handY);
      c.globalAlpha = (1 - Math.abs(a2 - 0.5) * 2) * 0.45;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath();
      c.arc(0, 0, r * 1.05, -1.2 + a2 * 2.0, -1.2 + (a2 + 0.14) * 2.0);
      c.stroke();
      c.restore();
    }
    c.save();
    c.translate(handX, handY);
    c.rotate(0.5 + atkSwing);
    if (w === 'club') {
      rod(c, 0, 0, r * 0.5, -r * 1.0, r * 0.16, '#5a3a1c', '#2e1808');
      c.fillStyle = '#4a2a14';
      c.beginPath(); c.arc(r * 0.62, -r * 1.15, r * 0.24, 0, 6.28); c.fill();
      c.fillStyle = '#6a4624';
      c.beginPath(); c.arc(r * 0.55, -r * 1.2, r * 0.12, 0, 6.28); c.fill();
      c.fillStyle = '#2a1808';
      c.beginPath(); c.moveTo(r * 0.5, -r * 1.35); c.lineTo(r * 0.46, -r * 1.5); c.lineTo(r * 0.58, -r * 1.42); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.78, -r * 1.2); c.lineTo(r * 0.92, -r * 1.28); c.lineTo(r * 0.82, -r * 1.08); c.closePath(); c.fill();
    } else if (w === 'axe') {
      rod(c, 0, 0, r * 0.5, -r * 1.0, r * 0.17, '#4a2e14', '#241206');
      c.fillStyle = '#9a9aa4';
      c.beginPath();
      c.moveTo(r * 0.55, -r * 0.95);
      c.quadraticCurveTo(r * 0.95, -r * 1.05, r * 0.95, -r * 0.7);
      c.quadraticCurveTo(r * 0.8, -r * 0.75, r * 0.6, -r * 0.62);
      c.quadraticCurveTo(r * 0.5, -r * 0.8, r * 0.55, -r * 0.95);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.moveTo(r * 0.55, -r * 0.95); c.lineTo(r * 0.7, -r * 0.78); c.lineTo(r * 0.62, -r * 0.7); c.closePath(); c.fill();
    } else if (w === 'sword') {
      rod(c, 0, 0, r * 0.1, -r * 0.5, r * 0.12, '#4a2e14', '#241206');
      c.fillStyle = '#c9c9d4';
      c.beginPath();
      c.moveTo(r * 0.16, -r * 0.55);
      c.lineTo(r * 0.22, -r * 1.3);
      c.lineTo(r * 0.1, -r * 0.55);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.moveTo(r * 0.16, -r * 0.55); c.lineTo(r * 0.21, -r * 1.1); c.lineTo(r * 0.18, -r * 0.6); c.closePath(); c.fill();
      c.fillStyle = '#ffd24a';
      c.fillRect(r * 0.06, -r * 0.6, r * 0.18, r * 0.1);
    } else if (w === 'dagger') {
      c.fillStyle = '#8a8a96';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(r * 0.5, r * 0.05);
      c.lineTo(r * 0.1, -r * 0.45);
      c.closePath(); c.fill();
      c.fillStyle = '#4a2e14';
      c.fillRect(-r * 0.02, -r * 0.08, r * 0.22, r * 0.12);
    } else if (w === 'staff') {
      rod(c, 0, 0, r * 0.3, -r * 1.5, r * 0.16, '#4a3018', '#241206');
      var orbY = -r * 1.55 + Math.sin(st.anim * 2) * r * 0.05;
      orb(c, r * 0.32, orbY, r * 0.26, spec.glowCol || '#c890ff');
      c.fillStyle = '#5a3a1e';
      c.beginPath(); c.arc(r * 0.32, orbY, r * 0.12, 0, 6.28); c.fill();
      if (spec.totem) {
        c.fillStyle = '#e8e0c8';
        c.beginPath();
        c.moveTo(r * 0.32, orbY);
        c.lineTo(r * 0.2, orbY - r * 0.25);
        c.lineTo(r * 0.44, orbY - r * 0.25);
        c.closePath(); c.fill();
      }
    } else if (w === 'hammer') {
      rod(c, 0, 0, r * 0.5, -r * 1.1, r * 0.2, '#4a3018', '#241206');
      c.fillStyle = '#7a7a86';
      c.beginPath();
      c.moveTo(r * 0.55, -r * 1.15);
      c.lineTo(r * 1.0, -r * 0.95);
      c.lineTo(r * 0.95, -r * 0.6);
      c.lineTo(r * 0.5, -r * 0.8);
      c.closePath(); c.fill();
      c.fillStyle = '#9a9aa6';
      c.beginPath(); c.arc(r * 0.75, -r * 0.85, r * 0.18, 0, 6.28); c.fill();
    } else if (w === 'scythe') {
      rod(c, 0, 0, r * 0.1, -r * 1.5, r * 0.16, '#4a3018', '#241206');
      c.strokeStyle = '#c9c9d4'; c.lineWidth = r * 0.12;
      c.beginPath(); c.arc(r * 0.3, -r * 1.1, r * 0.5, -1.5, 1.2); c.stroke();
      c.fillStyle = '#f0f0f8';
      c.beginPath(); c.arc(r * 0.6, -r * 1.55, r * 0.1, 0, 6.28); c.fill();
    } else if (w === 'cleaver') {
      rod(c, 0, 0, r * 0.45, -r * 0.9, r * 0.16, '#4a2e14', '#241206');
      c.fillStyle = '#a0a0ac';
      c.beginPath();
      c.moveTo(r * 0.5, -r * 0.8);
      c.quadraticCurveTo(r * 0.85, -r * 0.95, r * 0.7, -r * 0.4);
      c.lineTo(r * 0.45, -r * 0.5);
      c.closePath(); c.fill();
      c.fillStyle = '#c0c0cc';
      c.beginPath(); c.arc(r * 0.6, -r * 0.62, r * 0.12, 0, 6.28); c.fill();
    } else if (w === 'torch') {
      rod(c, 0, 0, r * 0.3, -r * 1.1, r * 0.14, '#5a3a1c', '#2e1808');
      var fl = 0.6 + 0.4 * Math.sin(st.anim * 8);
      c.fillStyle = 'rgba(255,160,40,' + (0.5 + fl * 0.5) + ')';
      c.beginPath();
      c.moveTo(r * 0.3, -r * 1.2);
      c.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.3, -r * 1.7);
      c.quadraticCurveTo(r * 0.12, -r * 1.5, r * 0.3, -r * 1.2);
      c.closePath(); c.fill();
    }
    c.restore();
  }

  // ---- Criaturas no humanoides ----------------------------------

  // Murciélago
  function bat(c, r, st) {
    var flap = Math.sin(st.anim * 3) * 0.5;
    c.save();
    c.translate(0, Math.sin(st.anim * 3) * r * 0.15);
    c.fillStyle = '#2a1a38';
    c.beginPath(); c.ellipse(0, 0, r * 0.8, r * 0.5, 0, 0, 6.28); c.fill();
    c.fillStyle = '#3a2850';
    c.beginPath(); c.ellipse(0, 0, r * 0.5, r * 0.3, 0, 0, 6.28); c.fill();
    // alas con membrana
    c.fillStyle = 'rgba(36,18,40,0.92)';
    c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.1);
    c.quadraticCurveTo(-r * 1.6, -r * 0.9 - flap * r * 0.8, -r * 2.0, -r * 0.2 - flap * r * 0.9);
    c.lineTo(-r * 1.15, -r * 0.35 - flap * r * 0.4);
    c.quadraticCurveTo(-r * 0.9, -r * 0.05, -r * 0.55, r * 0.2);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(r * 0.6, -r * 0.1);
    c.quadraticCurveTo(r * 1.6, -r * 0.9 - flap * r * 0.8, r * 2.0, -r * 0.2 - flap * r * 0.9);
    c.lineTo(r * 1.15, -r * 0.35 - flap * r * 0.4);
    c.quadraticCurveTo(r * 0.9, -r * 0.05, r * 0.55, r * 0.2);
    c.closePath(); c.fill();
    // dedos del ala
    c.strokeStyle = '#3a2850'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.1); c.quadraticCurveTo(-r * 1.6, -r * 0.9 - flap * r * 0.8, -r * 2.0, -r * 0.2 - flap * r * 0.9); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.1); c.quadraticCurveTo(-r * 1.3, -r * 0.55 - flap * r * 0.5, -r * 1.55, -r * 0.15 - flap * r * 0.4); c.stroke();
    c.beginPath(); c.moveTo(r * 0.6, -r * 0.1); c.quadraticCurveTo(r * 1.6, -r * 0.9 - flap * r * 0.8, r * 2.0, -r * 0.2 - flap * r * 0.9); c.stroke();
    c.beginPath(); c.moveTo(r * 0.6, -r * 0.1); c.quadraticCurveTo(r * 1.3, -r * 0.55 - flap * r * 0.5, r * 1.55, -r * 0.15 - flap * r * 0.4); c.stroke();
    // orejas
    c.fillStyle = '#2a1a38';
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.4); c.lineTo(-r * 0.5, -r * 0.9); c.lineTo(-r * 0.05, -r * 0.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(r * 0.3, -r * 0.4); c.lineTo(r * 0.5, -r * 0.9); c.lineTo(r * 0.05, -r * 0.5); c.closePath(); c.fill();
    // orejas internas
    c.fillStyle = '#4a2858';
    c.beginPath(); c.moveTo(-r * 0.28, -r * 0.45); c.lineTo(-r * 0.42, -r * 0.8); c.lineTo(-r * 0.12, -r * 0.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(r * 0.28, -r * 0.45); c.lineTo(r * 0.42, -r * 0.8); c.lineTo(r * 0.12, -r * 0.5); c.closePath(); c.fill();
    // ojos
    c.fillStyle = '#e83838';
    c.beginPath(); c.arc(-r * 0.25, -r * 0.2, r * 0.12, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.25, -r * 0.2, r * 0.12, 0, 6.28); c.fill();
    c.fillStyle = '#1a0a0a';
    c.beginPath(); c.arc(-r * 0.25, -r * 0.2, r * 0.05, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.25, -r * 0.2, r * 0.05, 0, 6.28); c.fill();
    c.fillStyle = '#f0e0d8';
    c.beginPath(); c.moveTo(-r * 0.2, r * 0.25); c.lineTo(r * 0.2, r * 0.25); c.lineTo(0, r * 0.5); c.closePath(); c.fill();
    c.restore();
  }

  // Fuego fatuo (orbe con estelas)
  function wisp(c, r, st) {
    var pulse = 0.5 + 0.5 * Math.sin(st.anim * 4);
    c.save();
    c.translate(0, Math.sin(st.anim * 2.4) * r * 0.3);
    var g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
    g.addColorStop(0, 'rgba(170,255,170,0.9)');
    g.addColorStop(0.4, 'rgba(122,212,127,' + (0.5 + pulse * 0.3) + ')');
    g.addColorStop(1, 'rgba(122,212,127,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r * 1.4, 0, 6.28); c.fill();
    // estelas
    c.strokeStyle = 'rgba(160,255,180,0.7)'; c.lineWidth = 1.2;
    for (var i = 0; i < 3; i++) {
      var a = st.anim * 1.4 + i * 2.1;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7 - r * 0.4, Math.cos(a) * r * 1.5, -r * 0.9 + Math.sin(a * 1.3) * r * 0.3);
      c.stroke();
    }
    // núcleo
    orb(c, 0, 0, r * 0.55, '#8ad47f', 'rgba(200,255,210,0.8)');
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(-r * 0.15, -r * 0.18, r * 0.12, 0, 6.28); c.fill();
    c.restore();
  }

  // Araña
  function spider(c, r, st) {
    var sc = st.r;
    c.fillStyle = '#2a2028';
    c.beginPath(); c.ellipse(0, 0, sc * 0.8, sc * 0.6, 0, 0, 6.28); c.fill();
    // cefalotórax
    c.fillStyle = '#3a3040';
    c.beginPath(); c.ellipse(0, -sc * 0.35, sc * 0.55, sc * 0.42, 0, 0, 6.28); c.fill();
    // patas
    c.strokeStyle = '#241a26'; c.lineWidth = sc * 0.12; c.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var ph = st.walk + i * 1.1;
      var sw = Math.sin(ph) * sc * 0.35;
      for (var s = 0; s < 2; s++) {
        var d = s ? 1 : -1;
        c.beginPath();
        c.moveTo(d * sc * 0.4, -sc * 0.15 + i * sc * 0.14);
        c.quadraticCurveTo(d * sc * 1.0, -sc * 0.3 + sw, d * sc * 1.35, -sc * 0.1 - sw + i * sc * 0.12);
        c.stroke();
        if (i < 2) {
          // rodilla
          c.fillStyle = '#2e2230';
          c.beginPath(); c.arc(d * sc * 1.0, -sc * 0.3 + sw, Math.max(1, sc * 0.06), 0, 6.28); c.fill();
        }
      }
    }
    // ojos
    c.fillStyle = '#e83838';
    for (var e2 = 0; e2 < 4; e2++) {
      var ex = -sc * 0.3 + (e2 % 2) * sc * 0.6;
      var ey = -sc * 0.55 + Math.floor(e2 / 2) * sc * 0.22;
      c.beginPath(); c.arc(ex, ey, sc * 0.09, 0, 6.28); c.fill();
    }
    c.fillStyle = '#1a1018';
    for (var e3 = 0; e3 < 4; e3++) {
      var ex2 = -sc * 0.28 + (e3 % 2) * sc * 0.56;
      var ey2 = -sc * 0.55 + Math.floor(e3 / 2) * sc * 0.22;
      c.beginPath(); c.arc(ex2 + sc * 0.03, ey2, sc * 0.04, 0, 6.28); c.fill();
    }
    // colmillos
    c.fillStyle = '#c8b8a0';
    c.beginPath(); c.moveTo(-sc * 0.15, -sc * 0.15); c.lineTo(-sc * 0.25, sc * 0.1); c.lineTo(-sc * 0.05, -sc * 0.05); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sc * 0.15, -sc * 0.15); c.lineTo(sc * 0.25, sc * 0.1); c.lineTo(sc * 0.05, -sc * 0.05); c.closePath(); c.fill();
    // abdomen brillo
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.beginPath(); c.ellipse(0, sc * 0.1, sc * 0.4, sc * 0.25, 0, 0, 6.28); c.fill();
  }

  // Golem de piedra
  function stoneGolem(c, r, st) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(0, r * 1.2, r * 0.6, r * 0.14, 0, 0, 6.28); c.fill();
    var bob = Math.abs(Math.sin(st.walk)) * -r * 0.08;
    var sw = Math.sin(st.walk);
    // brazos de roca (detrás del torso)
    c.fillStyle = '#6a6660';
    c.beginPath(); c.ellipse(-r * 0.95 - sw * r * 0.12, -r * 0.12, r * 0.2, r * 0.58, 0.14, 0, 6.28); c.fill();
    c.beginPath(); c.ellipse(r * 0.95 + sw * r * 0.12, -r * 0.12, r * 0.2, r * 0.58, -0.14, 0, 6.28); c.fill();
    // puños de roca
    c.fillStyle = '#54504b';
    c.beginPath(); c.arc(-r * 0.98 - sw * r * 0.12, r * 0.46, r * 0.24, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.98 + sw * r * 0.12, r * 0.46, r * 0.24, 0, 6.28); c.fill();
    // piernas cónicas (muslo → tobillo)
    taper(c, -r * 0.32, r * 0.46 + bob, -r * 0.4, r * 1.1 + bob, r * 0.4, r * 0.26, '#6a6660', '#3f3c38');
    taper(c, r * 0.32, r * 0.46 + bob, r * 0.4, r * 1.1 + bob, r * 0.4, r * 0.26, '#6a6660', '#3f3c38');
    // pies de roca
    c.fillStyle = '#4a4743';
    c.beginPath(); c.ellipse(-r * 0.44, r * 1.16 + bob, r * 0.3, r * 0.16, 0, 0, 6.28); c.fill();
    c.beginPath(); c.ellipse(r * 0.44, r * 1.16 + bob, r * 0.3, r * 0.16, 0, 0, 6.28); c.fill();
    // torso
    var g = c.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6);
    g.addColorStop(0, '#8a827a');
    g.addColorStop(1, '#5c5750');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-r * 0.55, r * 0.5 + bob);
    c.quadraticCurveTo(-r * 0.78, -r * 0.3, -r * 0.52, -r * 0.72);
    c.quadraticCurveTo(0, -r * 0.85, r * 0.52, -r * 0.72);
    c.quadraticCurveTo(r * 0.78, -r * 0.3, r * 0.55, r * 0.5 + bob);
    c.closePath(); c.fill();
    // hombros de roca
    c.fillStyle = '#7a746e';
    c.beginPath(); c.arc(-r * 0.58, -r * 0.5 + bob, r * 0.3, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.58, -r * 0.5 + bob, r * 0.3, 0, 6.28); c.fill();
    c.fillStyle = '#6a645e';
    c.beginPath(); c.arc(-r * 0.58, -r * 0.6 + bob, r * 0.16, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.58, -r * 0.6 + bob, r * 0.16, 0, 6.28); c.fill();
    // grietas
    c.strokeStyle = 'rgba(30,28,26,0.85)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.5); c.lineTo(-r * 0.1, r * 0.1); c.lineTo(-r * 0.3, r * 0.4); c.stroke();
    c.beginPath(); c.moveTo(r * 0.35, -r * 0.6); c.lineTo(r * 0.15, -r * 0.1); c.lineTo(r * 0.25, r * 0.3); c.stroke();
    // musgo
    c.fillStyle = 'rgba(80,120,60,0.65)';
    c.beginPath(); c.ellipse(r * 0.3, -r * 0.35, r * 0.2, r * 0.12, 0.3, 0, 6.28); c.fill();
    c.beginPath(); c.ellipse(-r * 0.45, r * 0.3, r * 0.16, r * 0.08, -0.2, 0, 6.28); c.fill();
    // cabeza con volumen
    var hg = c.createLinearGradient(0, -r * 1.45, 0, -r * 0.6);
    hg.addColorStop(0, '#847c74');
    hg.addColorStop(1, '#5c5750');
    c.fillStyle = hg;
    c.beginPath();
    c.moveTo(-r * 0.42, -r * 0.68);
    c.quadraticCurveTo(-r * 0.36, -r * 1.38, 0, -r * 1.38);
    c.quadraticCurveTo(r * 0.36, -r * 1.38, r * 0.42, -r * 0.68);
    c.quadraticCurveTo(r * 0.2, -r * 0.6, -r * 0.2, -r * 0.6);
    c.closePath(); c.fill();
    // cejas de roca
    c.fillStyle = '#4a4743';
    c.beginPath(); c.moveTo(-r * 0.38, -r * 1.08); c.lineTo(-r * 0.06, -r * 1.0); c.lineTo(-r * 0.4, -r * 0.96); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(r * 0.38, -r * 1.08); c.lineTo(r * 0.06, -r * 1.0); c.lineTo(r * 0.4, -r * 0.96); c.closePath(); c.fill();
    // ojos de brasa
    var oGlow = 0.5 + 0.5 * Math.sin(st.anim * 4);
    c.fillStyle = 'rgba(255,150,40,0.9)';
    c.beginPath(); c.ellipse(-r * 0.24, -r * 1.02, r * 0.13, r * 0.07, 0, 0, 6.28); c.fill();
    c.beginPath(); c.ellipse(r * 0.24, -r * 1.02, r * 0.13, r * 0.07, 0, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,170,60,' + (0.2 + oGlow * 0.3) + ')';
    c.beginPath(); c.arc(-r * 0.24, -r * 1.02, r * 0.2, 0, 6.28); c.fill();
    c.beginPath(); c.arc(r * 0.24, -r * 1.02, r * 0.2, 0, 6.28); c.fill();
    // boca de grieta
    c.strokeStyle = 'rgba(30,28,26,0.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-r * 0.16, -r * 0.82); c.quadraticCurveTo(0, -r * 0.78, r * 0.16, -r * 0.82); c.stroke();
    c.restore();
  }

  // Gólem de fuego (reutiliza stoneGolem con parámetros)
  function fireGolem(c, r, st) {
    var temp = st.r; st.r = r;
    stoneGolem(c, r, st);
    st.r = temp;
    // grietas incandescentes
    var pulse = 0.5 + 0.5 * Math.sin(st.anim * 3);
    c.save();
    c.strokeStyle = 'rgba(255,140,40,' + (0.5 + pulse * 0.5) + ')';
    c.lineWidth = r * 0.14;
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.5); c.lineTo(-r * 0.1, r * 0.1); c.lineTo(-r * 0.3, r * 0.4); c.stroke();
    c.beginPath(); c.moveTo(r * 0.35, -r * 0.6); c.lineTo(r * 0.15, -r * 0.1); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.32, -r * 1.1); c.lineTo(r * 0.32, -r * 1.1); c.stroke();
    // brasas orbitantes
    for (var ci = 0; ci < 3; ci++) {
      var ca = st.anim * 2 + ci * 2.09;
      var cx3 = Math.cos(ca) * r * 0.3;
      var cy3 = -r * 0.3 + Math.sin(ca) * r * 0.2 - ci * r * 0.15;
      c.fillStyle = 'rgba(255,100,20,' + (pulse * 0.47).toFixed(3) + ')';
      c.beginPath(); c.ellipse(cx3, cy3, r * 0.15, r * 0.1, 0, 0, 6.28); c.fill();
    }
    c.globalAlpha = 0.5 + pulse * 0.3;
    orb(c, 0, -r * 0.35, r * 0.3, '#ff9a3a', 'rgba(255,120,20,0.6)');
    c.restore();
  }

  // -------- Registro público ---------

  return {
    shade: shade,
    mix: mix,
    rgba: rgba,
    figure: figure,
    dragonHead: dragonHead,
    bat: bat,
    wisp: wisp,
    spider: spider,
    stoneGolem: stoneGolem,
    fireGolem: fireGolem,
    wing: wing,
    orb: orb,
    rod: rod
  };
})();

if (typeof window !== 'undefined') window.ART = ART;
