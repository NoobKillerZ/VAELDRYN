'use strict';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = r || 0;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

var game;
var lastTs = 0;
var shopButtons = [];
var eventsBound = false;
var lastGold = -1, lastLives = -1, lastWave = -1, lastWeather = '', lastCorruption = -1, lastLevel = -1;
var directorLevelName = ['🟢 Relajado', '🔶 Agresivo', '🔴 Pesadilla'];
var selectedDifficulty = 0;
var DIFF_COLORS = { 0: '#64b464', 1: '#50a0dc', 2: '#dc8c32', 3: '#c83c3c' };

function $(id) { return document.getElementById(id); }

function toast(msg, dur) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toasts').appendChild(el);
  var d = dur || 2500;
  setTimeout(function () { el.classList.add('out'); }, d - 200);
  setTimeout(function () { el.remove(); }, d);
}

function flashStat(el, dir) {
  if (!el || !dir) return;
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  el.classList.add(dir === 'up' ? 'flash-up' : 'flash-down');
}

/* --- HUD de batalla: chips, pausa y viñeta de peligro --- */
var _chipTxt = null, _cqTxt = null, _pausedUi = false, _dangerOn = false;
var _modalOpen = false;

function updateBattleUi() {
  if (!game) return;
  if (game.over || game.won) { hideBattleUi(); return; }

  /* La vida de los jefes la pinta el canvas (Game.drawBossBars). */

  var chip = $('wave-chip');
  var txt = game.waveState !== 'idle' ? ('🌊 Oleada ' + game.wave + ' · 👾 ' + countAlive()) : null;
  if (txt !== _chipTxt) {
    _chipTxt = txt;
    if (txt === null) chip.classList.add('hidden');
    else { chip.textContent = txt; chip.classList.remove('hidden'); }
  }

  var cqChip = $('conquest-chip');
  var cqTxt = (typeof CONQUEST !== 'undefined' && CONQUEST.enabled && game.conquestTimerMax > 0)
    ? ('⚔️ Conquista · ⏱ ' + Math.ceil(game.conquestTimer)) : null;
  if (cqTxt !== _cqTxt) {
    _cqTxt = cqTxt;
    if (cqTxt === null) cqChip.classList.add('hidden');
    else { cqChip.textContent = cqTxt; cqChip.classList.remove('hidden'); }
  }

  var paused = !!game.paused && !_modalOpen;
  if (paused !== _pausedUi) {
    _pausedUi = paused;
    $('pause-overlay').classList.toggle('hidden', !paused);
    if (paused) syncPauseMenu();
  }

  var danger = game.lives <= 5 && game.lives > 0 && !game.over;
  if (danger !== _dangerOn) {
    _dangerOn = danger;
    $('danger-vignette').classList.toggle('hidden', !danger);
  }
}

function hideBattleUi() {
  ['wave-chip', 'conquest-chip', 'pause-overlay', 'danger-vignette'].forEach(function (id) {
    var el = $(id);
    if (el) el.classList.add('hidden');
  });
  _chipTxt = null; _cqTxt = null; _pausedUi = false; _dangerOn = false;
  _modalOpen = false;
}

function syncPauseMenu() {
  var bAudio = $('btn-pause-audio');
  if (bAudio && typeof AUDIO !== 'undefined') {
    bAudio.textContent = AUDIO.enabled ? '🔊 Sonido: activado' : '🔇 Sonido: desactivado';
    if (typeof localStorage !== 'undefined' && hasSavedGame()) {
      var bSave = $('btn-pause-save');
      if (bSave) bSave.title = 'Sobrescribe el guardado automático de la oleada ' + game.wave;
    }
  }
}

function resumeGame() {
  if (!game || game.over) return;
  game.paused = false;
  $('btn-pause').textContent = '⏸ Pausa';
}

function bindPauseMenu() {
  var bResume = $('btn-resume');
  if (bResume) bResume.addEventListener('click', resumeGame);
  var bSave = $('btn-pause-save');
  if (bSave) bSave.addEventListener('click', function () { saveGame(false); });
  var bAudio = $('btn-pause-audio');
  if (bAudio) bAudio.addEventListener('click', function () {
    var on = typeof AUDIO !== 'undefined' && AUDIO.toggle();
    syncPauseMenu();
    toast(on ? '🎵 Audio activado' : '🔇 Audio desactivado', 1400);
  });
  var bFs = $('btn-pause-fullscreen');
  if (bFs) bFs.addEventListener('click', toggleFullscreen);
  var bQuit = $('btn-pause-quit');
  if (bQuit) bQuit.addEventListener('click', function () {
    saveGame(true);
    showMenu();
    buildMenu();
    toast('💾 Partida guardada. ¡Hasta pronto, comandante!', 2600);
  });
}

function countAlive() {
  var n = 0;
  for (var i = 0; i < game.enemies.length; i++) if (game.enemies[i].alive) n++;
  return n;
}

/* --- Minimapa --- */
var MINI_ELEM = { physical: '#d8d8d8', fire: '#ff7a3a', ice: '#6fd0ff', earth: '#c09a5a', nature: '#7fd47f', holy: '#ffe9a0', lightning: '#ffe45a', void: '#b07ae0' };
var _miniFrame = 0;

function renderMinimap() {
  if (!game || !game.map) return;
  var cv = $('minimap');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var sx = W / CONFIG.WIDTH, sy = H / CONFIG.HEIGHT;
  ctx.clearRect(0, 0, W, H);

  var path = game.map.path;
  ctx.strokeStyle = '#54401f';
  ctx.lineWidth = Math.max(4, CONFIG.CELL * sx * 0.55);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (var i = 0; i < path.length; i++) {
    var px = (path[i][0] + 0.5) * CONFIG.CELL * sx;
    var py = (path[i][1] + 0.5) * CONFIG.CELL * sy;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  var cs = Math.max(3, CONFIG.CELL * sx - 3);
  for (var t = 0; t < game.towers.length; t++) {
    var tw = game.towers[t];
    ctx.fillStyle = MINI_ELEM[tw.element] || '#f2c86a';
    ctx.fillRect(tw.col * CONFIG.CELL * sx + 1.5, tw.row * CONFIG.CELL * sy + 1.5, cs, cs);
  }

  for (var e = 0; e < game.enemies.length; e++) {
    var en = game.enemies[e];
    if (!en.alive) continue;
    ctx.fillStyle = en.boss ? '#ff4040' : (en.elite ? '#ffb020' : '#e05548');
    ctx.beginPath();
    ctx.arc(en.x * sx, en.y * sy, en.boss ? 4 : 2, 0, 6.283);
    ctx.fill();
    if (en.boss) {
      ctx.strokeStyle = 'rgba(255,80,80,.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(en.x * sx, en.y * sy, 7, 0, 6.283);
      ctx.stroke();
    }
  }

  var lp = path[path.length - 1];
  ctx.font = '11px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏰', (lp[0] + 0.5) * CONFIG.CELL * sx, (lp[1] + 0.5) * CONFIG.CELL * sy);
}

/* --- Pantalla completa --- */
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (err) { /* ignorar */ }
}

function bindFullscreen() {
  var btn = $('btn-fullscreen');
  if (!btn) return;
  if (!document.documentElement.requestFullscreen) { btn.classList.add('hidden'); return; }
  btn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', function () {
    btn.textContent = document.fullscreenElement ? '🗗' : '🖥️';
  });
}

/* --- Guardado de partida en curso --- */
var SAVE_KEY = 'vaeldryn_save';

function saveGame(silent) {
  if (!game || game.over || game.won) return false;
  if (typeof localStorage === 'undefined') return false;
  try {
    var s = {
      v: 1,
      mapId: game.mapId,
      difficulty: game.difficulty,
      wave: game.wave,
      lives: game.lives,
      gold: Math.round(game.gold),
      kills: game.kills,
      leaked: game.leaked,
      time: Math.round(game.time),
      continueEndless: !!game.continueEndless,
      stats: { goldEarned: game.stats.goldEarned, towersBuilt: game.stats.towersBuilt, upgrades: game.stats.upgrades },
      conquest: null
    };
    if (typeof CONQUEST !== 'undefined' && CONQUEST.enabled) {
      s.conquest = { difficulty: CONQUEST.difficulty, relics: CONQUEST.relics.slice(), timer: game.conquestTimer };
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    if (!silent) toast('💾 Partida guardada — oleada ' + game.wave, 2000);
    return true;
  } catch (err) { return false; }
}

function autoSaveGame(g) {
  saveGame(true);
}

function hasSavedGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    return !!(raw && raw.indexOf('"v":1') >= 0);
  } catch (err) { return false; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignorar */ }
}

function loadSavedGame() {
  var s = null;
  try {
    var raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVE_KEY) : null;
    if (raw) s = JSON.parse(raw);
  } catch (err) { s = null; }
  if (!s || s.v !== 1 || !s.mapId || typeof MAPS === 'undefined' || !(s.lives > 0)) {
    clearSave();
    buildMenu();
    toast('⚠️ No hay partida guardada válida', 2200);
    return false;
  }
  try {
    if (typeof CONQUEST !== 'undefined') CONQUEST.enabled = false;
    game = new Game(s.mapId, s.difficulty);
    game.wave = s.wave || 0;
    game.lives = s.lives;
    game.gold = s.gold || 0;
    game.kills = s.kills || 0;
    game.leaked = s.leaked || 0;
    game.time = s.time || 0;
    game.continueEndless = !!s.continueEndless;
    if (s.stats) game.stats = { goldEarned: s.stats.goldEarned || 0, towersBuilt: s.stats.towersBuilt || 0, upgrades: s.stats.upgrades || 0 };
    game.hpScale = (1 + (game.wave - 1) * 0.05) * game.map.mult * game.hpMult;
    var restoredRelics = 0;
    if (s.conquest && typeof CONQUEST !== 'undefined' && typeof RELICS !== 'undefined') {
      CONQUEST.enabled = true;
      CONQUEST.difficulty = s.conquest.difficulty || 0;
      CONQUEST.relics = [];
      DIRECTOR.level = CONQUEST.difficulty;
      for (var r = 0; r < s.conquest.relics.length; r++) {
        CONQUEST.grantRelic(s.conquest.relics[r], game, true);
        restoredRelics++;
      }
      game.conquestTimer = (typeof s.conquest.timer === 'number') ? s.conquest.timer : game.conquestTimerMax;
    }
    lastGold = -1; lastLives = -1; lastWave = -1; lastWeather = ''; lastCorruption = -1; lastLevel = -1;
    hideBattleUi();
    buildShop();
    if (!eventsBound) { bindEvents(); eventsBound = true; }
    UI.update(game);
    $('menu-overlay').classList.add('hidden');
    $('achievements-overlay').classList.add('hidden');
    $('conquest-overlay').classList.add('hidden');
    var msg = '▶️ Partida cargada: oleada ' + (game.wave + 1) + ' lista';
    if (restoredRelics) msg += ' · ' + restoredRelics + ' reliquias';
    toast(msg, 3500);
    return true;
  } catch (err) {
    game = null;
    clearSave();
    if (typeof console !== 'undefined' && console.error) console.error(err);
    toast('⚠️ Guardado corrupto: se ha descartado', 3000);
    return false;
  }
}

var UI = {
  update: function (g) {
    if (g.gold !== lastGold) {
      if (lastGold >= 0) flashStat($('stat-gold').parentElement, g.gold > lastGold ? 'up' : 'down');
      $('stat-gold').textContent = g.gold;
      lastGold = g.gold;
    }
    if (g.lives !== lastLives) {
      if (lastLives >= 0 && g.lives < lastLives) flashStat($('stat-lives').parentElement, 'down');
      $('stat-lives').textContent = g.lives;
      lastLives = g.lives;
    }
    if (g.wave !== lastWave) { $('stat-wave').textContent = g.wave; lastWave = g.wave; }

    var lv = (typeof PROGRESS !== 'undefined') ? PROGRESS.level : 1;
    if (lv !== lastLevel) { $('stat-level').textContent = 'Nv ' + lv; lastLevel = lv; }

    var corPct = Math.floor(g.corruptTotal / 300 * 100);
    if (corPct !== lastCorruption) {
      $('stat-corruption').textContent = corPct + '%';
      lastCorruption = corPct;
    }

    var wName = '';
    if (typeof WEATHER !== 'undefined' && WEATHER.type) {
      wName = WEATHER.type.name;
      $('weather-icon').textContent = WEATHER.type.icon;
      $('weather-name').textContent = wName;
    }
    if (wName !== lastWeather) { $('weather-name').textContent = wName || 'Despejado'; lastWeather = wName; }

    var btnWave = $('btn-wave');
    if (g.waveState === 'idle') {
      btnWave.disabled = false;
      btnWave.textContent = '⚔️ Iniciar oleada ' + (g.wave + 1);
    } else {
      btnWave.disabled = true;
      btnWave.textContent = '🌊 Oleada en curso...';
    }
    var btnAuto = $('btn-autowave');
    btnAuto.classList.toggle('on', !!g.autoWave);
    if (g.autoWave && g.waveState === 'idle' && g.wave > 0) {
      btnAuto.textContent = '🔄 Auto (' + Math.ceil(g.autoTimer) + 's)';
    } else {
      btnAuto.textContent = '🔄 Auto';
    }

    for (var i = 0; i < shopButtons.length; i++) {
      var b = shopButtons[i];
      var cost = Math.round(b.def.cost * g.upCostMult);
      var unlockWave = b.def.unlock ? (b.def.unlock.wave || 0) : 0;
      var locked = unlockWave > 0 && g.wave < unlockWave;
      b.btn.disabled = locked || g.gold < cost;
      b.btn.classList.toggle('locked', locked);
      b.btn.classList.toggle('sel', g.placing === b.type);
      b.btn.querySelector('.sb-cost').textContent = cost;
      b.btn.querySelector('.sb-lock').textContent = locked ? '🔒 Oleada ' + unlockWave : '';
      b.btn.title = locked ? 'Se desbloquea en la oleada ' + unlockWave : b.def.desc;
    }

    var panel = $('tower-panel');
    if (g.selected) {
      panel.classList.remove('hidden');
      var t = g.selected;
      $('tp-name').textContent = t.icon + ' ' + t.name + ' (Nv ' + (t.level + 1) + ')';
      var elName = { physical: 'Físico', fire: 'Fuego', ice: 'Hielo', earth: 'Tierra', nature: 'Naturaleza', holy: 'Sagrado', lightning: 'Rayo', void: 'Vacío' }[t.element] || t.element;
      var stats = '';
      stats += 'Elemento: <b>' + elName + '</b><br>';
      stats += 'Daño: <b>' + (t.type === 'druid' ? '—' : t.damage) + '</b><br>';
      stats += 'Alcance: <b>' + t.range + '</b><br>';
      stats += 'Cadencia: <b>' + (t.type === 'druid' ? '—' : (1 / t.rate).toFixed(1) + '/s') + '</b><br>';
      // DPS efectivo aproximado en el contexto actual (auras, clima, críticos, multiblanco)
      if (t.type !== 'druid') {
        var dpsMult = (t.dmgAmp || 1) * (t.buffed || 1) * (g.weatherMult ? g.weatherMult(t.element) : 1);
        dpsMult *= 1 + (g.critChance || 0) * 0.5;
        var dpsTargets = 1;
        if ((t.targetCap || 1) > 1) dpsTargets = t.targetCap;
        else if ((t.chains || 0) > 0) dpsTargets = 1 + t.chains * 0.9;
        else if ((t.pierce || 0) > 1) dpsTargets = Math.min(1 + t.pierce, 3);
        stats += 'DPS ≈ <b>' + Math.round(t.damage / t.rate * dpsMult * dpsTargets) + '</b><br>';
      }
      if (t.purge) stats += 'Purifica: <b>' + t.purge + '</b><br>';
      if (t.aoe) stats += 'Área: <b>' + t.aoe + '</b><br>';
      if (t.pierce) stats += 'Perfora: <b>' + t.pierce + '</b><br>';
      stats += 'Integridad: <b>' + Math.floor(t.hp / t.hpMax * 100) + '%</b><br>';
      stats += 'Asesinatos: <b>' + t.kills + '</b><br>';
      stats += '<i>' + t.desc + '</i>';
      var u = t.upgrade;
      if (u) stats += '<br><b>⬆ ' + u.name + ':</b> ' + u.desc + ' (' + Math.round(u.cost * g.upCostMult) + ' 🪙)';
      $('tp-stats').innerHTML = stats;
      var btnUp = $('btn-upgrade');
      btnUp.disabled = !u || g.gold < Math.round(u.cost * g.upCostMult);
      btnUp.textContent = u ? ('⬆️ Mejorar — ' + Math.round(u.cost * g.upCostMult) + ' 🪙 (U)') : '⭐ Máximo nivel';
      var btnRep = $('btn-repair');
      var repCost = t.repairCost ? t.repairCost() : 0;
      btnRep.disabled = t.hp >= t.hpMax || g.gold < repCost;
      btnRep.textContent = repCost > 0 ? ('🔧 Reparar — ' + repCost + ' 🪙 (R)') : '🔧 Reparada';
      var btnPri = $('btn-priority');
      if (btnPri) {
        btnPri.textContent = 'Objetivo: ' + (g.priorityNames[t.priority || 'first'] || '🎯 Primero') + ' (T)';
        btnPri.title = g.priorityNames[t.priority || 'first'] === g.priorityNames.strong
          ? 'Apunta al enemigo con más vida' : 'Cicla: primero en el camino → más vida → más cercano';
      }
      $('btn-sell').textContent = '💰 Vender — ' + Math.round(t.sellValue() / g.upCostMult) + ' 🪙 (V)';
      var btnAb = $('btn-ability');
      if (t.def && t.def.ability) {
        btnAb.classList.remove('hidden');
        var ab = t.def.ability;
        var cdFrac = t.abilityCd > 0 ? t.abilityCd / ab.cd : 0;
        btnAb.style.setProperty('--cd', cdFrac.toFixed(3));
        btnAb.disabled = t.abilityCd > 0;
        btnAb.innerHTML = cdFrac > 0
          ? ('✨ ' + ab.icon + ' ' + ab.name + ' — ' + t.abilityCd.toFixed(1) + 's')
          : ('✨ ' + ab.icon + ' ' + ab.name + ' (E)');
        btnAb.title = ab.desc;
      } else {
        btnAb.classList.add('hidden');
      }
    } else {
      panel.classList.add('hidden');
    }

    var info = $('wave-info');
    if (g.waveState === 'idle') {
      var next = (typeof WAVE.buildFor !== 'undefined') ? WAVE.buildFor(g.wave + 1, g.mapId) : WAVE.build(g.wave + 1);
      var counts = {};
      var bossType = null;
      for (var q = 0; q < next.length; q++) {
        if (ENEMIES[next[q].type].boss) bossType = next[q].type;
        counts[next[q].type] = (counts[next[q].type] || 0) + 1;
      }
      var lines = [];
      if (bossType) lines.push('👑 <b>' + ENEMIES[bossType].name + '</b>');
      var types = Object.keys(counts);
      types.sort();
      for (var k = 0; k < types.length; k++) {
        lines.push(ENEMIES[types[k]].name + ' ×' + counts[types[k]]);
      }
      info.innerHTML = lines.join('<br>') || 'Prepara tus torres...';
    } else {
      info.textContent = 'Enemigos en el campo: ' + g.enemies.length;
    }

    var dirInfo = $('director-info');
    if (typeof DIRECTOR !== 'undefined') {
      var dl = directorLevelName[DIRECTOR.level] || '🟢 Relajado';
      var dom = DIRECTOR.dominantElement();
      var domTxt = dom ? (dom.element + ' ' + Math.round(dom.pct * 100) + '%') : '—';
      // gráfico de barras: reparto de daño por elemento
      var EL_COL = { physical: '#c9ccd6', fire: '#ff8a4a', ice: '#8ad4ff', earth: '#c8a05a', nature: '#7ad47f', lightning: '#ffe86a', void: '#b08aff' };
      var EL_ICO = { physical: '⚔️', fire: '🔥', ice: '❄️', earth: '⛰️', nature: '🌿', lightning: '⚡', void: '🌌' };
      var br = DIRECTOR.elementBreakdown();
      var bars = '';
      for (var bi2 = 0; bi2 < br.length && bi2 < 5; bi2++) {
        var be = br[bi2];
        var wpct = Math.max(3, Math.round(be.pct * 100));
        bars += '<div class="dir-bar"><span class="dir-el">' + (EL_ICO[be.element] || '') + '</span>' +
          '<span class="dir-track"><span class="dir-fill" style="width:' + wpct + '%;background:' + (EL_COL[be.element] || '#999') + '"></span></span>' +
          '<span class="dir-pct">' + wpct + '%</span></div>';
      }
      var adaptTxt = DIRECTOR.adapted ? '<span class="dir-adapt">🧠 adaptando</span>' : '';
      dirInfo.innerHTML = 'Estado: <b>' + dl + '</b> ' + adaptTxt + '<br>Estrategia: <b>' + domTxt + '</b>' +
        (bars ? '<div class="dir-bars">' + bars + '</div>' : '') +
        'Kills: <b>' + g.kills + '</b> · Fugas: <b>' + g.leaked + '</b>';
    } else {
      dirInfo.textContent = '';
    }
  },

  showRelicChoice: function (picks, g) {
    var ov = $('relic-overlay');
    var box = $('relic-choices');
    _modalOpen = true;
    box.innerHTML = '';
    var unlockCost = g.wave > 10 ? Math.floor((g.wave - 10) * 40) : 0;
    for (var i = 0; i < picks.length; i++) {
      var r = picks[i];
      var b = document.createElement('button');
      b.className = 'relic-btn';
      b.innerHTML = '<span class="relic-icon">' + r.icon + '</span><span class="relic-name">' + r.name + '</span><span class="relic-desc">' + r.desc + '</span>';
      b.addEventListener('click', (function (rel) {
        return function () {
          _modalOpen = false;
          CONQUEST.grantRelic(rel, g);
          ov.classList.add('hidden');
          g.waveState = 'idle';
          g.paused = false;
          toast('✨ ¡Reliquia obtenida: ' + rel.name + '!', 3500);
        };
      })(r));
      box.appendChild(b);
    }
    if (unlockCost > 0 && g.gold >= unlockCost) {
      var d = document.createElement('button');
      d.className = 'relic-btn dim';
      d.innerHTML = '<span class="relic-icon">💎</span><span class="relic-name">Desbloquear adicional</span><span class="relic-desc">' + unlockCost + ' oro</span>';
      d.addEventListener('click', function () {
        _modalOpen = false;
        g.gold -= unlockCost;
        var picked = CONQUEST._extraPick(g);
        ov.classList.add('hidden');
        g.waveState = 'idle';
        g.paused = false;
        toast(picked ? '💎 ¡Reliquia extra desbloqueada!' : '💎 Todas las reliquias conseguidas', 2500);
      });
      box.appendChild(d);
    }
    ov.classList.remove('hidden');
    g.paused = true;
  }
};

function buildShop() {
  var shop = $('shop');
  shop.innerHTML = '';
  shopButtons = [];
  for (var i = 0; i < TOWER_TYPES.length; i++) {
    var type = TOWER_TYPES[i];
    var def = TOWERS[type];
    var b = document.createElement('button');
    b.className = 'shop-btn';
    b.innerHTML = '<span class="sb-icon">' + def.icon + '</span><span class="sb-name">' + def.name + '</span><span class="sb-lock"></span><span class="sb-cost">' + def.cost + '</span>';
    b.title = def.desc;
    b.addEventListener('click', function (t) {
      return function () {
        if (game.over) return;
        var uw = TOWERS[t].unlock ? (TOWERS[t].unlock.wave || 0) : 0;
        if (uw > 0 && game.wave < uw) {
          toast('🔒 ' + TOWERS[t].name + ' se desbloquea en la oleada ' + uw, 2000);
          return;
        }
        if (game.placing === t) { game.placing = null; }
        else { game.placing = t; game.selected = null; }
        UI.update(game);
      };
    }(type));
    shop.appendChild(b);
    shopButtons.push({ btn: b, def: def, type: type });
  }
}

function canvasToCell(e) {
  var rect = game.canvas.getBoundingClientRect();
  var x = (e.clientX - rect.left) * (CONFIG.WIDTH / rect.width);
  var y = (e.clientY - rect.top) * (CONFIG.HEIGHT / rect.height);
  return { c: Math.floor(x / CONFIG.CELL), r: Math.floor(y / CONFIG.CELL) };
}

function canvasToCellXY(clientX, clientY) {
  var rect = game.canvas.getBoundingClientRect();
  var x = (clientX - rect.left) * (CONFIG.WIDTH / rect.width);
  var y = (clientY - rect.top) * (CONFIG.HEIGHT / rect.height);
  return { c: Math.floor(x / CONFIG.CELL), r: Math.floor(y / CONFIG.CELL) };
}

function bindEvents() {
  var canvas = game.canvas;
  var _touchT0 = 0;

  function canvasTapAt(clientX, clientY) {
    if (game.over) return;
    var cell = canvasToCellXY(clientX, clientY);
    if (cell.c < 0 || cell.c >= CONFIG.COLS || cell.r < 0 || cell.r >= CONFIG.ROWS) return;
    if (game.placing) {
      var type = game.placing;
      if (game.buildTower(cell.c, cell.r, type)) {
        toast('🏗️ ¡' + TOWERS[type].name + ' construida!', 1200);
      } else if (game.gold >= TOWERS[type].cost) {
        toast('No puedes construir ahí', 1200);
      }
    } else {
      game.selected = game.towerAt(cell.c, cell.r);
    }
    UI.update(game);
  }

  canvas.addEventListener('mousemove', function (e) {
    var cell = canvasToCell(e);
    game.mouse.c = cell.c;
    game.mouse.r = cell.r;
    game.mouse.inside = cell.c >= 0 && cell.c < CONFIG.COLS && cell.r >= 0 && cell.r < CONFIG.ROWS;
    game.hovered = game.mouse.inside ? game.towerAt(cell.c, cell.r) : null;
  });

  canvas.addEventListener('mouseleave', function () {
    game.mouse.inside = false;
    game.hovered = null;
  });

  canvas.addEventListener('click', function (e) {
    canvasTapAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', function (e) {
    _touchT0 = Date.now();
    var t = e.touches[0];
    if (!t) return;
    var cell = canvasToCell(t);
    game.mouse.c = cell.c;
    game.mouse.r = cell.r;
    game.mouse.inside = cell.c >= 0 && cell.c < CONFIG.COLS && cell.r >= 0 && cell.r < CONFIG.ROWS;
    game.hovered = game.towerAt(cell.c, cell.r);
  }, { passive: true });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (!game || game.over) return;
    if (_touchT0 && Date.now() - _touchT0 > 500) {
      game.placing = null;
      game.selected = null;
      game.hovered = null;
      UI.update(game);
      toast('✋ Acción cancelada', 900);
      return;
    }
    var t = e.changedTouches[0];
    if (t) canvasTapAt(t.clientX, t.clientY);
  });

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    game.placing = null;
    game.selected = null;
    UI.update(game);
  });

  $('btn-wave').addEventListener('click', function () { game.startWave(); });
  var btnSideTg = $('btn-side-toggle');
  if (btnSideTg) btnSideTg.addEventListener('click', function () {
    var collapsed = document.body.classList.toggle('side-collapsed');
    btnSideTg.textContent = collapsed ? '«' : '»';
    sfx('ui_click');
  });
  $('btn-autowave').addEventListener('click', function () {
    game.autoWave = !game.autoWave;
    game.autoTimer = 2;
    var btn = $('btn-autowave');
    btn.classList.toggle('on', game.autoWave);
    if (game.autoWave) toast('🔄 Modo auto: las oleadas comenzarán solas', 2000);
    else toast('⏹️ Modo auto desactivado', 1500);
  });
  $('btn-audio').addEventListener('click', function () {
    var on = AUDIO.toggle();
    var b = $('btn-audio');
    b.textContent = on ? '🎵' : '🔇';
    b.classList.toggle('off', !on);
    if (!on) toast('🔇 Audio desactivado', 1500);
    else toast('🎵 Audio activado', 1500);
  });
  $('btn-speed').addEventListener('click', function () {
    game.speed = game.speed >= 3 ? 1 : game.speed + 1;
    $('btn-speed').textContent = '⏩ ' + game.speed + 'x';
  });
  $('btn-pause').addEventListener('click', function () {
    game.paused = !game.paused;
    $('btn-pause').textContent = game.paused ? '▶ Reanudar' : '⏸ Pausa';
  });
  $('btn-upgrade').addEventListener('click', function () {
    if (game.selected) game.upgradeTower(game.selected);
  });
  $('btn-repair').addEventListener('click', function () {
    if (game.selected) {
      game.selected.repair();
      UI.update(game);
    }
  });
  $('btn-sell').addEventListener('click', function () {
    if (game.selected) game.sellTower(game.selected);
    UI.update(game);
  });
  $('btn-ability').addEventListener('click', function () {
    if (game.selected && game.selected.useAbility) {
      game.selected.useAbility(game);
      UI.update(game);
    }
  });
  $('btn-priority').addEventListener('click', function () {
    if (!game.selected) return;
    var order = ['first', 'strong', 'close'];
    var cur = order.indexOf(game.selected.priority || 'first');
    game.selected.priority = order[(cur + 1) % order.length];
    UI.update(game);
  });
  $('btn-restart').addEventListener('click', function () {
    $('overlay').classList.add('hidden');
    showMenu();
  });
  $('btn-continue').addEventListener('click', function () {
    game.continueEndless = true;
    $('overlay').classList.add('hidden');
  });

  window.addEventListener('keydown', function (e) {
    if (!game || game.over) return;
    if (e.key === 'Escape') { game.placing = null; game.selected = null; UI.update(game); }
    else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    else if (e.key === ' ' || e.key === 'p') { $('btn-pause').click(); }
    else if (e.key === 'n') { game.startWave(); }
    else if (e.key === 'e' || e.key === 'E') {
      if (game.selected && game.selected.useAbility) {
        game.selected.useAbility(game);
        UI.update(game);
      }
    }
    else if (e.key === 'u' || e.key === 'U') {
      /* Mejorar la torre seleccionada sin ir al panel inferior */
      if (game.selected) { game.upgradeTower(game.selected); UI.update(game); }
    }
    else if (e.key === 'r' || e.key === 'R') {
      if (game.selected && game.selected.repair && game.selected.hp < game.selected.hpMax) {
        game.selected.repair();
        UI.update(game);
      }
    }
    else if (e.key === 'v' || e.key === 'V') {
      if (game.selected) { game.sellTower(game.selected); UI.update(game); }
    }
    else if (e.key === 't' || e.key === 'T') {
      if (game.selected) { $('btn-priority').click(); }
    }
    else {
      var idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TOWER_TYPES.length) {
        var type = TOWER_TYPES[idx - 1];
        var uw = TOWERS[type].unlock ? (TOWERS[type].unlock.wave || 0) : 0;
        if (uw > 0 && game.wave < uw) {
          toast('🔒 ' + TOWERS[type].name + ' se desbloquea en la oleada ' + uw, 2000);
          return;
        }
        game.placing = game.placing === type ? null : type;
        game.selected = null;
        UI.update(game);
      }
    }
  });
}

function loop(ts) {
  if (!game) { requestAnimationFrame(loop); return; }
  var dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!isFinite(dt) || dt <= 0) dt = 0.016;
  dt = Math.min(0.05, dt);
  if (!game.paused && !game.over && !game.won) {
    for (var i = 0; i < game.speed; i++) game.update(dt);
  }
  game.render();
  updateBattleUi();
  if ((_miniFrame++ & 1) === 0) renderMinimap();
  updateGameAudio();
  requestAnimationFrame(loop);
}

function updateGameAudio() {
  if (typeof AUDIO === 'undefined' || !AUDIO.enabled || !AUDIO.ctx) return;
  if (!game || game.over || game.won) return;
  if (game.wave % 5 === 0 && game.waveState !== 'idle') AUDIO.playMusic('boss');
  else if (game.enemies.length > 15) AUDIO.playMusic('intense');
  else AUDIO.playMusic('normal');
  if (!AUDIO._currentAmbKey && game.map) AUDIO.playAmbient(game.map.theme);
}

function updateHudLevel() {
  if (typeof PROGRESS === 'undefined') return;
  $('stat-level').textContent = 'Nv ' + PROGRESS.level;
  lastLevel = PROGRESS.level;
}

function buildMenu() {
  if (typeof PROGRESS === 'undefined' || typeof MAPS === 'undefined') return;
  var p = PROGRESS;
  $('menu-level').textContent = p.level;
  $('menu-xpbar').style.width = p.levelPct + '%';
  $('menu-wins').textContent = p.wins;
  $('menu-plays').textContent = p.playCount;
  var best = maxWaveBeaten();
  $('menu-best').textContent = best;

  var grid = $('map-grid');
  grid.innerHTML = '';
  for (var i = 0; i < MAPS.length; i++) {
    var m = MAPS[i];
    var unlocked = p.isMapUnlocked(m.id);
    var card = document.createElement('button');
    card.className = 'map-card' + (unlocked ? '' : ' locked');
    var stars = '';
    for (var s = 0; s < 3; s++) stars += s < m.difficulty ? '★' : '☆';
    card.innerHTML =
      '<span class="mc-icon">' + m.icon + '</span>' +
      '<span class="mc-name">' + m.name + '</span>' +
      '<span class="mc-diff">' + stars + '</span>' +
      '<span class="mc-desc">' + m.desc + '</span>' +
      '<span class="mc-meta">🪙 ' + m.startGold + ' · ❤️ ' + m.startLives + ' · ⚠️ ×' + m.mult + '</span>' +
      '<span class="mc-lock">' + (unlocked ? '' : '🔒 Completa ' + (i > 0 ? MAPS[i - 1].name : '') + ' para desbloquear') + '</span>';
    if (unlocked) {
      (function (id) {
        card.addEventListener('click', function () { startGame(id); });
      })(m.id);
    }
    grid.appendChild(card);
  }

  buildDifficultyButtons();
  updateDifficultyInfo();

  var btnCq = $('btn-menu-conquest');
  if (btnCq) {
    var cqOk = conquestUnlocked();
    btnCq.classList.toggle('hidden', !cqOk);
    if (cqOk) {
      btnCq.onclick = function () { showConquestSelect(); };
    }
  }
  var btnCont = $('btn-menu-continue');
  if (btnCont) {
    btnCont.classList.toggle('hidden', !hasSavedGame());
    btnCont.onclick = function () { loadSavedGame(); };
  }
  var btnEndless = $('btn-menu-endless');
  if (btnEndless) {
    var endlessOk = maxWaveBeaten() >= 5;
    btnEndless.classList.toggle('hidden', !endlessOk);
    if (endlessOk) {
      var lastUnlocked = 'plains';
      for (var mi = 0; mi < MAPS.length; mi++) {
        if (p.isMapUnlocked(MAPS[mi].id)) lastUnlocked = MAPS[mi].id;
      }
      btnEndless.onclick = function () { startGame(lastUnlocked, selectedDifficulty, true); };
    }
  }
  var btnScores = $('btn-scores');
  if (btnScores) btnScores.onclick = function () { showScores(); };
  var btnAch = $('btn-achievements');
  if (btnAch) {
    btnAch.textContent = '🏆 Logros ' + achievementCount() + '/' + ACHIEVEMENTS.length;
    btnAch.onclick = function () { showAchievements(); };
  }
}

function buildDifficultyButtons() {
  var row = $('difficulty-row');
  if (!row || typeof DIFFICULTY === 'undefined') return;
  row.innerHTML = '';
  for (var di = 0; di < 4; di++) {
    (function (di) {
      var d = DIFFICULTY[di];
      var b = document.createElement('button');
      b.className = 'diff-btn' + (di === selectedDifficulty ? ' sel' : '');
      b.textContent = d.name;
      b.style.setProperty('--dc', DIFF_COLORS[di]);
      b.addEventListener('click', function () {
        selectedDifficulty = di;
        buildDifficultyButtons();
        updateDifficultyInfo();
        sfx('ui_click');
      });
      row.appendChild(b);
    })(di);
  }
}

function updateDifficultyInfo() {
  var el = $('difficulty-info');
  if (!el || typeof DIFFICULTY === 'undefined') return;
  var d = DIFFICULTY[selectedDifficulty];
  var parts = [];
  if (d.hpMult !== 1) parts.push('HP ×' + d.hpMult);
  if (d.goldMult !== 1) parts.push('Oro ×' + d.goldMult);
  if (d.livesMod > 0) parts.push('+' + d.livesMod + ' vida');
  else if (d.livesMod < 0) parts.push(d.livesMod + ' vidas');
  if (d.eliteChance > 0) parts.push(Math.round(d.eliteChance * 100) + '% élites');
  parts.push('Enemigos ×' + d.speedMult);
  el.textContent = parts.join(' · ');
}

function startGame(mapId, difficulty, endless) {
  try {
    clearSave();
    if (typeof CONQUEST !== 'undefined' && CONQUEST.enabled) CONQUEST.enabled = false;
    game = new Game(mapId, difficulty !== undefined ? difficulty : selectedDifficulty);
    if (endless) game.continueEndless = true;
    if (typeof CONQUEST !== 'undefined' && CONQUEST.loadBest) CONQUEST.loadBest();
    lastGold = -1; lastLives = -1; lastWave = -1; lastWeather = ''; lastCorruption = -1; lastLevel = -1;
    hideBattleUi();
    buildShop();
    if (!eventsBound) { bindEvents(); eventsBound = true; }
    UI.update(game);
    $('menu-overlay').classList.add('hidden');
    $('achievements-overlay').classList.add('hidden');
    var diffName = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY[game.difficulty]) ? DIFFICULTY[game.difficulty].name : 'Normal';
    var hint = '1-' + TOWER_TYPES.length + '';
    if (endless) {
      toast('♾️ Modo infinito en ' + game.map.name + ': sin victoria final. ¿Hasta qué oleada llegarás?', 5000);
    } else {
      toast('🏰 ¡Bienvenido a ' + game.map.name + '! Dificultad: ' + diffName + '. Pulsa ' + hint + ' para elegir torre y haz clic para construir.', 5000);
    }
  } catch (err) {
    game = null;
    if (typeof console !== 'undefined' && console.error) console.error(err);
    toast('⚠️ Error al iniciar la partida: ' + err.message, 5000);
  }
}

function startConquest(relicId, mapId, difficulty) {
  try {
    clearSave();
    if (typeof CONQUEST === 'undefined') return;
    var diff = Math.min(CONQUEST.difficulty + 1, 2);
    CONQUEST.start(diff, relicId ? [relicId] : []);
    game = new Game(mapId || 'plains', difficulty !== undefined ? difficulty : selectedDifficulty);
    CONQUEST.applyStarting(game);
    lastGold = -1; lastLives = -1; lastWave = -1; lastWeather = ''; lastCorruption = -1; lastLevel = -1;
    hideBattleUi();
    buildShop();
    if (!eventsBound) { bindEvents(); eventsBound = true; }
    UI.update(game);
    $('menu-overlay').classList.add('hidden');
    $('conquest-overlay').classList.add('hidden');
    toast('⚔️ Conquista: comienza en la oleada ' + game.conquestWave + '. Sobrevive hasta la ' + game.conquestFinalWaves[game.conquestFinalWaves.length - 1] + '!', 5000);
  } catch (err) {
    game = null;
    CONQUEST.enabled = false;
    if (typeof console !== 'undefined' && console.error) console.error(err);
    toast('⚠️ Error al iniciar la conquista: ' + err.message, 5000);
  }
}

function showMenu() {
  game = null;
  buildMenu();
  $('menu-overlay').classList.remove('hidden');
  $('conquest-overlay').classList.add('hidden');
  $('achievements-overlay').classList.add('hidden');
  AUDIO.stopMusic();
  AUDIO.stopAmbient();
}

function showAchievements() {
  var list = $('ach-list');
  if (list) {
    list.innerHTML = '';
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var ach = ACHIEVEMENTS[i];
      var unlocked = isAchievementUnlocked(ach.id);
      var card = document.createElement('div');
      card.className = 'ach-card' + (unlocked ? '' : ' locked');
      card.innerHTML = '<span class="ach-icon">' + ach.icon + '</span><span class="ach-text"><b>' + ach.name + '</b><i>' + ach.desc + '</i></span>';
      list.appendChild(card);
    }
    $('ach-count').textContent = achievementCount() + '/' + ACHIEVEMENTS.length + ' completados';
  }
  $('achievements-overlay').classList.remove('hidden');
}

function showConquestSelect() {
  var box = $('cq-relics');
  if (box) {
    box.innerHTML = '';
    for (var i = 0; i < CONQUEST.SELECTED.length; i++) {
      (function (r) {
        var b = document.createElement('button');
        b.className = 'relic-btn';
        b.innerHTML = '<span class="relic-icon">' + r.icon + '</span><span class="relic-name">' + r.name + '</span><span class="relic-desc">' + r.desc + '</span>';
        b.addEventListener('click', function () { startConquest(r.id); });
        box.appendChild(b);
      })(CONQUEST.SELECTED[i]);
    }
  }
  $('conquest-overlay').classList.remove('hidden');
}

var LOAD_TIPS = [
  '💡 Los magos de hielo ralentizan enemigos; combínalos con flechas para máxima eficacia.',
  '💡 Vende torres mal colocadas: recuperas parte del oro invertido.',
  '💡 Los jefes aparecen cada 5 oleadas. ¡Prepara torres de purga contra los corruptos!',
  '💡 Las Barracas bloquean a los enemigos terrestres que pasen por su lado del camino.',
  '💡 El clima cambia la batalla: la lluvia debilita el fuego y potencia el hielo.',
  '💡 La habilidad de cada torre se lanza con la tecla E. ¡Úsala en el momento justo!',
  '💡 Gana oro extra terminando oleadas rápido: el bonus depende de tus vidas restantes.'
];

var BOOT_STEPS = [
  { label: 'Abriendo los archivos del reino...', fn: function () {
      PROGRESS.load();
      if (typeof CONQUEST !== 'undefined' && CONQUEST.loadBest) CONQUEST.loadBest();
      if (typeof SCORES !== 'undefined' && SCORES.load) SCORES.load();
      updateHudLevel();
    } },
  { label: 'Componiendo la melodía del reino...', fn: function () { AUDIO.musicBuffer('normal'); } },
  { label: 'Afinando los tambores de guerra...', fn: function () { AUDIO.musicBuffer('intense'); } },
  { label: 'Invocando el coro del jefe...', fn: function () { AUDIO.musicBuffer('boss'); } },
  { label: 'Tañendo las campanas de victoria...', fn: function () { AUDIO.musicBuffer('victory'); } },
  { label: 'Silenciando los lamentos de derrota...', fn: function () { AUDIO.musicBuffer('defeat'); } },
  { label: 'Despertando vientos y brisas...', fn: function () {
      var themes = ['plains', 'desert', 'forest', 'frozen', 'void'];
      for (var i = 0; i < themes.length; i++) AUDIO.ambientBuffer(themes[i]);
    } },
  { label: 'Encendiendo las antorchas del castillo...', fn: function () {
      buildMenu();
      spawnEmbers();
    } }
];

function runBoot(i, t0) {
  var fill = $('load-fill'), status = $('load-status');
  if (!fill || !status) return;
  if (i >= BOOT_STEPS.length) {
    status.textContent = '¡El reino está listo!';
    fill.style.width = '100%';
    var wait = Math.max(0, 1100 - (performance.now() - t0));
    setTimeout(function () {
      var ov = $('loading-overlay');
      ov.classList.add('done');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 700);
      showMenu();
    }, wait);
    return;
  }
  status.textContent = BOOT_STEPS[i].label;
  try { BOOT_STEPS[i].fn(); }
  catch (err) {
    if (typeof console !== 'undefined' && console.warn) console.warn('Paso de carga ' + i + ' falló:', err);
  }
  fill.style.width = Math.round((i + 1) / BOOT_STEPS.length * 100) + '%';
  setTimeout(function () { runBoot(i + 1, t0); }, 45);
}

function spawnEmbers() {
  var host = $('menu-overlay');
  if (!host || host.dataset.embers) return;
  host.dataset.embers = '1';
  for (var i = 0; i < 18; i++) {
    var s = document.createElement('span');
    s.className = 'ember';
    s.style.left = (Math.random() * 100) + '%';
    s.style.animationDuration = (7 + Math.random() * 9) + 's';
    s.style.animationDelay = (-Math.random() * 14) + 's';
    s.style.setProperty('--eo', (0.25 + Math.random() * 0.5).toFixed(2));
    s.style.setProperty('--esway', Math.round((Math.random() - 0.5) * 120) + 'px');
    var sz = 2 + Math.random() * 4;
    s.style.width = sz.toFixed(1) + 'px';
    s.style.height = sz.toFixed(1) + 'px';
    host.appendChild(s);
  }
}

function fmtTime(totalSecs) {
  var m = Math.floor(totalSecs / 60);
  var s = Math.floor(totalSecs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function showScores() {
  if (typeof SCORES !== 'undefined' && SCORES.load) SCORES.load();
  var list = $('scores-list');
  if (list) {
    list.innerHTML = '';
    var entries = (typeof SCORES !== 'undefined') ? SCORES.list : [];
    if (!entries.length) {
      list.innerHTML = '<p class="scores-empty">Aún no hay hazañas registradas.<br>¡Termina una partida para entrar en la clasificación!</p>';
    }
    var medals = ['🥇', '🥈', '🥉'];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var mapDef = (typeof MAPS_BY_ID !== 'undefined' && MAPS_BY_ID[e.mapId]) ? MAPS_BY_ID[e.mapId] : { icon: '🏰', name: e.mapId };
      var diffDef = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY[e.diff]) ? DIFFICULTY[e.diff] : DIFFICULTY[0];
      var row = document.createElement('div');
      row.className = 'score-row';
      var rankTxt = i < 3 ? medals[i] : (i + 1) + '.';
      var tags = '';
      if (e.endless) tags += '<span class="sc-tag endless">♾️</span>';
      if (e.conquest) tags += '<span class="sc-tag conquest">⚔️</span>';
      row.innerHTML =
        '<span class="sc-rank">' + rankTxt + '</span>' +
        '<span class="sc-map">' + mapDef.icon + ' ' + mapDef.name + '</span>' +
        '<span class="sc-diff" style="--dc:' + DIFF_COLORS[e.diff] + '">' + diffDef.name + '</span>' +
        '<span class="sc-wave">🌊 <b>' + e.wave + '</b></span>' +
        '<span class="sc-kills">⚔️ ' + e.kills + '</span>' +
        '<span class="sc-time">⏱ ' + fmtTime(e.time || 0) + '</span>' +
        '<span class="sc-date">' + new Date(e.date).toLocaleDateString() + '</span>' +
        tags;
      list.appendChild(row);
    }
  }
  $('scores-overlay').classList.remove('hidden');
}

function init() {
  var tipEl = $('load-tip');
  if (tipEl) tipEl.textContent = LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)];
  setupFeedback();
  $('btn-reset-progress').addEventListener('click', function () {
    if (typeof PROGRESS === 'undefined') return;
    if (confirm('¿Seguro que quieres borrar todo tu progreso y experiencia?')) {
      PROGRESS.reset();
      showMenu();
      toast('🗑️ Progreso borrado', 2000);
    }
  });
  var btnAchBack = $('btn-ach-back');
  if (btnAchBack) btnAchBack.addEventListener('click', function () { $('achievements-overlay').classList.add('hidden'); });
  var btnCqBack = $('btn-cq-back');
  if (btnCqBack) btnCqBack.addEventListener('click', function () { $('conquest-overlay').classList.add('hidden'); });
  var btnScBack = $('btn-scores-back');
  if (btnScBack) btnScBack.addEventListener('click', function () { $('scores-overlay').classList.add('hidden'); });
  bindFullscreen();
  bindPauseMenu();
  window.addEventListener('keydown', unlockAudioOnce, { once: true });
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });
  requestAnimationFrame(function (ts) { lastTs = ts; loop(ts); });
  requestAnimationFrame(function () { runBoot(0, performance.now()); });
  // sprites oficiales de personajes (fallback procedural si fallan)
  if (typeof SPRITES !== 'undefined') {
    var keys = [];
    Object.keys(ENEMIES).forEach(function (k) { keys.push(['e', k]); });
    TOWER_TYPES.forEach(function (k) { keys.push(['t', k]); });
    Object.keys(SOLDIER_TYPES).forEach(function (k) { keys.push(['s', k]); });
    SPRITES.preload(keys);
  }
}

function unlockAudioOnce() {
  if (typeof AUDIO !== 'undefined') AUDIO.ensure();
}

/* ===================== FEEDBACK ALPHA ===================== */
var FB_TAGS = ['Jugabilidad', 'Dificultad', 'Gráficos', 'Audio', 'Rendimiento', 'Controles móviles'];

function setupFeedback() {
  var alphaTag = $('alpha-tag');
  if (alphaTag) alphaTag.textContent = 'ALPHA ' + GAME_VERSION;
  var verEl = $('fb-version');
  if (verEl) verEl.textContent = GAME_VERSION;
  var btnMenu = $('btn-feedback'), btnPause = $('btn-pause-feedback');
  if (btnMenu) btnMenu.addEventListener('click', function () { openFeedback(); });
  if (btnPause) btnPause.addEventListener('click', function () {
    $('pause-overlay').classList.add('hidden');
    game.paused = false;
    openFeedback();
  });
  var btnClose = $('btn-fb-close');
  if (btnClose) btnClose.addEventListener('click', closeFeedback);
  var overlay = $('feedback-overlay');
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFeedback(); });
  var tags = document.querySelectorAll('.fb-tag');
  for (var i = 0; i < tags.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { b.classList.toggle('sel'); sfx('ui_click'); });
    })(tags[i]);
  }
  var btnSend = $('btn-fb-send');
  if (btnSend) btnSend.addEventListener('click', sendFeedbackForm);
  var btnCopy = $('btn-fb-copy');
  if (btnCopy) btnCopy.addEventListener('click', copyFeedback);
}

function openFeedback() {
  sfx('ui_click');
  $('feedback-overlay').classList.remove('hidden');
  var t = $('fb-text');
  if (t) setTimeout(function () { t.focus(); }, 60);
}

function closeFeedback() {
  $('feedback-overlay').classList.add('hidden');
  sfx('ui_click');
}

function buildFeedbackText() {
  var lines = ['🏰 VAELDRYN — Feedback (' + GAME_VERSION + ')'];
  var tags = [];
  var els = document.querySelectorAll('.fb-tag.sel');
  for (var i = 0; i < els.length; i++) tags.push(els[i].textContent);
  if (tags.length) lines.push('Temas: ' + tags.join(', '));
  var msg = ($('fb-text').value || '').trim();
  lines.push('', msg || '(sin mensaje)');
  if (game && !game.over) {
    lines.push('', 'Contexto: mapa=' + game.mapId + ' · oleada=' + game.wave + ' · dificultad=' + game.difficulty + ' · vidas=' + game.lives);
  }
  return lines.join('\n');
}

// Abre el formulario de Google con los campos ya rellenados
function sendFeedbackForm() {
  var cfg = (typeof FEEDBACK !== 'undefined') ? FEEDBACK : null;
  if (!cfg || !cfg.formUrl) { toast('⏳ Formulario aún no conectado: usa "Copiar crítica"', 2800); return; }
  var url = cfg.formUrl + (cfg.formUrl.indexOf('?') >= 0 ? '&' : '?') + 'usp=pp_url';
  var els = document.querySelectorAll('.fb-tag.sel');
  var tagArr = [];
  for (var i = 0; i < els.length; i++) tagArr.push(els[i].textContent);
  if (cfg.entryTags) {
    for (var j = 0; j < tagArr.length; j++) url += '&' + cfg.entryTags + '=' + encodeURIComponent(tagArr[j]);
  }
  var msg = ($('fb-text').value || '').trim();
  if (cfg.entryMsg) {
    var full = '';
    if (!cfg.entryTags && tagArr.length) full += '[' + tagArr.join(' / ') + ']\n';
    full += (msg || '(sin mensaje)');
    if (game && !game.over) full += '\n\n[mapa=' + game.mapId + ' oleada=' + game.wave + ' dif=' + game.difficulty + ' v=' + GAME_VERSION + ']';
    url += '&' + cfg.entryMsg + '=' + encodeURIComponent(full);
  }
  window.open(url, '_blank');
  toast('📨 Formulario abierto en tu navegador: revisa y envía', 2600);
  closeFeedback();
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (!ok) throw new Error('clipboard bloqueado');
  return true;
}

function copyFeedback() {
  copyTextToClipboard(buildFeedbackText()).then(function () {
    toast('📋 Crítica copiada. Pégala en el formulario o en Discord del dev', 3200);
    closeFeedback();
  }).catch(function () {
    toast('⚠️ No se pudo copiar automáticamente; selecciona y copia manualmente', 3000);
  });
}

window.addEventListener('DOMContentLoaded', init);
