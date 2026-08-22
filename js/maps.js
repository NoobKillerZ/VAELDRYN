'use strict';

// ============================================================
//  MAPAS DE VAELDRYN
//  Cada mapa define su propia ruta (PATH), dificultad, tema
//  visual y posiciones del castillo / portal.
// ============================================================

var MAPS = [
  {
    id: 'plains', name: 'Llanuras de Valdryn', icon: '🏰',
    desc: 'Las tierras de tu reino: un camino de adoquines, un lago sereno y el castillo a la vista.',
    difficulty: 1, startGold: 180, startLives: 20, mult: 1.0,
    theme: 'plains',
    path: [[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [18, 3], [18, 11], [24, 11]],
    portal: [1, 3], castle: [20, 8.4], featurePos: [2.5, 12.1]
  },
  {
    id: 'desert', name: 'Desierto de Ashar', icon: '🏜️',
    desc: 'Un laberinto de dunas y oasis ocultos. El sol abrasa y los muertos caminan.',
    difficulty: 1, startGold: 175, startLives: 20, mult: 1.15,
    theme: 'desert',
    path: [[-1, 2], [5, 2], [5, 6], [9, 6], [9, 2], [14, 2], [14, 6], [18, 6], [18, 10], [13, 10], [13, 13], [24, 13]],
    portal: [1, 2], castle: [20, 11], featurePos: [7.5, 10.5]
  },
  {
    id: 'forest', name: 'Bosque Sombrío', icon: '🌲',
    desc: 'Árboles centenarios, niebla y criaturas de la madera. El camino serpentea entre las raíces.',
    difficulty: 2, startGold: 170, startLives: 18, mult: 1.3,
    theme: 'forest',
    path: [[-1, 6], [3, 6], [3, 2], [9, 2], [9, 8], [5, 8], [5, 11], [13, 11], [13, 7], [20, 7], [20, 13], [24, 13]],
    portal: [1, 6], castle: [21, 11], featurePos: [22, 3.2]
  },
  {
    id: 'frozen', name: 'Montañas Heladas', icon: '❄️',
    desc: 'El frío eterno. Los glaciares crujen y los espectros de escarcha patrullan la nieve.',
    difficulty: 2, startGold: 165, startLives: 18, mult: 1.5,
    theme: 'frozen',
    path: [[-1, 1], [4, 1], [4, 5], [8, 5], [8, 9], [12, 9], [12, 5], [16, 5], [16, 12], [24, 12]],
    portal: [1, 1], castle: [20, 10], featurePos: [20.5, 2.4]
  },
  {
    id: 'void', name: 'Ruinas del Vacío', icon: '🌌',
    desc: 'El corazón de la corrupción. Largas serpentinas de ruinas corruptas, la prueba final.',
    difficulty: 3, startGold: 160, startLives: 16, mult: 1.75,
    theme: 'void',
    path: [[-1, 1], [1, 1], [1, 12], [7, 12], [7, 1], [13, 1], [13, 12], [19, 12], [19, 1], [24, 1]],
    portal: [1, 1], castle: [20, 2], featurePos: [4, 7]
  },
  {
    id: 'marsh', name: 'Marisma Podrida', icon: '🐊',
    desc: 'Ciénagas hirvientes entre raíces muertas. El lodo ralentiza a tus tropas y alimenta a la plaga.',
    difficulty: 3, startGold: 158, startLives: 15, mult: 1.8,
    theme: 'forest',
    path: [[-1, 12], [3, 12], [3, 6], [8, 6], [8, 12], [13, 12], [13, 4], [18, 4], [18, 10], [24, 10]],
    portal: [1, 12], castle: [20, 8], featurePos: [5, 2]
  },
  {
    id: 'canyon', name: 'Cañón de Ceniza', icon: '🌋',
    desc: 'Grietas humeantes y puentes colgantes sobre la lava. El último bastión antes del fin.',
    difficulty: 3, startGold: 155, startLives: 15, mult: 1.9,
    theme: 'desert',
    path: [[-1, 7], [4, 7], [4, 2], [10, 2], [10, 11], [16, 11], [16, 4], [21, 4], [21, 12], [24, 12]],
    portal: [1, 7], castle: [21, 10], featurePos: [6, 5]
  }
];

var MAPS_BY_ID = {};
for (var __m = 0; __m < MAPS.length; __m++) MAPS_BY_ID[MAPS[__m].id] = MAPS[__m];

// ============================================================
//  DECORACIÓN COMPARTIDA
// ============================================================

function decoTree(ctx, cx, cy, trunk, leaf, hi) {
  var i;
  // sombra proyectada
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + 1, cy + 10, 10, 3.2, 0, 0, 6.28); ctx.fill();
  // tronco cónico con raíces y bifurcación
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(cx - 2.4, cy + 10);
  ctx.quadraticCurveTo(cx - 2.8, cy + 4, cx - 1.6, cy - 1);
  ctx.lineTo(cx + 1.6, cy - 1);
  ctx.quadraticCurveTo(cx + 2.8, cy + 4, cx + 2.4, cy + 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,6,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 0.6, cy + 9); ctx.quadraticCurveTo(cx - 1, cy + 5, cx - 0.4, cy + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 2.2, cy + 9.6); ctx.lineTo(cx - 4.6, cy + 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 2.2, cy + 9.6); ctx.lineTo(cx + 4.4, cy + 11); ctx.stroke();
  // ramas visibles bajo la copa
  ctx.strokeStyle = trunk; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx - 4.5, cy - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + 1); ctx.lineTo(cx + 4.5, cy - 4.5); ctx.stroke();
  // copa: masa oscura trasera
  var back = leaf, mid = leaf, front = hi;
  ctx.fillStyle = back;
  ctx.beginPath(); ctx.arc(cx - 5.5, cy - 3, 6.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5.5, cy - 3, 6.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - 8.5, 7.5, 0, 6.28); ctx.fill();
  // lóbulos medios
  ctx.fillStyle = mid;
  ctx.beginPath(); ctx.arc(cx - 3.5, cy - 5.5, 5.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3.5, cy - 5.5, 5.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - 2, 4.5, 0, 6.28); ctx.fill();
  // luz cenital en los lóbulos
  ctx.fillStyle = front;
  ctx.beginPath(); ctx.arc(cx - 2.5, cy - 9, 3, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 5, cy - 5, 1.8, 0, 6.28); ctx.fill();
  // motas de hojas sueltas
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (i = 0; i < 4; i++) {
    var la = i * 1.7 + cx % 3;
    ctx.beginPath(); ctx.arc(cx + Math.cos(la) * 6.5, cy - 5 + Math.sin(la) * 4, 0.8, 0, 6.28); ctx.fill();
  }
  // sombreado inferior de la copa para volumen
  ctx.strokeStyle = 'rgba(10,24,10,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - 1.5, 8.5, 0.35, Math.PI - 0.35); ctx.stroke();
}

function decoPine(ctx, cx, cy, dark, light, snow) {
  var i;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 10, 7, 2.6, 0, 0, 6.28); ctx.fill();
  // tronco
  ctx.fillStyle = '#4a3520';
  ctx.beginPath(); ctx.roundRect(cx - 1.5, cy + 2, 3, 9, 1.2); ctx.fill();
  // cuatro pisos de ramas con caída (bordes combados)
  var layers = [
    [cy - 17, 4.2, dark],
    [cy - 12.5, 5.6, light],
    [cy - 8, 6.8, dark],
    [cy - 3.5, 7.8, light]
  ];
  for (i = 0; i < layers.length; i++) {
    var ty = layers[i][0], w = layers[i][1], col = layers[i][2];
    var baseY = cy + 3 - i * 0.4;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, ty);
    ctx.quadraticCurveTo(cx - w * 0.55, ty + (baseY - ty) * 0.55, cx - w, baseY - 1.5);
    ctx.quadraticCurveTo(cx - w * 0.5, baseY + 0.5, cx, baseY - 0.5);
    ctx.quadraticCurveTo(cx + w * 0.5, baseY + 0.5, cx + w, baseY - 1.5);
    ctx.quadraticCurveTo(cx + w * 0.55, ty + (baseY - ty) * 0.55, cx, ty);
    ctx.closePath(); ctx.fill();
    // nieve posada en cada piso
    if (snow) {
      ctx.strokeStyle = 'rgba(240,248,255,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.62, ty + (baseY - ty) * 0.62);
      ctx.quadraticCurveTo(cx, ty + (baseY - ty) * 0.4, cx + w * 0.62, ty + (baseY - ty) * 0.62);
      ctx.stroke();
    }
  }
  // luz del lado iluminado
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.arc(cx - 2.6, cy - 12, 1.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 1.8, cy - 6.5, 1.1, 0, 6.28); ctx.fill();
}

function decoCactus(ctx, cx, cy) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + 1, cy + 9, 8, 2.4, 0, 0, 6.28); ctx.fill();
  // brazos (detrás del fuste)
  ctx.fillStyle = '#2f6e2f';
  ctx.beginPath(); ctx.roundRect(cx - 9, cy - 8, 4.6, 6, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx - 7.5, cy - 4, 4, 3.4, 1.6); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + 4.4, cy - 7, 4.6, 5, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + 3.6, cy - 3.6, 4, 3.2, 1.6); ctx.fill();
  // fuste principal
  var cg = ctx.createLinearGradient(cx - 3, cy, cx + 3, cy);
  cg.addColorStop(0, '#4a8a42'); cg.addColorStop(0.5, '#3a7a3a'); cg.addColorStop(1, '#2c622c');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.roundRect(cx - 2.8, cy - 6, 6, 15, 2.6); ctx.fill();
  ctx.strokeStyle = 'rgba(16,36,12,0.65)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(cx - 2.8, cy - 6, 6, 15, 2.6); ctx.stroke();
  // costillas longitudinales
  ctx.strokeStyle = 'rgba(220,255,210,0.22)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(cx - 1.2, cy - 5); ctx.lineTo(cx - 1.2, cy + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 1.4, cy - 5); ctx.lineTo(cx + 1.4, cy + 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(16,36,12,0.35)';
  ctx.beginPath(); ctx.moveTo(cx + 2.6, cy - 4); ctx.lineTo(cx + 2.6, cy + 7); ctx.stroke();
  // espinas
  ctx.strokeStyle = 'rgba(240,240,220,0.6)'; ctx.lineWidth = 0.7;
  for (var sp = 0; sp < 3; sp++) {
    ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2 + sp * 4); ctx.lineTo(cx - 4.2, cy - 2.8 + sp * 4); ctx.stroke();
  }
  // flor
  ctx.fillStyle = '#e86a9a';
  ctx.beginPath(); ctx.arc(cx, cy - 7.4, 1.6, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(cx, cy - 7.4, 0.7, 0, 6.28); ctx.fill();
  // roca compañera
  ctx.fillStyle = '#8a5a2a';
  ctx.beginPath(); ctx.arc(cx + 5, cy + 6, 3, 0, 6.28); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(cx + 4, cy + 5, 1.2, 0, 6.28); ctx.fill();
}

function decoRock(ctx, cx, cy, a, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx + 1, cy + 8.5, 9, 2.6, 0, 0, 6.28); ctx.fill();
  // canto poligonal con facetas
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 8);
  ctx.lineTo(cx - 8.5, cy + 4);
  ctx.lineTo(cx - 5, cy + 0.5);
  ctx.lineTo(cx - 1, cy - 1);
  ctx.lineTo(cx + 4, cy + 0.2);
  ctx.lineTo(cx + 8, cy + 3.5);
  ctx.lineTo(cx + 7.5, cy + 8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,16,12,0.55)'; ctx.lineWidth = 1;
  ctx.stroke();
  // faceta iluminada y faceta en sombra
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 0.5);
  ctx.lineTo(cx - 1, cy - 1);
  ctx.lineTo(cx + 1.5, cy + 3);
  ctx.lineTo(cx - 2, cy + 6);
  ctx.lineTo(cx - 6, cy + 4.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy + 0.2);
  ctx.lineTo(cx + 8, cy + 3.5);
  ctx.lineTo(cx + 7.5, cy + 8);
  ctx.lineTo(cx + 2.5, cy + 7);
  ctx.lineTo(cx + 1.5, cy + 3);
  ctx.closePath(); ctx.fill();
  // grieta
  ctx.strokeStyle = 'rgba(15,12,8,0.5)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(cx - 1, cy + 0.2); ctx.lineTo(cx + 0.5, cy + 3); ctx.lineTo(cx - 0.8, cy + 5.5); ctx.stroke();
  // musgo
  ctx.fillStyle = 'rgba(90,130,60,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - 4.5, cy + 6.5, 2.4, 1, -0.2, 0, 6.28); ctx.fill();
  // destello cenital
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.ellipse(cx - 2.5, cy + 0.8, 2, 1, -0.5, 0, 6.28); ctx.fill();
}

function decoFlower(ctx, cx, cy, stem, petals) {
  ctx.fillStyle = stem;
  ctx.beginPath(); ctx.arc(cx, cy + 6, 3, 0, 6.28); ctx.fill();
  ctx.fillStyle = petals;
  ctx.beginPath(); ctx.arc(cx - 3, cy + 3, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3, cy + 3, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(cx, cy + 3, 1.6, 0, 6.28); ctx.fill();
}

function decoBush(ctx, cx, cy, a, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 8, 6, 1.8, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = a;
  ctx.beginPath(); ctx.arc(cx, cy + 6, 4, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 2.6, cy + 6.5, 2.6, 0, 6.28); ctx.fill();
  ctx.fillStyle = b;
  ctx.beginPath(); ctx.arc(cx + 2, cy + 5, 2.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(cx - 1.4, cy + 4, 1.4, 0, 6.28); ctx.fill();
}

function decoMushroom(ctx, cx, cy, cap, cap2) {
  ctx.fillStyle = '#c8c8cc';
  ctx.beginPath(); ctx.ellipse(cx, cy + 7, 3, 1.6, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath(); ctx.arc(cx, cy + 6, 2.6, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(cx - 1, cy + 5, 0.7, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#c8c8cc';
  ctx.beginPath(); ctx.ellipse(cx + 5, cy + 6, 2.4, 1.4, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = cap2;
  ctx.beginPath(); ctx.arc(cx + 5, cy + 5.5, 2, Math.PI, 0); ctx.fill();
}

function decoCrystal(ctx, cx, cy, col, col2) {
  ctx.fillStyle = col2;
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 8, 0, 6.28); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 2, cy - 8); ctx.lineTo(cx + 2, cy - 8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 2, cy + 2); ctx.lineTo(cx - 5, cy - 6); ctx.lineTo(cx - 1, cy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 2, cy + 1); ctx.lineTo(cx + 4, cy - 5); ctx.lineTo(cx + 1, cy - 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col2;
  ctx.beginPath(); ctx.arc(cx, cy - 5, 1.2, 0, 6.28); ctx.fill();
}

function decoBone(ctx, cx, cy) {
  ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 3, cy + 2); ctx.lineTo(cx + 3, cy - 2); ctx.stroke();
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath(); ctx.arc(cx - 3, cy + 2, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 2, 0, 6.28); ctx.fill();
}

function decoSkull(ctx, cx, cy) {
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, 6.28); ctx.fill();
  ctx.fillRect(cx - 1.5, cy + 2.5, 3, 2.5);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(cx - 1.2, cy - 0.5, 0.9, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 1.2, cy - 0.5, 0.9, 0, 6.28); ctx.fill();
}

function decoRuins(ctx, cx, cy, a, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 8.5, 9, 2.4, 0, 0, 6.28); ctx.fill();
  // dos pilares rotos con capiteles
  ctx.fillStyle = a;
  ctx.beginPath(); ctx.roundRect(cx - 6.5, cy - 2, 5, 10.5, 1); ctx.fill();
  ctx.save();
  ctx.translate(cx + 3, cy + 1);
  ctx.rotate(0.06);
  ctx.beginPath(); ctx.roundRect(-2, -6, 4, 13, 1); ctx.fill();
  ctx.restore();
  ctx.fillStyle = b;
  ctx.beginPath(); ctx.roundRect(cx - 6.5, cy - 2, 5, 2, 1); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + 0.5, cy - 5.5, 4.6, 2, 1); ctx.fill();
  // estrías de columna
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - 4.8, cy); ctx.lineTo(cx - 4.8, cy + 7.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 3.2, cy); ctx.lineTo(cx - 3.2, cy + 7.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 2.6, cy - 3.5); ctx.lineTo(cx + 2.9, cy + 6.5); ctx.stroke();
  // grieta y bloque caído
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.moveTo(cx - 5.6, cy + 1); ctx.lineTo(cx - 4.4, cy + 4); ctx.lineTo(cx - 5.2, cy + 7); ctx.stroke();
  ctx.fillStyle = a;
  ctx.beginPath(); ctx.roundRect(cx - 1, cy + 6, 5, 3.4, 1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.roundRect(cx - 1, cy + 6, 5, 1, 1); ctx.fill();
}

function decoGrass(ctx, cx, cy, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy);
  ctx.lineTo(cx, cy - 7);
  ctx.lineTo(cx + 3, cy);
  ctx.closePath(); ctx.fill();
}

function decoFern(ctx, cx, cy, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + 4, cy - 5, cx + 8, cy - 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx - 4, cy - 5, cx - 8, cy - 6); ctx.stroke();
}

// ============================================================
//  TEMAS
// ============================================================

var THEMES = {
  plains: {
    name: 'Pradera',
    ground: ['#3a4a2a', '#3f5130', '#2e3a24'],
    cell: function (h, shade) {
      var base = 56 + Math.floor(h * 26) + shade;
      return 'rgba(' + Math.max(20, base - 16) + ',' + Math.min(200, base + 52) + ',' + Math.max(18, base - 26) + ',0.5)';
    },
    tuft: 'rgba(120,190,90,0.35)',
    soil: 'rgba(60,45,25,0.25)',
    paintDecor: function (c, cx, cy, hh) {
      if (hh > 0.955) decoTree(c, cx, cy, '#5a3d22', '#2e6e2e', 'rgba(140,210,90,0.55)');
      else if (hh > 0.925) decoRock(c, cx, cy, '#6a6a74', '#7d7d88');
      else if (hh > 0.9) decoFlower(c, cx, cy, '#2e7a2e', ['#e05050', '#e8c060', '#d060d0', '#60a0e8'][Math.floor(hh * 10) % 4]);
      else if (hh > 0.88) decoBush(c, cx, cy, '#3f8f3f', '#4faf4f');
      else if (hh > 0.86) decoMushroom(c, cx, cy, '#e05858', '#e08058');
      else if (hh > 0.84) decoGrass(c, cx, cy, 'rgba(140,200,90,0.5)');
    },
    // hierba mecida por el viento y florecillas
    detail: function (c, COLS, ROWS, CELL) {
      for (var i = 0; i < 300; i++) {
        var gx = hash2(i, 11) * COLS * CELL, gy = hash2(i, 77) * ROWS * CELL;
        var h = hash2(i, 5);
        c.strokeStyle = h > 0.5 ? 'rgba(150,210,95,0.3)' : 'rgba(80,140,55,0.3)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(gx, gy);
        c.quadraticCurveTo(gx + (h - 0.5) * 3, gy - 2.5, gx + (h - 0.5) * 6, gy - 3.5 - h * 2);
        c.stroke();
      }
      for (var f = 0; f < 26; f++) {
        var fx = hash2(f, 31) * COLS * CELL, fy = hash2(f, 91) * ROWS * CELL;
        c.fillStyle = ['rgba(240,220,120,0.5)', 'rgba(240,240,240,0.45)', 'rgba(230,140,160,0.45)'][f % 3];
        c.beginPath(); c.arc(fx, fy, 1.1, 0, 6.28); c.fill();
      }
    },
    path: 'cobble'
  },
  desert: {
    name: 'Desierto',
    ground: ['#b59a52', '#c4aa60', '#8a7438'],
    cell: function (h, shade) {
      var base = 150 + Math.floor(h * 34) + shade;
      return 'rgba(' + Math.min(220, base + 30) + ',' + Math.min(200, base - 6) + ',' + Math.min(150, base - 70) + ',0.55)';
    },
    tuft: 'rgba(150,180,90,0.18)',
    soil: 'rgba(120,85,40,0.2)',
    paintDecor: function (c, cx, cy, hh) {
      if (hh > 0.955) decoCactus(c, cx, cy);
      else if (hh > 0.93) decoRock(c, cx, cy, '#8a7a58', '#a89a70');
      else if (hh > 0.905) decoSkull(c, cx, cy);
      else if (hh > 0.885) decoBush(c, cx, cy, '#6a8f4a', '#7aa05a');
      else if (hh > 0.87) decoBone(c, cx, cy);
      else if (hh > 0.85) decoRuins(c, cx, cy, '#9a8a6a', '#b0a080');
    },
    // crestas de dunas y guijarros
    detail: function (c, COLS, ROWS, CELL) {
      for (var i = 0; i < 46; i++) {
        var dx = hash2(i, 17) * COLS * CELL, dy = hash2(i, 43) * ROWS * CELL;
        var len = 30 + hash2(i, 7) * 70;
        c.strokeStyle = 'rgba(120,95,45,0.28)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(dx - len / 2, dy);
        c.quadraticCurveTo(dx, dy - 4 - hash2(i, 3) * 5, dx + len / 2, dy);
        c.stroke();
        c.strokeStyle = 'rgba(230,205,140,0.3)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(dx - len / 2, dy - 1.6);
        c.quadraticCurveTo(dx, dy - 5.6 - hash2(i, 3) * 5, dx + len / 2, dy - 1.6);
        c.stroke();
      }
      for (var p = 0; p < 60; p++) {
        var px = hash2(p, 23) * COLS * CELL, py = hash2(p, 59) * ROWS * CELL;
        c.fillStyle = hash2(p, 9) > 0.5 ? 'rgba(110,88,48,0.4)' : 'rgba(200,180,120,0.35)';
        c.beginPath(); c.arc(px, py, 0.9 + hash2(p, 13), 0, 6.28); c.fill();
      }
    },
    path: 'sand'
  },
  forest: {
    name: 'Bosque',
    ground: ['#2a3a20', '#33522a', '#1e2c18'],
    cell: function (h, shade) {
      var base = 40 + Math.floor(h * 26) + shade;
      return 'rgba(' + Math.max(16, base - 16) + ',' + Math.min(170, base + 44) + ',' + Math.max(14, base - 22) + ',0.55)';
    },
    tuft: 'rgba(90,150,60,0.3)',
    soil: 'rgba(40,28,14,0.3)',
    paintDecor: function (c, cx, cy, hh) {
      if (hh > 0.94) decoTree(c, cx, cy, '#3a2a16', '#1e4a1e', 'rgba(255,255,255,0.1)');
      else if (hh > 0.915) decoPine(c, cx, cy, '#1a3a1a', '#2e5a2e');
      else if (hh > 0.89) decoFern(c, cx, cy, '#3f7a3f');
      else if (hh > 0.87) decoMushroom(c, cx, cy, '#6a2a8a', '#8a3a9a');
      else if (hh > 0.85) decoBush(c, cx, cy, '#2e5a2e', '#3f7a3f');
      else if (hh > 0.83) decoRock(c, cx, cy, '#5a5a4a', '#6e6e5c');
      else if (hh > 0.81) decoGrass(c, cx, cy, 'rgba(110,170,80,0.4)');
    },
    // sotobosque: hierba oscura, tréboles y hojarasca
    detail: function (c, COLS, ROWS, CELL) {
      for (var i = 0; i < 260; i++) {
        var gx = hash2(i, 19) * COLS * CELL, gy = hash2(i, 83) * ROWS * CELL;
        var h = hash2(i, 5);
        c.strokeStyle = h > 0.5 ? 'rgba(110,170,75,0.28)' : 'rgba(45,85,35,0.32)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(gx, gy);
        c.quadraticCurveTo(gx + (h - 0.5) * 3, gy - 2.5, gx + (h - 0.5) * 5, gy - 3 - h * 2);
        c.stroke();
      }
      for (var l = 0; l < 34; l++) {
        var lx = hash2(l, 37) * COLS * CELL, ly = hash2(l, 71) * ROWS * CELL;
        c.fillStyle = ['rgba(150,110,50,0.35)', 'rgba(120,90,40,0.35)', 'rgba(90,120,50,0.3)'][l % 3];
        c.beginPath(); c.ellipse(lx, ly, 2.2, 1.1, hash2(l, 3) * 3, 0, 6.28); c.fill();
      }
      for (var t = 0; t < 40; t++) {
        var tx = hash2(t, 29) * COLS * CELL, ty = hash2(t, 67) * ROWS * CELL;
        c.fillStyle = 'rgba(70,140,60,0.4)';
        c.beginPath(); c.arc(tx, ty, 0.9, 0, 6.28); c.fill();
        c.beginPath(); c.arc(tx + 1.4, ty + 0.4, 0.9, 0, 6.28); c.fill();
        c.beginPath(); c.arc(tx - 1.2, ty + 0.6, 0.9, 0, 6.28); c.fill();
      }
    },
    path: 'dirt'
  },
  frozen: {
    name: 'Tundra',
    ground: ['#8aa0b8', '#a8c0d4', '#5e768e'],
    cell: function (h, shade) {
      var base = 120 + Math.floor(h * 30) + shade;
      return 'rgba(' + Math.min(220, base + 70) + ',' + Math.min(230, base + 80) + ',' + Math.min(235, base + 95) + ',0.6)';
    },
    tuft: 'rgba(255,255,255,0.25)',
    soil: 'rgba(120,150,180,0.25)',
    paintDecor: function (c, cx, cy, hh) {
      if (hh > 0.94) decoPine(c, cx, cy, '#2a5a4a', '#3a7a5a', true);
      else if (hh > 0.91) decoRock(c, cx, cy, '#9aa8b8', '#c8d4e0');
      else if (hh > 0.88) decoCrystal(c, cx, cy, '#bfe8ff', '#ffffff');
      else if (hh > 0.86) decoBush(c, cx, cy, '#8ab0a0', '#a0c8b4');
      else if (hh > 0.845) decoBone(c, cx, cy);
      else if (hh > 0.83) decoSkull(c, cx, cy);
    },
    // destellos de nieve y sombras de ventisquero
    detail: function (c, COLS, ROWS, CELL) {
      for (var i = 0; i < 150; i++) {
        var sx = hash2(i, 13) * COLS * CELL, sy = hash2(i, 47) * ROWS * CELL;
        var h = hash2(i, 3);
        c.fillStyle = 'rgba(255,255,255,' + (0.35 + h * 0.4) + ')';
        if (h > 0.82) {
          c.fillRect(sx - 1.6, sy - 0.5, 3.2, 1);
          c.fillRect(sx - 0.5, sy - 1.6, 1, 3.2);
        } else {
          c.beginPath(); c.arc(sx, sy, 0.7 + h * 0.7, 0, 6.28); c.fill();
        }
      }
      for (var d = 0; d < 22; d++) {
        var dx = hash2(d, 53) * COLS * CELL, dy = hash2(d, 97) * ROWS * CELL;
        c.fillStyle = 'rgba(90,130,170,0.16)';
        c.beginPath(); c.ellipse(dx, dy, 16 + hash2(d, 7) * 22, 3.5 + hash2(d, 11) * 3, hash2(d, 5) * 0.6 - 0.3, 0, 6.28); c.fill();
      }
    },
    path: 'ice'
  },
  void: {
    name: 'Vacío',
    ground: ['#1a1024', '#241632', '#120c1c'],
    cell: function (h, shade) {
      var base = 22 + Math.floor(h * 26) + shade;
      return 'rgba(' + Math.min(120, base + 40) + ',' + Math.max(8, base - 10) + ',' + Math.min(140, base + 58) + ',0.6)';
    },
    tuft: 'rgba(160,90,220,0.14)',
    soil: 'rgba(60,20,90,0.3)',
    paintDecor: function (c, cx, cy, hh) {
      if (hh > 0.94) decoCrystal(c, cx, cy, '#8a4aff', '#c8a0ff');
      else if (hh > 0.91) decoRuins(c, cx, cy, '#3a2a4a', '#4e3a64');
      else if (hh > 0.885) decoSkull(c, cx, cy);
      else if (hh > 0.865) decoBone(c, cx, cy);
      else if (hh > 0.845) decoBush(c, cx, cy, '#3a2a5a', '#4a3a6a');
      else if (hh > 0.83) decoRock(c, cx, cy, '#3a3250', '#4c4270');
    },
    // fisuras del vacío y motas corruptas
    detail: function (c, COLS, ROWS, CELL) {
      for (var i = 0; i < 42; i++) {
        var fx = hash2(i, 21) * COLS * CELL, fy = hash2(i, 61) * ROWS * CELL;
        var segs = 3 + Math.floor(hash2(i, 9) * 3);
        c.strokeStyle = 'rgba(150,80,230,' + (0.12 + hash2(i, 5) * 0.16) + ')';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(fx, fy);
        var px2 = fx, py2 = fy;
        for (var s = 0; s < segs; s++) {
          px2 += (hash2(i * 7 + s, 33) - 0.5) * 18;
          py2 += (hash2(i * 7 + s, 55) - 0.5) * 18;
          c.lineTo(px2, py2);
        }
        c.stroke();
        c.fillStyle = 'rgba(190,130,255,0.35)';
        c.beginPath(); c.arc(fx, fy, 1.1, 0, 6.28); c.fill();
      }
      for (var m = 0; m < 36; m++) {
        var mx = hash2(m, 41) * COLS * CELL, my = hash2(m, 89) * ROWS * CELL;
        c.fillStyle = 'rgba(170,110,240,' + (0.1 + hash2(m, 7) * 0.2) + ')';
        c.beginPath(); c.arc(mx, my, 0.8 + hash2(m, 3) * 1.2, 0, 6.28); c.fill();
      }
    },
    path: 'void'
  }
};

// ============================================================
//  DIBUJO DE CAMINOS POR TEMA
// ============================================================

function paintPathCobble(c, cells, CELL) {
  var keys = Object.keys(cells);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(',');
    var pc = +parts[0], pr = +parts[1];
    var x = pc * CELL, y = pr * CELL;
    // argamasa de tierra oscura
    c.fillStyle = '#6a4f2c';
    c.fillRect(x, y, CELL, CELL);
    c.fillStyle = 'rgba(60,44,22,0.5)';
    c.fillRect(x, y, CELL, 3);
    c.fillRect(x, y + CELL - 3, CELL, 3);
    // adoquines irregulares con sombra propia
    for (var sy = 0; sy < 3; sy++) {
      for (var sx = 0; sx < 3; sx++) {
        var hh2 = hash2(pc * 6 + sx, pr * 6 + sy);
        var w = CELL / 3 - 3 - hh2 * 2.5;
        var cx2 = x + sx * CELL / 3 + CELL / 6 + (hh2 - 0.5) * 4;
        var cy2 = y + sy * CELL / 3 + CELL / 6 + (((hh2 * 53) % 1) - 0.5) * 4;
        // sombra inferior
        c.fillStyle = 'rgba(50,35,15,0.5)';
        c.beginPath(); c.roundRect(cx2 - w / 2 + 1.2, cy2 - w / 2 + 1.8, w, w * 0.82, 3); c.fill();
        // cara del adoquín (tono variable)
        var tone = hh2;
        c.fillStyle = tone > 0.66 ? '#cbb274' : (tone > 0.33 ? '#bda367' : '#a98f55');
        c.beginPath(); c.roundRect(cx2 - w / 2, cy2 - w / 2, w, w * 0.82, 3); c.fill();
        // bisel iluminado y desgaste
        c.fillStyle = 'rgba(255,242,200,' + (0.22 + hh2 * 0.2) + ')';
        c.beginPath(); c.roundRect(cx2 - w / 2 + 1, cy2 - w / 2 + 1, w - 2, w * 0.3, 2.4); c.fill();
        if (hh2 > 0.8) {
          c.strokeStyle = 'rgba(70,52,26,0.55)'; c.lineWidth = 0.9;
          c.beginPath(); c.moveTo(cx2 - 3, cy2 - 2); c.lineTo(cx2 + 3, cy2 + 2); c.stroke();
        }
        // musgo entre juntas
        if (hh2 < 0.18) {
          c.fillStyle = 'rgba(90,140,60,0.45)';
          c.beginPath(); c.arc(cx2 + w / 2, cy2 + w / 2, 1.6, 0, 6.28); c.fill();
        }
      }
    }
  }
}

function paintPathSand(c, cells, CELL) {
  var keys = Object.keys(cells);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(',');
    var pc = +parts[0], pr = +parts[1];
    var x = pc * CELL, y = pr * CELL;
    // base compactada por el paso
    var hg = c.createLinearGradient(x, y, x, y + CELL);
    hg.addColorStop(0, '#8a6e3c');
    hg.addColorStop(0.5, '#9c8050');
    hg.addColorStop(1, '#7a5e32');
    c.fillStyle = hg;
    c.fillRect(x, y, CELL, CELL);
    // surcos de viento (ripples)
    for (var rp = 0; rp < 3; rp++) {
      var h3 = hash2(pc * 5 + rp, pr * 9 + rp);
      var ry = y + 6 + rp * (CELL - 12) / 2 + (h3 - 0.5) * 4;
      c.strokeStyle = 'rgba(120,92,44,0.4)'; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x + 3, ry);
      c.quadraticCurveTo(x + CELL * 0.5, ry - 2.5 - h3 * 2, x + CELL - 3, ry);
      c.stroke();
      c.strokeStyle = 'rgba(225,200,135,0.35)'; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 3, ry - 1.6);
      c.quadraticCurveTo(x + CELL * 0.5, ry - 4 - h3 * 2, x + CELL - 3, ry - 1.6);
      c.stroke();
    }
    // guijarros y granos
    for (var s = 0; s < 4; s++) {
      var h2 = hash2(pc * 7 + s, pr * 3 + s);
      var sx = x + 4 + h2 * (CELL - 8), sy = y + 4 + ((h2 * 31) % 1) * (CELL - 8);
      c.fillStyle = 'rgba(110,84,40,0.4)';
      c.beginPath(); c.ellipse(sx, sy, 1.6 + h2 * 1.6, 1.1, h2 * 3, 0, 6.28); c.fill();
    }
    // huellas hundidas ocasionales
    if (hash2(pc, pr) > 0.5) {
      c.fillStyle = 'rgba(90,66,30,0.35)';
      var fpx = x + 8 + hash2(pc, pr + 1) * (CELL - 16);
      var fpy = y + 8 + hash2(pc + 1, pr) * (CELL - 16);
      c.beginPath(); c.ellipse(fpx, fpy, 2.6, 1.5, 0.5, 0, 6.28); c.fill();
      c.beginPath(); c.ellipse(fpx + 5, fpy + 4, 2.6, 1.5, 0.5, 0, 6.28); c.fill();
    }
  }
}

function paintPathDirt(c, cells, CELL) {
  var keys = Object.keys(cells);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(',');
    var pc = +parts[0], pr = +parts[1];
    var x = pc * CELL, y = pr * CELL;
    // tierra pisada
    var hg = c.createLinearGradient(x, y, x, y + CELL);
    hg.addColorStop(0, '#5a4428');
    hg.addColorStop(0.5, '#523c22');
    hg.addColorStop(1, '#43301a');
    c.fillStyle = hg;
    c.fillRect(x, y, CELL, CELL);
    // orientación del tramo (para alinear las rodadas)
    var horiz = cells[(pc - 1) + ',' + pr] || cells[(pc + 1) + ',' + pr];
    var vert = cells[pc + ',' + (pr - 1)] || cells[pc + ',' + (pr + 1)];
    // rodadas de carro (dos surcos paralelos al sentido de la marcha)
    c.strokeStyle = 'rgba(32,22,10,0.5)'; c.lineWidth = 2.6; c.lineCap = 'round';
    var off = CELL * 0.2;
    if (horiz && !vert) {
      c.beginPath(); c.moveTo(x, y + CELL / 2 - off); c.lineTo(x + CELL, y + CELL / 2 - off); c.stroke();
      c.beginPath(); c.moveTo(x, y + CELL / 2 + off); c.lineTo(x + CELL, y + CELL / 2 + off); c.stroke();
      c.strokeStyle = 'rgba(120,95,55,0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y + CELL / 2 - off - 1.6); c.lineTo(x + CELL, y + CELL / 2 - off - 1.6); c.stroke();
      c.beginPath(); c.moveTo(x, y + CELL / 2 + off - 1.6); c.lineTo(x + CELL, y + CELL / 2 + off - 1.6); c.stroke();
    } else if (vert && !horiz) {
      c.beginPath(); c.moveTo(x + CELL / 2 - off, y); c.lineTo(x + CELL / 2 - off, y + CELL); c.stroke();
      c.beginPath(); c.moveTo(x + CELL / 2 + off, y); c.lineTo(x + CELL / 2 + off, y + CELL); c.stroke();
      c.strokeStyle = 'rgba(120,95,55,0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + CELL / 2 - off - 1.6, y); c.lineTo(x + CELL / 2 - off - 1.6, y + CELL); c.stroke();
      c.beginPath(); c.moveTo(x + CELL / 2 + off - 1.6, y); c.lineTo(x + CELL / 2 + off - 1.6, y + CELL); c.stroke();
    } else {
      // curva: parche de tierra removida
      c.fillStyle = 'rgba(32,22,10,0.3)';
      c.beginPath(); c.arc(x + CELL / 2, y + CELL / 2, CELL * 0.3, 0, 6.28); c.fill();
    }
    // piedrecitas sueltas
    for (var s = 0; s < 3; s++) {
      var h2 = hash2(pc * 11 + s, pr * 5 + s);
      c.fillStyle = 'rgba(28,18,8,0.35)';
      c.beginPath(); c.ellipse(x + 6 + h2 * (CELL - 12), y + 6 + ((h2 * 17) % 1) * (CELL - 12), 2.4, 1.3, h2 * 2, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(150,125,80,0.3)';
      c.beginPath(); c.arc(x + 5 + ((h2 * 41) % 1) * (CELL - 10), y + 5 + ((h2 * 23) % 1) * (CELL - 10), 0.9, 0, 6.28); c.fill();
    }
    // hierba asomando en los bordes
    var hg2 = hash2(pc + 7, pr + 3);
    if (hg2 > 0.55) {
      c.strokeStyle = 'rgba(90,140,55,0.5)'; c.lineWidth = 1;
      var ex = x + 4 + hg2 * 20, ey = y + (hg2 > 0.78 ? 3 : CELL - 3);
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 2, ey + (hg2 > 0.78 ? -4 : 4)); c.stroke();
      c.beginPath(); c.moveTo(ex + 2, ey); c.lineTo(ex + 4, ey + (hg2 > 0.78 ? -3.4 : 3.4)); c.stroke();
    }
  }
}

function paintPathIce(c, cells, CELL) {
  var keys = Object.keys(cells);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(',');
    var pc = +parts[0], pr = +parts[1];
    var x = pc * CELL, y = pr * CELL;
    // hielo profundo con gradiente vertical
    var hg = c.createLinearGradient(x, y, x, y + CELL);
    hg.addColorStop(0, '#7aa8cc');
    hg.addColorStop(0.5, '#8fbddd');
    hg.addColorStop(1, '#5e88b0');
    c.fillStyle = hg;
    c.fillRect(x, y, CELL, CELL);
    // reflejo especular diagonal
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath();
    c.moveTo(x + CELL * 0.15, y + CELL);
    c.lineTo(x + CELL * 0.55, y);
    c.lineTo(x + CELL * 0.8, y);
    c.lineTo(x + CELL * 0.4, y + CELL);
    c.closePath(); c.fill();
    // grietas ramificadas
    var nc = hash2(pc, pr);
    if (nc > 0.35) {
      var gx = x + 6 + nc * (CELL - 12), gy = y + 6 + ((nc * 37) % 1) * (CELL - 12);
      c.strokeStyle = 'rgba(235,248,255,0.6)'; c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(gx, gy);
      c.lineTo(gx + 6, gy + 3);
      c.lineTo(gx + 11, gy + 2);
      c.stroke();
      c.strokeStyle = 'rgba(235,248,255,0.4)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(gx + 6, gy + 3); c.lineTo(gx + 8, gy + 8); c.stroke();
      // sombra azul de la grieta (profundidad)
      c.strokeStyle = 'rgba(50,90,130,0.3)'; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(gx + 0.8, gy + 0.8);
      c.lineTo(gx + 6.8, gy + 3.8);
      c.lineTo(gx + 11.8, gy + 2.8);
      c.stroke();
    }
    // nieve acumulada en las juntas
    for (var s = 0; s < 2; s++) {
      var h2 = hash2(pc * 13 + s, pr * 7 + s);
      c.fillStyle = 'rgba(255,255,255,' + (0.4 + h2 * 0.3) + ')';
      c.beginPath(); c.ellipse(x + 6 + h2 * (CELL - 12), y + (s ? CELL - 4 : 4), 5 + h2 * 3, 2, 0, 0, 6.28); c.fill();
    }
  }
}

function paintPathVoid(c, cells, CELL) {
  var keys = Object.keys(cells);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(',');
    var pc = +parts[0], pr = +parts[1];
    var x = pc * CELL, y = pr * CELL;
    // losa de obsidiana
    var hg = c.createLinearGradient(x, y, x + CELL, y + CELL);
    hg.addColorStop(0, '#241634');
    hg.addColorStop(0.5, '#1e122c');
    hg.addColorStop(1, '#150c20');
    c.fillStyle = hg;
    c.fillRect(x, y, CELL, CELL);
    // juntas de la losa
    c.strokeStyle = 'rgba(90,50,150,0.35)'; c.lineWidth = 1.4;
    c.beginPath(); c.roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, 3); c.stroke();
    // vetas de energía del vacío que recorren la losa
    var nv = hash2(pc, pr);
    if (nv > 0.3) {
      c.strokeStyle = 'rgba(160,90,240,0.5)'; c.lineWidth = 1.1;
      c.beginPath();
      var vx = x + (nv > 0.65 ? 0 : CELL), vy = y + ((nv * 53) % 1) * CELL;
      c.moveTo(vx, vy);
      c.lineTo(x + CELL * 0.4, y + CELL * (0.3 + ((nv * 29) % 1) * 0.4));
      c.lineTo(x + CELL * 0.7, y + CELL * (0.25 + ((nv * 17) % 1) * 0.5));
      c.lineTo(x + (nv > 0.65 ? CELL : 0), y + ((nv * 41) % 1) * CELL);
      c.stroke();
      c.strokeStyle = 'rgba(220,180,255,0.35)'; c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(vx, vy);
      c.lineTo(x + CELL * 0.4, y + CELL * (0.3 + ((nv * 29) % 1) * 0.4));
      c.stroke();
    }
    // esquirlas de obsidiana
    if (nv < 0.22) {
      c.fillStyle = '#0e0818';
      var sx2 = x + 10 + nv * 80, sy2 = y + 10 + ((nv * 91) % 1) * 20;
      c.beginPath();
      c.moveTo(sx2, sy2);
      c.lineTo(sx2 + 3, sy2 - 7);
      c.lineTo(sx2 + 5.4, sy2);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(190,140,255,0.4)';
      c.beginPath(); c.moveTo(sx2 + 3, sy2 - 7); c.lineTo(sx2 + 3.8, sy2 - 3); c.lineTo(sx2 + 2.6, sy2 - 3); c.closePath(); c.fill();
    }
    // núcleo pulsante de la losa
    c.fillStyle = 'rgba(160,100,255,0.35)';
    c.beginPath(); c.arc(x + CELL * 0.5, y + CELL * 0.5, 1.6, 0, 6.28); c.fill();
  }
}

var PAINT_PATH = {
  cobble: paintPathCobble,
  sand: paintPathSand,
  dirt: paintPathDirt,
  ice: paintPathIce,
  void: paintPathVoid
};

// ============================================================
//  ELEMENTOS ESPECIALES POR TEMA (lagos, oasis, glaciares...)
// ============================================================

function featureLake(c, CELL) {
  var lx = CELL * 2.5, ly = CELL * 12.1, lrx = CELL * 2.5, lry = CELL * 1.45;
  c.fillStyle = '#a89f60';
  c.beginPath(); c.ellipse(lx, ly, lrx + 10, lry + 8, 0, 0, 6.28); c.fill();
  c.fillStyle = '#b8b06e';
  c.beginPath(); c.ellipse(lx, ly + 2, lrx + 5, lry + 4, 0, 0, 6.28); c.fill();
  var lg = c.createLinearGradient(lx, ly - lry, lx, ly + lry);
  lg.addColorStop(0, '#5a9ad8'); lg.addColorStop(0.5, '#3f7cc0'); lg.addColorStop(1, '#2f6098');
  c.fillStyle = lg;
  c.beginPath(); c.ellipse(lx, ly, lrx, lry, 0, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(20,60,110,0.5)';
  c.beginPath(); c.ellipse(lx, ly + 2, lrx * 0.7, lry * 0.65, 0, 0, 6.28); c.fill();
  // espuma de orilla
  c.strokeStyle = 'rgba(235,248,255,0.4)'; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(lx, ly, lrx - 1, lry - 1, 0, 0, 6.28); c.stroke();
  c.strokeStyle = 'rgba(235,248,255,0.18)'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(lx, ly, lrx - 4, lry - 3.5, 0, 0, 6.28); c.stroke();
  // cantos de la orilla
  for (var sh = 0; sh < 6; sh++) {
    var sa = sh * 1.05 + 0.3;
    c.fillStyle = sh % 2 ? '#8a8468' : '#7a7458';
    c.beginPath(); c.ellipse(lx + Math.cos(sa) * (lrx + 8), ly + Math.sin(sa) * (lry + 6), 2.6, 1.8, sa, 0, 6.28); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2;
  for (var wl = 0; wl < 3; wl++) {
    c.beginPath(); c.ellipse(lx + (wl - 1) * 22, ly - 6 + wl * 8, 18 - wl * 3, 4, 0, 0, 6.28); c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.beginPath(); c.arc(lx - 30, ly - 8, 2, 0, 6.28); c.fill();
  c.beginPath(); c.arc(lx + 14, ly - 4, 1.5, 0, 6.28); c.fill();
  for (var lp = 0; lp < 3; lp++) {
    var la = lp * 2.1 + 0.6;
    c.fillStyle = '#3f9f4f';
    c.beginPath(); c.ellipse(lx + Math.cos(la) * lrx * 0.6, ly + Math.sin(la) * lry * 0.6, 7, 4.5, la * 0.4, 0, 6.28); c.fill();
    c.fillStyle = '#5ac060';
    c.beginPath(); c.arc(lx + Math.cos(la) * lrx * 0.6, ly + Math.sin(la) * lry * 0.6, 1.5, 0, 6.28); c.fill();
  }
  c.strokeStyle = '#2e7a3a'; c.lineWidth = 1.8; c.lineCap = 'round';
  for (var rd = 0; rd < 5; rd++) {
    var rx2 = lx - lrx + 14 + rd * 24 + (hash2(rd, 7) - 0.5) * 12;
    var ry2 = ly - lry - 14 - hash2(rd, 3) * 8;
    c.beginPath(); c.moveTo(rx2, ly - lry - 6); c.lineTo(rx2 + (rd % 2 ? 4 : -3), ry2); c.stroke();
    c.fillStyle = '#4a9a4a';
    c.beginPath(); c.ellipse(rx2 + (rd % 2 ? 4 : -3), ry2, 2, 4, rd % 2 ? 0.4 : -0.4, 0, 6.28); c.fill();
  }
  c.strokeStyle = 'rgba(90,70,40,0.45)';
  c.lineWidth = 16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(886, -4); c.quadraticCurveTo(878, 36, 854, 62); c.quadraticCurveTo(840, 80, 822, 98); c.stroke();
  var rs = c.createLinearGradient(840, -4, 840, 120);
  rs.addColorStop(0, '#6aa8e0'); rs.addColorStop(1, '#3f7cc0');
  c.strokeStyle = rs; c.lineWidth = 13;
  c.beginPath(); c.moveTo(884, -4); c.quadraticCurveTo(876, 34, 852, 60); c.quadraticCurveTo(838, 78, 820, 96); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(884, -4); c.quadraticCurveTo(876, 34, 852, 60); c.quadraticCurveTo(838, 78, 820, 96); c.stroke();
  var pdx = 818, pdy = 104;
  c.fillStyle = 'rgba(70,50,30,0.45)';
  c.beginPath(); c.ellipse(pdx + 2, pdy + 2, 46, 18, 0, 0, 6.28); c.fill();
  var pg3 = c.createLinearGradient(pdx, pdy - 18, pdx, pdy + 18);
  pg3.addColorStop(0, '#6aa8e0'); pg3.addColorStop(1, '#3569a0');
  c.fillStyle = pg3;
  c.beginPath(); c.ellipse(pdx, pdy, 44, 16, 0, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(20,60,110,0.45)';
  c.beginPath(); c.ellipse(pdx, pdy + 2, 30, 10, 0, 0, 6.28); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(pdx, pdy - 3, 22, 6, 0, 0, 6.28); c.stroke();
  c.fillStyle = '#3f9f4f';
  c.beginPath(); c.ellipse(pdx - 18, pdy + 2, 6, 4, 0.5, 0, 6.28); c.fill();
}

function featureOasis(c, CELL) {
  var ox = CELL * 7.5, oy = CELL * 10.5, orx = CELL * 1.6, ory = CELL * 1.0;
  c.fillStyle = '#8a7440';
  c.beginPath(); c.ellipse(ox, oy, orx + 14, ory + 10, 0, 0, 6.28); c.fill();
  c.fillStyle = '#b0a060';
  c.beginPath(); c.ellipse(ox, oy + 2, orx + 7, ory + 5, 0, 0, 6.28); c.fill();
  var og = c.createLinearGradient(ox, oy - ory, ox, oy + ory);
  og.addColorStop(0, '#4ac0d8'); og.addColorStop(0.5, '#2a90a8'); og.addColorStop(1, '#1e6a80');
  c.fillStyle = og;
  c.beginPath(); c.ellipse(ox, oy, orx, ory, 0, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(10,60,80,0.5)';
  c.beginPath(); c.ellipse(ox, oy + 2, orx * 0.65, ory * 0.6, 0, 0, 6.28); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.2;
  for (var w = 0; w < 3; w++) {
    c.beginPath(); c.ellipse(ox + (w - 1) * 12, oy - 3 + w * 5, 10 - w * 2, 3, 0, 0, 6.28); c.stroke();
  }
  for (var p = 0; p < 2; p++) {
    var px = ox + (p ? 18 : -18), py = oy - 6;
    c.strokeStyle = '#5a8f3a'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + (p ? 4 : -4), py - 12, px + (p ? 2 : -2), py - 20); c.stroke();
    c.fillStyle = '#3f7a2a';
    c.beginPath(); c.ellipse(px + (p ? 3 : -3), py - 22, 6, 3, p ? 0.5 : -0.5, 0, 6.28); c.fill();
  }
}

function featureForestPool(c, CELL) {
  var fx = CELL * 22, fy = CELL * 3.2, frx = CELL * 0.9, fry = CELL * 0.7;
  c.fillStyle = 'rgba(30,20,10,0.4)';
  c.beginPath(); c.ellipse(fx + 2, fy + 2, frx + 8, fry + 6, 0, 0, 6.28); c.fill();
  var fg = c.createLinearGradient(fx, fy - fry, fx, fy + fry);
  fg.addColorStop(0, '#3a8a5a'); fg.addColorStop(0.5, '#2a6a44'); fg.addColorStop(1, '#1e5034');
  c.fillStyle = fg;
  c.beginPath(); c.ellipse(fx, fy, frx, fry, 0, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.beginPath(); c.ellipse(fx - 8, fy - 3, 10, 3, 0, 0, 6.28); c.stroke();
  for (var m = 0; m < 2; m++) {
    c.fillStyle = '#1e4a2e';
    c.beginPath(); c.arc(fx + (m ? 10 : -10), fy - 4, 3.4, 0, 6.28); c.fill();
    c.fillStyle = '#3a8a5a';
    c.beginPath(); c.arc(fx + (m ? 9.4 : -9.4), fy - 5, 1.6, 0, 6.28); c.fill();
  }
}

function featureGlacier(c, CELL) {
  var gx = CELL * 20.5, gy = CELL * 2.4;
  c.fillStyle = 'rgba(255,255,255,0.15)';
  for (var i = 0; i < 3; i++) {
    c.beginPath(); c.arc(gx - 20 + i * 20, gy + 8, 26, 0, 6.28); c.fill();
  }
  c.fillStyle = '#c8e4f4';
  c.beginPath(); c.arc(gx, gy, 22, 0, 6.28); c.fill();
  c.fillStyle = '#a8ccf0';
  c.beginPath(); c.arc(gx, gy, 22, 0, 6.28); c.fill();
  var gg = c.createRadialGradient(gx, gy, 2, gx, gy, 24);
  gg.addColorStop(0, '#dff2ff');
  gg.addColorStop(0.6, '#9cc8e8');
  gg.addColorStop(1, 'rgba(120,170,220,0.4)');
  c.fillStyle = gg;
  c.beginPath(); c.arc(gx, gy, 24, 0, 6.28); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(gx - 10, gy - 4); c.lineTo(gx - 4, gy + 2); c.stroke();
  c.beginPath(); c.moveTo(gx + 6, gy - 6); c.lineTo(gx + 12, gy); c.stroke();
  c.beginPath(); c.moveTo(gx - 2, gy + 4); c.lineTo(gx + 4, gy + 10); c.stroke();
  c.fillStyle = '#6aa8d0';
  c.beginPath(); c.arc(gx - 12, gy + 4, 5, 0, 6.28); c.fill();
  c.beginPath(); c.arc(gx + 10, gy - 8, 4, 0, 6.28); c.fill();
}

function featureVoidPool(c, CELL) {
  var vx = CELL * 4, vy = CELL * 7, vrx = CELL * 1.4, vry = CELL * 0.9;
  c.fillStyle = 'rgba(40,10,60,0.5)';
  c.beginPath(); c.ellipse(vx + 2, vy + 2, vrx + 10, vry + 8, 0, 0, 6.28); c.fill();
  var vg = c.createRadialGradient(vx, vy, 2, vx, vy, vrx);
  vg.addColorStop(0, '#2a1040');
  vg.addColorStop(0.6, '#1a0828');
  vg.addColorStop(1, 'rgba(20,5,40,0)');
  c.fillStyle = vg;
  c.beginPath(); c.ellipse(vx, vy, vrx, vry, 0, 0, 6.28); c.fill();
  c.strokeStyle = 'rgba(150,90,230,0.5)'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(vx, vy, vrx, vry, 0, 0, 6.28); c.stroke();
  c.strokeStyle = 'rgba(200,140,255,0.3)'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(vx, vy, vrx * 0.7, vry * 0.6, 0, 0, 6.28); c.stroke();
  for (var s = 0; s < 4; s++) {
    var a = s * 1.57;
    c.fillStyle = 'rgba(180,120,255,0.5)';
    c.beginPath(); c.arc(vx + Math.cos(a) * vrx * 0.5, vy + Math.sin(a) * vry * 0.5, 1.8, 0, 6.28); c.fill();
  }
}

var PAINT_FEATURE = {
  plains: featureLake,
  desert: featureOasis,
  forest: featureForestPool,
  frozen: featureGlacier,
  void: featureVoidPool
};
