'use strict';
// Franjas de depuracion para calibrar la cuadricula del sheet.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1600, webPreferences: { webSecurity: false } });
  await win.loadFile(path.join(__dirname, '_extract_page.html'));
  const sheetUrl = 'file:///' + path.join(__dirname, '..', 'art', 'sheet.png').replace(/\\/g, '/');
  const strips = await win.webContents.executeJavaScript('(function(){return new Promise(function(res){' +
    'var i=new Image();i.onload=function(){var out=[];[[20,420,"cal_towers"],[440,680,"cal_soldiers"],[650,900,"cal_bosses"],[860,1536,"cal_enemies"]].forEach(function(s){' +
    'var c=document.createElement("canvas");c.width=1024;c.height=s[1]-s[0];var x=c.getContext("2d");' +
    'x.fillStyle="#000";x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,s[0],1024,s[1]-s[0],0,0,1024,s[1]-s[0]);' +
    'x.strokeStyle="rgba(255,0,0,0.7)";x.lineWidth=1;for(var yy=0;yy<c.height;yy+=20){x.beginPath();x.moveTo(0,yy);x.lineTo(30,yy);x.stroke();x.fillStyle="#ff0";x.font="10px monospace";x.fillText(s[0]+yy,32,yy+3);}' +
    'out.push({name:s[2],data:c.toDataURL("image/png")});});res(out);};i.src=' + JSON.stringify(sheetUrl) + ';});})()');
  strips.forEach(function (s) {
    fs.writeFileSync(path.join(__dirname, s.name + '.png'), Buffer.from(s.data.split(',')[1], 'base64'));
    console.log('strip:', s.name);
  });
  app.quit();
});
