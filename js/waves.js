'use strict';

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

var WAVE = {
  BOSSES: ['dragon', 'orcKing', 'lord', 'iceDragon', 'warMachine', 'voidLord'],

  // sesgo de composición según el tema del mapa
  THEME_FLAVOR: {
    plains: { n: 12, picks: [['skeleton', 0.5], ['orc', 0.4], ['undead', 0.4]] },
    desert: { n: 11, picks: [['skeleton', 0.7], ['undead', 0.5], ['fireGolem', 0.4]] },
    forest: { n: 11, picks: [['treant', 0.7], ['wisp', 0.6], ['troll', 0.4], ['crawler', 0.5]] },
    frozen: { n: 10, picks: [['iceWraith', 0.7], ['stoneGolem', 0.5], ['stormSpirit', 0.5]] },
    void: { n: 9, picks: [['voidWalker', 0.8], ['hulker', 0.5], ['crawler', 0.5], ['demon', 0.5]] }
  },

  build: function (n) {
    return this.buildFor(n, 'plains');
  },

  buildFor: function (n, mapId) {
    if (n === 0) return [];
    var map = (typeof MAPS_BY_ID !== 'undefined' && MAPS_BY_ID[mapId]) || MAPS_BY_ID['plains'];
    var theme = map ? map.theme : 'plains';
    var list = [];
    var gap = Math.max(0.35, 1.4 - n * 0.06);

    if (n % 5 === 0) {
      var idx = ((n / 5) - 1) % WAVE.BOSSES.length;
      var boss = WAVE.BOSSES[idx];
      var esc = [];
      var bg = Math.max(0.3, 1.1 - n * 0.05);
      // Escoltas moderadas: el jefe debe ser la amenaza principal, no el muro
      var goblins = Math.floor(n * 1.15);
      for (var i = 0; i < goblins; i++) esc.push({ type: 'goblin', gap: bg });
      var orcs = Math.floor(n * 0.45);
      for (var j = 0; j < orcs; j++) esc.push({ type: 'orc', gap: bg });
      if (n >= 10) {
        var sks = Math.floor(n * 0.3);
        for (var k = 0; k < sks; k++) esc.push({ type: 'skeleton', gap: bg });
      }
      if (n >= 15) {
        var uds = Math.floor(n * 0.25);
        for (var m = 0; m < uds; m++) esc.push({ type: 'undead', gap: bg });
      }
      if (n >= 20 && boss !== 'iceDragon') {
        for (var sp = 0; sp < Math.floor(n * 0.25); sp++) esc.push({ type: 'stormSpirit', gap: bg });
      }
      // séquito especializado: sanadores y escudos protegen al jefe
      if (n >= 15) {
        var mend = Math.min(3, 1 + Math.floor(n / 25));
        for (var md = 0; md < mend; md++) esc.push({ type: 'mender', gap: bg });
        var shd = Math.floor(n / 12);
        for (var os2 = 0; os2 < shd; os2++) esc.push({ type: 'orcShield', gap: bg });
      }
      esc = shuffle(esc);
      var bossHpMul = 1 + (n - 5) * 0.08;
      esc.unshift({ type: boss, gap: 3, bossHpMul: bossHpMul });
      list = esc;
    } else {
      var types = [];
      types.push(['goblin', 3 + n * 2]);
      if (n >= 3) types.push(['orc', Math.floor(n * 1.2)]);
      if (n >= 5) types.push(['skeleton', Math.floor(n * 0.9)]);
      if (n >= 6) types.push(['crawler', Math.floor((n - 4) * 0.9)]);
      if (n >= 7) types.push(['berserker', Math.floor((n - 4) * 0.9)]);
      if (n >= 8) types.push(['gargoyle', Math.floor((n - 6) * 0.5)]);
      if (n >= 9) types.push(['bat', Math.floor(n * 0.6)]);
      if (n >= 11) types.push(['sorcerer', Math.floor((n - 8) * 0.5)]);
      if (n >= 11) types.push(['wisp', Math.floor((n - 9) * 0.5)]);
      if (n >= 12) types.push(['shaman', Math.floor((n - 10) * 0.35)]);
      if (n >= 13) types.push(['troll', Math.floor((n - 10) * 0.5)]);
      if (n >= 14) types.push(['fireGolem', Math.floor((n - 12) * 0.4)]);
      if (n >= 14) types.push(['demon', Math.floor((n - 12) * 0.45)]);
      if (n >= 15) types.push(['iceWraith', Math.floor((n - 12) * 0.5)]);
      if (n >= 16) types.push(['undead', Math.floor((n - 12) * 0.5)]);
      if (n >= 17) types.push(['stoneGolem', Math.floor((n - 14) * 0.4)]);
      if (n >= 17) types.push(['lich', Math.floor((n - 15) * 0.35)]);
      if (n >= 18) types.push(['treant', Math.floor((n - 15) * 0.5)]);
      if (n >= 18) types.push(['necromancer', Math.floor((n - 14) * 0.4)]);
      if (n >= 19) types.push(['stormSpirit', Math.floor((n - 15) * 0.5)]);
      if (n >= 19) types.push(['voidWalker', Math.floor((n - 17) * 0.5)]);
      if (n >= 13) types.push(['orcShield', Math.floor((n - 11) * 0.45)]);
      if (n >= 15) types.push(['mender', Math.floor((n - 13) * 0.35)]);
      if (n >= 17) types.push(['phaseStalker', Math.floor((n - 15) * 0.45)]);
      if (n >= 8) types.push(['saboteur', Math.floor((n - 6) * 0.4)]);
      if (n >= 10) types.push(['assassin', Math.floor((n - 8) * 0.45)]);
      if (n >= 12) types.push(['thief', Math.floor((n - 10) * 0.3)]);
      if (n >= 18) types.push(['hulker', Math.floor((n - 16) * 0.3)]);
      if (n >= 7) types.push(['splitter', Math.floor((n - 5) * 0.4)]);
      for (var t = 0; t < types.length; t++) {
        var arr = types[t];
        for (var c = 0; c < arr[1]; c++) list.push({ type: arr[0], gap: gap });
      }
      // sabor del tema
      var fl = WAVE.THEME_FLAVOR[theme];
      if (fl && n >= fl.n) {
        for (var f = 0; f < fl.picks.length; f++) {
          var pk = fl.picks[f];
          var count = Math.floor((n - fl.n + 3) * pk[1]);
          for (var f2 = 0; f2 < count; f2++) list.push({ type: pk[0], gap: gap });
        }
      }
      list = shuffle(list);
      if (list.length) list[0].gap = 2;
    }
    if (list.length > 90) list = list.slice(0, 90);
    return list;
  }
};
