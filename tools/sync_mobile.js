'use strict';
// Sincroniza los assets del juego (raíz) hacia www/ para el build móvil.
// Uso: node tools/sync_mobile.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
fs.cpSync(path.join(root, 'css'), path.join(www, 'css'), { recursive: true });
fs.cpSync(path.join(root, 'js'), path.join(www, 'js'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(www, 'index.html'));
console.log('www/ sincronizado:', fs.readdirSync(www).join(', '));
