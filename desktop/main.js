'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// El juego genera el audio con WebAudio tras interacción del usuario;
// este interruptor evita bloqueos de reproducción automática.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 780,
    minHeight: 560,
    title: 'VAELDRYN',
    backgroundColor: '#0d0b08',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // Evita que un error de navegación deje la ventana en blanco
  win.webContents.on('did-fail-load', function (_e, code, desc, url, isMain) {
    if (isMain) setTimeout(function () { win.loadFile(path.join(__dirname, '..', 'index.html')); }, 600);
  });
}

app.whenReady().then(function () {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
