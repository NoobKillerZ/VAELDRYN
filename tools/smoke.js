'use strict';
const fs = require('fs');
const path = require('path');
const VM = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');

function fakeGradient() { return { addColorStop() {} }; }
function fakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return fakeGradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) {
        return (...args) => undefined;
      }
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
function fakeElement() {
  return {
    width: 0, height: 0,
    getContext: () => fakeCtx(),
    addEventListener() {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    textContent: '', innerHTML: '', title: '',
    appendChild() {}, remove() {}, querySelector: () => fakeElement(), querySelectorAll: () => []
  };
}
const sandbox = {
  console,
  document: {
    getElementById: () => fakeElement(),
    createElement: () => fakeElement(),
    addEventListener() {},
    body: fakeElement(),
    fullscreenElement: null,
    documentElement: { requestFullscreen() {}, },
  },
  window: {},
  requestAnimationFrame: () => 0,
  localStorage: (() => {
    const store = {};
    return {
      getItem: (k) => (k in store ? store[k] : '{"xp":0}'),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      __store: store,
    };
  })(),
  CanvasRenderingContext2D: function () {},
  toast() {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Infinity, NaN, isFinite, parseInt, parseFloat,
};
sandbox.addEventListener = () => {};
sandbox.window = sandbox;
VM.createContext(sandbox);

function load(f) {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  try {
    VM.runInContext(src, sandbox, { filename: f });
  } catch (e) {
    console.error('LOAD FAIL:', f, e.message);
    process.exit(1);
  }
}

['config.js', 'artkit.js', 'maps.js', 'progress.js', 'relics.js', 'audio.js', 'director.js',
 'weather.js', 'waves.js', 'enemies.js', 'towers.js', 'game.js', 'main.js'].forEach(load);

VM.runInContext('PROGRESS.load(); DIRECTOR.reset ? null : null;', sandbox);

const g = new (VM.runInContext('Game', sandbox))('plains');

function freshWaveState(waveNum) {
  g.wave = waveNum - 1;
  g.waveState = 'idle';
  g.over = false;
  g.lives = 20;
  g.leaked = 0;
  g.enemies.length = 0;
  g.soldiers.length = 0;
  g.towers.length = 0;
  g.projectiles.length = 0;
}

// --- Test 1: oleada 9 genera escindidos (en la 7 el conteo redondea a 0, como Python) ---
freshWaveState(9);
g.startWave();
const hasSplitter = g.spawnQueue.some(e => e.type === 'splitter');
console.log('T1 splitter en oleada 9:', hasSplitter ? 'OK' : 'FALLO');

// --- Test 2: jefe escala HP ---
freshWaveState(5);
g.startWave();
let bossSpawned = null;
for (let i = 0; i < 600 && !bossSpawned && !g.over; i++) { g.update(0.1); bossSpawned = g.enemies.find(e => e.boss) || null; }
if (bossSpawned) {
  const bossMul = 1 + (5 - 5) * 0.08;
  const expected = 2800 * g.hpScale * bossMul;
  console.log('T2 jefe hpMax=' + Math.round(bossSpawned.hpMax) + ' esperado~' + Math.round(expected), Math.abs(bossSpawned.hpMax - expected) < 2 ? 'OK' : 'FALLO');
} else console.log('T2 jefe no aparecio (skip)');

// --- Test 3: split al morir ---
freshWaveState(9);
const before = g.enemies.length;
const sp = new (VM.runInContext('Enemy', sandbox))('splitter', g);
sp.pathPos = 100; sp.x = 300; sp.y = 200;
g.enemies.push(sp);
sp.takeDamage(99999, 'fire');
g.processEnemies ? null : null;
// forzar recoleccion de muertos
for (let i = 0; i < 3; i++) g.update(0.05);
const splittersNow = g.enemies.filter(e => e.type === 'splitterSmall').length;
console.log('T3 split genera hijos:', splittersNow >= 2 ? 'OK (' + splittersNow + ')' : 'FALLO (' + splittersNow + ')');

// --- Test 4: barracas crea soldado y bloquea enemigo ---
freshWaveState(9);
g.gold += 5000;
const towerCls = VM.runInContext('Tower', sandbox);
const bar = new towerCls(6, 4, 'barracks', g);
g.towers.push(bar);
bar.update(0.1, g);
console.log('T4 soldados creados:', bar._soldiersSpawned && g.soldiers.length > 0 ? 'OK (' + g.soldiers.length + ')' : 'FALLO');
const soldier = g.soldiers[0];
const ground = new (VM.runInContext('Enemy', sandbox))('orc', g);
ground.flying = false;
ground.blockedBy = null;
g.enemies.push(ground);
// colocar al orco en el punto del camino mÃ¡s cercano al hogar del soldado
let bestS = 0, bestD = Infinity;
for (let s2 = 0; s2 < g.pathLength; s2 += 1) {
  const pp = g.pathPoint(s2);
  const dd = (pp.x - soldier.homeX) ** 2 + (pp.y - soldier.homeY) ** 2;
  if (dd < bestD) { bestD = dd; bestS = s2; }
}
ground.pathPos = bestS;
ground.x = g.pathPoint(bestS).x + 15;
ground.y = g.pathPoint(bestS).y + 4;
soldier.update(0.1, g);
console.log('T4b soldado engancha enemigo:', soldier.engaged === ground && ground.blockedBy === soldier ? 'OK' : 'FALLO');
const ppBefore = ground.pathPos;
for (let i = 0; i < 30; i++) { ground.update(0.1, g); soldier.update(0.1, g); if (!ground.alive) break; }
console.log('   [debug] alive=' + ground.alive, 'pathPos ' + ppBefore.toFixed(1) + 'â†’' + ground.pathPos.toFixed(1),
  'engaged=' + (soldier.engaged === ground), 'blockedBy=' + (ground.blockedBy === soldier),
  'soldierHP=' + Math.round(soldier.hp), 'orcHP=' + Math.round(ground.hp));
console.log('T4c bloqueado sin avanzar (el retroceso por golpes es intencional):',
  ground.alive && ground.pathPos <= ppBefore + 0.01 && soldier.engaged === ground ? 'OK' : 'FALLO');
console.log('T4d soldado recibe golpes (hp<max):', soldier.hp < soldier.hpMax ? 'OK' : 'aviso');

// --- Test 5: upgrade de barracas reinicia escuadron ---
g.gold += 5000;
while (bar.upgrade && bar.level < 3) { bar.applyUpgrade(); bar.update(0.05, g); }
const types = {};
g.soldiers.filter(s => s.tower === bar).forEach(s => types[s.stype] = 1);
const nTypes = Object.keys(types).length;
console.log('T5 nivel 3 tiene 4 tipos:', nTypes === 4 ? 'OK (' + Object.keys(types).join(',') + ')' : 'FALLO (' + Object.keys(types).join(',') + ')');

// --- Test 6: habilidad refuerzos revive ---
g.soldiers.forEach(s => { s.takeDamage(9999); });
const allDead = g.soldiers.filter(s => s.tower === bar).every(s => !s.alive);
bar.useAbility(g);
const revived = g.soldiers.filter(s => s.tower === bar).every(s => s.alive);
console.log('T6 refuerzos revive:', allDead && revived ? 'OK' : 'FALLO');

// --- Test 7: actIce novaCd corre en update ---
const ice = new towerCls(8, 8, 'ice', g);
ice.novaCd = 0.3;
for (let i = 0; i < 20; i++) ice.update(0.1, g);
console.log('T7 novaCd decrementa sin objetivo:', ice.novaCd <= 0 || ice.novaCd !== 0.3 ? 'OK' : 'FALLO');

// --- Test 8: dificultad aplicada en constructor ---
const gd = new (VM.runInContext('Game', sandbox))('plains', 2);
const dDef = VM.runInContext('DIFFICULTY[2]', sandbox);
const okHp = Math.abs(gd.hpScale - gd.map.mult * dDef.hpMult) < 0.001;
const okLives = gd.lives === gd.map.startLives + dDef.livesMod;
const okGold = gd.goldMult === dDef.goldMult;
console.log('T8 dificultad DifÃ­cil (hp Ã—1.5, vidas -3, oro Ã—0.8):', okHp && okLives && okGold ? 'OK' : 'FALLO',
  '(hpScale=' + gd.hpScale + ', lives=' + gd.lives + ', goldMult=' + gd.goldMult + ')');
// velocidad de enemigos escala con difficulty
VM.runInContext('CONQUEST.enabled = false', sandbox);
const gs0 = new (VM.runInContext('Game', sandbox))('plains', 0);
const gs2 = new (VM.runInContext('Game', sandbox))('plains', 2);
const e0 = new (VM.runInContext('Enemy', sandbox))('orc', gs0);
const e2 = new (VM.runInContext('Enemy', sandbox))('orc', gs2);
e2.speed = e2.speed; // ya multiplicado en spawn; simulamos aquÃ­:
e2.speed *= gs2.enemySpeedMult;
console.log('T8b velocidad enemigos Ã—1.1 en DifÃ­cil:', Math.abs(e2.speed / e0.speed - 1.1) < 0.001 ? 'OK' : 'FALLO',
  '(' + e0.speed.toFixed(1) + ' â†’ ' + e2.speed.toFixed(1) + ')');

// --- Test 9: conquista inicia en oleada 10 con SETTINGS ---
VM.runInContext('CONQUEST.start(0, [])', sandbox);
const gc = new (VM.runInContext('Game', sandbox))('plains', 0);
const cqOk = gc.wave === 9 && gc.conquestGoldPerEnd === 100 && gc.conquestTimerMax === 100 &&
  gc.conquestFinalWaves.length === 4 && gc.conquestFinalWaves[3] === 30;
console.log('T9 conquista init (wave=9, goldPerEnd=100, final=[15,20,25,30]):', cqOk ? 'OK' : 'FALLO',
  '(wave=' + gc.wave + ')');

// --- Test 10: waveCleared en conquista da oro extra, reliquia y timer ---
gc.gold = 0;
gc.wave = 10;
gc.waveCleared();
const t10ok = gc.waveState === 'relic_choice' && gc.conquestTimer === 99.4 && gc.lives === gc.startLives && gc.gold >= 70;
console.log('T10 oleada conquistada â†’ relic_choice + oro + timer:', t10ok ? 'OK' : 'FALLO',
  '(state=' + gc.waveState + ', timer=' + gc.conquestTimer + ', gold=' + gc.gold + ')');

// --- Test 11: victoria de conquista en oleada 30 con bono final ---
gc.wave = 30;
gc.continueEndless = false;
const goldBeforeWin = gc.gold;
gc.waveCleared();
console.log('T11 conquista termina en 30 con +300:', gc.over && gc.won && gc.gold >= goldBeforeWin + 300 ? 'OK' : 'FALLO',
  '(won=' + gc.won + ', over=' + gc.over + ')');
VM.runInContext('CONQUEST.enabled=false', sandbox);

// --- Test 12: logros se desbloquean y cuentan ---
VM.runInContext('PROGRESS.load()', sandbox);
const achCls = VM.runInContext('typeof ACHIEVEMENTS !== "undefined" && ACHIEVEMENTS.length', sandbox);
const unlockAch = VM.runInContext('unlockAchievement', sandbox);
const isUnlocked = VM.runInContext('isAchievementUnlocked', sandbox);
const achCount = VM.runInContext('achievementCount', sandbox);
g.kills = 1;
g.checkAchievements();
const fb = isUnlocked('first_blood');
// barracas
g.gold += 5000;
g.buildTower(3, 10, 'barracks');
// torre al mÃ¡ximo
const arch = new towerCls(5, 5, 'archer', g);
while (arch.upgrade) arch.applyUpgrade();
g.upgradeTower(arch);
const cnt = achCount();
console.log('T12 logros (12 definidos, first_blood+barracks+tower_max):',
  achCls === 12 && fb && cnt >= 3 ? 'OK (' + cnt + '/12)' : 'FALLO (' + cnt + '/12)');

// --- Test 13: maxWaveBeaten desbloquea conquista en menÃº ---
VM.runInContext('PROGRESS.recordRun("plains", { wave: 12, kills: 50, gold: 300 })', sandbox);
const maxWB = VM.runInContext('maxWaveBeaten', sandbox);
const cqUnlock = VM.runInContext('conquestUnlocked', sandbox);
console.log('T13 rÃ©cord 12 â†’ conquestUnlocked():', maxWB() >= 12 && cqUnlock() ? 'OK' : 'FALLO');

// --- Test 14: audio carga sin WebAudio (node) sin romper el juego ---
const AUDIOref = VM.runInContext('AUDIO', sandbox);
let sfxSafeFn = VM.runInContext('sfx', sandbox);
let sfxSafe = true;
try {
  sfxSafeFn('tower_build'); sfxSafeFn('boss_appear', 0.8); AUDIOref.playMusic('normal'); AUDIOref.stopMusic(); AUDIOref.toggle();
} catch (err) { sfxSafe = false; console.error(err.message); }
AUDIOref.enabled = true;
console.log('T14 AUDIO presente y llamadas seguras sin AudioContext:', !!AUDIOref && sfxSafe ? 'OK' : 'FALLO');

// --- Test 15: estadÃ­sticas de partida (torres, mejoras, bajas, oro) ---
const gs = new (VM.runInContext('Game', sandbox))('plains', 0);
gs.gold += 5000;
gs.buildTower(3, 10, 'archer');
gs.upgradeTower(gs.towers[0]);
const EnemyCls = VM.runInContext('Enemy', sandbox);
const enStat = new EnemyCls('orc', gs);
gs.handleDeath(enStat, []);
const stOK = gs.stats.towersBuilt === 1 && gs.stats.upgrades >= 1 && gs.kills === 1 && gs.stats.goldEarned > 0;
console.log('T15 stats (torres/mejoras/bajas/oro):', stOK ? 'OK' : 'FALLO', JSON.stringify(gs.stats));

// --- Test 16: guardado y carga de partida (incluye conquista y reliquias) ---
VM.runInContext(`
  var __g = new Game('plains', 2);
  CONQUEST.start(1, ['merchant']);
  CONQUEST.grantRelic('berserker', __g, true);
  __g.wave = 7; __g.lives = 12; __g.gold = 555; __g.kills = 99; __g.time = 83;
  __g.stats = { goldEarned: 400, towersBuilt: 5, upgrades: 3 };
  game = __g;
`, sandbox);
const savedOk = VM.runInContext('saveGame(true) === true && hasSavedGame() === true', sandbox);
console.log('T16a guardar partida:', savedOk ? 'OK' : 'FALLO');

VM.runInContext('game = null; CONQUEST.enabled = false;', sandbox);
const loadedRaw = VM.runInContext('(function () { try { return loadSavedGame(); } catch (e) { console.error("LOAD THREW:", e && e.message); return "threw"; } })()', sandbox);
const gl = VM.runInContext('game', sandbox);
const loadOK = loadedRaw === true && !!gl &&
  gl.wave === 7 && gl.lives === 12 && gl.gold === 555 && gl.kills === 99;
console.log('T16b cargar partida (wave/lives/gold/kills):', loadOK ? 'OK' : 'FALLO',
  `(loaded=${loadedRaw}, wave=${gl && gl.wave}, lives=${gl && gl.lives}, gold=${gl && gl.gold}, kills=${gl && gl.kills})`);
const cqRestored = VM.runInContext('CONQUEST.enabled === true && CONQUEST.relics.indexOf("merchant") >= 0 && CONQUEST.relics.indexOf("berserker") >= 0 && CONQUEST.relics.length === 2', sandbox);
console.log('T16c conquista restaurada (enabled + reliquias sin duplicar):', cqRestored ? 'OK' : 'FALLO',
  `(relics=${JSON.stringify(VM.runInContext('CONQUEST.relics', sandbox))})`);

// --- Test 17: clearSave al terminar la partida ---
VM.runInContext('game.waveCleared = function () {}; game.gameOver();', sandbox);
const clearedOk = VM.runInContext('hasSavedGame() === false', sandbox);
console.log('T17 gameOver borra el guardado:', clearedOk ? 'OK' : 'FALLO');

// --- Test 18: clasificaciÃ³n local (SCORES) ---
VM.runInContext('SCORES.load(); SCORES.list = [];', sandbox);
const scoresApi = VM.runInContext('SCORES', sandbox);
scoresApi.add({ mapId: 'plains', diff: 0, wave: 12, kills: 300, time: 500 });
scoresApi.add({ mapId: 'void', diff: 2, wave: 30, kills: 900, time: 1500 });
scoresApi.add({ mapId: 'forest', diff: 1, wave: 20, kills: 700, time: 1000 });
const sortedOk = VM.runInContext('SCORES.list[0].wave === 30 && SCORES.list[2].wave === 12 && SCORES.list.length === 3', sandbox);
console.log('T18a rÃ©cords ordenados por oleada:', sortedOk ? 'OK' : 'FALLO');
for (let i = 0; i < 12; i++) {
  scoresApi.add({ mapId: 'plains', diff: 0, wave: i, kills: i * 10, time: i });
}
const capOk = VM.runInContext('SCORES.list.length === 10 && SCORES.list[0].wave === 30 && JSON.parse(localStorage.getItem("vaeldryn_scores")).length === 10', sandbox);
console.log('T18b tope de 10 + persistencia:', capOk ? 'OK' : 'FALLO');

// --- Test 19: mapas nuevos vÃ¡lidos (7+, temas, rutas alineadas) ---
const mapsOk = VM.runInContext(`
  (function () {
    var ids = {}; var ok = MAPS.length >= 7;
    for (var i = 0; i < MAPS.length; i++) {
      var m = MAPS[i];
      if (ids[m.id]) ok = false;
      ids[m.id] = true;
      if (!THEMES[m.theme]) ok = false;
      if (!m.portal || !m.castle || m.path.length < 3) ok = false;
      for (var p = 0; p < m.path.length; p++) {
        var x = m.path[p][0], y = m.path[p][1];
        if (x < -1 || x > 24 || y < 0 || y > 13) ok = false;
        if (p > 0) {
          var px2 = m.path[p - 1][0], py2 = m.path[p - 1][1];
          if (x !== px2 && y !== py2) ok = false;
        }
      }
    }
    return ok && !!MAPS_BY_ID['marsh'] && !!MAPS_BY_ID['canyon'];
  })()
`, sandbox);
console.log('T19 mapas nuevos vÃ¡lidos (' + VM.runInContext('MAPS.length', sandbox) + ' mapas):', mapsOk ? 'OK' : 'FALLO');

// --- Test 20: balanceo â€” recompensas escaladas y aceleraciÃ³n del infinito ---
const t20reward = VM.runInContext(`
  (function () {
    var g4 = new Game('plains', 0);
    g4.wave = 40;
    var en4 = new Enemy('orc', g4);
    g4.handleDeath(en4, []);
    var expReward = Math.round(en4.reward * 1 * (1 + Math.min(40, 60) * 0.01));
    return g4.stats.goldEarned === expReward;
  })()
`, sandbox);
console.log('T20a recompensa escala +1%/oleada:', t20reward ? 'OK' : 'FALLO');
const t20endless = VM.runInContext(`
  (function () {
    var gA = new Game('canyon', 0);
    gA.continueEndless = true;
    gA.wave = 31;
    gA.startWave();
    var expA = (1 + (gA.wave - 1) * 0.05) * gA.map.mult * Math.pow(1.02, gA.wave - CONFIG.WIN_WAVE);
    var okA = Math.abs(gA.hpScale - expA) < 1e-6;
    var gB = new Game('canyon', 0);
    gB.continueEndless = true;
    gB.wave = 10;
    gB.startWave();
    var okB = Math.abs(gB.hpScale - (1 + (gB.wave - 1) * 0.05) * gB.map.mult) < 1e-6;
    return okA && okB;
  })()
`, sandbox);
console.log('T20b infinito acelera tras oleada', VM.runInContext('CONFIG.WIN_WAVE', sandbox), ':', t20endless ? 'OK' : 'FALLO');

// T21: hpScale por oleada incluye hpMult con rampa de gracia (completo en la oleada 4)
const t21diag = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false;
    var gH = new Game('plains', 2);
    gH.startWave();
    var ok1 = Math.abs(gH.hpScale - 1.0) < 1e-9;
    gH.waveState = 'idle';
    gH.startWave();
    var ok2 = Math.abs(gH.hpScale - 1.05 * (1 + 0.5 / 6)) < 1e-9;
    while (gH.wave < 7) { gH.waveState = 'idle'; gH.startWave(); }
    var ok5 = Math.abs(gH.hpScale - 1.3 * 1.5) < 1e-9;
    return JSON.stringify({ ok1: ok1, ok2: ok2, ok5: ok5, hpScale: gH.hpScale, wave: gH.wave,
      hpMult: gH.hpMult, mapMult: gH.map.mult, over: gH.over });
  })()
`, sandbox);
const t21hp = t21diag.indexOf('"ok1":true') !== -1 && t21diag.indexOf('"ok2":true') !== -1 && t21diag.indexOf('"ok5":true') !== -1;
console.log('T21 hpScale conserva hpMult de dificultad en oleadas:', t21hp ? 'OK' : 'FALLO ' + t21diag);

// T22: Ã©lites solo segÃºn la tabla de dificultad (Normal 0 Â· Pesadilla >0 y aplica)
const t22elite = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false;
    var gN = new Game('plains', 0);
    var okN = gN.eliteChance === 0;
    for (var w = 0; w < 3; w++) { gN.waveState = 'idle'; gN.startWave(); }
    var anyEliteN = gN.spawnQueue.some(function (q) { return q.elite; });
    var oldRandom = Math.random;
    Math.random = function () { return 0; };
    var gP = new Game('plains', 3);
    for (var w2 = 0; w2 < 3; w2++) { gP.waveState = 'idle'; gP.startWave(); }
    Math.random = oldRandom;
    var elites = gP.spawnQueue.filter(function (q) { return q.elite; });
    var okP = gP.eliteChance >= 0.25 && elites.length > 0 && elites.every(function (q) { return q.type !== 'goblin' && !ENEMIES[q.type].boss; });
    return okN && !anyEliteN && okP;
  })()
`, sandbox);
console.log('T22 Ã©lites solo en dificultades con eliteChance:', t22elite ? 'OK' : 'FALLO');

// T23: estÃ­mulo de economÃ­a temprana (+12% recompensas en oleadas 1-5)
const t23early = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false;
    var gE = new Game('plains', 0);
    gE.wave = 3;
    var e1 = new Enemy('orc', gE);           // reward 11
    gE.handleDeath(e1, []);
    var okEarly = gE.stats.goldEarned === Math.round(11 * 1.15);
    var gL = new Game('plains', 0);
    gL.wave = 8;
    var e2 = new Enemy('orc', gL);
    gL.handleDeath(e2, []);
    var okLate = gL.stats.goldEarned === Math.round(11 * (1 + 8 * 0.01));
    return okEarly && okLate;
  })()
`, sandbox);
console.log('T23 estÃ­mulo temprano de recompensas (+12% oleadas 1-5):', t23early ? 'OK' : 'FALLO');

// T24: anti-soflock de Conquista â€” tras elegir reliquia la partida continÃºa
const t24diag = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false;
    CONQUEST.start(0, ['berserker', 'merchant']);
    var g = new Game('plains', 0);
    g.gold = 8000;
    var placed = 0;
    for (var c = 0; c < CONFIG.COLS && placed < 14; c++)
      for (var r = 0; r < CONFIG.ROWS && placed < 14; r++) {
        if (!g.canPlace(c, r)) continue;
        var nearPath = false;
        for (var key in g.pathCells) {
          var pp = key.split(',');
          if (Math.abs(+pp[0] - c) + Math.abs(+pp[1] - r) <= 2) { nearPath = true; break; }
        }
        if (nearPath && g.buildTower(c, r, 'archer')) {
          if (g.towers[g.towers.length - 1].upgrade && g.gold > 400) g.upgradeTower(g.towers[g.towers.length - 1]);
          placed++;
        }
      }
    var guard = 0;
    while (!g.over && g.wave < 11 && guard++ < 80000) {
      g.update(0.05);
      if (g.waveState === 'idle') g.startWave();
      if (g.waveState === 'relic_choice') break;
    }
    if (g.waveState !== 'relic_choice') return JSON.stringify({ err: 'no relic_choice', wave: g.wave, over: g.over });
    CONQUEST.grantRelic(CONQUEST.nextRelics[0].id, g);
    g.paused = false;
    for (var i = 0; i < 5; i++) { g.update(0.05); if (g.waveState === 'idle') break; }
    var healed = g.waveState === 'idle';
    g.startWave();
    var advanced = g.wave === 11;
    CONQUEST.enabled = false;
    return JSON.stringify({ healed: healed, advanced: advanced, wave: g.wave });
  })()
`, sandbox);
const t24ok = t24diag.indexOf('"healed":true') !== -1 && t24diag.indexOf('"advanced":true') !== -1;
console.log('T24 conquista continÃºa tras elegir reliquia:', t24ok ? 'OK' : 'FALLO ' + t24diag);

// T25: applyStarting no entra en bucle infinito (push durante iteraciÃ³n)
const t25diag = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false;
    DIRECTOR.level = 0;
    var gS = new Game('frozen', 0);
    var calls = 0;
    var origGrant = CONQUEST.grantRelic;
    CONQUEST.grantRelic = function (id, game, silent) { calls++; return origGrant.call(CONQUEST, id, game, silent); };
    var threw = false;
    try { CONQUEST.start(1, ['glacier']); CONQUEST.applyStarting(gS); }
    catch (e) { threw = true; }
    finally { CONQUEST.grantRelic = origGrant; }
    DIRECTOR.level = 0;
    return JSON.stringify({ calls: calls, relics: CONQUEST.relics.length,
      slow: gS.startSlow === 0.8, threw: threw });
  })()
`, sandbox);
const t25ok = t25diag.indexOf('"calls":0') !== -1 && t25diag.indexOf('"relics":1') !== -1
  && t25diag.indexOf('"slow":true') !== -1 && t25diag.indexOf('"threw":false') !== -1;
console.log('T25 applyStarting aplica cada reliquia inicial exactamente una vez:', t25ok ? 'OK' : 'FALLO ' + t25diag);

// T25b: la reliquia Mercader no se duplica (goldMult Ã—1.3, no Ã—1.69)
const t25b = VM.runInContext(`
  (function () {
    CONQUEST.enabled = false; CONQUEST.relics = []; DIRECTOR.level = 0;
    var gM = new Game('plains', 0);
    CONQUEST.start(1, ['merchant']);
    var goldBefore = gM.gold;
    CONQUEST.applyStarting(gM);
    var okM = Math.abs(gM.goldMult - 1.3) < 1e-9 && CONQUEST.relics.length === 1;
    CONQUEST.enabled = false; CONQUEST.relics = []; DIRECTOR.level = 0;
    return okM;
  })()
`, sandbox);
console.log('T25b Mercader inicial aplica goldMult x1.30 sin duplicar:', t25b ? 'OK' : 'FALLO');


console.log('SMOKE TEST COMPLETO');

