'use strict';

var WEATHER = {
  TYPES: {
    clear:    { name: 'Despejado', icon: '☀️', fx: {}, color: 'rgba(255,255,255,0)' },
    rain:     { name: 'Lluvia',    icon: '🌧️', fx: { fireMult: 0.75, natureMult: 1.2 }, color: 'rgba(90,120,180,0.12)' },
    snow:     { name: 'Nieve',     icon: '❄️', fx: { enemySpeed: 0.85, iceMult: 1.2 }, color: 'rgba(230,240,255,0.15)' },
    storm:    { name: 'Tormenta',  icon: '⛈️', fx: { fireMult: 0.6, iceMult: 1.3, enemySpeed: 0.9, lightning: true }, color: 'rgba(40,50,90,0.2)' },
    fog:      { name: 'Niebla',    icon: '🌫️', fx: { rangeMult: 0.85 }, color: 'rgba(210,210,210,0.18)' },
    drought:  { name: 'Sequía',    icon: '🔥', fx: { fireMult: 1.35, iceMult: 0.75 }, color: 'rgba(255,190,90,0.1)' }
  },
  current: 'clear',
  next: 0,
  flashT: 0,
  drops: [],
  flakes: [],
  fogPatches: [],

  init: function () {
    this.set('clear');
    for (var i = 0; i < 120; i++) {
      this.drops.push({ x: Math.random() * CONFIG.WIDTH, y: Math.random() * CONFIG.HEIGHT, len: 8 + Math.random() * 10, sp: 700 + Math.random() * 400 });
    }
    for (var j = 0; j < 70; j++) {
      this.flakes.push({ x: Math.random() * CONFIG.WIDTH, y: Math.random() * CONFIG.HEIGHT, r: 1.5 + Math.random() * 2.5, sp: 25 + Math.random() * 35, drift: (Math.random() - 0.5) * 20 });
    }
    for (var k = 0; k < 8; k++) {
      this.fogPatches.push({ x: Math.random() * CONFIG.WIDTH, y: Math.random() * CONFIG.HEIGHT, r: 90 + Math.random() * 140, sp: 8 + Math.random() * 10, dir: Math.random() > 0.5 ? 1 : -1 });
    }
  },

  set: function (type) {
    this.current = type;
    this.flashT = 0;
    var def = this.TYPES[type];
    this.type = def;
    this.color = def.color;
    this.fx = def.fx;
    if (type === 'storm') sfx('weather_thunder', 0.5);
    else if (type === 'drought' || type === 'rain') sfx('weather_wind_gust', 0.3);
    if (typeof UI !== 'undefined' && UI.updateWeather) UI.updateWeather();
  },

  tick: function (dt) {
    this.next -= dt;
    if (this.next <= 0) {
      var types = Object.keys(this.TYPES);
      var r = Math.random();
      var pick = 'clear';
      if (r < 0.22) pick = 'rain';
      else if (r < 0.38) pick = 'snow';
      else if (r < 0.52) pick = 'storm';
      else if (r < 0.66) pick = 'fog';
      else if (r < 0.78) pick = 'drought';
      this.set(pick);
      this.next = 25 + Math.random() * 20;
      if (typeof toast === 'function' && pick !== 'clear') {
        toast(this.TYPES[pick].icon + ' Clima: ' + this.TYPES[pick].name, 2600);
      }
    }
    for (var i = 0; i < this.drops.length; i++) {
      var d = this.drops[i];
      d.y += d.sp * dt; d.x += d.len * 0.3 * dt;
      if (d.y > CONFIG.HEIGHT) { d.y = -12; d.x = Math.random() * CONFIG.WIDTH; }
    }
    for (var j = 0; j < this.flakes.length; j++) {
      var f = this.flakes[j];
      f.y += f.sp * dt; f.x += f.drift * dt;
      if (f.y > CONFIG.HEIGHT) { f.y = -6; f.x = Math.random() * CONFIG.WIDTH; }
    }
    for (var k = 0; k < this.fogPatches.length; k++) {
      var g = this.fogPatches[k];
      g.x += g.sp * g.dir * dt;
      if (g.x < -g.r) g.x = CONFIG.WIDTH + g.r;
      if (g.x > CONFIG.WIDTH + g.r) g.x = -g.r;
    }
  },

  drawOverlay: function (ctx) {
    if (this.current === 'clear') return;
    if (this.current === 'rain' || this.current === 'storm') {
      ctx.lineCap = 'round';
      for (var pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        if (pass === 0) { ctx.strokeStyle = 'rgba(120,150,190,0.16)'; ctx.lineWidth = 0.7; }
        else { ctx.strokeStyle = 'rgba(175,205,235,0.5)'; ctx.lineWidth = 1.3; }
        for (var i = 0; i < this.drops.length; i++) {
          var d = this.drops[i];
          var sl = d.len * (pass === 0 ? 0.7 : 1);
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + sl * 0.3, d.y + sl);
        }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      for (var sp = 0; sp < 5; sp++) {
        var spx = Math.random() * CONFIG.WIDTH;
        ctx.strokeStyle = 'rgba(150,180,220,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(spx - 3, CONFIG.HEIGHT - 8); ctx.lineTo(spx + 3, CONFIG.HEIGHT - 8); ctx.stroke();
      }
      if (this.current === 'storm') {
        if (this.flashT > 0) {
          ctx.fillStyle = 'rgba(230,240,255,' + (this.flashT * 0.3).toFixed(3) + ')';
          ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
          this.flashT -= 0.035;
        }
        if (Math.random() < 0.04) {
          this.flashT = 0.14;
          sfx('weather_lightning_strike', 0.4);
          var x = Math.random() * CONFIG.WIDTH;
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + (Math.random() - 0.5) * 40, CONFIG.HEIGHT);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(150,220,255,0.6)';
          ctx.lineWidth = 1;
          for (var s = 0; s < 3; s++) {
            var sx = x + (Math.random() - 0.5) * 30;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx + (Math.random() - 0.5) * 30, CONFIG.HEIGHT);
            ctx.stroke();
          }
        }
      }
    } else if (this.current === 'snow') {
      for (var j = 0; j < this.flakes.length; j++) {
        var f = this.flakes[j];
        ctx.fillStyle = f.r > 2.4 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28); ctx.fill();
      }
    } else if (this.current === 'fog') {
      ctx.fillStyle = 'rgba(220,225,230,0.22)';
      for (var k = 0; k < this.fogPatches.length; k++) {
        var g = this.fogPatches[k];
        var grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grad.addColorStop(0, 'rgba(230,235,240,0.5)');
        grad.addColorStop(1, 'rgba(230,235,240,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.28); ctx.fill();
      }
    }
  }
};
