'use strict';

class Game {
  constructor(mapId, difficulty) {
    this.mapId = mapId || 'plains';
    var map = (typeof MAPS_BY_ID !== 'undefined' && MAPS_BY_ID[this.mapId]) || MAPS_BY_ID.plains;
    this.map = map;
    this.theme = THEMES[map.theme];
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bg.width = CONFIG.WIDTH;
    this.bg.height = CONFIG.HEIGHT;
    this.towers = [];
    this.enemies = [];
    this.soldiers = [];
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.lightning = [];
    this.gold = map.startGold + (typeof PROGRESS !== 'undefined' ? PROGRESS.startGoldBonus() : 0);
    this.lives = map.startLives;
    this.difficulty = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY[difficulty]) ? difficulty : 0;
    var diffDef = (typeof DIFFICULTY !== 'undefined') ? (DIFFICULTY[this.difficulty] || DIFFICULTY[0]) : { hpMult: 1, goldMult: 1, livesMod: 0, eliteChance: 0, speedMult: 1 };
    this.hpMult = diffDef.hpMult;
    this.goldMult = diffDef.goldMult;
    this.wave = 0;
    this.waveState = 'idle';
    this.spawnQueue = [];
    this.spawnTimer = 2;
    this.hpScale = 1 * map.mult * this.hpMult;
    this.startLives = Math.max(1, this.lives + diffDef.livesMod);
    this.lives = this.startLives;
    this.gold = Math.round(this.gold * this.goldMult);
    this.eliteChance = diffDef.eliteChance;
    this.enemySpeedMult = diffDef.speedMult;
    this.time = 0;
    this.speed = 1;
    this.paused = false;
    this.over = false;
    this.won = false;
    // Juice: sacudida de pantalla y micro-pausa por impactos fuertes
    this.shake = 0;
    this.hitstop = 0;
    this.stormFlash = 0;
    this._adaptNotified = false;
    // Prioridad de tiro por torre ('first' | 'strong' | 'close')
    this.priorityNames = { first: '🎯 Primero', strong: '💪 Más fuerte', close: '📍 Más cerca' };
    this.continueEndless = false;
    this.selected = null;
    this.hovered = null;
    this.placing = null;
    this.mouse = { c: -1, r: -1, inside: false };
    this.leaked = 0;
    this.kills = 0;
    this.stats = { goldEarned: 0, towersBuilt: 0, upgrades: 0 };
    this.bossWarned = false;
    this.corruption = {};
    this.corruptTotal = 0;
    this.corruptCellCount = 0;
    this.purifyRate = 0;
    this.corruptMult = 1;
    this.upCostMult = 1;
    this.critChance = 0;
    this.startSlow = 1;
    this.autoWave = false;
    this.autoTimer = 0;
    this.stormImmune = false;
    this.buildPath();
    this.buildPathCells();
    this.renderBG();
    if (typeof DIRECTOR !== 'undefined') DIRECTOR.reset();
    if (typeof WEATHER !== 'undefined') WEATHER.init();
    if (typeof CONQUEST !== 'undefined' && CONQUEST.enabled && CONQUEST.SETTINGS) {
      var cs = CONQUEST.SETTINGS;
      this.conquestWave = cs.startWaves;
      this.wave = this.conquestWave - 1;
      this.conquestRelics = [];
      this.conquestHpLoss = cs.hpLossPerEnd;
      this.conquestGoldPerEnd = cs.goldPerEnd;
      this.conquestHpBonus = cs.hpBonusPer5Waves;
      this.conquestFinalBonusGold = cs.finalBonusGold;
      this.conquestFinalWaves = cs.finalWaves;
      this.conquestTimer = cs.conquestTimerStart;
      this.conquestTimerMax = cs.conquestTimerStart;
      this.conquestTimerEnd = cs.conquestTimerEnd;
      this.conquestTimerDec = cs.conquestTimerDec;
      // Presupuesto de conquista: el modo abre en plena oleada jefe (10) sin
      // economía previa. Con +400 la mitad de las partidas normales moría en
      // la propia oleada 10 (simulación); +500 suaviza el acantilado inicial.
      this.gold += 500;
    } else {
      this.conquestWave = 0;
      this.conquestRelics = [];
      this.conquestHpLoss = 0;
      this.conquestGoldPerEnd = 0;
      this.conquestHpBonus = 0;
      this.conquestFinalBonusGold = 0;
      this.conquestFinalWaves = [];
      this.conquestTimer = 0;
      this.conquestTimerMax = 0;
      this.conquestTimerEnd = 0;
      this.conquestTimerDec = 0;
    }
  }

  buildPath() {
    var wp = this.map.path.map(function (p) {
      return { x: (p[0] + 0.5) * CONFIG.CELL, y: (p[1] + 0.5) * CONFIG.CELL };
    });
    this.wp = wp;
    this.cum = [0];
    var total = 0;
    for (var i = 1; i < wp.length; i++) {
      total += Math.hypot(wp[i].x - wp[i - 1].x, wp[i].y - wp[i - 1].y);
      this.cum.push(total);
    }
    this.pathLength = total;
  }

  pathPoint(d) {
    var wp = this.wp, cum = this.cum;
    var n = wp.length;
    if (d <= 0) {
      return { x: wp[0].x, y: wp[0].y, angle: Math.atan2(wp[1].y - wp[0].y, wp[1].x - wp[0].x) };
    }
    for (var i = 1; i < n; i++) {
      if (d <= cum[i]) {
        var seg = cum[i] - cum[i - 1] || 1;
        var t = (d - cum[i - 1]) / seg;
        var x = wp[i - 1].x + (wp[i].x - wp[i - 1].x) * t;
        var y = wp[i - 1].y + (wp[i].y - wp[i - 1].y) * t;
        var a = Math.atan2(wp[i].y - wp[i - 1].y, wp[i].x - wp[i - 1].x);
        return { x: x, y: y, angle: a };
      }
    }
    var last = wp[n - 1], prev = wp[n - 2];
    return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
  }

  futurePos(enemy, t) {
    var spd = enemy.speed * (enemy.freeze ? 0.1 : 1) * (enemy.slow ? enemy.slow.mult : 1) * enemy.buffed * (enemy.enraged ? 1.6 : 1);
    return this.pathPoint(Math.min(this.pathLength, enemy.pathPos + spd * t));
  }

  buildPathCells() {
    this.pathCells = {};
    var p = this.map.path;
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i];
      if (a[0] === b[0]) {
        var c0 = a[0], r0 = Math.min(a[1], b[1]), r1 = Math.max(a[1], b[1]);
        for (var r = r0; r <= r1; r++) this.setPathCell(c0, r);
      } else {
        var rr = a[1], cc0 = Math.min(a[0], b[0]), cc1 = Math.max(a[0], b[0]);
        for (var c = cc0; c <= cc1; c++) this.setPathCell(c, rr);
      }
    }
  }

  setPathCell(c, r) {
    if (c >= 0 && c < CONFIG.COLS && r >= 0 && r < CONFIG.ROWS) this.pathCells[c + ',' + r] = true;
  }

  isPathCell(c, r) {
    return !!this.pathCells[c + ',' + r];
  }

  towerAt(c, r) {
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i].col === c && this.towers[i].row === r) return this.towers[i];
    }
    return null;
  }

  canPlace(c, r) {
    if (c < 0 || c >= CONFIG.COLS || r < 0 || r >= CONFIG.ROWS) return false;
    if (this.isPathCell(c, r)) return false;
    if (this.towerAt(c, r)) return false;
    return true;
  }

  buildTower(c, r, type) {
    var def = TOWERS[type];
    if (!def) return false;
    var cost = Math.round(def.cost * this.upCostMult);
    if (this.gold < cost) { toast('No tienes oro suficiente', 1400); return false; }
    if (!this.canPlace(c, r)) return false;
    this.gold -= cost;
    var t = new Tower(c, r, type, this);
    this.towers.push(t);
    this.selected = t;
    this.stats.towersBuilt++;
    this.burst(t.x, t.y, '#ffd24a', 10);
    this.particles.push({ x: t.x, y: t.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffd24a', size: 6, grav: 0, kind: 'ring', r1: 26 });
    if (typeof DIRECTOR !== 'undefined' && DIRECTOR.recordBuild) DIRECTOR.recordBuild(c, r, type);
    sfx('tower_build');
    if (type === 'barracks' && typeof unlockAchievement === 'function' && unlockAchievement('barracks')) {
      this._achNotify('General');
    }
    return true;
  }

  upgradeTower(t) {
    var u = t.upgrade;
    if (!u) { toast('Ya está al máximo nivel', 1200); return; }
    var cost = Math.round(u.cost * this.upCostMult);
    if (this.gold < cost) { toast('No tienes oro suficiente', 1400); return; }
    this.gold -= cost;
    t.applyUpgrade();
    this.stats.upgrades++;
    this.burst(t.x, t.y, '#f2c86a', 12);
    this.particles.push({ x: t.x, y: t.y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#f2c86a', size: 8, grav: 0, kind: 'ring', r1: 34 });
    this.particles.push({ x: t.x, y: t.y - 30, vx: 0, vy: -16, life: 0.6, max: 0.6, color: '#ffe08a', size: 3, grav: -24 });
    sfx('tower_upgrade');
    toast('⬆️ ' + t.name + ' → ' + u.name, 1600);
    if (!t.upgrade && typeof unlockAchievement === 'function' && unlockAchievement('tower_max')) {
      this._achNotify('Maestro Constructor');
    }
  }

  sellTower(t) {
    var v = Math.round(t.sellValue() / this.upCostMult);
    this.gold += v;
    var idx = this.towers.indexOf(t);
    if (idx >= 0) this.towers.splice(idx, 1);
    if (this.selected === t) this.selected = null;
    sfx('tower_sell');
    toast('💰 Vendida por ' + v + ' oro', 1400);
  }

  startWave() {
    if (this.waveState !== 'idle' || this.over) return;
    this.wave++;
    // El escalado por oleada incluye el hpMult de dificultad (paridad con la tabla),
    // con una rampa de gracia: en Difícil/Pesadilla el multiplicador entra completo
    // en la oleada 7, evitando aplastamientos instantáneos en el arranque.
    var ramp = Math.min(1, (this.wave - 1) / 6);
    this.hpScale = (1 + (this.wave - 1) * 0.05) * this.map.mult * (1 + (this.hpMult - 1) * ramp);
    // Modo infinito: a partir de la oleada final, el HP acelera un +2% adicional
    // compuesto por oleada para que las partidas infinitas eventualmente terminen.
    if (this.continueEndless && this.wave > CONFIG.WIN_WAVE) {
      this.hpScale *= Math.pow(1.02, this.wave - CONFIG.WIN_WAVE);
    }
    this.spawnQueue = (typeof DIRECTOR !== 'undefined' && DIRECTOR.buildWave) ? DIRECTOR.buildWave(this.wave, this) : (typeof WAVE.buildFor !== 'undefined' ? WAVE.buildFor(this.wave, this.mapId) : WAVE.build(this.wave));
    // La probabilidad de élites sale SIEMPRE de la tabla de dificultad
    // (Normal/Fácil: 0 · Difícil/Pesadilla: crece suavemente con la oleada)
    var eliteChance = this.eliteChance > 0
      ? Math.min(this.eliteChance + this.wave * 0.006, 0.42)
      : (typeof DIRECTOR !== 'undefined' && DIRECTOR.level >= 2 && this.wave >= 14 ? 0.05 : 0);
    for (var qi = 0; qi < this.spawnQueue.length; qi++) {
      if (this.spawnQueue[qi].type !== 'goblin' && !ENEMIES[this.spawnQueue[qi].type].boss && Math.random() < eliteChance) this.spawnQueue[qi].elite = true;
    }
    if (this.wave >= 3 && this.corruptTotal > 50 && Math.random() < 0.5) {
      var cPos = Math.floor(Math.random() * this.spawnQueue.length);
      this.spawnQueue.splice(cPos, 0, { type: 'hulker', gap: 2 });
    }
    this.waveState = 'spawning';
    this.spawnTimer = 2.2;
    this.bossWarned = false;
    sfx('wave_start');
    if (this.wave % 5 === 0) toast('👑 ¡JEFE en camino!', 4000);
    else if (typeof DIRECTOR !== 'undefined' && DIRECTOR.adapted) {
      var dom = DIRECTOR.dominantElement();
      if (dom && dom.pct >= 0.3) {
        toast('🧠 El Director ha detectado tu uso de ' + {
          fire: 'fuego', ice: 'hielo', earth: 'tierra', nature: 'naturaleza', physical: 'daño físico'
        }[dom.element] + '... y ha enviado contramedidas.', 3600);
      }
    }
  }

  update(dt) {
    if (this.over || this.paused) return;
    // Hit-stop: micro-pausa dramática tras matar a un jefe
    if (this.hitstop > 0) { this.hitstop -= dt; this.updateEffects(dt); return; }
    // Curación anti-soflock: si se salió del modal de reliquia sin restaurar el
    // estado de oleada, la siguiente actualización lo devuelve a 'idle'.
    if (this.waveState === 'relic_choice') { this.waveState = 'idle'; }
    this.time += dt;
    if (typeof WEATHER !== 'undefined' && WEATHER.tick) WEATHER.tick(dt);
    this.updateWave(dt);
    this.updateCorruption(dt);
    if (typeof WEATHER !== 'undefined' && WEATHER.fx && WEATHER.fx.lightning && this.enemies.length && !this.stormImmune && Math.random() < dt * 0.15) {
      var victim = this.enemies[Math.floor(Math.random() * this.enemies.length)];
      victim.takeDamage(35, 'ice', null);
      this.burst(victim.x, victim.y, '#8ad4ff', 10);
      this.texts.push({ x: victim.x, y: victim.y - 20, txt: '⚡', life: 0.6, max: 0.6, color: '#8ad4ff', vy: -20, size: 14 });
      sfx('weather_lightning_strike', 0.6);
      this.stormFlash = 0.6;
    }
    this.applyBuffAuras();
    for (var i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt, this);
    for (var j = 0; j < this.towers.length; j++) this.towers[j].update(dt, this);
    for (var sl = 0; sl < this.soldiers.length; sl++) this.soldiers[sl].update(dt, this);
    for (var k = this.projectiles.length - 1; k >= 0; k--) {
      var p = this.projectiles[k];
      p.update(dt, this);
      if (p.dead) this.projectiles.splice(k, 1);
    }
    this.processEnemies();
    this.updateEffects(dt);
    if (this.autoWave && this.waveState === 'idle' && this.wave > 0 && !this.over) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) this.startWave();
    }
    // Guardia: un juego terminado no limpia oleadas (evita victoria/recompensas
    // tras una muerte en el mismo tick).
    if (!this.over && this.waveState === 'fighting' && this.spawnQueue.length === 0 && this.enemies.length === 0) this.waveCleared();
    if (typeof UI !== 'undefined' && UI.update) UI.update(this);
  }

  updateWave(dt) {
    if (this.waveState !== 'spawning') return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length) {
      var e = this.spawnQueue.shift();
      var bossMul = e.bossHpMul || 1;
      var en = new Enemy(e.type, this, bossMul);
      if (en.mutate && e.elite) en.mutate();
      if (this.startSlow < 1 && !en.boss) {
        en.slow = { mult: this.startSlow, t: 9999 };
      }
      if (this.enemySpeedMult !== 1) {
        // Gracia de velocidad: el multiplicador de dificultad entra completo en la oleada 5
        var spdRamp = Math.min(1, (this.wave - 1) / 4);
        en.speed *= 1 + (this.enemySpeedMult - 1) * spdRamp;
      }
      if (en.corruption && !en.corrupted && this.corruptTotal > 60) {
        en.corrupted = true;
        en.hpMax *= 1.3; en.hp = en.hpMax;
        en.color = '#7a2a7a';
      }
      this.enemies.push(en);
      this.spawnTimer = Math.max(0.15, e.gap);
      sfx(en.boss ? 'boss_appear' : 'enemy_spawn', en.boss ? 0.8 : 0.5);
    } else if (this.spawnTimer <= 0 && !this.spawnQueue.length) {
      this.waveState = 'fighting';
    }
  }

  applyBuffAuras() {
    var i, j;
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].buffed = 1;
    for (i = 0; i < this.enemies.length; i++) {
      var s = this.enemies[i];
      if (!s.alive) continue;
      if (s.type === 'sorcerer') {
        for (j = 0; j < this.enemies.length; j++) {
          var e = this.enemies[j];
          if (!e.alive || e.type !== 'goblin') continue;
          var dx = e.x - s.x, dy = e.y - s.y;
          if (dx * dx + dy * dy <= 120 * 120) e.buffed = Math.max(e.buffed, 1.3);
        }
      } else if (s.type === 'orcKing') {
        for (j = 0; j < this.enemies.length; j++) {
          var o = this.enemies[j];
          if (!o.alive || (o.type !== 'orc' && o.type !== 'berserker')) continue;
          var dx2 = o.x - s.x, dy2 = o.y - s.y;
          if (dx2 * dx2 + dy2 * dy2 <= 170 * 170) o.buffed = Math.max(o.buffed, 1.35);
        }
      } else if (s.corruption > 0 && s.alive && s.pathPos > 0) {
        this.addCorruption(s.x, s.y, s.corruption * 0.4 * 0.016);
      }
      if (s.buffShaman && s.alive) {
        for (j = 0; j < this.enemies.length; j++) {
          var sh = this.enemies[j];
          if (!sh.alive || sh === s || sh.boss) continue;
          var dxs = sh.x - s.x, dys = sh.y - s.y;
          if (dxs * dxs + dys * dys <= 130 * 130) sh.buffed = Math.max(sh.buffed, 1.25);
        }
      }
    }
    for (i = 0; i < this.towers.length; i++) {
      this.towers[i].buffed = 1;
      this.towers[i].dmgAmp = 1;
      this.towers[i].rateAura = 1;
      var rMult = 1;
      if (typeof WEATHER !== 'undefined' && WEATHER.fx && WEATHER.fx.rangeMult) rMult = WEATHER.fx.rangeMult;
      this.towers[i].rangeMult = rMult;
      this.towers[i].effectiveRange = this.towers[i].range * rMult;
      if (this.getCorruptionAt(this.towers[i].col, this.towers[i].row) > 0.4) this.towers[i].buffed *= 0.7;
      if (this.purifyRate > 0) this.purifyRadius(this.towers[i].x, this.towers[i].y, 70, this.purifyRate);
    }
    for (i = 0; i < this.towers.length; i++) {
      var d = this.towers[i];
      if (d.type === 'banner') {
        if (d.stun > 0) continue;
        for (j = 0; j < this.towers.length; j++) {
          var tb = this.towers[j];
          if (tb === d) continue;
          var db2 = Math.hypot(tb.x - d.x, tb.y - d.y);
          if (db2 <= d.range) {
            tb.dmgAmp *= d.aura;
            tb.rateAura *= d.rateAura;
          }
        }
      } else if (d.type !== 'druid' || d.stun > 0) {
        continue;
      } else {
        for (j = 0; j < this.towers.length; j++) {
          var t = this.towers[j];
          if (t === d) continue;
          var dd = Math.hypot(t.x - d.x, t.y - d.y);
          if (dd <= d.range) t.buffed *= d.aura;
        }
      }
    }
  }

  weatherMult(element) {
    if (typeof WEATHER === 'undefined' || !WEATHER.fx) return 1;
    if (element === 'fire') return WEATHER.fx.fireMult || 1;
    if (element === 'ice') return WEATHER.fx.iceMult || 1;
    if (element === 'nature') return WEATHER.fx.natureMult || 1;
    return 1;
  }

  addCorruption(x, y, amount) {    var c = Math.floor(x / CONFIG.CELL), r = Math.floor(y / CONFIG.CELL);
    if (c < 0 || c >= CONFIG.COLS || r < 0 || r >= CONFIG.ROWS) return;
    var key = c + ',' + r;
    var was = this.corruption[key] || 0;
    var val = Math.min(1, was + amount * this.corruptMult);
    this.corruption[key] = val;
    this.corruptTotal += val - was;
  }

  getCorruptionAt(col, row) {
    return this.corruption[col + ',' + row] || 0;
  }

  purifyRadius(x, y, radius, amount) {
    var c0 = Math.floor((x - radius) / CONFIG.CELL), c1 = Math.floor((x + radius) / CONFIG.CELL);
    var r0 = Math.floor((y - radius) / CONFIG.CELL), r1 = Math.floor((y + radius) / CONFIG.CELL);
    for (var c = c0; c <= c1; c++) {
      for (var r = r0; r <= r1; r++) {
        if (c < 0 || c >= CONFIG.COLS || r < 0 || r >= CONFIG.ROWS) continue;
        var cc = (c + 0.5) * CONFIG.CELL, rr = (r + 0.5) * CONFIG.CELL;
        if (Math.hypot(cc - x, rr - y) > radius) continue;
        var key = c + ',' + r;
        var was = this.corruption[key] || 0;
        if (was > 0) {
          var val = Math.max(0, was - amount);
          this.corruption[key] = val;
          this.corruptTotal += val - was;
        }
      }
    }
  }

  updateCorruption(dt) {
    if (this.corruptTotal <= 0) return;
    if (Math.random() < dt * 0.4) {
      var keys = Object.keys(this.corruption);
      if (keys.length) {
        var k = keys[Math.floor(Math.random() * keys.length)];
        var was = this.corruption[k];
        if (was > 0) {
          var val = Math.max(0, was - 0.002);
          this.corruption[k] = val;
          this.corruptTotal += val - was;
          if (val === 0) delete this.corruption[k];
        }
      }
    }
    this.corruptCellCount = Object.keys(this.corruption).length;
  }

  destroyTower(t) {
    var idx = this.towers.indexOf(t);
    if (idx < 0) return;
    this.towers.splice(idx, 1);
    this.soldiers = this.soldiers.filter(function (s) { return s.tower !== t; });
    if (this.selected === t) this.selected = null;
    this.explosion(t.x, t.y, 40, '#ff8a3a');
    this.texts.push({ x: t.x, y: t.y - 20, txt: '💥 ¡Torre destruida!', life: 1.8, max: 1.8, color: '#ff6a3a', vy: -18, size: 13 });
    this.addCorruption(t.x, t.y, 20);
    this.addShake(7);
    sfx('tower_destroy');
  }

  drawCorruption() {
    var ctx = this.ctx;
    var keys = Object.keys(this.corruption);
    for (var i = 0; i < keys.length; i++) {
      var parts = keys[i].split(',');
      var c = +parts[0], r = +parts[1];
      var v = this.corruption[keys[i]];
      if (v <= 0.02) continue;
      var cx = (c + 0.5) * CONFIG.CELL, cy = (r + 0.5) * CONFIG.CELL;
      ctx.globalAlpha = v * 0.5;
      ctx.fillStyle = '#2a0a2a';
      ctx.beginPath(); ctx.arc(cx, cy, CONFIG.CELL * 0.5, 0, 6.28); ctx.fill();
      ctx.globalAlpha = v;
      ctx.strokeStyle = 'rgba(90,20,110,0.75)';
      ctx.lineWidth = 1.4;
      for (var t = 0; t < 4; t++) {
        var ta = (t / 4) * 6.28 + this.time * 0.5 * ((t % 2) ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ta) * 6, cy + Math.sin(ta) * 6);
        ctx.quadraticCurveTo(
          cx + Math.cos(ta) * 16, cy + Math.sin(ta) * 16,
          cx + Math.cos(ta + 0.5) * 22, cy + Math.sin(ta + 0.5) * 22
        );
        ctx.stroke();
      }
      ctx.strokeStyle = '#6a1a6a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, CONFIG.CELL * 0.35 * (0.8 + 0.2 * Math.sin(this.time * 3 + c)), 0, 6.28); ctx.stroke();
      ctx.fillStyle = 'rgba(120,40,160,' + (0.3 + 0.2 * Math.sin(this.time * 2 + r)) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  addHitstop(t) {
    this.hitstop = Math.max(this.hitstop, t);
  }

  // Número de daño flotante (solo impactos directos de torres; los DoT no lo muestran)
  addDmgText(x, y, d, element, crit) {
    var col = crit ? '#ffd24a' : ({
      physical: '#e8e2d0', fire: '#ff9a4a', ice: 'rgba(160,216,255,1)', earth: '#c8a05a',
      nature: '#7ad47f', lightning: '#ffe86a', void: '#c8a4ff'
    }[element] || '#e8e2d0');
    var txt = String(Math.round(d));
    if (crit) txt += '!';
    this.texts.push({
      x: x + (Math.random() - 0.5) * 14, y: y, txt: txt,
      life: crit ? 0.7 : 0.5, max: crit ? 0.7 : 0.5,
      color: col, vy: -36 - Math.random() * 12, size: crit ? 15 : 10, dmgNum: true
    });
    // límite de números de daño en pantalla: descarta el más antiguo
    if (this.texts.length > 90) {
      for (var i = 0; i < this.texts.length; i++) {
        if (this.texts[i].dmgNum) { this.texts.splice(i, 1); break; }
      }
    }
  }

  findTarget(tower) {
    var best = null;
    var pri = tower.priority || 'first';
    var bestScore = pri === 'close' ? Infinity : -Infinity;
    var range = tower.effectiveRange || tower.range;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive || e.hidden) continue;
      if (e.flying && !tower.canHitFlying) continue;
      var dx = e.x - tower.x, dy = e.y - tower.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > range * range) continue;
      var score = pri === 'strong' ? e.hp : (pri === 'close' ? d2 : e.pathPos);
      if ((pri === 'close') ? score < bestScore : score > bestScore) { best = e; bestScore = score; }
    }
    return best;
  }

  findTargets(tower, n) {
    var inRange = [];
    var range = tower.effectiveRange || tower.range;
    var pri = tower.priority || 'first';
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive || e.hidden) continue;
      if (e.flying && !tower.canHitFlying) continue;
      var dx = e.x - tower.x, dy = e.y - tower.y;
      if (dx * dx + dy * dy <= range * range) inRange.push(e);
    }
    if (pri === 'strong') inRange.sort(function (a, b) { return b.hp - a.hp; });
    else if (pri === 'close') {
      var tx = tower.x, ty = tower.y;
      inRange.sort(function (a, b) {
        return ((a.x - tx) * (a.x - tx) + (a.y - ty) * (a.y - ty)) -
               ((b.x - tx) * (b.x - tx) + (b.y - ty) * (b.y - ty));
      });
    } else inRange.sort(function (a, b) { return b.pathPos - a.pathPos; });
    return inRange.slice(0, n);
  }

  findNextEnemy(x, y, except, radius, allowFlying) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive || e === except || e.hidden) continue;
      if (e.flying && !allowFlying) continue;
      var dx = e.x - x, dy = e.y - y;
      var d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius && e.pathPos > except.pathPos && d2 < bestD) {
        best = e; bestD = d2;
      }
    }
    return best;
  }

  enemyLeaks(e) {
    e.leaked = true;
    if (e.steal) {
      var stolen = Math.min(this.gold, Math.floor(this.gold * 0.12) + 10);
      if (stolen > 0) {
        this.gold -= stolen;
        this.texts.push({ x: e.x, y: e.y - 22, txt: '💰 ¡Ladrón roba ' + stolen + '!', life: 1.4, max: 1.4, color: '#ffd24a', vy: -28, size: 13 });
      } else {
        this.texts.push({ x: e.x, y: e.y - 22, txt: '💰 ¡Ladrón!', life: 1.2, max: 1.2, color: '#ffd24a', vy: -28, size: 12 });
      }
      return;
    }
    var dmg = e.boss ? 6 : 1;
    this.lives -= dmg;
    this.leaked += dmg;
    this.castleHit = 0.5;
    if (this.addShake) this.addShake(4.5);
    if (typeof DIRECTOR !== 'undefined' && DIRECTOR.recordLeak) DIRECTOR.recordLeak(dmg);
    this.texts.push({ x: e.x, y: e.y - 22, txt: '-' + dmg + ' ❤️', life: 1.2, max: 1.2, color: '#ff5a5a', vy: -28, size: 14 });
    sfx(dmg >= 6 ? 'castle_hit_big' : 'castle_hit');
    if (this.lives <= 5 && this.lives > 0) sfx('castle_low_hp', 0.4);
    if (this.lives <= 0) { this.lives = 0; this.gameOver(); }
  }

  processEnemies() {
    var alive = [];
    var dying = [];
    var revived = [];
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.leaked) continue;
      if (e.alive) { alive.push(e); continue; }
      if (!e.deathHandled) { this.handleDeath(e, revived); e.deathHandled = true; }
      if (e.deadT > 0) dying.push(e);
    }
    this.enemies = alive.concat(dying, revived);
  }

  handleDeath(e, revived) {
    // Balanceo web: las recompensas suben un +1% por oleada (máx +60%) para que la
    // economía aguante el ritmo del HP (+5%/oleada) en partidas largas.
    // Además, estímulo de arranque: +12% durante las 5 primeras oleadas para
    // escapar del inicio frío en dificultades con oro reducido.
    var infl = 1 + Math.min(this.wave, 60) * 0.01;
    if (this.wave <= 5) infl += 0.12;
    var reward = Math.round(e.reward * this.goldMult * infl);
    // Bestiario: caza acumulada por especie → +1% oro por cada 25 cazados (máx +8%)
    try {
      var store = {};
      try { store = JSON.parse(localStorage.getItem('vaeldryn_bestiary') || '{}'); } catch (err2) { }
      var prior = store[e.type] || 0;
      store[e.type] = prior + 1;
      localStorage.setItem('vaeldryn_bestiary', JSON.stringify(store));
      var bonus = Math.min(0.08, Math.floor((prior + 1) / 25) * 0.01);
      if (bonus > 0) reward = Math.round(reward * (1 + bonus));
      if ((prior + 1) % 50 === 0) this.texts.push({ x: e.x, y: e.y - 30, txt: '📖 ' + e.name + ' ×' + (prior + 1) + ' ¡experto!', life: 1.6, max: 1.6, color: '#c8a0ff', vy: -20, size: 11 });
    } catch (errB) { }
    this.gold += reward;
    this.stats.goldEarned += reward;
    this.kills++;
    // crédito de baja a la torre (último golpe directo o dueño del veneno/quemadura)
    if (e.lastHitBy && typeof e.lastHitBy.kills === 'number') {
      e.lastHitBy.kills++;
      e.lastHitBy = null;
    }
    this.texts.push({ x: e.x, y: e.y - 16, txt: '+' + reward + ' 🪙', life: 0.9, max: 0.9, color: '#ffd24a', vy: -25, size: 11 });
    if (e.type === 'splitter' && typeof unlockAchievement === 'function' && unlockAchievement('splitter_kill')) {
      this._achNotify('Atomizador');
    }
    sfx(e.boss ? 'enemy_death_boss' : 'enemy_death', e.boss ? 1 : 0.5);
    // Juice: la caída de un jefe sacude la pantalla y congela un instante
    if (e.boss) {
      this.addShake(11);
      this.addHitstop(0.09);
    } else if (e.r >= 15) this.addShake(2.2);
    if (e.deathFrozen) {
      this.shockRing(e.x, e.y, e.r * 3.4, '#bfe8ff', 0.35);
      for (var sh = 0; sh < (e.boss ? 22 : 9); sh++) {
        var sa = Math.random() * 6.28, ss = 40 + Math.random() * 120;
        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss - 30, life: 0.5 + Math.random() * 0.3, max: 0.8, color: Math.random() < 0.5 ? '#bfe8ff' : '#e8f6ff', size: 1.6 + Math.random() * 1.8, grav: 0 });
      }
    } else {
      this.burst(e.x, e.y, e.color, e.boss ? 20 : 6);
      this.shockRing(e.x, e.y, e.r * (e.boss ? 5.5 : 2.8), e.color, 0.4);
      for (var w = 0; w < (e.boss ? 12 : 4); w++) {
        this.particles.push({
          x: e.x, y: e.y,
          vx: (Math.random() - 0.5) * 50, vy: -28 - Math.random() * 44,
          life: 0.6 + Math.random() * 0.4, max: 1, color: '#9a9aa6',
          size: 2 + Math.random() * 2.2, grav: -22
        });
      }
    }
    if (typeof DIRECTOR !== 'undefined' && DIRECTOR.recordKill) DIRECTOR.recordKill(e, this);
    if (e.corruption && this.corruptTotal < 240) this.addCorruption(e.x, e.y, e.corruption);
    if (e.explode) {
      var rr = e.explode.radius, ed = e.explode.dmg;
      for (var ex = 0; ex < this.enemies.length; ex++) {
        var ex2 = this.enemies[ex];
        if (!ex2.alive || ex2 === e) continue;
        var exd = Math.hypot(ex2.x - e.x, ex2.y - e.y);
        if (exd <= rr) ex2.takeDamage(ed, 'physical', null);
      }
      this.explosion(e.x, e.y, rr, '#8ad47f');
      sfx('enemy_explode');
    }
    if (e.revive && !e.revived && Math.random() < e.revive && this.enemies.length + revived.length < 60) {
      var sk = new Enemy('skeleton', this);
      sk.revived = true;
      sk.hpMax = e.hpMax * 0.3;
      sk.hp = sk.hpMax;
      sk.pathPos = Math.max(0, e.pathPos - 25);
      revived.push(sk);
      this.texts.push({ x: e.x, y: e.y - 30, txt: '💀 resucita', life: 1, max: 1, color: '#9ab', vy: -20, size: 11 });
      sfx('enemy_revive', 0.4);
    }
    if (e.split && this.enemies.length + revived.length < 60) {
      var intoType = e.split.into;
      var count = e.split.count || 2;
      if (intoType && ENEMIES[intoType]) {
        for (var si = 0; si < count; si++) {
          var se = new Enemy(intoType, this);
          se.pathPos = Math.max(0, e.pathPos - 10 + Math.random() * 10);
          revived.push(se);
        }
        this.burst(e.x, e.y, ENEMIES[intoType].color || e.color, 8);
        sfx('enemy_hurt', 0.4);
      }
    }
  }

  waveCleared() {
    this.waveState = 'idle';
    var bonus = Math.round((20 + this.wave * 5) * this.goldMult);
    this.gold += bonus;
    this.stats.goldEarned += bonus;
    if (typeof PROGRESS !== 'undefined' && PROGRESS.addXp) PROGRESS.addXp(5 + this.wave * 2);
    toast('🏆 ¡Oleada ' + this.wave + ' superada! +' + bonus + ' oro', 3500);
    sfx('wave_cleared');
    var conquestActive = typeof CONQUEST !== 'undefined' && CONQUEST.enabled;
    if (conquestActive) {
      this.gold += this.conquestGoldPerEnd;
      this.stats.goldEarned += this.conquestGoldPerEnd;
      this.conquestTimer = Math.max(this.conquestTimerEnd, this.conquestTimer - this.conquestTimerDec);
      if (this.wave % 5 === 0) {
        this.waveState = 'relic_choice';
        var picks = CONQUEST.pickRewards(2);
        if (typeof UI !== 'undefined' && UI.showRelicChoice) UI.showRelicChoice(picks, this);
      }
      if (this.wave % 5 === 0 && this.wave > 0) {
        this.lives = Math.min(this.lives + this.conquestHpBonus, this.map.startLives);
      }
      var finalWave = this.conquestFinalWaves.length ? this.conquestFinalWaves[this.conquestFinalWaves.length - 1] : 0;
      if (finalWave && this.wave >= finalWave && !this.continueEndless) {
        this.gold += this.conquestFinalBonusGold;
        this.stats.goldEarned += this.conquestFinalBonusGold;
        this.winGame();
      }
    } else if (this.wave >= CONFIG.WIN_WAVE && !this.continueEndless) {
      this.winGame();
    }
    this.checkAchievements();
    if (typeof autoSaveGame === 'function' && !this.over && !this.won) autoSaveGame(this);
  }

  _recordScore() {
    if (typeof SCORES === 'undefined' || !SCORES.add) return;
    SCORES.add({
      mapId: this.mapId,
      diff: this.difficulty,
      wave: this.wave,
      kills: this.kills,
      time: Math.round(this.time),
      conquest: typeof CONQUEST !== 'undefined' && CONQUEST.enabled,
      endless: !!this.continueEndless
    });
  }

  winGame() {
    this.won = true;
    this.over = true;
    this._recordScore();
    if (typeof CONQUEST !== 'undefined') CONQUEST.enabled = false;
    if (typeof clearSave === 'function') clearSave();
    if (typeof PROGRESS !== 'undefined' && PROGRESS.recordRun) PROGRESS.recordRun(this.mapId, this);
    sfx('victory', 0.6);
    AUDIO.playMusic('victory');
    this.showOverlay('win');
  }

  gameOver() {
    this.over = true;
    this._recordScore();
    if (typeof clearSave === 'function') clearSave();
    if (typeof CONQUEST !== 'undefined' && CONQUEST.enabled && CONQUEST.recordRun) CONQUEST.recordRun(this);
    if (typeof PROGRESS !== 'undefined' && PROGRESS.recordRun) PROGRESS.recordRun(this.mapId, this);
    sfx('defeat', 0.6);
    AUDIO.playMusic('defeat');
    this.showOverlay('lose');
  }

  checkAchievements() {
    if (typeof unlockAchievement !== 'function') return;
    if (this.kills >= 1 && unlockAchievement('first_blood')) this._achNotify('Primera Sangre');
    if (this.kills >= 100 && unlockAchievement('kill_100')) this._achNotify('Carnicero');
    if (this.kills >= 500 && unlockAchievement('kill_500')) this._achNotify('Destructor');
    if (this.wave >= 5 && unlockAchievement('wave_5')) this._achNotify('Oleada 5');
    if (this.wave >= 10 && unlockAchievement('wave_10')) this._achNotify('Veterano');
    if (this.gold >= 500 && unlockAchievement('gold_500')) this._achNotify('Avaricia');
    if (this.won && this.difficulty >= 2 && unlockAchievement('hard_win')) this._achNotify('Masoquista');
    var aliveCount = 0;
    for (var i = 0; i < this.enemies.length; i++) { if (this.enemies[i].alive) aliveCount++; }
    if (aliveCount === 0 && this.won && typeof MAPS !== 'undefined') {
      var completedMaps = 0;
      for (var j = 0; j < MAPS.length; j++) {
        var mrec = PROGRESS.data.maps[MAPS[j].id];
        if (mrec && mrec.completed) completedMaps++;
      }
      if (completedMaps >= MAPS.length - 1 && unlockAchievement('all_maps')) this._achNotify('Explorador');
    }
  }

  _achNotify(name) {
    this.texts.push({
      x: CONFIG.WIDTH / 2, y: CONFIG.HEIGHT / 2 - 40,
      txt: '🏆 Logro: ' + name, life: 2.0, max: 2.0,
      color: '#ffd24a', vy: -8, size: 14
    });
  }
  showOverlay(mode) {
    var ov = document.getElementById('overlay');
    var title = document.getElementById('overlay-title');
    var txt = document.getElementById('overlay-text');
    var statsEl = document.getElementById('overlay-stats');
    var cont = document.getElementById('btn-continue');
    if (mode === 'win') {
      title.textContent = '🏰 ¡VAELDRYN A SALVO!';
      txt.textContent = 'Has resistido las ' + CONFIG.WIN_WAVE + ' oleadas y derrotado a todos los jefes. El reino celebra tu victoria. ¿Te atreves con el modo infinito?';
      cont.classList.remove('hidden');
    } else {
      title.textContent = '💀 EL REINO HA CAÍDO';
      var cq = '';
      if (typeof CONQUEST !== 'undefined' && CONQUEST.enabled && CONQUEST.bestWave > 0) {
        cq = '<br><br>🏆 Récord de Conquista: oleada <b>' + CONQUEST.bestWave + '</b>';
      }
      txt.innerHTML = 'Llegaste a la oleada ' + this.wave + ' con ' + this.kills + ' enemigos derrotados. Los ejércitos del caos han tomado VAELDRYN... ¡Inténtalo de nuevo!' + cq;
      cont.classList.add('hidden');
    }
    if (statsEl) {
      var mins = Math.floor(this.time / 60);
      var secs = Math.floor(this.time % 60);
      var diffName = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY[this.difficulty]) ? DIFFICULTY[this.difficulty].name : 'Normal';
      statsEl.innerHTML =
        '<div class="ostat"><span>🌊</span><b>Oleadas</b><i>' + this.wave + '</i></div>' +
        '<div class="ostat"><span>⚔️</span><b>Bajas</b><i>' + this.kills + '</i></div>' +
        '<div class="ostat"><span>💔</span><b>Fugas</b><i>' + this.leaked + '</i></div>' +
        '<div class="ostat"><span>🪙</span><b>Oro ganado</b><i>' + this.stats.goldEarned + '</i></div>' +
        '<div class="ostat"><span>🏗️</span><b>Torres</b><i>' + this.stats.towersBuilt + '</i></div>' +
        '<div class="ostat"><span>⬆️</span><b>Mejoras</b><i>' + this.stats.upgrades + '</i></div>' +
        '<div class="ostat"><span>⏱️</span><b>Tiempo</b><i>' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</i></div>' +
        '<div class="ostat"><span>🔥</span><b>Dificultad</b><i>' + diffName + '</i></div>';
    }
    ov.classList.remove('hidden');
  }

  burst(x, y, color, n) {
    if (this.particles.length > 700) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28;
      var sp = 40 + Math.random() * 90;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.4 + Math.random() * 0.4, max: 0.8, color: color,
        size: 2 + Math.random() * 2.5, grav: 160
      });
    }
    for (var j = 0; j < Math.floor(n / 2); j++) {
      var a2 = Math.random() * 6.28;
      var sp2 = 20 + Math.random() * 50;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a2) * sp2, vy: Math.sin(a2) * sp2 - 15,
        life: 0.3 + Math.random() * 0.3, max: 0.6, color: '#fff6c8',
        size: 1 + Math.random() * 1.5, grav: 120
      });
    }
  }

  explosion(x, y, radius, color) {
    if (this.particles.length < 700) this.burst(x, y, color, 16);
    for (var i = 0; i < 12 && this.particles.length < 760; i++) {
      var a = (i / 12) * 6.28;
      var sp = 80 + Math.random() * 40;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.15, max: 0.4, color: '#fff6c8',
        size: 2 + Math.random() * 2, grav: 0
      });
    }
    for (var k = 0; k < 6; k++) {
      var a3 = (k / 6) * 6.28 + 0.3;
      var sp3 = 50 + Math.random() * 30;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a3) * sp3, vy: Math.sin(a3) * sp3,
        life: 0.35, max: 0.35, color: color,
        size: 3 + Math.random() * 2, grav: 0
      });
    }
    this.particles.push({
      x: x, y: y, vx: 0, vy: 0,
      life: 0.4, max: 0.4, color: color,
      size: 3, grav: 0, kind: 'ring', r1: Math.max(30, radius * 0.8)
    });
    this.particles.push({
      x: x, y: y, vx: 0, vy: 0,
      life: 0.2, max: 0.2, color: '#fff6c8',
      size: Math.max(10, radius * 0.35), grav: 0, kind: 'flash'
    });
    this.particles.push({
      x: x, y: y, vx: 0, vy: -15,
      life: 0.5, max: 0.5, color: '#888',
      size: 5, grav: -8, kind: 'smoke'
    });
  }

  hitSpark(x, y, color) {
    for (var i = 0; i < 6; i++) {
      var a = Math.random() * 6.28;
      var sp = 50 + Math.random() * 80;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.15 + Math.random() * 0.15, max: 0.3, color: color,
        size: 1.5 + Math.random() * 1.5, grav: 0
      });
    }
    for (var j = 0; j < 2; j++) {
      this.particles.push({
        x: x, y: y, vx: 0, vy: 0,
        life: 0.12, max: 0.12, color: '#ffffff',
        size: 4 + Math.random() * 2, grav: 0, kind: 'flash'
      });
    }
  }

  lightningBolt(x1, y1, x2, y2, color, dur) {
    this.lightning.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color || '#8ad4ff', t: dur || 0.15, max: dur || 0.15 });
    this.hitSpark(x2, y2, color || '#8ad4ff');
  }

  streak(x1, y1, x2, y2, color, dur) {
    this.lightning.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color || '#ffffff', t: dur || 0.15, max: dur || 0.15, straight: true });
    this.hitSpark(x2, y2, color || '#ffffff');
  }

  shockRing(x, y, r1, color, life) {
    this.particles.push({ x: x, y: y, vx: 0, vy: 0, life: life || 0.4, max: life || 0.4, color: color || '#ffffff', size: 6, grav: 0, kind: 'ring', r1: r1 || 40 });
  }

  drawLightning(ctx) {
    for (var i = 0; i < this.lightning.length; i++) {
      var lb = this.lightning[i];
      var alpha = Math.max(0, lb.t / lb.max);
      var pts;
      if (lb.straight) {
        pts = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];
      } else {
        var segs = 8;
        pts = [{ x: lb.x1, y: lb.y1 }];
        for (var s = 1; s < segs; s++) {
          var tt = s / segs;
          var px = lb.x1 + (lb.x2 - lb.x1) * tt;
          var py = lb.y1 + (lb.y2 - lb.y1) * tt;
          pts.push({ x: px + (Math.random() - 0.5) * 14, y: py + (Math.random() - 0.5) * 14 });
        }
        pts.push({ x: lb.x2, y: lb.y2 });
      }
      ctx.save();
      // halo exterior de color
      ctx.globalAlpha = alpha * 0.2;
      ctx.strokeStyle = lb.color; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var p1 = 1; p1 < pts.length; p1++) ctx.lineTo(pts[p1].x, pts[p1].y);
      ctx.stroke();
      // núcleo blanco grueso
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var p2 = 1; p2 < pts.length; p2++) ctx.lineTo(pts[p2].x, pts[p2].y);
      ctx.stroke();
      // trazo principal
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = lb.color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var p3 = 1; p3 < pts.length; p3++) ctx.lineTo(pts[p3].x, pts[p3].y);
      ctx.stroke();
      // filamento interior
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var p4 = 1; p4 < pts.length; p4++) ctx.lineTo(pts[p4].x, pts[p4].y);
      ctx.stroke();
      ctx.restore();
    }
  }

  frostNova(x, y, radius, slow, dur) {
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * 6.28;
      var sp = 100 + Math.random() * 60;
      this.particles.push({
        x: x + Math.cos(a) * radius * 0.3, y: y + Math.sin(a) * radius * 0.3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35, max: 0.35, color: '#bfe8ff', size: 2.5 + Math.random() * 1.5, grav: 0
      });
    }
    for (var w = 0; w < 8; w++) {
      var a2 = (w / 8) * 6.28;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a2) * 40, vy: Math.sin(a2) * 40,
        life: 0.5, max: 0.5, color: '#ffffff', size: 2, grav: 0
      });
    }
    this.particles.push({
      x: x, y: y, vx: 0, vy: 0,
      life: 0.45, max: 0.45, color: '#bfe8ff',
      size: 6, grav: 0, kind: 'ring', r1: radius
    });
    this.particles.push({
      x: x, y: y, vx: 0, vy: 0,
      life: 0.3, max: 0.3, color: '#e8f6ff',
      size: Math.max(6, radius * 0.25), grav: 0, kind: 'flash'
    });
    for (var j = 0; j < this.enemies.length; j++) {
      var e = this.enemies[j];
      if (!e.alive) continue;
      var dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        e.slow = { mult: slow, t: dur };
      }
    }
  }

  greenBurst(x, y, radius) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * 6.28;
      var r = Math.random() * radius * 0.7;
      this.particles.push({
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: 0, vy: -30 - Math.random() * 40,
        life: 0.6, max: 0.6, color: '#7fd47f', size: 3, grav: -30
      });
    }
  }

  updateEffects(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 22);
    if (this.stormFlash > 0) this.stormFlash = Math.max(0, this.stormFlash - dt * 2.2);
    var i;
    for (i = this.lightning.length - 1; i >= 0; i--) {
      var lb = this.lightning[i];
      lb.t -= dt;
      if (lb.t <= 0) { this.lightning[i] = this.lightning[this.lightning.length - 1]; this.lightning.pop(); }
    }
    // swap-pop: evita el coste O(n) de splice en arrays de cientos de elementos
    for (i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (i = this.texts.length - 1; i >= 0; i--) {
      var t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts[i] = this.texts[this.texts.length - 1]; this.texts.pop(); continue; }
      t.y += (t.vy || 0) * dt;
    }
    if (this.castleHit > 0) this.castleHit -= dt;
  }

  renderBG() {
    var c = this.bg.getContext('2d');
    var COLS = CONFIG.COLS, ROWS = CONFIG.ROWS, CELL = CONFIG.CELL;
    var th = this.theme;
    // ground base
    var grad = c.createLinearGradient(0, 0, 0, ROWS * CELL);
    grad.addColorStop(0, th.ground[0]);
    grad.addColorStop(0.5, th.ground[1]);
    grad.addColorStop(1, th.ground[2]);
    c.fillStyle = grad;
    c.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    // manchas orgánicas a gran escala (rompe la cuadrícula)
    for (var br = 0; br < ROWS; br += 2) {
      for (var bc = 0; bc < COLS; bc += 2) {
        var bh = hash2(bc * 0.7 + 3, br * 0.7 + 11);
        if (bh < 0.35) continue;
        var bx = (bc + 0.5 + (hash2(bc, br) - 0.5) * 1.6) * CELL;
        var by = (br + 0.5 + (hash2(bc + 9, br + 4) - 0.5) * 1.6) * CELL;
        c.globalAlpha = 0.1 + bh * 0.12;
        c.fillStyle = th.cell(bh, Math.sin((bc + br) * 0.7) * 6);
        c.beginPath(); c.ellipse(bx, by, CELL * (1.1 + bh), CELL * (0.8 + bh * 0.7), bh * 2, 0, 6.28); c.fill();
      }
    }
    c.globalAlpha = 1;
    for (var r = 0; r < ROWS; r++) {
      for (var col = 0; col < COLS; col++) {
        var h = hash2(col, r);
        var shade = Math.sin((col + r) * 0.7 + h * 9) * 6;
        var x0 = col * CELL, y0 = r * CELL;
        c.fillStyle = th.cell(h, shade);
        c.beginPath(); c.roundRect(x0 - 1, y0 - 1, CELL + 2, CELL + 2, 6 + h * 6); c.fill();
        if (h > 0.82) {
          c.fillStyle = th.tuft;
          c.beginPath();
          c.moveTo(x0 + 4 + h * 10, y0 + CELL - 3);
          c.lineTo(x0 + 8 + h * 10, y0 + CELL - 8);
          c.lineTo(x0 + 12 + h * 10, y0 + CELL - 3);
          c.fill();
          c.beginPath();
          c.moveTo(x0 + 9 + h * 6, y0 + CELL - 2);
          c.lineTo(x0 + 13 + h * 6, y0 + CELL - 6);
          c.lineTo(x0 + 17 + h * 6, y0 + CELL - 2);
          c.fill();
        }
        if (h < 0.1) {
          c.fillStyle = th.soil;
          c.beginPath(); c.ellipse(x0 + CELL * 0.5, y0 + CELL * 0.5, CELL * 0.45, CELL * 0.3, h * 3, 0, 6.28); c.fill();
        }
      }
    }
    // motas de textura orgánica
    for (var nx = 0; nx < 420; nx++) {
      var nxc = hash2(nx, 42) * COLS * CELL, nyc = hash2(nx, 87) * ROWS * CELL;
      c.globalAlpha = 0.05 + hash2(nx, 13) * 0.09;
      c.fillStyle = hash2(nx, 5) > 0.5 ? th.ground[2] : '#000';
      c.beginPath(); c.arc(nxc, nyc, 1 + hash2(nx, 7) * 2.4, 0, 6.28); c.fill();
    }
    c.globalAlpha = 1;
    // detalle específico del bioma (hierba, dunas, nieve, fisuras...)
    if (th.detail) th.detail(c, COLS, ROWS, CELL);
    // theme decor (no path)
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        if (this.isPathCell(cc, rr)) continue;
        var hh = hash2(cc + 100, rr + 50);
        var cx = (cc + 0.5) * CELL + (hh - 0.5) * 8;
        var cy = (rr + 0.5) * CELL + ((hh * 37) % 1 - 0.5) * 8;
        th.paintDecor(c, cx, cy, hh);
      }
    }
    // path
    PAINT_PATH[th.path](c, this.pathCells, CELL);
    // borde orgánico del camino (tierra pisada)
    c.save();
    for (var pk in this.pathCells) {
      var pp = pk.split(',');
      var pc2 = +pp[0], pr2 = +pp[1];
      for (var nb = 0; nb < 8; nb++) {
        var dx = ((nb % 3) - 1), dy = (Math.floor(nb / 3) - 1);
        if (dx === 0 && dy === 0) continue;
        var nk = (pc2 + dx) + ',' + (pr2 + dy);
        if (this.pathCells[nk]) continue;
        if (pc2 + dx < 0 || pc2 + dx >= COLS || pr2 + dy < 0 || pr2 + dy >= ROWS) continue;
        c.fillStyle = th.soil;
        c.beginPath();
        c.arc(pc2 * CELL + CELL / 2 + dx * CELL / 2, pr2 * CELL + CELL / 2 + dy * CELL / 2, CELL * 0.58, 0, 6.28);
        c.fill();
      }
    }
    c.restore();
    // special feature
    PAINT_FEATURE[this.map.theme](c, CELL);
    // (el portal y el castillo se dibujan por frame en render() para animarse)
    // luz ambiental direccional suave (acabado ilustrado)
    var lg = c.createLinearGradient(0, 0, COLS * CELL, ROWS * CELL);
    lg.addColorStop(0, 'rgba(255,244,214,0.07)');
    lg.addColorStop(0.5, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.08)');
    c.fillStyle = lg;
    c.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    // vignette
    var vg = c.createRadialGradient(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.45, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    c.fillStyle = vg;
    c.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    // props ambientales animables (hierba que se mece, hojas, brasas...)
    this.bakeAmbient();
  }

  // Prepara los elementos ambientales animados según el bioma.
  // Posiciones deterministas fuera del camino para no ensuciar el combate.
  bakeAmbient() {
    var th = this.map.theme;
    var A = [];
    var hash2b = function (a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    var counts = { tuft: 16, leaf: 6, mote: 9, mist: 3 };
    var moteCol = { plains: 'rgba(255,240,180,0.5)', desert: 'rgba(230,200,140,0.55)', forest: 'rgba(200,255,140,0.4)', frozen: 'rgba(220,240,255,0.6)', void: 'rgba(180,120,255,0.5)' }[th] || 'rgba(255,255,255,0.4)';
    for (var i = 0; i < counts.tuft; i++) {
      var tx = hash2b(i, 3) * CONFIG.WIDTH, ty = hash2b(i, 7) * CONFIG.HEIGHT;
      if (this.isPathCell(Math.floor(tx / CONFIG.CELL), Math.floor(ty / CONFIG.CELL))) continue;
      A.push({ t: 'tuft', x: tx, y: ty, p: hash2b(i, 11) * 6.28, s: 0.7 + hash2b(i, 13) * 0.7 });
    }
    for (var l = 0; l < counts.leaf; l++) {
      A.push({ t: 'leaf', x: hash2b(l, 21) * CONFIG.WIDTH, y: hash2b(l, 23) * CONFIG.HEIGHT, p: hash2b(l, 29) * 6.28, s: 0.8 + hash2b(l, 31) * 0.5 });
    }
    for (var m = 0; m < counts.mote; m++) {
      A.push({ t: 'mote', x: hash2b(m, 41) * CONFIG.WIDTH, y: hash2b(m, 43) * CONFIG.HEIGHT, p: hash2b(m, 47) * 6.28, s: 0.6 + hash2b(m, 53), col: moteCol });
    }
    for (var mi = 0; mi < counts.mist; mi++) {
      A.push({ t: 'mist', x: hash2b(mi, 61) * CONFIG.WIDTH, y: (0.2 + hash2b(mi, 63) * 0.6) * CONFIG.HEIGHT, p: hash2b(mi, 67) * 6.28, s: 60 + hash2b(mi, 71) * 60 });
    }
    this.ambient = A;
  }

  // Dibuja la capa ambiental viva (sutil: el protagonismo es del combate)
  drawAmbient(ctx) {
    if (!this.ambient) return;
    var t = this.time;
    var th = this.map.theme;
    for (var i = 0; i < this.ambient.length; i++) {
      var a = this.ambient[i];
      if (a.t === 'tuft') {
        var sway = Math.sin(t * 1.4 + a.p) * 2.2 * a.s;
        ctx.strokeStyle = 'rgba(120,180,80,0.4)';
        ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        for (var b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(a.x + b * 2.2 * a.s, a.y);
          ctx.quadraticCurveTo(a.x + b * 2.6 * a.s + sway * 0.4, a.y - 3 * a.s, a.x + b * 3 * a.s + sway, a.y - 5.5 * a.s);
          ctx.stroke();
        }
      } else if (a.t === 'leaf' && (th === 'forest' || th === 'plains')) {
        var lp = ((t * 0.09 * a.s + a.p) % 1);
        var ly = a.y + lp * CONFIG.HEIGHT * 0.9;
        var lx = a.x + Math.sin(t * 0.9 + a.p + lp * 5) * 16;
        ctx.globalAlpha = Math.sin(lp * Math.PI) * 0.55;
        ART.leaf(ctx, lx, ly, lp * 5 + a.p, 3.4 * a.s, th === 'forest' ? '#7aa840' : '#a8b050', '#4a6a28');
        ctx.globalAlpha = 1;
      } else if (a.t === 'mote') {
        var mp = ((t * 0.13 * a.s + a.p) % 1);
        var mx = a.x + Math.sin(t * 0.5 + a.p) * 10;
        var my = a.y - mp * 46;
        ctx.globalAlpha = Math.sin(mp * Math.PI) * 0.5;
        ctx.fillStyle = a.col;
        ctx.beginPath(); ctx.arc(mx, my, 1.3 * a.s, 0, 6.28); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (a.t === 'mist' && (th === 'frozen' || th === 'void')) {
        var mxp = ((t * 0.02 + a.p) % 1);
        var mpx = -a.s + mxp * (CONFIG.WIDTH + a.s * 2);
        var mg = ctx.createRadialGradient(mpx, a.y, 4, mpx, a.y, a.s);
        mg.addColorStop(0, th === 'frozen' ? 'rgba(220,240,255,0.09)' : 'rgba(150,90,220,0.10)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.ellipse(mpx, a.y, a.s, a.s * 0.32, 0, 0, 6.28); ctx.fill();
      }
    }
    // penumbra de tormenta + destello del relámpago
    if (typeof WEATHER !== 'undefined' && WEATHER.fx && WEATHER.fx.lightning) {
      ctx.fillStyle = 'rgba(30,45,80,0.12)';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      if (this.stormFlash > 0) {
        ctx.fillStyle = 'rgba(230,240,255,' + (this.stormFlash * 0.35).toFixed(3) + ')';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      }
    }
  }

  drawPortal(c) {
    var px = (this.map.portal[0] + 0.5) * CONFIG.CELL, py = (this.map.portal[1] + 0.5) * CONFIG.CELL;
    var t = this.time;
    // plataforma de piedra desgastada (tres peldaños)
    c.fillStyle = 'rgba(70,58,44,0.95)';
    c.beginPath(); c.ellipse(px, py + 9, 40, 13, 0, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(120,102,74,0.9)';
    c.beginPath(); c.ellipse(px, py + 7, 34, 10, 0, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(150,128,92,0.8)';
    c.beginPath(); c.ellipse(px, py + 6, 26, 7, 0, 0, 6.28); c.fill();
    // círculo rúnico grabado en el suelo
    c.strokeStyle = 'rgba(255,210,74,0.5)'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(px, py + 6, 22, 6, 0, 0, 6.28); c.stroke();
    c.strokeStyle = 'rgba(255,210,74,' + (0.3 + 0.2 * Math.sin(t * 2)) + ')';
    c.beginPath(); c.ellipse(px, py + 6, 17, 4.6, 0, 0, 6.28); c.stroke();
    // sombra del aro
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 12;
    c.beginPath(); c.ellipse(px + 3, py + 1, 22, 30, 0, 0, 6.28); c.stroke();
    // aro de piedras talladas
    for (var s = 0; s < 16; s++) {
      var a = s / 16 * Math.PI * 2;
      var ax = px + Math.cos(a) * 23, ay = py - 2 + Math.sin(a) * 31;
      var hh = hash2(s, 3);
      var sz = 5 + hh * 2.5;
      c.fillStyle = hh > 0.5 ? '#7a6a52' : '#6a5a44';
      c.save();
      c.translate(ax, ay);
      c.rotate(a + Math.PI / 2);
      c.beginPath(); c.roundRect(-sz / 2, -3.4, sz, 6.8, 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.beginPath(); c.roundRect(-sz / 2, -3.4, sz, 1.6, 1); c.fill();
      c.restore();
    }
    // runas en el aro
    var runes = ['ᚠ', 'ᚱ', 'ᚦ', 'ᚨ', 'ᚷ', 'ᛒ', 'ᛞ', 'ᛖ'];
    c.fillStyle = '#ffd24a';
    c.font = '7px sans-serif'; c.textAlign = 'center';
    for (var rn = 0; rn < runes.length; rn++) {
      var ra = rn / runes.length * Math.PI * 2 + 0.4;
      c.fillText(runes[rn], px + Math.cos(ra) * 25, py + Math.sin(ra) * 33);
    }
    // vórtice mágico
    var g = c.createRadialGradient(px, py - 2, 2, px, py - 2, 26);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.25, '#ffd24a');
    g.addColorStop(0.55, '#b06aff');
    g.addColorStop(0.85, '#4a2a8a');
    g.addColorStop(1, 'rgba(40,10,60,0.1)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(px, py - 2, 20, 28, 0, 0, 6.28); c.fill();
    // remolinos
    c.strokeStyle = 'rgba(255,242,200,0.55)'; c.lineWidth = 1.6;
    for (var w = 0; w < 3; w++) {
      var wa = t * 1.6 + w * 2.09;
      c.beginPath();
      c.ellipse(px, py - 2, 12 + w * 3, 16 + w * 4, wa, 0, 6.28);
      c.stroke();
    }
    // núcleo
    c.fillStyle = 'rgba(255,250,220,0.95)';
    c.beginPath(); c.arc(px, py - 2, 3 + Math.sin(t * 4) * 1.2, 0, 6.28); c.fill();
    // rocas flotantes que orbitan el portal
    for (var fr = 0; fr < 4; fr++) {
      var fa = t * 0.5 + fr * 1.57;
      var frx = px + Math.cos(fa) * 34, fry = py - 2 + Math.sin(fa) * 40;
      var fsz = 2.4 + hash2(fr, 9) * 1.8;
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath(); c.ellipse(frx, fry + fsz + 2, fsz, fsz * 0.4, 0, 0, 6.28); c.fill();
      c.fillStyle = '#6a5a44';
      c.save();
      c.translate(frx, fry);
      c.rotate(fa);
      c.beginPath(); c.roundRect(-fsz / 2, -fsz / 2, fsz, fsz * 0.8, 1); c.fill();
      c.fillStyle = 'rgba(255,220,140,0.25)';
      c.beginPath(); c.roundRect(-fsz / 2, -fsz / 2, fsz, fsz * 0.3, 1); c.fill();
      c.restore();
    }
  }

  // CASTILLO DE VAELDRYN — muralla con sillares, torres con tejado
  // cónico, torreón con bandera ondeante, puerta con rastrillo y
  // puente levadizo. Animado por frame: bandera, antorchas, humo y
  // los estados de daño según las vidas restantes.
  drawCastle(c) {
    var bx = (this.map.castle[0]) * CONFIG.CELL, by = (this.map.castle[1]) * CONFIG.CELL;
    var CW = CONFIG.CELL * 4;
    var wh = CONFIG.CELL * 1.5;
    var hp = this.lives / this.map.startLives;
    var t = this.time;
    var vs = by < 160 ? 0.6 : 1; // mapas con el castillo en la franja alta
    var i;
    var themeStones = {
      plains: ['#9aa3b2', '#6e7686', '#c2c9d6', '#3e4a68'],
      desert: ['#c4a86a', '#96803e', '#ddd0a0', '#705828'],
      forest: ['#7a8a6a', '#5a6a4a', '#a0b090', '#2e3a20'],
      frozen: ['#b0c8dc', '#8aa0b4', '#d8e8f4', '#4a6a8a'],
      void: ['#6a5080', '#4a3060', '#9a70b8', '#2a1840']
    };
    var ts = themeStones[this.map.theme] || themeStones.plains;
    var stone = ts[0], stoneD = ts[1], stoneL = ts[2];
    var roof = ts[3], roofL = '#5a6a92';

    // sombra de cimientos
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(bx + CW / 2, by + wh + 3, CW * 0.62, 7, 0, 0, 6.28); c.fill();

    // ===== TORRES LATERALES (tejado cónico + gallardete) =====
    for (var tt = 0; tt < 2; tt++) {
      var tx = bx + (tt ? CW - 26 : -2);
      var th2 = 58 * vs;
      var tg = c.createLinearGradient(tx, 0, tx + 28, 0);
      tg.addColorStop(0, stoneL); tg.addColorStop(0.5, stone); tg.addColorStop(1, stoneD);
      c.fillStyle = tg;
      c.beginPath(); c.roundRect(tx, by - th2, 28, th2 + wh * 0.45, 3); c.fill();
      c.strokeStyle = 'rgba(20,24,34,0.5)'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.14)';
      for (i = 1; i <= 3; i++) {
        c.beginPath(); c.moveTo(tx + 2, by - th2 + i * th2 / 3.4); c.lineTo(tx + 26, by - th2 + i * th2 / 3.4); c.stroke();
      }
      // almenas de la torre
      c.fillStyle = stoneD;
      for (i = 0; i < 3; i++) c.fillRect(tx + 2 + i * 9, by - th2 - 7, 6, 8);
      // tejado cónico
      var rg = c.createLinearGradient(tx, by - th2 - 30 * vs, tx, by - th2);
      rg.addColorStop(0, roofL); rg.addColorStop(1, roof);
      c.fillStyle = rg;
      c.beginPath();
      c.moveTo(tx - 3, by - th2 - 6);
      c.lineTo(tx + 14, by - th2 - 30 * vs);
      c.lineTo(tx + 31, by - th2 - 6);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(16,20,30,0.6)'; c.stroke();
      // remate + gallardete ondeante
      c.strokeStyle = '#2e3648'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(tx + 14, by - th2 - 30 * vs); c.lineTo(tx + 14, by - th2 - 36 * vs); c.stroke();
      var pw = Math.sin(t * 3 + tt * 1.7) * 2;
      c.fillStyle = '#c03030';
      c.beginPath();
      c.moveTo(tx + 14, by - th2 - 36 * vs);
      c.quadraticCurveTo(tx + 22, by - th2 - 35 * vs + pw, tx + 27, by - th2 - 33 * vs + pw);
      c.lineTo(tx + 14, by - th2 - 30.5 * vs);
      c.closePath(); c.fill();
      // aspilleras con luz
      c.fillStyle = '#141824';
      c.fillRect(tx + 12, by - th2 + 12, 4, 10);
      c.fillRect(tx + 12, by - th2 + 30, 4, 10);
      c.fillStyle = 'rgba(255,220,130,0.85)';
      c.fillRect(tx + 13, by - th2 + 13, 2, 4);
    }

    // ===== MURALLA (sillares con juntas alternas) =====
    var kg = c.createLinearGradient(bx, 0, bx + CW, 0);
    kg.addColorStop(0, stoneD); kg.addColorStop(0.5, stone); kg.addColorStop(1, stoneD);
    c.fillStyle = kg;
    c.fillRect(bx, by, CW, wh);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 1;
    var rowH = 10;
    for (i = 1; i * rowH < wh; i++) {
      c.beginPath(); c.moveTo(bx, by + i * rowH); c.lineTo(bx + CW, by + i * rowH); c.stroke();
      var off = (i % 2) * 10;
      for (var vxx = off; vxx < CW; vxx += 20) {
        c.beginPath(); c.moveTo(bx + vxx, by + (i - 1) * rowH); c.lineTo(bx + vxx, by + i * rowH); c.stroke();
      }
    }
    // almenas (con su sombra y su bisel)
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(bx, by, CW, 3);
    c.fillStyle = stoneD;
    for (i = 0; i < 8; i++) c.fillRect(bx + i * 20 + 2, by - 11, 13, 12);
    c.fillStyle = stoneL;
    for (i = 0; i < 8; i++) c.fillRect(bx + i * 20 + 2, by - 11, 13, 3);
    // almena derrumbada al perder vida
    if (hp < 0.5) {
      c.fillStyle = stone;
      c.fillRect(bx + 122, by - 11, 13, 12);
      c.fillStyle = stoneD;
      c.beginPath();
      c.moveTo(bx + 122, by);
      c.lineTo(bx + 122, by - 6); c.lineTo(bx + 126, by - 10); c.lineTo(bx + 129, by - 5);
      c.lineTo(bx + 132, by - 8); c.lineTo(bx + 135, by - 3); c.lineTo(bx + 135, by);
      c.closePath(); c.fill();
      c.fillStyle = stoneD;
      c.beginPath(); c.ellipse(bx + 129, by + 4, 5, 2.4, 0, 0, 6.28); c.fill();
    }

    // ===== TORREÓN CENTRAL =====
    var kw = 52, kx = bx + CW / 2 - kw / 2, kh = 84 * vs;
    var kg2 = c.createLinearGradient(kx, 0, kx + kw, 0);
    kg2.addColorStop(0, stoneL); kg2.addColorStop(0.5, '#aab3c2'); kg2.addColorStop(1, stoneD);
    c.fillStyle = kg2;
    c.fillRect(kx, by - kh, kw, kh + 6);
    c.strokeStyle = 'rgba(20,24,34,0.5)'; c.lineWidth = 1;
    c.strokeRect(kx, by - kh, kw, kh + 6);
    c.strokeStyle = 'rgba(0,0,0,0.14)';
    for (i = 1; i <= 4; i++) {
      c.beginPath(); c.moveTo(kx, by - kh + i * kh / 4.6); c.lineTo(kx + kw, by - kh + i * kh / 4.6); c.stroke();
    }
    // almenas del torreón
    c.fillStyle = stoneD;
    for (i = 0; i < 5; i++) c.fillRect(kx + 2 + i * 10, by - kh - 8, 7, 9);
    c.fillStyle = stoneL;
    for (i = 0; i < 5; i++) c.fillRect(kx + 2 + i * 10, by - kh - 8, 7, 2.6);
    // ventana geminada iluminada
    c.fillStyle = '#141824';
    c.beginPath(); c.roundRect(kx + kw / 2 - 12, by - kh + 16, 24, 26, 4); c.fill();
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.roundRect(kx + kw / 2 - 9, by - kh + 19, 8, 20, 3); c.fill();
    c.beginPath(); c.roundRect(kx + kw / 2 + 1, by - kh + 19, 8, 20, 3); c.fill();
    c.fillStyle = 'rgba(255,210,74,0.22)';
    c.beginPath(); c.arc(kx + kw / 2, by - kh + 30, 18, 0, 6.28); c.fill();
    // chimenea con humo
    c.fillStyle = stoneD;
    c.fillRect(kx + kw - 6, by - kh - 16 * vs, 8, 12);
    for (i = 0; i < 3; i++) {
      var ph2 = (t * 0.5 + i * 0.33) % 1;
      c.globalAlpha = (1 - ph2) * 0.3;
      c.fillStyle = '#b8bcc8';
      c.beginPath(); c.arc(kx + kw - 2 + Math.sin(t * 1.4 + i * 2) * 3, by - kh - 18 * vs - ph2 * 16, 2 + ph2 * 4, 0, 6.28); c.fill();
    }
    c.globalAlpha = 1;
    // asta + bandera real ondeante
    var fx0 = kx + kw / 2, fy0 = by - kh - 8;
    c.strokeStyle = '#4a3a24'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(fx0, fy0); c.lineTo(fx0, fy0 - 30 * vs); c.stroke();
    c.fillStyle = '#e0b84a';
    c.beginPath(); c.arc(fx0, fy0 - 30 * vs, 2.2, 0, 6.28); c.fill();
    var w1 = Math.sin(t * 3.2) * 2.4, w2 = Math.sin(t * 3.2 - 0.9) * 3.2;
    c.fillStyle = '#b02828';
    c.beginPath();
    c.moveTo(fx0, fy0 - 30 * vs);
    c.quadraticCurveTo(fx0 + 12, fy0 - 29 * vs + w1, fx0 + 24, fy0 - 27 * vs + w2);
    c.lineTo(fx0 + 24, fy0 - 21 * vs + w2);
    c.quadraticCurveTo(fx0 + 12, fy0 - 23 * vs + w1, fx0, fy0 - 24 * vs);
    c.closePath(); c.fill();
    c.fillStyle = '#e0b84a';
    c.beginPath(); c.arc(fx0 + 8, fy0 - 25.5 * vs + w1 * 0.6, 2.2, 0, 6.28); c.fill();

    // ===== PUERTA CON RASTILLO Y PUENTE LEVADIZO =====
    var gw = 30, gx = bx + CW / 2;
    var dg = c.createLinearGradient(gx, by + wh - 40, gx, by + wh);
    dg.addColorStop(0, '#232333'); dg.addColorStop(1, '#0d0d16');
    c.fillStyle = dg;
    c.beginPath();
    c.moveTo(gx - gw / 2, by + wh);
    c.lineTo(gx - gw / 2, by + wh - 26);
    c.arc(gx, by + wh - 26, gw / 2, Math.PI, 0);
    c.lineTo(gx + gw / 2, by + wh);
    c.closePath(); c.fill();
    // rastrillo bajado
    c.strokeStyle = 'rgba(190,196,210,0.8)'; c.lineWidth = 1.8;
    for (i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(gx + i * gw / 5, by + wh - 40); c.lineTo(gx + i * gw / 5, by + wh); c.stroke();
    }
    c.lineWidth = 1.4;
    for (i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(gx - gw / 2, by + wh - 30 + i * 10); c.lineTo(gx + gw / 2, by + wh - 30 + i * 10); c.stroke();
    }
    // marco del arco
    c.strokeStyle = stoneD; c.lineWidth = 4;
    c.beginPath(); c.arc(gx, by + wh - 26, gw / 2 + 2, Math.PI, 0); c.stroke();
    // puente levadizo de madera con cadenas
    var bw = gw / 2 + 4;
    c.fillStyle = '#6a4a28';
    c.beginPath();
    c.moveTo(gx - bw, by + wh);
    c.lineTo(gx + bw, by + wh);
    c.lineTo(gx + bw + 8, by + wh + 15);
    c.lineTo(gx - bw - 8, by + wh + 15);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,20,10,0.6)'; c.lineWidth = 1;
    for (i = 1; i <= 3; i++) {
      var plx = gx - bw - 8 + (2 * bw + 16) * i / 4;
      c.beginPath(); c.moveTo(plx, by + wh); c.lineTo(plx, by + wh + 15); c.stroke();
    }
    c.strokeStyle = 'rgba(40,40,48,0.8)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(gx - bw + 1, by + wh - 20); c.lineTo(gx - bw - 7, by + wh + 12); c.stroke();
    c.beginPath(); c.moveTo(gx + bw - 1, by + wh - 20); c.lineTo(gx + bw + 7, by + wh + 12); c.stroke();

    // ===== VENTANAS Y ANTORCHAS DE LA MURALLA =====
    for (i = 0; i < 2; i++) {
      var wx = i ? bx + CW - 20 : bx + 12;
      c.fillStyle = '#141824';
      c.beginPath(); c.roundRect(wx, by + 14, 8, 12, 2); c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.roundRect(wx + 1.5, by + 16, 5, 9, 1.5); c.fill();
    }
    for (i = 0; i < 2; i++) {
      var ax2 = gx + (i ? 26 : -26), ay2 = by + wh - 24;
      c.strokeStyle = '#3a2c18'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ax2, ay2 + 6); c.lineTo(ax2, ay2); c.stroke();
      var fl2 = 0.7 + 0.3 * Math.sin(t * 9 + i * 2.4);
      c.fillStyle = 'rgba(255,140,40,' + (0.28 * fl2) + ')';
      c.beginPath(); c.arc(ax2, ay2 - 3, 6.5 * fl2, 0, 6.28); c.fill();
      c.fillStyle = '#ff8a2a';
      c.beginPath(); c.arc(ax2, ay2 - 3, 2.6 * fl2, 0, 6.28); c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(ax2, ay2 - 3.8, 1.2 * fl2, 0, 6.28); c.fill();
    }

    // ===== DAÑOS DEL ASEDIO =====
    if (hp < 0.66) {
      c.strokeStyle = 'rgba(20,16,10,0.65)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(bx + CW * 0.3, by + 8); c.lineTo(bx + CW * 0.36, by + 22); c.lineTo(bx + CW * 0.31, by + 36); c.stroke();
      c.beginPath(); c.moveTo(bx + CW * 0.72, by + 16); c.lineTo(bx + CW * 0.66, by + 30); c.lineTo(bx + CW * 0.7, by + 46); c.stroke();
      c.beginPath(); c.moveTo(kx + 8, by - kh + 30); c.lineTo(kx + 14, by - kh + 44); c.stroke();
    }
    if (hp < 0.33) {
      c.fillStyle = 'rgba(30,22,12,0.7)';
      c.fillRect(bx + 2, by + 2, CW - 4, 6);
      c.fillRect(bx + 2, by + 40, CW - 4, 5);
      for (i = 0; i < 3; i++) {
        var fx2 = bx + CW * (0.2 + 0.3 * i) + Math.sin(t * 5 + i * 2) * 2;
        var fy2 = by + wh - 4;
        c.fillStyle = '#ff7a3a';
        c.beginPath(); c.arc(fx2, fy2, 3.2, 0, 6.28); c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(fx2, fy2 - 1.6, 1.7, 0, 6.28); c.fill();
      }
    }
    // destello rojo al recibir daño
    if (this.castleHit > 0) {
      c.globalAlpha = Math.max(0, this.castleHit / 0.5) * 0.5;
      c.fillStyle = '#ff4040';
      c.fillRect(bx - 6, by - kh - 40 * vs, CW + 12, kh + wh + 44 * vs);
      c.globalAlpha = 1;
    }

    // barra de vida del castillo
    var barW = Math.round(CW * 0.6), barH = 5;
    var barX = bx + CW / 2 - barW / 2, barY = by - kh - 22 * vs;
    c.fillStyle = 'rgba(0,0,0,0.62)';
    c.beginPath(); c.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3); c.fill();
    c.fillStyle = 'rgba(80,20,20,0.78)';
    c.beginPath(); c.roundRect(barX, barY, barW, barH, 2); c.fill();
    var hpCol = hp > 0.6 ? '#44cc44' : (hp > 0.3 ? '#cccc44' : '#cc4444');
    c.fillStyle = hpCol;
    if (hp > 0) {
      c.beginPath(); c.roundRect(barX, barY, Math.max(2, barW * Math.min(1, hp)), barH, 2); c.fill();
    }
  }

  drawRange(t) {
    var ctx = this.ctx;
    var range = t.effectiveRange || t.range;
    var col = (t.def && t.def.color) || '#ffffff';
    ctx.save();
    ctx.beginPath();
    ctx.arc(t.x, t.y, range, 0, 6.28);
    // relleno suave del área
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = col;
    ctx.fill();
    // anillo oscuro de contraste (legible sobre cualquier fondo)
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // anillo de color animado: rota para destacar incluso en medio de
    // explosiones, novas y otros efectos de habilidad
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -((this.time * 26) % 24);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  render() {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    // Sacudida de pantalla: desplaza el mundo; la barra de jefes queda estable
    ctx.save();
    if (this.shake > 0.2) {
      var sMag = Math.min(this.shake, 12) * 0.9;
      ctx.translate((Math.random() - 0.5) * sMag * 2, (Math.random() - 0.5) * sMag * 2);
      ctx.fillStyle = '#151310';
      ctx.fillRect(-24, -24, CONFIG.WIDTH + 48, CONFIG.HEIGHT + 48);
    }
    ctx.drawImage(this.bg, 0, 0);
    // capa ambiental viva (bajo las unidades)
    this.drawAmbient(ctx);

    // portal y castillo (animados por frame)
    this.drawPortal(ctx);
    this.drawCastle(ctx);

    // animated portal glow
    var gp = 0.5 + 0.5 * Math.sin(this.time * 3);
    var gpx = (this.map.portal[0] + 0.5) * CONFIG.CELL, gpy = (this.map.portal[1] + 0.5) * CONFIG.CELL;
    var gg2 = ctx.createRadialGradient(gpx, gpy, 2, gpx, gpy, 34);
    gg2.addColorStop(0, 'rgba(255,235,150,' + (0.35 + gp * 0.4) + ')');
    gg2.addColorStop(1, 'rgba(150,70,190,0)');
    ctx.fillStyle = gg2;
    ctx.beginPath(); ctx.ellipse(gpx, gpy, 30, 36, 0, 0, 6.28); ctx.fill();
    // rising portal sparks
    for (var sp = 0; sp < 3; sp++) {
      var sphase = ((this.time * 0.6 + sp * 0.34) % 1);
      ctx.fillStyle = 'rgba(255,240,190,' + (0.6 * (1 - sphase)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(gpx + Math.sin(this.time * 2 + sp * 2) * 8, gpy + 12 - sphase * 30, 1.5, 0, 6.28); ctx.fill();
    }
    // feature shimmer (lake / oasis / pool / glacier)
    var fpx = (this.map.featurePos[0] + 0.5) * CONFIG.CELL, fpy = (this.map.featurePos[1] + 0.5) * CONFIG.CELL;
    for (var lm = 0; lm < 3; lm++) {
      var lph = (this.time * 0.5 + lm * 0.3) % 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (0.5 - Math.abs(lph - 0.5))).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(fpx - 24 + lm * 24 + Math.sin(this.time + lm * 3) * 4, fpy + (lm % 2) * 12, 6, 2, 0, 0, 6.28); ctx.fill();
    }

    this.drawCorruption();

    if (this.placing && this.mouse.inside) {
      var c = this.mouse.c, r = this.mouse.r;
      var ok = this.canPlace(c, r);
      var gx = (c + 0.5) * CONFIG.CELL, gy = (r + 0.5) * CONFIG.CELL;
      var def = TOWERS[this.placing];
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = ok ? 'rgba(120,220,120,0.9)' : 'rgba(220,80,80,0.9)';
      ctx.beginPath(); ctx.arc(gx, gy, def.range, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ok ? '#7ad47f' : '#e05050';
      ctx.beginPath(); ctx.arc(gx, gy, CONFIG.CELL * 0.42, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#7ad47f' : '#e05050';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * CONFIG.CELL + 1, r * CONFIG.CELL + 1, CONFIG.CELL - 2, CONFIG.CELL - 2);
    }

    var sel = this.selected;
    var hover = this.hovered;
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i] === sel || this.towers[i] === hover) this.drawRange(this.towers[i]);
    }
    for (var j = 0; j < this.towers.length; j++) this.towers[j].draw(ctx, this);
    for (var k = 0; k < this.enemies.length; k++) this.enemies[k].draw(ctx, this);
    for (var sd = 0; sd < this.soldiers.length; sd++) this.soldiers[sd].draw(ctx);
    for (var m = 0; m < this.projectiles.length; m++) this.projectiles[m].draw(ctx);
    this.drawLightning(ctx);

    for (var n = 0; n < this.particles.length; n++) {
      var p = this.particles[n];
      var al = Math.max(0, p.life / p.max);
      if (p.kind === 'ring') {
        var rr = p.size + (p.r1 - p.size) * (1 - p.life / p.max);
        ctx.globalAlpha = al * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.28); ctx.stroke();
        if (al > 0.5) {
          ctx.globalAlpha = (al - 0.5) * 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr * 0.7, 0, 6.28); ctx.stroke();
        }
        continue;
      }
      if (p.kind === 'flash') {
        var fsz = p.size * (1.4 - al * 0.4);
        ctx.globalAlpha = al * 0.6;
        var fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, fsz);
        fg.addColorStop(0, p.color);
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(p.x, p.y, fsz, 0, 6.28); ctx.fill();
        ctx.globalAlpha = al;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, fsz * 0.3, 0, 6.28); ctx.fill();
        continue;
      }
      if (p.kind === 'smoke') {
        var smSz = p.size * (2 - al);
        ctx.globalAlpha = al * 0.25;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, smSz, 0, 6.28); ctx.fill();
        ctx.globalAlpha = al * 0.1;
        ctx.beginPath(); ctx.arc(p.x, p.y, smSz * 1.3, 0, 6.28); ctx.fill();
        continue;
      }
      ctx.globalAlpha = al;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill();
      var sp2 = Math.hypot(p.vx || 0, p.vy || 0);
      if (sp2 > 40 && al > 0.2) {
        ctx.globalAlpha = al * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx || 0) * 0.045, p.y - (p.vy || 0) * 0.045);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (var q = 0; q < this.texts.length; q++) {
      var t = this.texts[q];
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      ctx.fillStyle = t.color;
      ctx.font = 'bold ' + (t.size || 12) + 'px Georgia, serif';
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    this.drawBossBars(ctx);
    if (typeof WEATHER !== 'undefined' && WEATHER.drawOverlay) WEATHER.drawOverlay(ctx, this);
  }

  drawBossBars(ctx) {
    var idx = 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.boss || !e.alive) continue;
      var x = CONFIG.WIDTH / 2 - 160;
      var y = 16 + idx * 24;
      idx++;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 2, y - 2, 324, 18);
      ctx.strokeStyle = '#f2c86a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, 324, 18);
      var pct = Math.max(0, e.hp / e.hpMax);
      var grad = ctx.createLinearGradient(x, 0, x + 320, 0);
      grad.addColorStop(0, '#e05050');
      grad.addColorStop(1, '#c02020');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 320 * pct, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 ' + e.name + ' — ' + Math.floor(pct * 100) + '%', CONFIG.WIDTH / 2, y + 12);
    }
  }
}
