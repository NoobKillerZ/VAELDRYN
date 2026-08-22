'use strict';

// ============================================================
//  MOTOR DE AUDIO PROCEDURAL PARA VAELDRYN (WebAudio)
//  Genera todos los efectos de sonido y música sin archivos
//  externos. Portado desde python/audio.py.
// ============================================================

var SR = 22050;

var AUDIO = {
  ctx: null,
  enabled: true,
  sfxVolume: 0.7,
  musicVolume: 0.5,
  masterVolume: 0.8,
  _cache: {},
  _musicCache: {},
  _currentMusicKey: null,
  _currentAmbKey: null,
  _musicGain: null,
  _ambSource: null,
  _voices: 0,
  _lastPlay: {},

  ensure: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
      return true;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return false; }
    try { this.ctx = new AC(); } catch (e) { this.enabled = false; return false; }
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = this.musicVolume * this.masterVolume;
    this._musicGain.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    return true;
  },

  // ---------- utilidades de generación ----------
  _buf: function (samples, volume) {
    var v = volume === undefined ? 0.5 : volume;
    var n = samples.length;
    var buffer = this.ctx.createBuffer(1, n, SR);
    var d = buffer.getChannelData(0);
    for (var i = 0; i < n; i++) {
      var s = samples[i] * v;
      d[i] = s > 1 ? 1 : (s < -1 ? -1 : s);
    }
    return buffer;
  },

  sine: function (freq, dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * freq * i / SR);
    return out;
  },

  square: function (freq, dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * freq * i / SR) > 0 ? 1 : -1;
    return out;
  },

  saw: function (freq, dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = 2 * ((freq * i / SR) % 1) - 1;
    return out;
  },

  noise: function (dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
    return out;
  },

  envelope: function (samples, attack, decay, sustain, release) {
    var n = samples.length, out = new Float32Array(n);
    var aN = Math.floor(SR * attack), dN = Math.floor(SR * decay), rN = Math.floor(SR * release);
    var sN = Math.max(0, n - aN - dN - rN);
    for (var i = 0; i < n; i++) {
      var env;
      if (i < aN) env = i / Math.max(1, aN);
      else if (i < aN + dN) env = 1 - (1 - sustain) * ((i - aN) / Math.max(1, dN));
      else if (i < aN + dN + sN) env = sustain;
      else env = sustain * (1 - (i - aN - dN - sN) / Math.max(1, rN));
      out[i] = samples[i] * env;
    }
    return out;
  },

  sweep: function (fStart, fEnd, dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var t = i / n;
      var freq = fStart + (fEnd - fStart) * t;
      out[i] = Math.sin(2 * Math.PI * freq * i / SR);
    }
    return out;
  },

  mixLayers: function (layers, volumes) {
    if (!layers.length) return new Float32Array(0);
    var vols = volumes;
    if (!vols) { vols = []; for (var v = 0; v < layers.length; v++) vols.push(1); }
    var maxLen = 0, li;
    for (li = 0; li < layers.length; li++) maxLen = Math.max(maxLen, layers[li].length);
    var out = new Float32Array(maxLen);
    for (li = 0; li < layers.length; li++) {
      var layer = layers[li];
      for (var i = 0; i < layer.length; i++) out[i] += layer[i] * vols[li];
    }
    var peak = 0;
    for (var p = 0; p < maxLen; p++) peak = Math.max(peak, Math.abs(out[p]));
    if (peak > 1) { for (var q = 0; q < maxLen; q++) out[q] /= peak; }
    return out;
  },

  lowpass: function (samples, cutoff) {
    var rc = 1 / (2 * Math.PI * cutoff), dt = 1 / SR;
    var alpha = dt / (rc + dt);
    var n = samples.length, out = new Float32Array(n);
    out[0] = samples[0] || 0;
    for (var i = 1; i < n; i++) out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
    return out;
  },

  highpass: function (samples, cutoff) {
    var rc = 1 / (2 * Math.PI * cutoff), dt = 1 / SR;
    var alpha = rc / (rc + dt);
    var n = samples.length, out = new Float32Array(n);
    if (n === 0) return out;
    var prevIn = samples[0];
    for (var i = 1; i < n; i++) {
      out[i] = alpha * (out[i - 1] + samples[i] - prevIn);
      prevIn = samples[i];
    }
    return out;
  },

  crackle: function (dur, density) {
    var n = Math.floor(SR * dur);
    var out = new Float32Array(n);
    if (n === 0) return out;
    var gap = Math.max(1, Math.floor(SR / density));
    var i = 0;
    while (i < n) {
      i += Math.floor(Math.random() * gap) + 1;
      if (i >= n) break;
      var amp = 0.4 + Math.random() * 0.6;
      var len = 2 + Math.floor(Math.random() * 40);
      for (var j = 0; j < len && i + j < n; j++) {
        out[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / len);
      }
    }
    return out;
  },

  delay: function (samples, sec) {
    var dN = Math.floor(SR * sec);
    var out = new Float32Array(dN + samples.length);
    for (var i = 0; i < samples.length; i++) out[dN + i] = samples[i];
    return out;
  },

  // ---------- biblioteca SFX ----------
  _get: function (key, gen) {
    if (!this._cache[key]) this._cache[key] = this._buf(gen(), undefined);
    return this._cache[key];
  },

  sfxBuffer: function (name) {
    switch (name) {
      case 'ui_click': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sine(800, 0.06), AUDIO.noise(0.06)]), 0.002, 0.02, 0.3, 0.03); });
      case 'ui_hover': return this._get(name, function () { return AUDIO.envelope(AUDIO.sine(600, 0.03), 0.002, 0.01, 0.2, 0.01); });
      case 'ui_open': return this._get(name, function () { return AUDIO.envelope(AUDIO.sweep(300, 600, 0.12), 0.005, 0.03, 0.5, 0.06); });
      case 'tower_build': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 500, 0.15), AUDIO.sine(400, 0.2)], [0.6, 0.4]), 0.005, 0.05, 0.5, 0.1); });
      case 'tower_sell': return this._get(name, function () { return AUDIO.envelope(AUDIO.sweep(500, 180, 0.2), 0.005, 0.05, 0.3, 0.12); });
      case 'tower_upgrade': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 800, 0.15), AUDIO.sweep(600, 1200, 0.15), AUDIO.sine(800, 0.25)], [0.4, 0.3, 0.3]), 0.005, 0.04, 0.6, 0.15); });
      case 'tower_destroy': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.3), AUDIO.sweep(300, 80, 0.3)], [0.7, 0.5]), 0.002, 0.08, 0.3, 0.15); });
      case 'tower_repair': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(500, 900, 0.12), AUDIO.sine(700, 0.18)], [0.5, 0.5]), 0.003, 0.03, 0.5, 0.1); });
      case 'tower_attack_archer': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(2000, 600, 0.08), AUDIO.noise(0.04)], [0.7, 0.5]), 0.001, 0.015, 0.2, 0.03); });
      case 'tower_attack_fire': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([
        AUDIO.crackle(0.18, 320),
        AUDIO.noise(0.2),
        AUDIO.sweep(900, 140, 0.2),
        AUDIO.sine(68, 0.3)
      ], [0.4, 0.6, 0.5, 0.45]), 1800), 0.004, 0.05, 0.35, 0.12); });
      case 'tower_attack_ice': return this._get(name, function () { return AUDIO.envelope(AUDIO.highpass(AUDIO.mixLayers([
        AUDIO.sweep(1900, 3100, 0.09),
        AUDIO.sine(1320, 0.13),
        AUDIO.crackle(0.12, 850),
        AUDIO.delay(AUDIO.sine(2640, 0.06), 0.05)
      ], [0.5, 0.4, 0.35, 0.3]), 900), 0.001, 0.012, 0.22, 0.06); });
      case 'tower_attack_dwarf': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.noise(0.09),
        AUDIO.sweep(430, 90, 0.14),
        AUDIO.sine(92, 0.22),
        AUDIO.sine(1244, 0.09),
        AUDIO.delay(AUDIO.sine(1866, 0.06), 0.04)
      ], [0.55, 0.55, 0.5, 0.3, 0.2]), 0.001, 0.02, 0.22, 0.12); });
      case 'tower_attack_crossbow': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(1800, 800, 0.06), AUDIO.noise(0.04)], [0.7, 0.4]), 0.001, 0.01, 0.15, 0.03); });
      case 'tower_attack_venom': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([
        AUDIO.sweep(520, 140, 0.14),
        AUDIO.delay(AUDIO.sweep(340, 90, 0.12), 0.05),
        AUDIO.sine(210, 0.1),
        AUDIO.noise(0.07)
      ], [0.5, 0.5, 0.4, 0.3]), 1300), 0.003, 0.025, 0.22, 0.06); });
      case 'tower_attack_tesla': return this._get(name, function () { return AUDIO.envelope(AUDIO.highpass(AUDIO.mixLayers([
        AUDIO.crackle(0.16, 1100),
        AUDIO.sweep(5200, 300, 0.13),
        AUDIO.square(92, 0.18),
        AUDIO.noise(0.04)
      ], [0.9, 0.65, 0.28, 0.3]), 550), 0.001, 0.015, 0.28, 0.06); });
      case 'tower_attack_knight': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.sine(1180, 0.14),
        AUDIO.sine(1731, 0.11),
        AUDIO.sine(2358, 0.08),
        AUDIO.noise(0.05),
        AUDIO.sweep(700, 210, 0.09)
      ], [0.4, 0.3, 0.2, 0.45, 0.5]), 0.0008, 0.012, 0.15, 0.04); });
      case 'tower_attack_sniper': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.noise(0.04),
        AUDIO.sweep(3600, 700, 0.06),
        AUDIO.lowpass(AUDIO.delay(AUDIO.noise(0.28), 0.07), 800),
        AUDIO.sine(175, 0.3)
      ], [0.8, 0.6, 0.35, 0.3]), 0.0005, 0.01, 0.12, 0.04); });
      case 'tower_attack_holy': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.sweep(700, 1250, 0.16),
        AUDIO.sine(1050, 0.22),
        AUDIO.sine(1575, 0.18),
        AUDIO.delay(AUDIO.sine(2100, 0.12), 0.06)
      ], [0.35, 0.4, 0.3, 0.22]), 0.003, 0.03, 0.45, 0.1); });
      case 'tower_attack_warlock': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 600, 0.15), AUDIO.square(80, 0.15), AUDIO.noise(0.08)], [0.4, 0.3, 0.3]), 0.003, 0.04, 0.4, 0.08); });
      case 'tower_attack_druid': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 800, 0.2), AUDIO.sine(600, 0.25)], [0.5, 0.5]), 0.005, 0.05, 0.5, 0.12); });
      case 'tower_attack_banner': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([
        AUDIO.saw(146.8, 0.55),
        AUDIO.saw(148.2, 0.55),
        AUDIO.sine(73.4, 0.6),
        AUDIO.delay(AUDIO.saw(220, 0.35), 0.12)
      ], [0.4, 0.35, 0.4, 0.25]), 1100), 0.05, 0.08, 0.5, 0.15); });
      case 'ability_generic': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 1200, 0.2), AUDIO.sweep(600, 1800, 0.2), AUDIO.sine(1000, 0.3)], [0.3, 0.3, 0.4]), 0.005, 0.05, 0.5, 0.2); });
      case 'ability_meteor': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.4), AUDIO.sweep(100, 40, 0.4), AUDIO.sine(60, 0.5)], [0.5, 0.5, 0.3]), 0.002, 0.1, 0.5, 0.25); });
      case 'ability_frost_nova': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(2000, 4000, 0.3), AUDIO.sweep(1500, 3000, 0.25), AUDIO.sine(2000, 0.4)], [0.3, 0.3, 0.4]), 0.003, 0.05, 0.4, 0.25); });
      case 'ability_arrow_rain': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(2000, 800, 0.25), AUDIO.noise(0.15)], [0.6, 0.5]), 0.002, 0.04, 0.4, 0.12); });
      case 'ability_bombardment': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.5), AUDIO.sweep(200, 50, 0.5), AUDIO.sine(80, 0.6)], [0.5, 0.5, 0.3]), 0.001, 0.08, 0.5, 0.3); });
      case 'ability_chain_lightning': return this._get(name, function () { return AUDIO.envelope(AUDIO.highpass(AUDIO.mixLayers([
        AUDIO.crackle(0.24, 1400),
        AUDIO.sweep(4800, 260, 0.18),
        AUDIO.delay(AUDIO.sweep(3600, 200, 0.1), 0.07),
        AUDIO.square(110, 0.2)
      ], [0.9, 0.6, 0.45, 0.26]), 500), 0.001, 0.02, 0.3, 0.1); });
      case 'ability_shield_bash': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.12), AUDIO.sweep(600, 150, 0.12), AUDIO.sine(200, 0.15)], [0.6, 0.5, 0.4]), 0.001, 0.03, 0.3, 0.06); });
      case 'ability_purification': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(600, 1200, 0.3), AUDIO.sine(900, 0.35), AUDIO.sine(1350, 0.3)], [0.3, 0.4, 0.3]), 0.005, 0.05, 0.6, 0.2); });
      case 'ability_war_cry': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 500, 0.2), AUDIO.sine(350, 0.3)], [0.6, 0.4]), 0.003, 0.05, 0.5, 0.15); });
      case 'ability_lethal_shot': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(3000, 1500, 0.12), AUDIO.noise(0.06), AUDIO.sine(800, 0.15)], [0.5, 0.3, 0.3]), 0.001, 0.02, 0.2, 0.05); });
      case 'ability_devastation': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.5), AUDIO.sweep(100, 30, 0.5), AUDIO.square(60, 0.3), AUDIO.sine(200, 0.4)], [0.4, 0.4, 0.2, 0.2]), 0.001, 0.08, 0.5, 0.3); });
      case 'ability_toxic_cloud': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(300, 200, 0.3), AUDIO.noise(0.2)], [0.5, 0.5]), 0.005, 0.05, 0.4, 0.15); });
      case 'projectile_hit': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.06), AUDIO.sweep(800, 300, 0.05)], [0.6, 0.5]), 0.001, 0.01, 0.15, 0.02); });
      case 'projectile_explosion': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([AUDIO.noise(0.35), AUDIO.sweep(150, 40, 0.35), AUDIO.sine(80, 0.4)], [0.5, 0.5, 0.3]), 3000), 0.001, 0.06, 0.4, 0.2); });
      case 'projectile_frost': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(1500, 2500, 0.08), AUDIO.sine(1800, 0.1)], [0.6, 0.4]), 0.002, 0.02, 0.3, 0.04); });
      case 'enemy_spawn': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(150, 300, 0.1), AUDIO.noise(0.06)], [0.5, 0.3]), 0.003, 0.03, 0.3, 0.04); });
      case 'enemy_hurt': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.06), AUDIO.sweep(600, 300, 0.05)], [0.6, 0.5]), 0.001, 0.01, 0.15, 0.02); });
      case 'shield_block': return this._get(name, function () { return AUDIO.envelope(AUDIO.highpass(AUDIO.mixLayers([
        AUDIO.sine(1244, 0.09),
        AUDIO.sine(1866, 0.06),
        AUDIO.noise(0.05)
      ], [0.55, 0.35, 0.5]), 900), 0.001, 0.005, 0.28, 0.04); });
      case 'cloak_on': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.sweep(400, 1600, 0.22),
        AUDIO.sine(1200, 0.18),
        AUDIO.delay(AUDIO.sweep(900, 2400, 0.12), 0.08)
      ], [0.4, 0.3, 0.3]), 0.01, 0.03, 0.3, 0.12); });
      case 'heal_pulse': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([
        AUDIO.sine(660, 0.18),
        AUDIO.delay(AUDIO.sine(990, 0.16), 0.07)
      ], [0.5, 0.45]), 0.01, 0.02, 0.35, 0.1); });
      case 'enemy_death': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 100, 0.2), AUDIO.noise(0.12)], [0.5, 0.5]), 0.001, 0.04, 0.3, 0.1); });
      case 'enemy_death_boss': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([AUDIO.noise(0.6), AUDIO.sweep(200, 30, 0.6), AUDIO.sine(60, 0.8), AUDIO.sweep(100, 20, 0.5)], [0.4, 0.4, 0.3, 0.3]), 2000), 0.001, 0.1, 0.6, 0.3); });
      case 'enemy_revive': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 600, 0.2), AUDIO.sine(400, 0.25)], [0.5, 0.5]), 0.005, 0.04, 0.4, 0.1); });
      case 'enemy_explode': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.25), AUDIO.sweep(500, 80, 0.25)], [0.6, 0.5]), 0.001, 0.04, 0.3, 0.12); });
      case 'enemy_leak': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(300, 150, 0.15), AUDIO.noise(0.08)], [0.5, 0.4]), 0.003, 0.03, 0.3, 0.08); });
      case 'enemy_type_goblin': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(800, 1200, 0.06), AUDIO.noise(0.04)], [0.5, 0.4]), 0.001, 0.01, 0.2, 0.02); });
      case 'enemy_type_orc': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 100, 0.1), AUDIO.noise(0.08)], [0.5, 0.5]), 0.002, 0.02, 0.2, 0.04); });
      case 'enemy_type_undead': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(150, 100, 0.15), AUDIO.sine(120, 0.2)], [0.5, 0.4]), 0.003, 0.04, 0.3, 0.08); });
      case 'enemy_type_bat': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(2000, 4000, 0.04), AUDIO.sweep(1800, 3500, 0.04)], [0.5, 0.5]), 0.001, 0.01, 0.1, 0.02); });
      case 'enemy_type_troll': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(120, 80, 0.15), AUDIO.noise(0.1)], [0.5, 0.4]), 0.002, 0.03, 0.3, 0.06); });
      case 'enemy_type_skeleton': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sine(400, 0.08), AUDIO.noise(0.05)], [0.5, 0.5]), 0.001, 0.01, 0.15, 0.03); });
      case 'enemy_attack_tower': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.noise(0.1), AUDIO.sweep(400, 200, 0.1)], [0.6, 0.5]), 0.001, 0.02, 0.2, 0.04); });
      case 'boss_appear': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([AUDIO.sweep(60, 200, 0.8), AUDIO.sweep(80, 250, 0.7), AUDIO.sine(100, 1.0), AUDIO.noise(0.4)], [0.3, 0.3, 0.3, 0.2]), 1500), 0.01, 0.2, 0.6, 0.3); });
      case 'boss_attack_dragon_breath': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([AUDIO.noise(0.4), AUDIO.sweep(100, 60, 0.4)], [0.6, 0.5]), 2000), 0.005, 0.05, 0.5, 0.2); });
      case 'boss_attack_frost_nova': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(2000, 3500, 0.3), AUDIO.sweep(1500, 3000, 0.25), AUDIO.sine(2200, 0.4)], [0.3, 0.3, 0.4]), 0.003, 0.05, 0.4, 0.2); });
      case 'boss_summon': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(150, 400, 0.3), AUDIO.square(100, 0.2), AUDIO.sine(300, 0.35)], [0.4, 0.3, 0.3]), 0.005, 0.05, 0.5, 0.15); });
      case 'boss_enrage': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 800, 0.3), AUDIO.sweep(300, 1000, 0.25), AUDIO.noise(0.15)], [0.4, 0.3, 0.3]), 0.002, 0.05, 0.5, 0.15); });
      case 'castle_hit': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(200, 80, 0.2), AUDIO.noise(0.15), AUDIO.sine(100, 0.25)], [0.5, 0.4, 0.3]), 0.001, 0.04, 0.3, 0.1); });
      case 'castle_hit_big': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(150, 40, 0.3), AUDIO.noise(0.25), AUDIO.sine(60, 0.35)], [0.5, 0.5, 0.3]), 0.001, 0.06, 0.4, 0.15); });
      case 'castle_low_hp': return this._get(name, function () { return AUDIO.envelope(AUDIO.sine(200, 0.4), 0.005, 0.05, 0.5, 0.2); });
      case 'wave_start': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(300, 600, 0.2), AUDIO.sweep(450, 900, 0.2), AUDIO.sine(600, 0.3)], [0.3, 0.3, 0.4]), 0.005, 0.05, 0.5, 0.15); });
      case 'wave_cleared': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 800, 0.15), AUDIO.sweep(500, 1000, 0.15), AUDIO.sine(700, 0.25), AUDIO.sine(1000, 0.2)], [0.25, 0.25, 0.25, 0.25]), 0.005, 0.04, 0.5, 0.2); });
      case 'weather_thunder': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([
        AUDIO.noise(0.9),
        AUDIO.sweep(130, 30, 0.7),
        AUDIO.sine(38, 1.15),
        AUDIO.delay(AUDIO.lowpass(AUDIO.noise(0.5), 300), 0.22)
      ], [0.55, 0.5, 0.45, 0.4]), 650), 0.02, 0.15, 0.55, 0.3); });
      case 'weather_lightning_strike': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.mixLayers([
        AUDIO.crackle(0.14, 1700),
        AUDIO.noise(0.5),
        AUDIO.sweep(3000, 80, 0.32),
        AUDIO.sine(46, 0.95)
      ], [0.9, 0.55, 0.5, 0.5]), 2600), 0.001, 0.04, 0.45, 0.04); });
      case 'weather_wind_gust': return this._get(name, function () { return AUDIO.envelope(AUDIO.lowpass(AUDIO.noise(0.5), 800), 0.05, 0.1, 0.5, 0.2); });
      case 'victory': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 800, 0.3), AUDIO.sweep(500, 1000, 0.3), AUDIO.sweep(600, 1200, 0.3), AUDIO.sine(800, 0.5), AUDIO.sine(1000, 0.4)], [0.2, 0.2, 0.2, 0.2, 0.2]), 0.005, 0.08, 0.6, 0.3); });
      case 'defeat': return this._get(name, function () { return AUDIO.envelope(AUDIO.mixLayers([AUDIO.sweep(400, 150, 0.5), AUDIO.sweep(350, 120, 0.45), AUDIO.sine(200, 0.6)], [0.3, 0.3, 0.4]), 0.005, 0.1, 0.5, 0.3); });
      default: return null;
    }
  },

  // ---------- reproducción SFX ----------
  playSfx: function (name, volScale) {
    if (!this.enabled) return;
    if (!this.ensure()) return;
    if (this.ctx.state !== 'running') return;
    var now = performance.now();
    if (this._lastPlay[name] && now - this._lastPlay[name] < 45) return;
    this._lastPlay[name] = now;
    if (this._voices > 14) return;
    var buf = this.sfxBuffer(name);
    if (!buf) return;
    try {
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var g = this.ctx.createGain();
      var vol = Math.max(0, Math.min(1, this.sfxVolume * this.masterVolume * (volScale === undefined ? 1 : volScale)));
      g.gain.value = vol;
      src.connect(g); g.connect(this.ctx.destination);
      var self = this;
      src.onended = function () { self._voices--; };
      src.start();
      this._voices++;
    } catch (e) {}
  },

  // ---------- música procedural ----------
  fastPad: function (freq, dur) {
    var n = Math.floor(SR * dur), out = new Float32Array(n);
    var twoPi = 2 * Math.PI;
    var ph1 = 0, ph2 = 0, ph3 = 0;
    var d1 = twoPi * freq / SR, d2 = twoPi * freq * 1.003 / SR, d3 = twoPi * freq * 0.498 / SR;
    for (var i = 0; i < n; i++) {
      out[i] = Math.sin(ph1) * 0.35 + Math.sin(ph2) * 0.25 + Math.sin(ph3) * 0.25 +
        (Math.sin(ph1) > 0 ? 1 : -1) * 0.15;
      ph1 += d1; ph2 += d2; ph3 += d3;
    }
    return out;
  },

  fastArp: function (notes, noteDur) {
    var out = [];
    var att = Math.floor(SR * 0.003);
    var rel = Math.floor(SR * noteDur * 0.3);
    for (var ni = 0; ni < notes.length; ni++) {
      var freq = notes[ni];
      var n = Math.floor(SR * noteDur);
      for (var i = 0; i < n; i++) {
        var env;
        if (i < att) env = i / att;
        else if (i > n - rel) env = Math.max(0, (n - i) / rel);
        else env = 0.7;
        out.push(Math.sin(2 * Math.PI * freq * i / SR) * env);
      }
    }
    return Float32Array.from(out);
  },

  makeLoop: function (samples, volume) {
    var fadeN = Math.min(samples.length, Math.floor(SR * 0.15));
    for (var i = 0; i < fadeN; i++) {
      var t = i / fadeN;
      samples[i] *= t;
      samples[samples.length - 1 - i] *= t;
    }
    return this._buf(samples, volume === undefined ? 0.3 : volume);
  },

  musicBuffer: function (key) {
    if (this._musicCache[key]) return this._musicCache[key];
    var chordNotes, padFreq, arp, pad, mixed, notes;
    switch (key) {
      case 'normal':
        chordNotes = [261, 329, 392, 329, 261, 329, 392, 329, 261, 329, 392, 329];
        arp = this.fastArp(chordNotes, 0.25);
        pad = this.fastPad(130, arp.length / SR);
        mixed = this.mixLayers([pad, arp], [0.5, 0.5]);
        this._musicCache[key] = this.makeLoop(mixed);
        break;
      case 'intense':
        chordNotes = [220, 261, 311, 349, 220, 261, 311, 349, 220, 261, 311, 349];
        arp = this.fastArp(chordNotes, 0.15);
        pad = this.fastPad(110, arp.length / SR);
        mixed = this.mixLayers([pad, arp], [0.5, 0.5]);
        this._musicCache[key] = this.makeLoop(mixed);
        break;
      case 'boss':
        chordNotes = [196, 233, 277, 311, 196, 233, 277, 311, 196, 233, 277, 311];
        arp = this.fastArp(chordNotes, 0.12);
        pad = this.fastPad(98, arp.length / SR);
        mixed = this.mixLayers([pad, arp], [0.5, 0.5]);
        this._musicCache[key] = this.makeLoop(mixed);
        break;
      case 'victory':
        notes = [523, 659, 784, 1047, 784, 659, 523, 659, 523, 659, 784, 1047, 784, 659, 523, 659];
        arp = this.fastArp(notes, 0.12);
        pad = this.fastPad(523, arp.length / SR);
        mixed = this.mixLayers([pad, arp], [0.4, 0.6]);
        this._musicCache[key] = this.makeLoop(mixed);
        break;
      case 'defeat':
        notes = [392, 349, 311, 261, 220, 196, 165, 147, 392, 349, 311, 261, 220, 196, 165, 147];
        arp = this.fastArp(notes, 0.2);
        pad = this.fastPad(98, arp.length / SR);
        mixed = this.mixLayers([pad, arp], [0.5, 0.5]);
        this._musicCache[key] = this.makeLoop(mixed);
        break;
      default: return null;
    }
    return this._musicCache[key];
  },

  playMusic: function (key) {
    if (!this.enabled) return;
    if (!this.ensure()) return;
    if (this._currentMusicKey === key) return;
    this.stopMusic();
    this._currentMusicKey = key;
    var buf = this.musicBuffer(key);
    if (!buf) { this._currentMusicKey = null; return; }
    try {
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this._musicGain);
      src.start();
      this._musicSource = src;
    } catch (e) { this._currentMusicKey = null; }
  },

  stopMusic: function () {
    this._currentMusicKey = null;
    if (this._musicGain && this.ctx) {
      try {
        var g = this._musicGain.gain;
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        var self = this;
        setTimeout(function () {
          if (self._musicSource) { try { self._musicSource.stop(); } catch (e) {} self._musicSource = null; }
          g.setValueAtTime(self.musicVolume * self.masterVolume, self.ctx.currentTime);
        }, 250);
      } catch (e) {}
    }
  },

  // ---------- ambiente por tema del mapa ----------
  ambientBuffer: function (theme) {
    var key = 'amb_' + theme;
    if (this._musicCache[key]) return this._musicCache[key];
    var freqs = { plains: 130, desert: 98, forest: 110, frozen: 98, void: 55 };
    var vols = { plains: 0.1, desert: 0.08, forest: 0.1, frozen: 0.08, void: 0.1 };
    this._musicCache[key] = this._buf(this.fastPad(freqs[theme] || 130, 2.0), vols[theme] || 0.09);
    return this._musicCache[key];
  },

  playAmbient: function (theme) {
    if (!this.enabled) return;
    if (!this.ensure()) return;
    var ambKey = String(theme);
    if (this._currentAmbKey === ambKey) return;
    this.stopAmbient();
    this._currentAmbKey = ambKey;
    var buf = this.ambientBuffer(theme);
    if (!buf) return;
    try {
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var g = this.ctx.createGain();
      g.gain.value = this.musicVolume * this.masterVolume * 0.3;
      src.connect(g); g.connect(this.ctx.destination);
      src.start();
      this._ambSource = src;
      this._ambGain = g;
    } catch (e) { this._currentAmbKey = null; }
  },

  stopAmbient: function () {
    if (this._ambSource) { try { this._ambSource.stop(); } catch (e) {} this._ambSource = null; }
    this._currentAmbKey = null;
  },

  changeWeatherSounds: function (weatherType, mapTheme) {
    if (weatherType === 'rain' || weatherType === 'storm') this.playAmbient(mapTheme);
    else this.playAmbient(mapTheme);
  },

  // ---------- volúmenes ----------
  setSfxVolume: function (vol) { this.sfxVolume = Math.max(0, Math.min(1, vol)); },
  setMasterVolume: function (vol) { this.masterVolume = Math.max(0, Math.min(1, vol)); },
  setMusicVolume: function (vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this._musicGain && this.ctx) {
      try { this._musicGain.gain.value = this.musicVolume * this.masterVolume; } catch (e) {}
    }
  },

  toggle: function () {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopMusic();
      this.stopAmbient();
    }
    return this.enabled;
  }
};

function sfx(name, vol) {
  if (typeof AUDIO !== 'undefined' && AUDIO.playSfx) AUDIO.playSfx(name, vol);
}
