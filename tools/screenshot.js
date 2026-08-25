'use strict';
// Captura la app en un tamano de pantalla dado para verificar layouts moviles.
// Uso: electron tools/screenshot.js <ancho> <alto> <salida.png> [--battle]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const w = parseInt(process.argv[2], 10) || 800;
const h = parseInt(process.argv[3], 10) || 380;
const out = process.argv[4] || path.join(__dirname, 'shot.png');
const battle = process.argv.includes('--battle');
const toggleSide = process.argv.includes('--toggle-side');
const pageFlag = process.argv.find(a => a.startsWith('--page='));
const page = pageFlag ? pageFlag.slice(7) : 'index.html';
const yFlag = process.argv.find(a => a.startsWith('--y='));
const scrollY = yFlag ? parseInt(yFlag.slice(4), 10) : 0;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: w, height: h, useContentSize: true, show: true });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) console.log('[consola:' + level + ']', message, '@', (sourceId || '').split(/[\\/]/).pop() + ':' + line);
  });
  await win.loadFile(path.join(__dirname, '..', page));
  await new Promise(r => setTimeout(r, page === 'codice.html' ? 2500 : 14000));
  if (battle) {
    const ok = await win.webContents.executeJavaScript(
      "(function(){var c=document.querySelector('#map-grid .map-card:not(.locked)');if(c){c.click();return true;}return false;})()"
    );
    console.log('mapa elegido:', ok);
    await new Promise(r => setTimeout(r, 2500));
    const state = await win.webContents.executeJavaScript(
      "(function(){try{return 'game=' + (typeof game !== 'undefined' && game ? 'OK wave=' + game.wave : 'NULL') + ' | menu=' + document.getElementById('menu-overlay').className + ' | canvasVisible=' + (document.getElementById('game').offsetParent !== null);}catch(e){return 'ERR ' + e.message;}})()"
    );
    console.log('estado:', state);
    const waveFlag = process.argv.find(a => a === '--wave' || a.startsWith('--wave='));
    if (waveFlag) {
      const wv = waveFlag.startsWith('--wave=') ? waveFlag.slice(7) : null;
      if (wv) await win.webContents.executeJavaScript("try { game.wave = " + wv + "; } catch(e) {}");
      await win.webContents.executeJavaScript("try { game.startWave(); } catch(e) {}");
      await new Promise(r => setTimeout(r, 6000));
      const en = await win.webContents.executeJavaScript("(function(){try{return 'enemigos=' + game.enemies.length + ' tipos=' + game.enemies.slice(0,4).map(function(e){return e.type;}).join(',');}catch(e){return 'ERR';}})()");
      console.log(en);
    }
  }
  if (toggleSide) {
    await win.webContents.executeJavaScript("document.getElementById('btn-side-toggle').click()");
    await new Promise(r => setTimeout(r, 400));
  }
  if (scrollY > 0) {
    await win.webContents.executeJavaScript("window.scrollTo(0, " + scrollY + ")");
    await new Promise(r => setTimeout(r, 400));
  }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log('captura:', out);
  app.quit();
});
