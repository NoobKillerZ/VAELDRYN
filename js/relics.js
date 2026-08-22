'use strict';

var RELICS = [
  { id: 'berserker', name: 'Corazón del Berserker', icon: '🩸', desc: '+25% daño en todas las torres, pero -15% alcance.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { var t = g.towers[i]; t.damage *= 1.25; t.range *= 0.85; }
  } },
  { id: 'merchant', name: 'Corona del Mercader', icon: '🪙', desc: '+30% de oro por derrota, pero las mejoras cuestan +25%.', goldMult: 1.3, upCostMult: 1.25 },
  { id: 'glacier', name: 'Fragmento Glacial', icon: '❄️', desc: 'Los enemigos comienzan ralentizados.', apply: function (g) { g.startSlow = 0.8; } },
  { id: 'archery', name: 'Manual del Arquero', icon: '🏹', desc: '+30% daño físico.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { if (g.towers[i].element === 'physical') g.towers[i].damage *= 1.3; }
  } },
  { id: 'pyromancer', name: 'Grimorio Ígneo', icon: '🔥', desc: '+30% daño de fuego y quema más fuerte.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { if (g.towers[i].element === 'fire') g.towers[i].damage *= 1.3; }
  } },
  { id: 'cryomancer', name: 'Perla Glacial', icon: '🧊', desc: '+30% daño de hielo y ralentiza más.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { if (g.towers[i].element === 'ice') g.towers[i].damage *= 1.3; }
  } },
  { id: 'lucky', name: 'Trébol de la Suerte', icon: '🍀', desc: '+2 vidas máximas y 15% de probabilidad de crítico.', apply: function (g) { g.lives += 2; g.critChance = 0.15; } },
  { id: 'hunter', name: 'Ojo del Cazador', icon: '👁️', desc: '+20% alcance en todas las torres.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { g.towers[i].range *= 1.2; }
  } },
  { id: 'engineer', name: 'Engranaje de Ingeniero', icon: '⚙️', desc: '+25% cadencia de ataque.', apply: function (g) {
    for (var i = 0; i < g.towers.length; i++) { g.towers[i].rate *= 0.75; }
  } },
  { id: 'fountain', name: 'Fuente Sagrada', icon: '⛲', desc: 'Los enemigos dejan menos corrupción y las torres la purifican.', apply: function (g) { g.purifyRate = 0.03; g.corruptMult = 0.5; } },
  { id: 'storm', name: 'Runa de Tormenta', icon: '⚡', desc: '+20% daño de hielo y tierra, y las tormentas no te afectan.', apply: function (g) { g.stormImmune = true; } }
];

var CONQUEST = {
  enabled: false,
  difficulty: 0,
  relics: [],
  nextRelics: [],
  rewardPicked: false,
  bestWave: 0,
  runGold: 0,

  SETTINGS: {
    startWaves: 10,
    finalWaves: [15, 20, 25, 30],
    goldPerEnd: 100,
    hpLossPerEnd: 10,
    hpBonusPer5Waves: 20,
    finalBonusGold: 300,
    conquestTimerStart: 100,
    conquestTimerEnd: 40,
    conquestTimerDec: 0.6
  },

  SELECTED: [
    { id: 'glacier', name: 'Fragmento Glacial', icon: '❄️', desc: 'Los enemigos comienzan ralentizados.' },
    { id: 'merchant', name: 'Corona del Mercader', icon: '🪙', desc: '+30% de oro por derrota, pero las mejoras cuestan +25%.' }
  ],

  loadBest: function () {
    try { this.bestWave = parseInt(localStorage.getItem('vaeldryn_best') || '0', 10) || 0; } catch (e) { this.bestWave = 0; }
  },

  saveBest: function () {
    try { localStorage.setItem('vaeldryn_best', String(this.bestWave)); } catch (e) {}
  },

  start: function (difficulty, relicIds) {
    this.enabled = true;
    this.difficulty = difficulty;
    this.relics = relicIds.slice();
    this.rewardPicked = false;
    this.runGold = 0;
    DIRECTOR.level = difficulty;
  },

  pickRewards: function (n) {
    var pool = RELICS.slice();
    var have = {};
    for (var i = 0; i < this.relics.length; i++) have[this.relics[i]] = true;
    pool = pool.filter(function (r) { return !have[r.id]; });
    var shuffled = pool.slice();
    for (var j = shuffled.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = shuffled[j]; shuffled[j] = shuffled[k]; shuffled[k] = tmp;
    }
    this.nextRelics = shuffled.slice(0, n);
    return this.nextRelics;
  },

  _extraPick: function (game) {
    var pool = RELICS.slice();
    var have = {};
    for (var i = 0; i < this.relics.length; i++) have[this.relics[i]] = true;
    pool = pool.filter(function (r) { return !have[r.id]; });
    if (!pool.length) return null;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    this.grantRelic(pick.id, game);
    return pick.id;
  },

  recordRun: function (game) {
    this.runGold += game.gold;
    if (game.wave > this.bestWave) {
      this.bestWave = game.wave;
      this.saveBest();
    }
  },

  _applyEffects: function (id, game, silent) {
    for (var i = 0; i < RELICS.length; i++) {
      if (RELICS[i].id === id) {
        var r = RELICS[i];
        if (r.apply) r.apply(game);
        if (r.goldMult) game.goldMult = (game.goldMult || 1) * r.goldMult;
        if (r.upCostMult) game.upCostMult = (game.upCostMult || 1) * r.upCostMult;
        if (!silent) toast(r.icon + ' Reliquia obtenida: ' + r.name, 3000);
        break;
      }
    }
  },

  grantRelic: function (id, game, silent) {
    this.relics.push(id);
    this._applyEffects(id, game, silent);
  },

  applyStarting: function (game) {
    // Las reliquias iniciales YA están registradas por start(): aquí solo se
    // aplican sus efectos sobre el Game recién creado, sin re-registrarlas
    // (re-grantearlas duplicaba goldMult y antes llegó a colgar el bucle).
    for (var i = 0; i < this.relics.length; i++) {
      this._applyEffects(this.relics[i], game, true);
    }
  }
};
