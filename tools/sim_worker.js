'use strict';
/* Worker headless: monta el sandbox una vez y procesa trabajos de simulación. */
const fs = require('fs');
const path = require('path');
const VM = require('vm');
const { parentPort } = require('worker_threads');

const JS_DIR = path.join(__dirname, '..', 'js');

function fakeGradient() { return { addColorStop() {} }; }
function fakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return fakeGradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => undefined;
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
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    textContent: '', innerHTML: '', title: '',
    appendChild() {}, remove() {}, querySelector: () => fakeElement(), querySelectorAll: () => []
  };
}
const sandbox = {
  console,
  document: { getElementById: () => fakeElement(), createElement: () => fakeElement(), addEventListener() {}, body: fakeElement(), fullscreenElement: null, documentElement: { requestFullscreen() {} } },
  window: {},
  requestAnimationFrame: () => 0,
  localStorage: (() => {
    const store = {};
    return {
      getItem: k => (k in store ? store[k] : '{"xp":0}'),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
  })(),
  CanvasRenderingContext2D: function () {},
  toast() {},
  setTimeout, clearTimeout, setInterval, clearInterval, Math
};
sandbox.addEventListener = () => {};
sandbox.window = sandbox;
VM.createContext(sandbox);

['config.js', 'artkit.js', 'maps.js', 'progress.js', 'relics.js', 'audio.js', 'director.js',
 'weather.js', 'waves.js', 'enemies.js', 'towers.js', 'game.js', 'main.js'].forEach(f => {
  VM.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sandbox, { filename: f });
});
VM.runInContext(`
  UI.update = function(){};
  toast = function(){};
  sfx = function(){};
`, sandbox);

function resetState() {
  sandbox.localStorage.removeItem('vaeldryn_progress');
  sandbox.localStorage.removeItem('vaeldryn_scores');
  VM.runInContext(`
    PROGRESS.load();
    PROGRESS.data.xp = 0;
    if (typeof DIRECTOR !== 'undefined' && DIRECTOR.reset) DIRECTOR.reset();
    CONQUEST.enabled = false; CONQUEST.relics = []; CONQUEST.difficulty = 0;
    if (typeof SCORES !== 'undefined') SCORES.list = [];
  `, sandbox);
}

VM.runInContext(`
  function __simRun(mapId, diff, strat, opts) {
    opts = opts || {};
    var t0 = Date.now();
    if (opts.conquest) {
      /* Flujo real de startConquest(): dificultad interna +1 (cap 2),
         UNA reliquia inicial elegida y applyStarting tras crear el Game. */
      CONQUEST.start(Math.min(CONQUEST.difficulty + 1, 2), [opts.startRelic || 'merchant']);
    }
    var g = new Game(mapId, diff);
    if (opts.conquest) CONQUEST.applyStarting(g);
    if (opts.endless) g.continueEndless = true;
    var maxWave = opts.maxWave || (opts.conquest ? 34 : 26);

    var spots = [];
    for (var c = 0; c < CONFIG.COLS; c++)
      for (var r = 0; r < CONFIG.ROWS; r++) {
        if (!g.canPlace(c, r)) continue;
        var bd = 99;
        for (var key in g.pathCells) {
          var pp = key.split(',');
          var d = Math.abs(+pp[0] - c) + Math.abs(+pp[1] - r);
          if (d < bd) bd = d;
        }
        if (bd <= 2) spots.push({ c: c, r: r });
      }
    spots.sort(function (a, b) { return (a.c - b.c) || (a.r - b.r); });

    var cap = strat === 'heavy' ? 9 : 16;
    var spotPtr = 0, idleT = 0, tick = 0;

    function findSpot() {
      for (var n = 0; n < spots.length; n++) {
        var idx = (spotPtr + n) % spots.length;
        var s = spots[idx];
        if (!g.towerAt(s.c, s.r)) { spotPtr = (idx + 1) % spots.length; return s; }
      }
      return null;
    }
    function availableTypes() {
      var list = [];
      for (var i = 0; i < TOWER_TYPES.length; i++) {
        var t = TOWER_TYPES[i];
        var u = TOWERS[t].unlock;
        if (u && u.wave && g.wave < u.wave) continue;
        list.push(t);
      }
      return list;
    }
    /* elige tipo del elemento MENOS representado (evita disparar al Director),
       desempata por coste según estrategia */
    function pickType() {
      var list = availableTypes();
      if (!list.length) return null;
      var counts = {};
      for (var i = 0; i < g.towers.length; i++) {
        var el = TOWERS[g.towers[i].type].element;
        counts[el] = (counts[el] || 0) + 1;
      }
      var best = null, bestScore = Infinity;
      for (var j = 0; j < list.length; j++) {
        var ty = list[j];
        var cnt = counts[TOWERS[ty].element] || 0;
        var tie = strat === 'heavy' ? -TOWERS[ty].cost : TOWERS[ty].cost;
        var score = cnt * 10000 + tie;
        if (score < bestScore) { bestScore = score; best = ty; }
      }
      return best;
    }
    function tryBuild() {
      if (g.towers.length >= cap) return false;
      var margin = strat === 'heavy' ? 50 : 30;
      var order;
      if (g.towers.length < 3) {
        /* apertura: base barata primero (como un humano sensato) */
        order = availableTypes().sort(function (a, b) { return TOWERS[a].cost - TOWERS[b].cost; });
      } else {
        var pref = pickType();
        order = [];
        if (pref) order.push(pref);
        var rest = availableTypes().sort(function (a, b) { return TOWERS[a].cost - TOWERS[b].cost; });
        for (var k = 0; k < rest.length; k++) if (rest[k] !== pref) order.push(rest[k]);
      }
      for (var m = 0; m < order.length; m++) {
        var ty = order[m];
        if (g.gold < Math.round(TOWERS[ty].cost * g.upCostMult) + margin) continue;
        var s = findSpot();
        if (!s) return false;
        if (g.buildTower(s.c, s.r, ty)) return true;
      }
      return false;
    }
    function tryUpgrade(reserve) {
      var best = null, bestLv = 99;
      for (var i = 0; i < g.towers.length; i++) {
        var t = g.towers[i];
        if (!t.upgrade || t.level >= bestLv) continue;
        var cost = Math.round(t.upgrade.cost * g.upCostMult);
        if (g.gold >= cost + reserve) { bestLv = t.level; best = t; }
      }
      if (best) { g.upgradeTower(best); return true; }
      return false;
    }
    function tryAbilities() {
      var used = 0;
      for (var i = 0; i < g.towers.length && used < 2; i++) {
        var t = g.towers[i];
        if (!t.def || !t.def.ability || t.abilityCd > 0 || t.col === undefined) continue;
        var tx = (t.col + 0.5) * CONFIG.CELL, ty = (t.row + 0.5) * CONFIG.CELL;
        var n = 0, rg = (t.range || 120);
        rg *= rg;
        for (var j = 0; j < g.enemies.length; j++) {
          var e = g.enemies[j];
          var dx = e.x - tx, dy = e.y - ty;
          if (dx * dx + dy * dy <= rg) n++;
        }
        if (n >= 3) { t.useAbility(g); used++; }
      }
    }

    while (!g.over && !g.won && g.wave < maxWave) {
      g.update(0.05);
      tick++;
      if (tick > 30000) break;
      if ((tick & 1023) === 0 && Date.now() - t0 > 45000) break;
      /* Conquista: resolver la elección de reliquia (greedy: Mercader primero) */
      if (opts.conquest && g.paused && g.waveState === 'relic_choice') {
        var picksC = CONQUEST.nextRelics || [];
        var pickC = picksC.length ? picksC[0] : null;
        for (var pi = 0; pi < picksC.length; pi++) if (picksC[pi].id === 'merchant') pickC = picksC[pi];
        if (pickC) CONQUEST.grantRelic(pickC.id, g);
        g.waveState = 'idle';
        g.paused = false;
        continue;
      }
      if (g.waveState === 'idle') idleT += 0.05; else idleT = 0;
      if (tick % 4 !== 0) continue;
      try { tryAbilities(); } catch (e) { /* habilidad con estado inválido: se ignora en sim */ }
      var acted = true, guard = 0;
      while (acted && guard++ < 6) {
        acted = tryBuild();
        if (!acted) acted = tryUpgrade(strat === 'heavy' ? 40 : 60);
      }
      if (g.waveState === 'idle' && idleT > 1.5 && !g.over) {
        g.startWave();
        idleT = 0;
      }
    }

    return { mapId: mapId, diff: diff, strat: strat, endless: !!opts.endless, conquest: !!opts.conquest,
             won: !!g.won, over: !!g.over, wave: g.wave, kills: g.kills,
             towers: g.towers.length, lives: g.lives,
             relics: opts.conquest ? CONQUEST.relics.length : 0,
             leaked: g.leaked, gold: Math.round(g.gold), time: Math.round(g.time),
             ms: Date.now() - t0 };
  }
`, sandbox);

parentPort.on('message', job => {
  const t0 = Date.now();
  try {
    resetState();
    const rec = VM.runInContext(
      '__simRun(' + JSON.stringify(job.mapId) + ',' + job.diff + ',' +
      JSON.stringify(job.strat) + ',' + JSON.stringify(job.opts || {}) + ')', sandbox);
    rec.id = job.id;
    parentPort.postMessage({ ok: true, rec });
  } catch (e) {
    parentPort.postMessage({ ok: false, id: job.id, err: e.message });
  }
});
parentPort.postMessage({ ready: true });
