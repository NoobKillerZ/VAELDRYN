'use strict';

// ============================================================
//  PROGRESIÓN PERSISTENTE DE VALDRYN
//  Guarda el avance del jugador: mapas superados, nivel,
//  experiencia y récords. Se guarda en localStorage.
// ============================================================

var ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Primera Sangre', desc: 'Mata tu primer enemigo', icon: '🗡️' },
  { id: 'wave_5', name: 'Oleada 5', desc: 'Sobrevive 5 oleadas', icon: '⚔️' },
  { id: 'wave_10', name: 'Veterano', desc: 'Sobrevive 10 oleadas', icon: '🛡️' },
  { id: 'wave_20', name: 'Invicto', desc: 'Completa todas las 20 oleadas', icon: '👑' },
  { id: 'all_maps', name: 'Explorador', desc: 'Desbloquea todos los mapas', icon: '🗺️' },
  { id: 'gold_500', name: 'Avaricia', desc: 'Acumula 500 de oro en una partida', icon: '💰' },
  { id: 'kill_100', name: 'Carnicero', desc: 'Mata 100 enemigos en total', icon: '💀' },
  { id: 'kill_500', name: 'Destructor', desc: 'Mata 500 enemigos en total', icon: '🔥' },
  { id: 'hard_win', name: 'Masoquista', desc: 'Gana en Difícil o superior', icon: '🌟' },
  { id: 'tower_max', name: 'Maestro Constructor', desc: 'Mejora una torre al máximo nivel', icon: '🏷️' },
  { id: 'splitter_kill', name: 'Atomizador', desc: 'Mata un Escindido y todos sus fragmentos', icon: '💥' },
  { id: 'barracks', name: 'General', desc: 'Coloca una torre Barracas', icon: '🏰' }
];

var PROGRESS = {
  KEY: 'vaeldryn_save_v2',
  data: null,

  load: function () {
    try {
      this.data = JSON.parse(localStorage.getItem(this.KEY));
    } catch (e) { this.data = null; }
    if (!this.data || typeof this.data !== 'object' || Array.isArray(this.data)) {
      this.data = { maps: {}, xp: 0, totalWaves: 0, wins: 0, playCount: 0, goldEarned: 0, achievements: {} };
    }
    if (!this.data.maps) this.data.maps = {};
    if (!this.data.achievements) this.data.achievements = {};
  },

  save: function () {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  reset: function () {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    this.data = { maps: {}, xp: 0, totalWaves: 0, wins: 0, playCount: 0, goldEarned: 0, achievements: {} };
    this.save();
  },

  get xp() { return this.data.xp || 0; },
  get level() { return Math.floor((this.data.xp || 0) / 100) + 1; },
  get levelPct() { return (this.data.xp || 0) % 100; },
  get totalWaves() { return this.data.totalWaves || 0; },
  get wins() { return this.data.wins || 0; },
  get playCount() { return this.data.playCount || 0; },
  get goldEarned() { return this.data.goldEarned || 0; },

  startGoldBonus: function () {
    return Math.min(80, (this.level - 1) * 5);
  },

  mapProgress: function (id) {
    return this.data.maps[id] || { bestWave: 0, completed: false, stars: 0 };
  },

  isMapUnlocked: function (id) {
    for (var i = 0; i < MAPS.length; i++) {
      if (MAPS[i].id === id) {
        if (i === 0) return true;
        var prev = this.data.maps[MAPS[i - 1].id];
        return !!prev && prev.completed === true;
      }
    }
    return true;
  },

  // ¿la torre está desbloqueada de forma permanente?
  isTowerUnlocked: function (type) {
    var def = TOWERS[type];
    if (!def || !def.unlock) return true;
    if (def.unlock.map) {
      var m = this.data.maps[def.unlock.map];
      return !!m && m.completed === true;
    }
    return true;
  },

  recordRun: function (mapId, game) {
    var m = this.data.maps[mapId] || { bestWave: 0, completed: false, stars: 0, goldEarned: 0 };
    m.bestWave = Math.max(m.bestWave || 0, game.wave);
    m.goldEarned = (m.goldEarned || 0) + Math.round(game.gold * 0.3);
    if (game.wave >= CONFIG.WIN_WAVE) m.completed = true;
    var pct = Math.max(0, Math.min(1, game.wave / CONFIG.WIN_WAVE));
    var stars = pct >= 1 ? 3 : (pct >= 0.7 ? 2 : (pct >= 0.35 ? 1 : 0));
    m.stars = Math.max(m.stars || 0, stars);
    this.data.maps[mapId] = m;
    this.data.totalWaves = Math.max(this.data.totalWaves || 0, game.wave);
    this.data.maxWaveBeaten = Math.max(this.data.maxWaveBeaten || 0, game.wave);
    if ((this.data.maxWaveBeaten || 0) >= 10) this.data.conquestUnlocked = true;
    this.data.goldEarned = (this.data.goldEarned || 0) + game.kills * 4;
    this.data.playCount = (this.data.playCount || 0) + 1;
    var gained = Math.round(game.wave * 6 + game.kills * 0.5);
    this.addXp(gained);
    if (game.wave >= CONFIG.WIN_WAVE) this.data.wins = (this.data.wins || 0) + 1;
    this.save();
    return gained;
  },

  addXp: function (n) {
    this.data.xp = (this.data.xp || 0) + n;
  }
};

function maxWaveBeaten() {
  if (!PROGRESS.data) return 0;
  var best = PROGRESS.data.maxWaveBeaten || 0;
  for (var mk in PROGRESS.data.maps) best = Math.max(best, PROGRESS.data.maps[mk].bestWave || 0);
  return best;
}

function conquestUnlocked() {
  return !!PROGRESS.data.conquestUnlocked || maxWaveBeaten() >= 10;
}

function unlockAchievement(aid) {
  if (!PROGRESS.data.achievements) PROGRESS.data.achievements = {};
  if (PROGRESS.data.achievements[aid]) return false;
  PROGRESS.data.achievements[aid] = true;
  PROGRESS.save();
  return true;
}

function isAchievementUnlocked(aid) {
  return !!(PROGRESS.data && PROGRESS.data.achievements && PROGRESS.data.achievements[aid]);
}

function achievementCount() {
  var n = 0;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    if (isAchievementUnlocked(ACHIEVEMENTS[i].id)) n++;
  }
  return n;
}

// --- Clasificación local (mejores partidas) ---
var SCORES = {
  key: 'vaeldryn_scores',
  list: [],

  load: function () {
    try {
      this.list = JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch (e) { this.list = []; }
    if (!Array.isArray(this.list)) this.list = [];
    return this.list;
  },

  save: function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.list)); } catch (e) { /* ignorar */ }
  },

  add: function (entry) {
    entry.date = Date.now();
    this.list.push(entry);
    this.list.sort(function (a, b) {
      return (b.wave - a.wave) || (b.kills - a.kills);
    });
    if (this.list.length > 10) this.list.length = 10;
    this.save();
    return this.list.indexOf(entry);
  }
};
