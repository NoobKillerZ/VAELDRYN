'use strict';
// Extrae los sprites de art/sheet.png: recorta cada celda, elimina el fondo
// oscuro por inundacion desde los bordes y recorta al contenido.
// Uso: electron tools/extract_sprites.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const MAP = {
  towers: {
    dir: 'art/towers',
    cells: { cols: 7, ys: [50, 266], x0: 2, cw: 145.5, w: 138, cropH: 143 },
    names: [
      ['archer', 'fire', 'ice', 'venom', 'crossbow', 'dwarf', 'druid'],
      ['tesla', 'knight', 'sniper', 'holy', 'banner', 'warlock', 'barracks']
    ]
  },
  soldiers: {
    dir: 'art/soldiers',
    cells: { cols: 4, ys: [508], x0: 8, cw: 256, w: 240, cropH: 145 },
    names: [['swordsman', 'archer', 'shieldbearer', 'mage']]
  },
  bosses: {
    dir: 'art/enemies',
    cells: { cols: 6, ys: [684], x0: 4, cw: 169, w: 162, cropH: 183 },
    names: [['dragon', 'orcKing', 'lord', 'iceDragon', 'warMachine', 'voidLord']]
  },
  enemies: {
    dir: 'art/enemies',
    cells: { cols: 8, ys: [972, 1110, 1250, 1390], x0: 4, cw: 126.5, w: 120, cropH: 105 },
    names: [
      ['splitterTiny', 'goblin', 'bat', 'crawler', 'lich', 'splitterSmall', 'skeleton', 'assassin'],
      ['wisp', 'sorcerer', 'stormSpirit', 'mender', 'iceWraith', 'phaseStalker', 'orc', 'shaman'],
      ['saboteur', 'berserker', 'splitter', 'demon', 'necromancer', 'gargoyle', 'orcShield', 'undead'],
      ['treant', 'voidWalker', null, 'fireGolem', 'stoneGolem', 'troll', 'hulker', null]
    ]
  }
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1600, webPreferences: { webSecurity: false } });
  await win.loadFile(path.join(__dirname, '_extract_page.html'));
  const sheetUrl = 'file:///' + path.join(__dirname, '..', 'art', 'sheet.png').replace(/\\/g, '/');
  const res = await win.webContents.executeJavaScript('(' + extractor.toString() + ')(' + JSON.stringify(MAP) + ', ' + JSON.stringify(sheetUrl) + ')');
  res.files.forEach(function (f) {
    var dest = path.join(__dirname, '..', f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(f.data.split(',')[1], 'base64'));
  });
  console.log(res.log.join('\n'));
  console.log('TOTAL:', res.total);
  app.quit();
}).catch(function (e) { console.error('FALLO:', e.message); app.quit(); });

function extractor(MAP, sheetUrl) {
  return new Promise(function (resolve) {
    var log = [], total = 0, files = [];
    var img = new Image();
    img.onload = function () {
      try {
      var log0 = 'sheet=' + img.width + 'x' + img.height;
      var cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      // sonda de ocupaciÃ³n: bloques de 64px con contenido no-fondo
      {
        var dAll = ctx.getImageData(0, 0, img.width, img.height).data;
        var bg0 = [dAll[8], dAll[9], dAll[10]];
        var rows = [];
        for (var by = 0; by < img.height; by += 64) {
          var row = '';
          for (var bx = 0; bx < img.width; bx += 64) {
            var hit = 0;
            for (var sy = 0; sy < 64 && !hit; sy += 4) {
              for (var sx = 0; sx < 64; sx += 4) {
                var q = ((by + sy) * img.width + (bx + sx)) * 4;
                if (Math.abs(dAll[q] - bg0[0]) + Math.abs(dAll[q + 1] - bg0[1]) + Math.abs(dAll[q + 2] - bg0[2]) > 60) { hit = 1; break; }
              }
            }
            row += hit ? '#' : '.';
          }
          rows.push(String(by).padStart(4) + ' ' + row);
        }
        log0 += '\n' + rows.join('\n');
      }

      function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }
      var cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      function extractCell(sx, sy, sw, sh) {
        var d = ctx.getImageData(sx, sy, sw, sh);
        var px = d.data, W = sw, H = sh;
        var bg = [px[0], px[1], px[2]]; var corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]; for (var ci = 1; ci < 4; ci++) { var cp = (corners[ci][1] * W + corners[ci][0]) * 4; if (px[cp] + px[cp + 1] + px[cp + 2] < bg[0] + bg[1] + bg[2]) bg = [px[cp], px[cp + 1], px[cp + 2]]; }
        // inundacion desde los bordes: marca fondo conectado
        var mask = new Uint8Array(W * H);
        var stack = [];
        for (var x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
        for (var y2 = 0; y2 < H; y2++) { stack.push(0, y2, W - 1, y2); }
        while (stack.length) {
          var yy = stack.pop(), xx = stack.pop();
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          var i = yy * W + xx;
          if (mask[i]) continue;
          var p = i * 4;
          if (dist([px[p], px[p + 1], px[p + 2]], bg) > 88) continue;
          mask[i] = 1;
          stack.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
        }
        // aplica alpha + bounding box del contenido
        var minX = W, minY = H, maxX = -1, maxY = -1;
        for (var j = 0; j < W * H; j++) {
          if (mask[j]) { px[j * 4 + 3] = 0; continue; }
          var jx = j % W, jy = (j / W) | 0;
          if (jx < minX) minX = jx; if (jx > maxX) maxX = jx;
          if (jy < minY) minY = jy; if (jy > maxY) maxY = jy;
        }
        if (maxX < 0) return null;
        var pad = 2;
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
        var cw = maxX - minX + 1, chh = maxY - minY + 1;
        var out = document.createElement('canvas');
        out.width = cw; out.height = chh;
        out.getContext('2d').putImageData(ctx.getImageData(sx + minX, sy + minY, cw, chh), 0, 0);
        return out;
      }

      Object.keys(MAP).forEach(function (group) {
        var g = MAP[group];
        for (var r = 0; r < g.names.length; r++) {
          for (var c = 0; c < g.names[r].length; c++) {
            var name = g.names[r][c];
            if (!name) continue;
            var sx = Math.round(g.cells.x0 + c * g.cells.cw);
            var sy = g.cells.ys[r];
            var out = extractCell(sx, sy, g.cells.w, g.cells.cropH);
            if (!out) { log.push('VACIO: ' + name); continue; }
            files.push({ path: g.dir + '/' + name + '.png', data: out.toDataURL('image/png') });
            log.push(group + ' -> ' + name + '.png (' + out.width + 'x' + out.height + ')');
            total++;
          }
        }
      });
      resolve({ log: [log0].concat(log), total: total, files: files });
      } catch (err) { resolve({ log: ['EXCEPCION: ' + err.message], total: 0 }); }
    };
    img.onerror = function () { resolve({ log: ['ERROR cargando sheet'], total: 0 }); };
    img.src = sheetUrl;
  });
}
