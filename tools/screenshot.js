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

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: w, height: h, useContentSize: true, show: true });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise(r => setTimeout(r, 14000));
  if (battle) {
    const ok = await win.webContents.executeJavaScript(
      "(function(){var c=document.querySelector('#map-grid .map-card:not(.locked)');if(c){c.click();return true;}return false;})()"
    );
    console.log('mapa elegido:', ok);
    await new Promise(r => setTimeout(r, 2500));
  }
  if (toggleSide) {
    await win.webContents.executeJavaScript("document.getElementById('btn-side-toggle').click()");
    await new Promise(r => setTimeout(r, 400));
  }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log('captura:', out);
  app.quit();
});
