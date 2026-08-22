'use strict';

var DIRECTOR = {
  LEVELS: ['Relajado', 'Agresivo', 'Pesadilla'],
  level: 0,
  stats: {
    dmg: { physical: 0, fire: 0, ice: 0, earth: 0, nature: 0, lightning: 0, void: 0 },
    kills: 0,
    livesLost: 0,
    leaks: 0,
    goldEarned: 0,
    towersBuilt: 0,
    placements: []
  },
  adapted: false,
  lastReport: '',

  reset: function () {
    this.stats.dmg = { physical: 0, fire: 0, ice: 0, earth: 0, nature: 0, lightning: 0, void: 0 };
    this.stats.kills = 0;
    this.stats.livesLost = 0;
    this.stats.leaks = 0;
    this.stats.goldEarned = 0;
    this.stats.towersBuilt = 0;
    this.stats.placements = [];
    this.adapted = false;
  },

  recordDamage: function (element, amount) {
    if (!this.stats.dmg[element]) this.stats.dmg[element] = 0;
    this.stats.dmg[element] += amount;
  },

  recordKill: function () { this.stats.kills++; },

  recordLeak: function (dmg) { this.stats.leaks++; this.stats.livesLost += dmg; },

  recordGold: function (amt) { this.stats.goldEarned += amt; },

  recordBuild: function (c, r, type) { this.stats.towersBuilt++; this.stats.placements.push({ c: c, r: r, type: type }); },

  dominantElement: function () {
    var d = this.stats.dmg;
    var total = d.physical + d.fire + d.ice + d.earth + d.nature + d.lightning + d.void;
    if (total <= 0) return null;
    var best = null, bestPct = 0;
    for (var k in d) {
      var pct = d[k] / total;
      if (pct > bestPct) { best = k; bestPct = pct; }
    }
    return { element: best, pct: bestPct };
  },

  elementCounter: function (element) {
    var map = {
      fire: ['fireGolem', 'treant'],
      ice: ['iceWraith', 'stormSpirit'],
      earth: ['stoneGolem', 'treant'],
      nature: ['treant', 'fireGolem'],
      physical: ['undead', 'stoneGolem', 'orcShield']
    };
    return map[element] || [];
  },

  weaknessOf: function (element) {
    var map = {
      fire: 'ice',
      ice: 'fire',
      earth: 'nature',
      nature: 'fire',
      physical: 'fire'
    };
    return map[element] || 'fire';
  },

  analyze: function (game) {
    var dom = this.dominantElement();
    if (!dom) return 'Aún no hay datos suficientes...';
    var total = this.stats.dmg.physical + this.stats.dmg.fire + this.stats.dmg.ice + this.stats.dmg.earth + this.stats.dmg.nature + this.stats.dmg.lightning + this.stats.dmg.void;
    var lines = [];
    lines.push('Elemento dominante: <b>' + {
      physical: 'Físico', fire: 'Fuego', ice: 'Hielo', earth: 'Tierra', nature: 'Naturaleza', lightning: 'Rayo', void: 'Vacío'
    }[dom.element] + '</b> (' + Math.round(dom.pct * 100) + '% de ' + Math.round(total) + ' de daño)');
    if (this.stats.livesLost > 0) lines.push('Vidas perdidas: ' + this.stats.livesLost);
    return lines.join('<br>');
  },

  buildWave: function (n, game) {
    var list = (typeof WAVE.buildFor !== 'undefined' && game && game.mapId) ? WAVE.buildFor(n, game.mapId) : WAVE.build(n);
    var dom = this.dominantElement();
    if (!dom || dom.pct < 0.3) return list;
    var diff = this.level;
    var strength = Math.max(1, Math.floor((n - 4) * 0.35));
    var counters = this.elementCounter(dom.element);
    if (!counters.length) return list;
    var idx = Math.floor(Math.random() * counters.length);
    var counter = counters[idx];
    var extra = [];
    for (var i = 0; i < strength; i++) {
      extra.push({ type: counter, gap: 0.6 });
    }
    if (diff >= 1 && n >= 7) {
      var second = this.elementCounter(dom.element);
      if (second.length > 1) {
        var idx2 = (idx + 1 + Math.floor(Math.random() * (second.length - 1))) % second.length;
        for (var j = 0; j < Math.floor(strength / 2); j++) {
          extra.push({ type: second[idx2], gap: 0.7 });
        }
      }
      if (diff >= 2 && n >= 10) {
        for (var k = 0; k < Math.floor(strength / 3); k++) {
          extra.push({ type: 'voidWalker', gap: 1 });
        }
      }
    }
    list = shuffle(list.concat(extra));
    if (list.length > 90) list = list.slice(0, 90);
    this.adapted = true;
    return list;
  }
};
