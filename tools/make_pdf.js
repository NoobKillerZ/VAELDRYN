'use strict';
// Genera el PDF del códice imprimiendo codice.html con Electron.
// Uso: electron tools/make_pdf.js [salida.pdf]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || path.join(__dirname, '..', 'VAELDRYN-Codice.pdf');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: true });
  await win.loadFile(path.join(__dirname, '..', 'codice.html'));
  // deja que el bucle de animación dibuje los sprites
  await new Promise(r => setTimeout(r, 3500));
  const data = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: '0.5cm', bottom: '0.5cm', left: '0.5cm', right: '0.5cm' }
  });
  fs.writeFileSync(out, data);
  console.log('PDF:', out, Math.round(data.length / 1024) + ' KB');
  app.quit();
});
