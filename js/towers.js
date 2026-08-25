'use strict';

function abilityTargets(g, x, y, r) {
  var out = [];
  for (var i = 0; i < g.enemies.length; i++) {
    var e = g.enemies[i];
    if (!e.alive) continue;
    var dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy <= r * r) out.push(e);
  }
  out.sort(function (a, b) { return a.pathPos - b.pathPos; });
  return out;
}

function abilityTowers(g, x, y, r) {
  var out = [];
  for (var i = 0; i < g.towers.length; i++) {
    var t = g.towers[i];
    var dx = t.x - x, dy = t.y - y;
    if (dx * dx + dy * dy <= r * r) out.push(t);
  }
  return out;
}

function turnToward(cur, target, maxDelta) {
  var d = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  if (d > maxDelta) d = maxDelta;
  if (d < -maxDelta) d = -maxDelta;
  return cur + d;
}

var PROJ_SPEED = {
  archer: 430, fire: 280, ice: 400, venom: 320, dwarf: 260,
  crossbow: 620, sniper: 780, holy: 380, warlock: 340
};

var ABILITY_FX = {
  archer: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range + 30);
    for (var i = 0; i < Math.min(10, list.length); i++) {
      var e = list[i];
      e.takeDamage(t.damage * 1.4 * g.weatherMult(t.element), t.element, t);
      if (e.alive) { e.slow = { mult: 0.75, t: 1.5 }; g.hitSpark(e.x, e.y, '#e8d48a'); }
    }
    g.burst(t.x, t.y, '#e8d48a', 10);
    g.shockRing(t.x, t.y, t.range + 30, '#e8d48a', 0.4);
  },
  fire: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range);
    var cx = t.x, cy = t.y;
    if (list.length) { cx = list[0].x; cy = list[0].y; }
    var r = Math.max(46, (t.aoe || 46) + 28);
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= r * r) {
        e.takeDamage(t.damage * 2.2 * g.weatherMult('fire'), 'fire', t);
        if (e.alive) e.burn = { dps: t.damage * 0.5 * g.weatherMult('fire'), t: 3, src: t };
      }
    }
    g.explosion(cx, cy, r, '#ff7a30');
    g.shockRing(cx, cy, r, '#ffb04a', 0.5);
  },
  ice: function (g, t) {
    var r = t.range * 1.4;
    g.frostNova(t.x, t.y, r, 0.35 + t.level * 0.1, 4);
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        e.takeDamage(t.damage * 2 * g.weatherMult('ice'), 'ice', t);
        if (e.alive) e.freeze = { t: Math.max(e.freeze ? e.freeze.t : 0, 1.2 + t.level * 0.3), dur: 1.2 + t.level * 0.3, src: "ice" };
      }
    }
    g.shockRing(t.x, t.y, r, '#bfe8ff', 0.55);
  },
  dwarf: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range + 40);
    if (!list.length) { g.burst(t.x, t.y, '#ffb04a', 6); return; }
    var n = Math.min(6, Math.max(3, list.length));
    for (var i = 0; i < n; i++) {
      var e = list[i];
      var x = e.x, y = e.y;
      for (var j = 0; j < g.enemies.length; j++) {
        var o = g.enemies[j];
        if (!o.alive || o.flying) continue;
        var dx = o.x - x, dy = o.y - y;
        if (dx * dx + dy * dy <= 50 * 50) {
          o.takeDamage(t.damage * 1.5 * g.weatherMult('earth'), 'earth', t);
          if (o.alive) o.pathPos = Math.max(0, o.pathPos - 12);
        }
      }
      g.explosion(x, y, 50, '#ffb04a');
    }
  },
  crossbow: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range);
    if (!list.length) { g.shockRing(t.x, t.y, t.range, '#9a8a5a', 0.3); return; }
    var tx2 = list[0];
    var ang = Math.atan2(tx2.y - t.y, tx2.x - t.x);
    var cosA = Math.cos(ang), sinA = Math.sin(ang);
    var dmg = t.damage * 3;
    var hit = 0;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var rx = e.x - t.x, ry = e.y - t.y;
      var proj = rx * cosA + ry * sinA;
      if (proj < 0 || proj > t.range + 30) continue;
      var perp = Math.abs(rx * sinA - ry * cosA);
      if (perp < 16) {
        e.takeDamage(dmg * g.weatherMult('physical'), 'physical', t, t.ignoreArmor);
        if (e.alive) e.slow = { mult: 0.8, t: 2 };
        g.hitSpark(e.x, e.y, '#9a8a5a');
        hit++;
      }
    }
    g.streak(t.x, t.y, t.x + cosA * (t.range + 20), t.y + sinA * (t.range + 20), '#e8d48a', 0.16);
    g.texts.push({ x: t.x, y: t.y - 24, txt: '🎯 ¡Perforación! ×' + hit, life: 0.8, max: 0.8, color: '#e8d48a', vy: -16, size: 12 });
  },
  venom: function (g, t) {
    var r = t.range * 1.3;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        e.takeDamage(t.damage * 1.5 * g.weatherMult('nature'), 'nature', t);
        if (e.alive) e.poison = { dps: (t.poison ? t.poison.dps : 8) * 3, t: 4, src: t };
      }
    }
    for (var j = 0; j < 18; j++) {
      var a = Math.random() * 6.28, rr = Math.random() * r * 0.9;
      g.particles.push({ x: t.x + Math.cos(a) * rr, y: t.y + Math.sin(a) * rr, vx: 0, vy: -20 - Math.random() * 20, life: 0.8, max: 0.8, color: '#7ad47f', size: 3 + Math.random() * 2.5, grav: -12 });
    }
    g.shockRing(t.x, t.y, r, '#7ad47f', 0.5);
  },
  druid: function (g, t) {
    var r = t.range * 1.2;
    var n = 0;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive || e.flying) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        e.takeDamage(t.damage > 0 ? t.damage * 2.5 * g.weatherMult('nature') : 40, 'nature', t);
        if (e.alive) e.freeze = { t: Math.max(e.freeze ? e.freeze.t : 0, 1.6 + t.level * 0.4), dur: 1.6 + t.level * 0.4, src: "ice" };
        g.burst(e.x, e.y, '#7fd47f', 4);
        n++;
      }
    }
    g.texts.push({ x: t.x, y: t.y - 24, txt: n ? '🌿 ¡Enraizados! ×' + n : '🌿', life: 0.8, max: 0.8, color: '#7fd47f', vy: -16, size: 12 });
    g.shockRing(t.x, t.y, r, '#7fd47f', 0.5);
  },
  tesla: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range + 30);
    var n = Math.min(10, list.length);
    var from = { x: t.x, y: t.y - 20 };
    for (var i = 0; i < n; i++) {
      var e = list[i];
      g.lightningBolt(from.x, from.y, e.x, e.y, '#8ad4ff', 0.18);
      e.takeDamage(t.damage * (1 - i * 0.06) * g.weatherMult('lightning'), 'lightning', t);
      if (e.alive) e.slow = { mult: 0.8, t: 1.5 };
      from = { x: e.x, y: e.y };
    }
    g.burst(t.x, t.y, '#8ad4ff', 8);
  },
  knight: function (g, t) {
    var r = 74;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        e.pathPos = Math.max(0, e.pathPos - 20);
        e.freeze = { t: Math.max(e.freeze ? e.freeze.t : 0, 1.1), dur: 1.1, src: "ice" };
        e.takeDamage(t.damage * 1.5 * g.weatherMult('physical'), 'physical', t);
        g.burst(e.x, e.y, '#ccccdd', 4);
      }
    }
    g.shockRing(t.x, t.y, r, '#ccccdd', 0.45);
  },
  sniper: function (g, t) {
    var list = abilityTargets(g, t.x, t.y, t.range);
    if (!list.length) { g.shockRing(t.x, t.y, t.range, '#e8e8f0', 0.3); return; }
    var target = list[0];
    var dmg = t.damage * 4;
    target.takeDamage(dmg * g.weatherMult('physical'), 'physical', t, true);
    g.texts.push({ x: target.x, y: target.y - 20, txt: '💥 ' + Math.floor(dmg), life: 0.9, max: 0.9, color: '#fff', vy: -24, size: 15 });
    g.hitSpark(target.x, target.y, '#fff');
    g.streak(t.x, t.y - 6, target.x, target.y, '#e8e8f0', 0.14);
    g.burst(t.x, t.y, '#e8e8f0', 8);
    g.shockRing(target.x, target.y, 26, '#fff', 0.35);
  },
  holy: function (g, t) {
    var r = t.range * 1.3;
    var tws = abilityTowers(g, t.x, t.y, r);
    for (var i = 0; i < tws.length; i++) {
      var tw = tws[i];
      tw.hp = Math.min(tw.hpMax, tw.hp + 35);
      tw.burnT = 0;
      g.burst(tw.x, tw.y, '#fff6c8', 4);
    }
    for (var j = 0; j < g.enemies.length; j++) {
      var e = g.enemies[j];
      if (!e.alive) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r && (e.corrupted || e.revive || e.necro)) {
        e.takeDamage(t.damage * 3 * g.weatherMult('nature'), 'nature', t);
      }
    }
    if (g.purifyRadius) g.purifyRadius(t.x, t.y, r, (t.purge || 4) * 2);
    g.shockRing(t.x, t.y, r, '#ffe08a', 0.55);
  },
  banner: function (g, t) {
    var r = t.range * 1.4;
    var tws = abilityTowers(g, t.x, t.y, r);
    for (var i = 0; i < tws.length; i++) {
      var tw = tws[i];
      tw.tempMul = 1.5;
      tw.tempMulT = 8;
      g.burst(tw.x, tw.y, '#ffe08a', 4);
    }
    g.texts.push({ x: t.x, y: t.y - 24, txt: '🚩 ¡Furia! ×' + tws.length, life: 1, max: 1, color: '#ffe08a', vy: -16, size: 13 });
    g.shockRing(t.x, t.y, r, '#ffe08a', 0.55);
  },
  warlock: function (g, t) {
    var r = t.range * 1.3;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.alive) continue;
      var dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        e.takeDamage(t.damage * 2.2 * g.weatherMult('void'), 'void', t);
        if (e.alive) e.hex = { mult: t.hex ? t.hex.mult : 1.4, t: 5 };
      }
    }
    for (var j = 0; j < 16; j++) {
      var a = Math.random() * 6.28, rr = Math.random() * r * 0.8;
      g.particles.push({ x: t.x + Math.cos(a) * rr, y: t.y + Math.sin(a) * rr, vx: 0, vy: -24 - Math.random() * 24, life: 0.7, max: 0.7, color: '#b08aff', size: 3, grav: -16 });
    }
    g.shockRing(t.x, t.y, r, '#b08aff', 0.5);
  },
  barracks: function (g, t) {
    for (var i = 0; i < g.soldiers.length; i++) {
      var s = g.soldiers[i];
      if (s.tower !== t) continue;
      s.hp = s.hpMax;
      s.alive = true;
      s.respawnTimer = 0;
      g.burst(s.x, s.y, '#ffe08a', 6);
    }
    g.shockRing(t.x, t.y, t.range, '#ffe08a', 0.5);
  }
};

var SOLDIER_TYPES = {
  swordsman: { color: '#7d8697', dark: '#4c5563', accent: '#a03428', metal: '#aab3c0', weapon: 'sword' },
  archer: { color: '#567d46', dark: '#37552c', accent: '#8a6b43', metal: '#c9a84c', weapon: 'bow' },
  shieldbearer: { color: '#707a88', dark: '#414a56', accent: '#c9a84c', metal: '#98a2af', weapon: 'shield' },
  mage: { color: '#533a8f', dark: '#37265e', accent: '#c9a84c', metal: '#b08aff', weapon: 'staff' }
};

class AlliedSoldier {
  constructor(x, y, stype, stats, tower) {
    this.x = x;
    this.y = y;
    this.stype = stype;
    this.tower = tower;
    this.hpMax = stats.hp || 80;
    this.hp = this.hpMax;
    this.dmg = stats.dmg || 8;
    this.rate = stats.rate || 0.8;
    this.attackRange = stats.range || 28;
    this.armor = stats.armor || 0;
    this.ranged = !!stats.ranged;
    this.element = stats.element || 'physical';
    this.cooldown = 0;
    this.angle = 0;
    this.flash = 0;
    this.alive = true;
    this.respawnTimer = 0;
    this.anim = 0;
    this.homeX = x;
    this.homeY = y;
    this.engaged = null;
    this.facing = 0;
  }

  update(dt, game) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.hp = this.hpMax;
        this.x = this.homeX;
        this.y = this.homeY;
      }
      return;
    }
    this.anim += dt;
    if (this.flash > 0) this.flash -= dt;
    this.cooldown -= dt;
    if (this.engaged !== null) {
      var e = this.engaged;
      if (!e.alive) {
        this.engaged = null;
        return;
      }
      var dx = e.x - this.x, dy = e.y - this.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > Math.pow(this.attackRange * 4, 2)) {
        this.engaged = null;
        e.blockedBy = null;
        return;
      }
      this.facing = Math.atan2(dy, dx);
      this.angle = this.facing;
      if (this.cooldown <= 0) {
        this.cooldown = this.rate;
        this.flash = 0.15;
        var mult = e.hex ? e.hex.mult : 1;
        e.takeDamage(this.dmg * mult * game.weatherMult(this.element), this.element, this.tower);
        if (!this.ranged && e.alive) e.pathPos = Math.max(0, e.pathPos - 2);
      }
      return;
    }
    var best = null, bestDist = this.attackRange * this.attackRange;
    for (var i = 0; i < game.enemies.length; i++) {
      var en = game.enemies[i];
      if (!en.alive) continue;
      if (!this.ranged && en.flying) continue;
      if (en.blockedBy !== null && en.blockedBy !== undefined && en.blockedBy !== this) continue;
      var edx = en.x - this.x, edy = en.y - this.y;
      var ed2 = edx * edx + edy * edy;
      if (ed2 <= bestDist) { best = en; bestDist = ed2; }
    }
    if (best && this.cooldown <= 0) {
      this.engaged = best;
      best.blockedBy = this;
      this.facing = Math.atan2(best.y - this.y, best.x - this.x);
      this.angle = this.facing;
      this.cooldown = this.rate;
      this.flash = 0.15;
      var bmult = best.hex ? best.hex.mult : 1;
      best.takeDamage(this.dmg * bmult * game.weatherMult(this.element), this.element, this.tower);
      if (!this.ranged && best.alive) best.pathPos = Math.max(0, best.pathPos - 2);
    }
  }

  takeDamage(dmg) {
    var d = Math.max(1, dmg - this.armor);
    this.hp -= d;
    this.flash = 0.15;
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnTimer = 10;
      if (this.engaged) {
        this.engaged.blockedBy = null;
        this.engaged = null;
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    var r = 8;
    // sprite oficial del soldado
    if (typeof SPRITES !== 'undefined' && SPRITES.draw(ctx, 's', this.stype, this.x, this.y + 10, 30, this.flash > 0 ? 1 : 0, null)) return;

    // sombra en el suelo
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 1.5, r * 1.15, r * 0.3, 0, 0, 6.28);
    ctx.fill();
    ctx.globalAlpha = 1;

    // aura de combate al bloquear un enemigo
    if (this.engaged) {
      ctx.globalAlpha = 0.14 + 0.05 * Math.sin(this.anim * 9);
      ctx.fillStyle = '#ff5028';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.9, 0, 6.28);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    var bob = Math.sin(this.anim * 2.3) * 0.5;      // respiración en reposo
    var dir = Math.cos(this.facing) >= 0 ? 1 : -1;  // orientado hacia su objetivo
    var atk = this.flash > 0;                       // pose de ataque
    var info = SOLDIER_TYPES[this.stype] || SOLDIER_TYPES.swordsman;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    if (this.stype === 'mage') {
      this._drawMage(ctx, r, bob, atk, info);
    } else {
      this._drawFighter(ctx, r, bob, atk, info);
    }
    ctx.restore();

    // barra de vida flotante
    var barW = 16, barH = 3;
    var barX = this.x - barW / 2, barY = this.y - r * 3.4;
    var pct = Math.max(0, this.hp / this.hpMax);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX, barY, barW, barH);
    if (pct > 0) {
      ctx.fillStyle = pct > 0.55 ? 'rgba(90,212,90,0.9)' : pct > 0.28 ? 'rgba(255,179,0,0.9)' : 'rgba(229,57,53,0.9)';
      ctx.fillRect(barX, barY, Math.max(1, barW * pct), barH);
    }
  }

  _drawFighter(ctx, r, bob, atk, info) {
    // piernas y botas
    ctx.fillStyle = '#3c2f22';
    ctx.fillRect(-r * 0.45, -r * 0.62 + bob * 0.4, r * 0.38, r * 0.62);
    ctx.fillRect(r * 0.08, -r * 0.62 + bob * 0.4, r * 0.38, r * 0.62);
    ctx.fillStyle = '#241a12';
    ctx.fillRect(-r * 0.52, -r * 0.2 + bob * 0.4, r * 0.46, r * 0.2);
    ctx.fillRect(r * 0.04, -r * 0.2 + bob * 0.4, r * 0.46, r * 0.2);

    // torso con sombreado lateral y cinturón con hebilla
    ctx.fillStyle = info.color;
    ctx.fillRect(-r * 0.55, -r * 1.72 + bob, r * 1.1, r * 1.14);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = info.dark;
    ctx.fillRect(r * 0.22, -r * 1.72 + bob, r * 0.33, r * 1.14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(-r * 0.55, -r * 0.82 + bob, r * 1.1, r * 0.17);
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(-r * 0.08, -r * 0.82 + bob, r * 0.16, r * 0.17);

    // cabeza
    var hy = -r * 2.05 + bob;
    ctx.fillStyle = '#eec39a';
    ctx.beginPath();
    ctx.arc(0, hy, r * 0.36, 0, 6.28);
    ctx.fill();

    if (this.stype === 'swordsman') {
      // tabardo con franja heráldica
      ctx.fillStyle = info.accent;
      ctx.fillRect(-r * 0.14, -r * 1.72 + bob, r * 0.28, r * 1.0);
      // yelmo de nasal
      ctx.fillStyle = info.metal;
      ctx.beginPath();
      ctx.arc(0, hy - r * 0.04, r * 0.4, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r * 0.05, hy - r * 0.04, r * 0.1, r * 0.34);
      // espada: diagonal en reposo, estocada frontal al atacar
      var sx = r * 0.55, sy = -r * 1.3 + bob;
      var ex = atk ? r * 2.15 : r * 1.15;
      var ey = sy + (atk ? r * 0.12 : -r * 0.85);
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 2, sy + 2); ctx.lineTo(sx, sy); ctx.stroke();
      var gx = sx + (ex - sx) * 0.14, gy = sy + (ey - sy) * 0.14;
      var nx = -(ey - sy), ny = ex - sx;
      var nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(gx - nx * 2.6, gy - ny * 2.6);
      ctx.lineTo(gx + nx * 2.6, gy + ny * 2.6);
      ctx.stroke();
      ctx.strokeStyle = '#d7dee8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    } else if (this.stype === 'archer') {
      // capucha verde con pico caído hacia la espalda
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, hy - r * 0.02, r * 0.44, Math.PI * 0.86, Math.PI * 2.14);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, hy - r * 0.3);
      ctx.lineTo(-r * 0.95, hy - r * 0.05);
      ctx.lineTo(-r * 0.32, hy + r * 0.18);
      ctx.closePath();
      ctx.fill();
      // correa del carcaj
      ctx.strokeStyle = '#4a3826';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 1.66 + bob); ctx.lineTo(r * 0.42, -r * 0.94 + bob); ctx.stroke();
      // carcaj a la espalda con flechas
      ctx.save();
      ctx.translate(-r * 0.52, -r * 1.28 + bob);
      ctx.rotate(0.45);
      ctx.fillStyle = '#7a4b26';
      ctx.fillRect(-1.3, -3.5, 2.6, 7);
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-0.5, -3.5); ctx.lineTo(-1.1, -5.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.5, -3.5); ctx.lineTo(1.0, -5.4); ctx.stroke();
      ctx.restore();
      // arco frente al pecho con cuerda tensada y flecha al disparar
      var bx = r * 0.72, by = -r * 1.05 + bob, br = r * 0.78;
      ctx.strokeStyle = '#8a6b43';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(bx, by, br, -1.15, 1.15); ctx.stroke();
      var axT = bx + br * Math.cos(-1.15), ayT = by + br * Math.sin(-1.15);
      var axB = bx + br * Math.cos(1.15), ayB = by + br * Math.sin(1.15);
      var nockX = atk ? bx - br * 0.55 : bx + br * 0.28;
      ctx.strokeStyle = 'rgba(238,228,204,0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(axT, ayT); ctx.lineTo(nockX, by); ctx.lineTo(axB, ayB); ctx.stroke();
      if (atk) {
        ctx.strokeStyle = '#caa84f';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(nockX, by); ctx.lineTo(bx + br + r * 0.5, by); ctx.stroke();
        ctx.fillStyle = '#d7dee8';
        ctx.beginPath();
        ctx.moveTo(bx + br + r * 0.62, by);
        ctx.lineTo(bx + br + r * 0.34, by - 1.8);
        ctx.lineTo(bx + br + r * 0.34, by + 1.8);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // escudero: yelmo de borde ancho
      ctx.fillStyle = info.metal;
      ctx.beginPath();
      ctx.arc(0, hy - r * 0.05, r * 0.37, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, hy - r * 0.06, r * 0.58, r * 0.13, 0, 0, 6.28);
      ctx.fill();
      // lanza: en guardia o nivelada al atacar
      ctx.strokeStyle = '#8a6b43';
      ctx.lineWidth = 1.6;
      var p1x = r * 0.3, p1y = -r * 0.2 + bob;
      var p2x = atk ? r * 1.9 : r * 1.25;
      var p2y = atk ? -r * 1.25 + bob : -r * 2.35 + bob;
      ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
      var dpx = p2x - p1x, dyp = p2y - p1y;
      var pl = Math.hypot(dpx, dyp) || 1;
      dpx /= pl; dyp /= pl;
      ctx.fillStyle = '#b9c2cf';
      ctx.beginPath();
      ctx.moveTo(p2x + dpx * 4.2, p2y + dyp * 4.2);
      ctx.lineTo(p2x - dyp * 1.8, p2y + dpx * 1.8);
      ctx.lineTo(p2x + dyp * 1.8, p2y - dpx * 1.8);
      ctx.closePath();
      ctx.fill();
      // gran escudo de torre con umbo dorado
      ctx.save();
      if (atk) ctx.translate(r * 0.12, -1.5);
      var shx = r * 0.6, shy = -r * 1.02 + bob;
      ctx.fillStyle = '#7a4a26';
      ctx.strokeStyle = '#4b5058';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(shx, shy, r * 0.48, r * 0.88, 0, 0, 6.28);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(shx - r * 0.3, shy - r * 0.72); ctx.lineTo(shx - r * 0.3, shy + r * 0.72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(shx + r * 0.05, shy - r * 0.86); ctx.lineTo(shx + r * 0.05, shy + r * 0.86); ctx.stroke();
      ctx.fillStyle = info.accent;
      ctx.beginPath(); ctx.arc(shx, shy, r * 0.17, 0, 6.28); ctx.fill();
      ctx.restore();
    }
  }

  _drawMage(ctx, r, bob, atk, info) {
    var hb = bob * 0.6;
    // túnica larga con sombra lateral y ribete dorado
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 1.85 + hb);
    ctx.lineTo(r * 0.5, -r * 1.85 + hb);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(-r * 0.95, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = info.dark;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 1.85 + hb);
    ctx.lineTo(r * 0.5, -r * 1.85 + hb);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(r * 0.42, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = info.accent;
    ctx.beginPath();
    ctx.moveTo(-r * 0.93, -r * 0.16);
    ctx.lineTo(r * 0.93, -r * 0.16);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(-r * 0.95, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-r * 0.56, -r * 0.95 + hb); ctx.lineTo(r * 0.56, -r * 0.95 + hb); ctx.stroke();

    // cabeza y barba gris
    var hy = -r * 2.08 + hb;
    ctx.fillStyle = '#eec39a';
    ctx.beginPath(); ctx.arc(0, hy, r * 0.35, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#cfd4dc';
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, hy + r * 0.08);
    ctx.lineTo(r * 0.24, hy + r * 0.08);
    ctx.lineTo(0, hy + r * 0.85);
    ctx.closePath();
    ctx.fill();

    // sombrero puntiagudo con ala y banda dorada
    ctx.fillStyle = info.dark;
    ctx.beginPath();
    ctx.ellipse(0, hy - r * 0.26, r * 0.66, r * 0.15, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.33, hy - r * 0.3);
    ctx.lineTo(r * 0.33, hy - r * 0.3);
    ctx.lineTo(-r * 0.14, hy - r * 1.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = info.accent;
    ctx.fillRect(-r * 0.31, hy - r * 0.42, r * 0.62, r * 0.12);

    // bastón con orbe pulsante; chispas al lanzar
    var ox = r * 0.8, oyTop = -r * 2.5 + hb, oyOrb = oyTop - r * 0.22;
    ctx.strokeStyle = '#6e4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, oyTop); ctx.stroke();
    var pulse = 0.3 + 0.14 * Math.sin(this.anim * 5) + (atk ? 0.25 : 0);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = info.metal;
    ctx.beginPath(); ctx.arc(ox, oyOrb, r * 0.34, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = atk ? '#ffffff' : '#d9c6ff';
    ctx.beginPath(); ctx.arc(ox, oyOrb, atk ? r * 0.2 : r * 0.15, 0, 6.28); ctx.fill();
    if (atk) {
      ctx.strokeStyle = '#e6d9ff';
      ctx.lineWidth = 1;
      for (var k = 0; k < 4; k++) {
        var ang = k * Math.PI / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(ang) * r * 0.26, oyOrb + Math.sin(ang) * r * 0.26);
        ctx.lineTo(ox + Math.cos(ang) * r * 0.46, oyOrb + Math.sin(ang) * r * 0.46);
        ctx.stroke();
      }
    }
  }
}

class Tower {
  constructor(col, row, type, game) {
    this.col = col;
    this.row = row;
    this.type = type;
    this.game = game;
    this.x = (col + 0.5) * CONFIG.CELL;
    this.y = (row + 0.5) * CONFIG.CELL;
    var def = TOWERS[type];
    this.def = def;
    this.name = def.name;
    this.icon = def.icon;
    this.level = 0;
    this.element = def.element;
    this.range = def.range;
    this.damage = def.damage;
    this.rate = def.rate;
    this.canHitFlying = def.canHitFlying !== false;
    this.targetCap = def.targetCap || 1;
    this.pierce = def.pierce || 0;
    this.aoe = def.aoe || 0;
    this.rootDur = def.rootDur || 1.0;
    this.aura = 1;
    this.rateAura = 1;
    this.dmgAmp = 1;
    this.chains = def.chains || 0;
    this.poison = def.poison || null;
    this.hex = def.hex || null;
    this.ignoreArmor = !!def.ignoreArmor;
    this.purge = def.purge || 0;
    this.cooldown = Math.random() * 0.3;
    this.angle = -Math.PI / 2;
    this.flash = 0;
    this.kills = 0;
    this.totalDamage = 0;
    this.totalSpent = def.cost;
    this.stun = 0;
    this.buffed = 1;
    this.novaCd = 4;
    this.rootTimer = 2;
    this.hpMax = 100;
    this.hp = 100;
    this.burnT = 0;
    this.recoil = 0;
    this.windup = 0;
    this.aim = Math.random() * 6.28;
    this.abilityCd = 0;
    this.tempMul = 1;
    this.tempMulT = 0;
    this.priority = 'first';
    this._soldiersSpawned = false;
  }

  fireFX(game, tipDist) {
    this.recoil = 1;
    var atkSound = {
      archer: 'tower_attack_archer', crossbow: 'tower_attack_crossbow',
      sniper: 'tower_attack_sniper', fire: 'tower_attack_fire',
      ice: 'tower_attack_ice', dwarf: 'tower_attack_dwarf',
      venom: 'tower_attack_venom', tesla: 'tower_attack_tesla',
      knight: 'tower_attack_knight', holy: 'tower_attack_holy',
      druid: 'tower_attack_druid', banner: 'tower_attack_banner',
      warlock: 'tower_attack_warlock'
    }[this.type];
    if (atkSound) sfx(atkSound, 0.4);
    var d = tipDist || 18;
    var tx = this.x + Math.cos(this.angle) * d;
    var ty = this.y - 6 + Math.sin(this.angle) * d;
    for (var i = 0; i < 4; i++) {
      var a = this.angle + (Math.random() - 0.5) * 0.9;
      var sp = 70 + Math.random() * 70;
      game.particles.push({
        x: tx, y: ty,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
        life: 0.12 + Math.random() * 0.1, max: 0.22, color: i % 2 ? '#ffd24a' : '#fff6c8',
        size: 3 + Math.random() * 2, grav: 0
      });
    }
    game.particles.push({
      x: tx, y: ty,
      vx: (Math.random() - 0.5) * 14, vy: -26 - Math.random() * 14,
      life: 0.5 + Math.random() * 0.3, max: 0.8, color: '#8a8a96',
      size: 2.4 + Math.random() * 1.8, grav: -26
    });
  }

  get upgrade() {
    if (this.level >= CONFIG.MAX_LEVEL) return null;
    return this.def.upgrades[this.level];
  }

  upgradeCost() {
    var u = this.upgrade;
    return u ? u.cost : null;
  }

  applyUpgrade() {
    var u = this.upgrade;
    if (!u) return false;
    this.level++;
    if (u.damage) this.damage = u.damage;
    if (u.rate) this.rate = u.rate;
    if (u.range) this.range = u.range;
    if (u.targetCap) this.targetCap = u.targetCap;
    if (u.pierce) this.pierce = u.pierce;
    if (u.aoe) this.aoe = u.aoe;
    if (u.rootDur) this.rootDur = u.rootDur;
    if (u.aura) this.aura = u.aura;
    if (u.rateAura) this.rateAura = u.rateAura;
    if (u.poison) this.poison = u.poison;
    if (u.chains) this.chains = u.chains;
    if (u.hex) this.hex = u.hex;
    if (u.ignoreArmor) this.ignoreArmor = true;
    if (u.purge) this.purge = u.purge;
    if (this.type === 'barracks') {
      this._soldiersSpawned = false;
      this.game.soldiers = this.game.soldiers.filter(function (s) { return s.tower !== this; }, this);
    }
    this.totalSpent += u.cost;
    this.flash = 0.5;
    return true;
  }

  sellValue() {
    return Math.round(this.totalSpent * CONFIG.SELL_RATIO);
  }

  repairCost() {
    if (this.hp >= this.hpMax) return 0;
    var missing = this.hpMax - this.hp;
    return Math.max(5, Math.round(missing * 0.25));
  }

  repair() {
    var cost = this.repairCost();
    if (cost <= 0) return;
    if (this.game.gold < cost) { toast('No tienes oro suficiente', 1400); return; }
    this.game.gold -= cost;
    this.hp = this.hpMax;
    this.burnT = 0;
    sfx('tower_repair', 0.3);
    toast('🔧 ' + this.name + ' reparada', 1200);
  }

  takeDamage(dmg, source) {
    this.hp -= dmg;
    this.flash = Math.max(this.flash, 0.25);
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.destroyTower(this);
    }
  }

  update(dt, game) {
    if (this.stun > 0) { this.stun -= dt; this.flash = Math.max(this.flash, 0.3); return; }
    if (this.flash > 0) this.flash -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4);
    // apuntado automático: sigue al enemigo en alcance (con antelación de vuelo)
    var aimT = game.findTarget(this);
    var want = -Math.PI / 2;
    if (aimT) {
      var adx = aimT.x - this.x, ady = aimT.y - this.y;
      var dist = Math.sqrt(adx * adx + ady * ady);
      var ps = PROJ_SPEED[this.type] || 0;
      var leadT = (ps > 0 && aimT.speed > 0) ? dist / ps : 0;
      want = Math.atan2(
        aimT.y + Math.cos(aimT.angle) * aimT.speed * leadT - this.y,
        aimT.x + Math.sin(aimT.angle) * aimT.speed * leadT - this.x
      );
    }
    this.aim = turnToward(this.aim, want, dt * (7 + this.level * 1.5));
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.tempMulT > 0) {
      this.tempMulT -= dt;
      if (this.tempMulT <= 0) this.tempMul = 1;
    }
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.takeDamage(1.5 * dt, 'burn');
      if (this.hp <= 0) return;
    }
    this.cooldown -= dt * this.buffed * (this.rateAura || 1);
    if (this.type === 'ice') this.novaCd -= dt;
    this.windup = this.cooldown > 0 ? Math.max(0, Math.min(1, 1 - this.cooldown / (this.rate || 1))) : 0;
    var fn = {
      archer: this.actArcher,
      fire: this.actFire,
      ice: this.actIce,
      venom: this.actVenom,
      dwarf: this.actDwarf,
      crossbow: this.actCrossbow,
      druid: this.actDruid,
      tesla: this.actTesla,
      knight: this.actKnight,
      sniper: this.actSniper,
      holy: this.actHoly,
      banner: this.actBanner,
      warlock: this.actWarlock,
      barracks: this.actBarracks
    }[this.type];
    if (fn) {
      var baseDmg = this.damage;
      this.damage = this.damage * (this.dmgAmp || 1) * (this.tempMul || 1);
      fn.call(this, dt, game);
      this.damage = baseDmg;
    }
  }

  useAbility(game) {
    var ab = this.def.ability;
    if (!ab) { toast('Esta torre no tiene habilidad', 1400); return false; }
    if (this.abilityCd > 0) { toast('⏳ ' + ab.name + ' lista en ' + Math.ceil(this.abilityCd) + 's', 1200); return false; }
    var fx = ABILITY_FX[this.type];
    if (!fx) { toast('Esta torre no tiene habilidad', 1400); return false; }
    fx(game, this);
    this.abilityCd = ab.cd;
    this.flash = Math.max(this.flash, 0.3);
    sfx('ability_generic', 0.6);
    toast('✦ ' + ab.icon + ' ' + ab.name, 1800);
    return true;
  }

  actHoly(dt, game) {
    this.cooldown -= dt * this.buffed;
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.15;
    this.fireFX(game, 16);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 380, damage: this.damage, element: 'nature',
      tower: this, projColor: this.def.projColor, visual: 'holy',
      opts: { purge: this.purge || 4 }
    }));
  }

  actArcher(dt, game) {
    if (this.cooldown > 0) return;
    var targets = game.findTargets(this, this.targetCap);
    if (!targets.length) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(targets[0].y - this.y, targets[0].x - this.x);
    this.flash = 0.12;
    this.fireFX(game, 17);
    for (var i = 0; i < targets.length; i++) {
      game.projectiles.push(new Projectile(this.x, this.y, targets[i], {
        speed: 430, damage: this.damage, element: this.element,
        tower: this, projColor: this.def.projColor, visual: this.def.visual,
        opts: { pierce: this.pierce, aoe: this.aoe }
      }));
    }
  }

  actFire(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.2;
    this.fireFX(game, 14);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 280, damage: this.damage, element: 'fire',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { aoe: this.aoe, burn: true }
    }));
  }

  actIce(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.15;
    this.fireFX(game, 15);
    var slow = 0.35 + this.level * 0.12;
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 400, damage: this.damage, element: 'ice',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { slow: slow, slowDur: 2 }
    }));
    if (this.novaCd <= 0) {
      this.novaCd = 5 - this.level;
      game.frostNova(this.x, this.y, this.range * 0.65, 0.5 - this.level * 0.05, 2.5);
    }
  }

  actDwarf(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.25;
    this.fireFX(game, 22);
    var tt = Math.max(0.3, Math.hypot(t.x - this.x, t.y - this.y) / 260);
    var fut = game.futurePos(t, tt);
    game.projectiles.push(new Projectile(this.x, this.y, null, {
      speed: 260, damage: this.damage, element: 'earth',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      tx: fut.x, ty: fut.y,
      opts: { aoe: this.aoe, needGround: true, kb: 26 }
    }));
  }

  actCrossbow(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.2;
    this.fireFX(game, 20);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 620, damage: this.damage, element: 'physical',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { pierce: this.pierce }
    }));
  }

  actDruid(dt, game) {
    this.rootTimer -= dt;
    if (this.rootTimer > 0) return;
    this.rootTimer = 2.6 - this.level * 0.3;
    var rooted = false;
    var list = game.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive || e.flying) continue;
      var dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy <= this.range * this.range) {
        e.freeze = { t: Math.max(e.freeze ? e.freeze.t : 0, this.rootDur), dur: this.rootDur, src: "root" };
        rooted = true;
      }
    }
    if (rooted) {
      this.flash = 0.3;
      game.greenBurst(this.x, this.y, this.range);
    }
    for (var j = 0; j < game.towers.length; j++) {
      var tt = game.towers[j];
      if (tt === this) continue;
      var d2 = (tt.x - this.x) * (tt.x - this.x) + (tt.y - this.y) * (tt.y - this.y);
      if (d2 <= this.range * this.range && tt.stun > 0) tt.stun = 0;
    }
  }

  actKnight(dt, game) {
    if (this.cooldown > 0) { this.angle += dt * 2; return; }
    var best = null, bestD = -1;
    var list = game.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive || e.flying) continue;
      var dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy <= this.range * this.range && e.pathPos > bestD) {
        best = e; bestD = e.pathPos;
      }
    }
    if (!best) { this.angle += dt * 2; return; }
    this.cooldown = this.rate;
    this.angle = Math.atan2(best.y - this.y, best.x - this.x);
    this.flash = 0.2;
    this.recoil = 0.8;
    best.takeDamage(this.damage * game.weatherMult('physical'), 'physical', this);
    if (best.alive) {
      best.pathPos = Math.max(0, best.pathPos - 6);
      if (this.level >= 2) best.slow = { mult: 0.7, t: 0.8 };
      if (this.level >= 3) best.freeze = { t: Math.max(best.freeze ? best.freeze.t : 0, 0.3), dur: 0.3, src: "ice" };
    }
  }

  actVenom(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.15;
    this.fireFX(game, 13);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 320, damage: this.damage, element: 'nature',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { poison: this.poison, aoe: this.aoe }
    }));
  }

  actTesla(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.2;
    var hit = [];
    var cx = t.x, cy = t.y;
    t.takeDamage(this.damage * game.weatherMult('lightning'), 'lightning', this);
    if (t.alive) t.slow = { mult: 0.75, t: 1.2 };
    hit.push(t);
    game.lightningBolt(this.x, this.y - 6, t.x, t.y, '#8ad4ff', 0.16);
    for (var c = 0; c < this.chains && hit.length < 8; c++) {
      var next = null, nextD = Infinity;
      for (var i = 0; i < game.enemies.length; i++) {
        var e = game.enemies[i];
        if (!e.alive || hit.indexOf(e) !== -1) continue;
        var dx = e.x - cx, dy = e.y - cy;
        var d = dx * dx + dy * dy;
        if (d < nextD && d <= 90 * 90) { nextD = d; next = e; }
      }
      if (!next) break;
      var chainDmg = this.damage * (1 - c * 0.15) * game.weatherMult('lightning');
      next.takeDamage(chainDmg, 'lightning', this);
      if (next.alive) next.slow = { mult: 0.75, t: 1.2 };
      hit.push(next);
      game.lightningBolt(cx, cy, next.x, next.y, '#b8e4ff', 0.16);
      cx = next.x; cy = next.y;
    }
  }

  actSniper(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.25;
    this.recoil = 1;
    this.fireFX(game, 26);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 780, damage: this.damage, element: 'physical',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { pierce: this.pierce, ignoreArmor: this.ignoreArmor }
    }));
  }

  actBanner(dt, game) {
    this.angle += dt * 0.5;
    var g = 0.5 + 0.5 * Math.sin(game.time * 4);
    if (Math.random() < 0.15) {
      game.particles.push({
        x: this.x, y: this.y - 16, vx: (Math.random() - 0.5) * 10, vy: -14 - Math.random() * 10,
        life: 0.5, max: 0.5, color: '#ffe08a', size: 2, grav: 0
      });
    }
    if (g > 0.96) this.flash = Math.max(this.flash, 0.1);
  }

  actWarlock(dt, game) {
    if (this.cooldown > 0) return;
    var t = game.findTarget(this);
    if (!t) return;
    this.cooldown = this.rate;
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
    this.flash = 0.2;
    this.fireFX(game, 14);
    game.projectiles.push(new Projectile(this.x, this.y, t, {
      speed: 340, damage: this.damage, element: 'void',
      tower: this, projColor: this.def.projColor, visual: this.def.visual,
      opts: { hex: this.hex, aoe: this.aoe }
    }));
  }

  actBarracks(dt, game) {
    if (!this._soldiersSpawned) {
      this._soldiersSpawned = true;
      this.spawnSoldiers(game);
    }
  }

  spawnSoldiers(game) {
    var CELL = CONFIG.CELL;
    var path = game.map.path;
    var pathCells = [];
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1], b = path[i];
      if (a[0] === b[0]) {
        for (var r1 = Math.min(a[1], b[1]); r1 <= Math.max(a[1], b[1]); r1++) pathCells.push([a[0], r1]);
      } else {
        for (var c1 = Math.min(a[0], b[0]); c1 <= Math.max(a[0], b[0]); c1++) pathCells.push([c1, a[1]]);
      }
    }
    var occupied = {};
    for (var s0 = 0; s0 < game.soldiers.length; s0++) {
      occupied[game.soldiers[s0].homeX + ',' + game.soldiers[s0].homeY] = true;
    }
    var specs = {};
    var baseSpec = this.def.soldiers || {};
    for (var k in baseSpec) specs[k] = baseSpec[k];
    for (var u2 = 0; u2 < this.level && u2 < 3; u2++) {
      var up = this.def.upgrades[u2];
      if (up && up.soldiers) {
        for (var k2 in up.soldiers) specs[k2] = up.soldiers[k2];
      }
    }
    var typesToSpawn;
    if (this.level >= 3) typesToSpawn = ['swordsman', 'archer', 'shieldbearer', 'mage'];
    else if (this.level >= 2) typesToSpawn = ['swordsman', 'archer'];
    else typesToSpawn = ['swordsman'];
    for (var ti = 0; ti < typesToSpawn.length; ti++) {
      var stype = typesToSpawn[ti];
      var stats = specs[stype] || specs.swordsman || {};
      var bestCell = null;
      var bestDist = Infinity;
      for (var pc = 0; pc < pathCells.length; pc++) {
        var px = (pathCells[pc][0] + 0.5) * CELL;
        var py = (pathCells[pc][1] + 0.5) * CELL;
        if (occupied[px + ',' + py]) continue;
        var dx = px - this.x, dy = py - this.y;
        var d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestCell = [px, py]; }
      }
      if (bestCell) {
        occupied[bestCell[0] + ',' + bestCell[1]] = true;
        game.soldiers.push(new AlliedSoldier(bestCell[0], bestCell[1], stype, stats, this));
      }
    }
  }

  respawnSoldiers(game) {
    for (var i = 0; i < game.soldiers.length; i++) {
      var s = game.soldiers[i];
      if (s.tower === this) {
        s.alive = true;
        s.hp = s.hpMax;
        s.respawnTimer = 0;
      }
    }
  }

  draw(ctx, game) {
    var stun = this.stun > 0;
    var lv = this.level;
    var ap = 0.5 + 0.5 * Math.sin(game.time * 2.5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.translate(0, Math.sin(game.time * 1.8 + this.x * 0.06 + this.y * 0.04) * 0.6);
    if (stun) {
      var t = game.time;
      for (var s = 0; s < 3; s++) {
        ctx.globalAlpha = 0.5 - s * 0.12;
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(((s * 7 + t * 30) % 22) - 11, -14 - ((t * 22 + s * 9) % 14), 3, 0, 6.28);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // sombra
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 12, 18, 5, 0, 0, 6.28);
    ctx.fill();
    ctx.restore();
    // aura elemental
    ctx.save();
    ctx.globalAlpha = 0.1 + lv * 0.05 + ap * (0.04 + lv * 0.01);
    ctx.fillStyle = this.def.color;
    ctx.beginPath(); ctx.arc(0, -2, 20 + lv * 4 + ap * 2, 0, 6.28); ctx.fill();
    ctx.restore();
    // zócalo de piedra escalonado
    var pg = ctx.createLinearGradient(-19, 9, 19, 16);
    pg.addColorStop(0, '#6a645c');
    pg.addColorStop(0.5, '#54504a');
    pg.addColorStop(1, '#3e3a34');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(-19, 9, 38, 5.5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-19, 11.6, 38, 1.2);
    // piedras angulares
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-19, 9, 4, 5.5);
    ctx.fillRect(15, 9, 4, 5.5);
    // sprite oficial de la torre: sustituye cuerpo y arma procedural
    if (typeof SPRITES !== 'undefined' && SPRITES.draw(ctx, 't', this.type, 0, 16, 52, 0, null)) {
      // (el emblema y las gemas de nivel ya se dibujaron antes del arma)
    } else {
    // cuerpo arquitectónico según el tipo
    this._body(ctx, game);
    }
    var bodyH = 27 + lv * 4;
    var hw = 16 + lv * 2;
    // cornisa de sombra superior
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.roundRect(-hw, -13, hw * 2, 3, 1); ctx.fill();
    // destellos de poder al subir de nivel
    if (lv >= 2) {
      ctx.fillStyle = 'rgba(242,200,106,0.9)';
      for (var r3 = 0; r3 < lv; r3++) {
        var ra = game.time * 1.4 + r3 * 2.09;
        ctx.beginPath(); ctx.arc(Math.cos(ra) * (hw + 6), -8 + Math.sin(ra) * 3, 1.8, 0, 6.28); ctx.fill();
      }
    }
    // rayos de poder al nivel máximo
    if (lv >= 3) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.translate(0, -5);
      ctx.rotate(game.time * 0.4);
      ctx.fillStyle = this.def.color;
      for (var ray = 0; ray < 5; ray++) {
        ctx.rotate(1.2566);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(9, -4); ctx.lineTo(25, 0); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // emblema
    var emblemY = 3;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.roundRect(-8, emblemY - 4, 16, 9, 3); ctx.fill();
    ctx.fillStyle = this.def.color;
    ctx.beginPath(); ctx.arc(0, emblemY + 0.5, 3.4, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.def.icon, 0, emblemY + 1);
    if (lv >= 2) {
      ctx.globalAlpha = 0.5 + 0.4 * ap;
      ctx.fillStyle = this.def.color;
      ctx.beginPath(); ctx.arc(0, emblemY + 0.5, 6 + ap * 2, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // arma (crece con el nivel)
    var drawFn = {
      archer: this.drawArcher,
      fire: this.drawFire,
      ice: this.drawIce,
      venom: this.drawVenom,
      dwarf: this.drawDwarf,
      crossbow: this.drawCrossbow,
      druid: this.drawDruid,
      tesla: this.drawTesla,
      knight: this.drawKnight,
      sniper: this.drawSniper,
      holy: this.drawHoly,
      banner: this.drawBanner,
      warlock: this.drawWarlock,
      barracks: this.drawBarracks
    }[this.type];
    if (drawFn && !(typeof SPRITES !== 'undefined' && SPRITES.has('t', this.type))) {
      var ws = 1 + lv * 0.14;
      ctx.save();
      ctx.scale(ws, ws);
      drawFn.call(this, ctx, game);
      ctx.restore();
    }
    // gemas de nivel
    for (var i = 0; i < this.level; i++) {
      var px2 = -13 + i * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(px2 + 0.6, 13.1, 1.9, 0, 6.28); ctx.fill();
      ctx.fillStyle = ['#f2c86a', '#7fe8a0', '#7fb4ff'][i] || '#f2c86a';
      ctx.beginPath(); ctx.arc(px2, 12.4, 1.9, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(px2 - 0.5, 11.9, 0.6, 0, 6.28); ctx.fill();
    }
    if (this.flash > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (this.flash * 2) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 1, -13, hw * 2 + 2, bodyH + 1);
    }
    // vida / daño
    var pct = this.hp / this.hpMax;
    if (pct < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-15, 17, 30, 4);
      ctx.fillStyle = pct > 0.5 ? '#5ad45a' : (pct > 0.25 ? '#e8d24a' : '#e05050');
      ctx.fillRect(-15, 17, 30 * pct, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, 17, 30, 4);
    }
    if (pct < 0.5) {
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10, -6); ctx.lineTo(2, 4); ctx.lineTo(10, -2);
      ctx.moveTo(-4, 8); ctx.lineTo(6, 2);
      ctx.stroke();
    }
    if (pct < 0.25) {
      ctx.strokeStyle = 'rgba(20,20,20,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 10); ctx.lineTo(4, -8); ctx.lineTo(12, -4);
      ctx.moveTo(-12, -4); ctx.lineTo(0, 2);
      ctx.stroke();
    }
    if (this.burnT > 0 || (this.type === 'fire' && game.time % 0.1 < 0.05)) {
      var fl = 0.6 + 0.4 * Math.sin(game.time * 10);
      ctx.fillStyle = 'rgba(255,120,30,' + (0.5 + fl * 0.5) + ')';
      ctx.beginPath();
      ctx.moveTo(0, -18 - fl * 3);
      ctx.lineTo(-3, -13); ctx.lineTo(3, -13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,' + fl + ')';
      ctx.beginPath(); ctx.arc(0, -15, 2, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  _body(ctx, game) {
    var t = this.type;
    if (t === 'archer' || t === 'crossbow' || t === 'venom' || t === 'banner') this._bodyWood(ctx, game, t);
    else if (t === 'fire' || t === 'ice' || t === 'dwarf' || t === 'knight' || t === 'sniper' || t === 'holy') this._bodyStone(ctx, game, t);
    else if (t === 'druid') this._bodyLiving(ctx, game);
    else if (t === 'tesla') this._bodyCrystal(ctx, game);
    else if (t === 'warlock') this._bodyVoid(ctx, game);
    else if (t === 'barracks') this._bodyTent(ctx, game);
  }

  // Banderín triangular ondeante en un mástil.
  _pennant(ctx, x, y, len, time, col) {
    var w1 = Math.sin(time * 5 + x) * 1.6, w2 = Math.sin(time * 5 + x + 1.2) * 2.2;
    ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len * 0.6); ctx.stroke();
    ctx.fillStyle = col || '#c9483a';
    ctx.beginPath();
    ctx.moveTo(x, y - len * 0.6);
    ctx.quadraticCurveTo(x + len * 0.45, y - len * 0.55 + w1, x + len, y - len * 0.42 + w2);
    ctx.quadraticCurveTo(x + len * 0.45, y - len * 0.38 + w1, x, y - len * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,160,0.8)';
    ctx.beginPath(); ctx.arc(x, y - len * 0.62, 0.9, 0, 6.28); ctx.fill();
  }

  _bodyTent(ctx, game) {
    var t = game.time;
    // tienda de campaña militar
    var cg = ctx.createLinearGradient(-16, -14, 16, 12);
    cg.addColorStop(0, '#8a6434');
    cg.addColorStop(0.5, '#6a4a2a');
    cg.addColorStop(1, '#4a3018');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-17, 12);
    ctx.quadraticCurveTo(-13, -10, 0, -16);
    ctx.quadraticCurveTo(13, -10, 17, 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,12,6,0.85)'; ctx.lineWidth = 1.4; ctx.stroke();
    // costuras radiales
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (var seam = -1; seam <= 1; seam++) {
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.quadraticCurveTo(seam * 8, -2, seam * 13, 11);
      ctx.stroke();
    }
    // entrada oscura con luz interior parpadeante
    var gl = 0.55 + 0.45 * Math.sin(t * 6);
    ctx.fillStyle = '#1c1008';
    ctx.beginPath();
    ctx.moveTo(-5, 12); ctx.lineTo(-4, -2); ctx.quadraticCurveTo(0, -6, 4, -2); ctx.lineTo(5, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,60,' + (0.16 + gl * 0.14) + ')';
    ctx.beginPath();
    ctx.moveTo(-3.4, 12); ctx.lineTo(-3, -1); ctx.quadraticCurveTo(0, -4, 3, -1); ctx.lineTo(3.4, 12);
    ctx.closePath(); ctx.fill();
    // remate central + banderín ondeante
    this._pennant(ctx, 0, -17, 12, t + 2, '#c9a84c');
    // faldón de estacas
    ctx.strokeStyle = '#2e2010'; ctx.lineWidth = 1.6;
    for (var peg = -2; peg <= 2; peg++) {
      if (!peg) continue;
      ctx.beginPath(); ctx.moveTo(peg * 6.5, 10); ctx.lineTo(peg * 8.5, 14); ctx.stroke();
    }
    // escudo heráldico plantado junto a la entrada
    ctx.save();
    ctx.translate(13, 6);
    ctx.rotate(0.08 + Math.sin(t * 1.6) * 0.02);
    ctx.fillStyle = '#6b6f7c';
    ctx.beginPath();
    ctx.moveTo(-3.4, -5); ctx.lineTo(3.4, -5); ctx.lineTo(3.4, 2);
    ctx.quadraticCurveTo(3.4, 5.5, 0, 6.5);
    ctx.quadraticCurveTo(-3.4, 5.5, -3.4, 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d8dce4'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = '#c9483a';
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(2, 0); ctx.lineTo(0, 3.5); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _bodyWood(ctx, game, t) {
    var w = '#6a4a2a', wd = '#4a3018', dl = '#8a6434';
    var raised = t === 'crossbow';
    var top = -23 - (raised ? 8 : 0);
    // pilares
    ctx.fillStyle = wd;
    ctx.fillRect(-13.5, -13, 4, 29);
    ctx.fillRect(9.5, -13, 4, 29);
    // riostras en X
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(-12, 5); ctx.stroke();
    // plataforma superior
    ctx.fillStyle = w;
    ctx.beginPath(); ctx.roundRect(-16, top, 32, 4, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-16, top + 3.2, 32, 0.8);
    // parapeto con almenas de madera
    ctx.fillStyle = dl;
    ctx.fillRect(-16, top - 6, 32, 6);
    for (var mb = -1; mb <= 1; mb++) {
      ctx.fillRect(mb * 8 - 2.2, top - 8.5, 4.4, 8.5);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(mb * 8 - 2.2, top - 8.5, 4.4, 1);
      ctx.fillStyle = dl;
    }
    // travesaño
    ctx.fillStyle = dl;
    ctx.fillRect(-13, -5, 26, 2.4);
    // viga central de refuerzo
    ctx.fillStyle = wd;
    ctx.fillRect(-2.4, top + 2, 4.8, 14);
    // base reforzada
    ctx.fillStyle = w;
    ctx.beginPath(); ctx.roundRect(-16, 3, 32, 7, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-16, 3, 32, 1);
    // clavos
    ctx.fillStyle = '#1c1208';
    ctx.fillRect(-15, 3.5, 1.6, 1.6);
    ctx.fillRect(13.4, 3.5, 1.6, 1.6);
    // banderín en la esquina de la plataforma
    if (t !== 'banner') this._pennant(ctx, 14, top - 7, 10, game.time, '#c9483a');
  }

  _bodyStone(ctx, game, t) {
    var holy = t === 'holy';
    var light = holy ? '#efe9d8' : '#9aa0a8';
    var mid = holy ? '#d5cdb8' : '#757b84';
    var dark = holy ? '#a89f8c' : '#4a5058';
    // cuerpo ahusado
    var bg = ctx.createLinearGradient(-15, -13, 15, 14);
    bg.addColorStop(0, light);
    bg.addColorStop(0.45, mid);
    bg.addColorStop(1, dark);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-15, 14);
    ctx.lineTo(-12, -13);
    ctx.lineTo(12, -13);
    ctx.lineTo(15, 14);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(-18, -18, 36, 34);
    // sillares
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
    for (var by = 1; by <= 4; by++) {
      var yy = -13 + by * 6.7;
      ctx.beginPath(); ctx.moveTo(-15, yy); ctx.lineTo(15, yy); ctx.stroke();
      var off = (by % 2) * 4.5;
      ctx.beginPath(); ctx.moveTo(-15 + off, yy - 6.7); ctx.lineTo(-15 + off, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15 + off + 9, yy - 6.7); ctx.lineTo(-15 + off + 9, yy); ctx.stroke();
    }
    ctx.restore();
    // contrafuertes
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.roundRect(-18, 3, 4, 11, 1); ctx.fill();
    ctx.beginPath(); ctx.roundRect(14, 3, 4, 11, 1); ctx.fill();
    // puerta arqueada
    ctx.fillStyle = '#201d1a';
    ctx.beginPath(); ctx.arc(0, 2, 4.2, Math.PI, 0); ctx.lineTo(4.2, 6.5); ctx.lineTo(-4.2, 6.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-4.2, 3, 8.4, 0.8);
    // almenas
    ctx.fillStyle = mid;
    ctx.fillRect(-12, -16, 24, 3.5);
    for (var c = -1; c <= 1; c++) {
      ctx.fillStyle = dark;
      ctx.fillRect(c * 8 - 2, -18.5, 4, 6);
      ctx.fillStyle = light;
      ctx.fillRect(c * 8 - 2, -18.5, 4, 1);
    }
    // detalles por tipo
    if (t === 'fire') {
      var gl = 0.5 + 0.5 * Math.sin(game.time * 8);
      ctx.fillStyle = '#1a1008';
      ctx.beginPath(); ctx.arc(0, -1, 5.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,30,' + (0.4 + gl * 0.5) + ')';
      ctx.beginPath(); ctx.arc(0, -2, 4 + gl * 2, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,130,' + gl + ')';
      ctx.beginPath(); ctx.arc(0, -2.4, 2, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(180,180,180,' + (0.2 + gl * 0.2) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -7 - gl * 2, 2 + gl, 3.4, 5.8); ctx.stroke();
    } else if (t === 'ice') {
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath(); ctx.moveTo(-5, -13); ctx.lineTo(-2, -28); ctx.lineTo(1, -13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1, -13); ctx.lineTo(5, -25); ctx.lineTo(9, -13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(-7, -22); ctx.lineTo(-4, -13); ctx.fill();
      ctx.fillStyle = '#e8f6ff';
      ctx.beginPath(); ctx.moveTo(-4, -13); ctx.lineTo(-2, -26); ctx.lineTo(0, -13); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,0.35)';
      ctx.beginPath(); ctx.arc(0, -8, 7, 0, 6.28); ctx.fill();
    } else if (t === 'dwarf') {
      ctx.fillStyle = '#5c5448';
      ctx.fillRect(5, -24, 9, 11);
      ctx.fillRect(4, -26.5, 11, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(5.5, -22, 8, 1.4);
      ctx.fillStyle = '#c9b26a';
      ctx.beginPath(); ctx.arc(0, 5, 1, 0, 6.28); ctx.fill();
    } else if (t === 'sniper') {
      ctx.fillStyle = '#1a160f';
      ctx.beginPath(); ctx.roundRect(-1.6, -9, 3.2, 14, 1.6); ctx.fill();
    } else if (t === 'knight') {
      ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-10, -17); ctx.lineTo(-10, -30); ctx.stroke();
      ctx.fillStyle = '#c03030';
      ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(-3, -27); ctx.lineTo(-10, -24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(-2, 6.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(2, 6.5); ctx.stroke();
    } else if (t === 'holy') {
      ctx.fillStyle = 'rgba(232,200,90,0.9)';
      ctx.fillRect(-1, -28, 2, 13);
      ctx.fillRect(-4, -25, 8, 2);
      ctx.strokeStyle = 'rgba(232,200,90,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(7, -5); ctx.stroke();
    }
    // banderín sobre la almena izquierda
    if (!holy) this._pennant(ctx, -8, -18, 9, game.time + 1, '#c9483a');
  }

  _bodyLiving(ctx, game) {
    var bark = '#5a4a34', dark = '#3f3323';
    var gl = 0.5 + 0.5 * Math.sin(game.time * 3);
    // raíces
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, 10); ctx.quadraticCurveTo(-15, 13, -17, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, 10); ctx.quadraticCurveTo(15, 13, 17, 15); ctx.stroke();
    // tronco
    var bg = ctx.createLinearGradient(-12, -13, 12, 14);
    bg.addColorStop(0, bark);
    bg.addColorStop(1, dark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-10, 14);
    ctx.quadraticCurveTo(-14, -6, -9, -13);
    ctx.lineTo(9, -13);
    ctx.quadraticCurveTo(14, -6, 10, 14);
    ctx.closePath(); ctx.fill();
    // corteza
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(-3, 0, -5, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -8); ctx.quadraticCurveTo(3, 2, 6, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -9); ctx.quadraticCurveTo(-1, 1, -2, 9); ctx.stroke();
    // ramas
    ctx.strokeStyle = bark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(-13, -13, -14, -19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -9); ctx.quadraticCurveTo(13, -13, 14, -19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -11); ctx.quadraticCurveTo(4, -16, 2, -20); ctx.stroke();
    // follaje
    ctx.fillStyle = '#5a9a4a';
    ctx.beginPath(); ctx.arc(-11, -20, 6.5, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -20, 6.5, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 9, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -24, 6, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(-6, -24, 5, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -24, 5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#4a7a3a';
    ctx.beginPath(); ctx.arc(0, -25, 6, 0, 6.28); ctx.fill();
    // flores brillantes
    ctx.fillStyle = 'rgba(255,180,120,' + (0.5 + gl * 0.4) + ')';
    ctx.beginPath(); ctx.arc(-11, -20, 1.8, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -17, 1.8, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -27, 1.8, 0, 6.28); ctx.fill();
  }

  _bodyCrystal(ctx, game) {
    var gl = 0.5 + 0.5 * Math.sin(game.time * 5);
    // roca base
    var rg = ctx.createLinearGradient(-16, 2, 16, 14);
    rg.addColorStop(0, '#5a5a68');
    rg.addColorStop(1, '#3a3a46');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(-16, 14); ctx.lineTo(-12, 4); ctx.lineTo(-4, 2);
    ctx.lineTo(4, 2); ctx.lineTo(12, 4); ctx.lineTo(16, 14); ctx.closePath(); ctx.fill();
    // cristal principal
    var g2 = ctx.createLinearGradient(-9, -26, 9, 0);
    g2.addColorStop(0, '#e0c8ff');
    g2.addColorStop(0.45, '#9a6aff');
    g2.addColorStop(1, '#5a2a8a');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.lineTo(3.5, -26); ctx.lineTo(-3.5, -26);
    ctx.closePath(); ctx.fill();
    // cristales laterales
    ctx.fillStyle = '#8a5aff';
    ctx.beginPath(); ctx.moveTo(-13, 4); ctx.lineTo(-4, 4); ctx.lineTo(-8, -15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(13, 4); ctx.lineTo(8, -15); ctx.closePath(); ctx.fill();
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(-3, -24); ctx.lineTo(-1.5, -10); ctx.lineTo(0, -24); ctx.closePath(); ctx.fill();
    // halo de energía
    ctx.strokeStyle = 'rgba(200,160,255,' + (0.3 + gl * 0.3) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -6, 12 + gl * 3, 0, 6.28); ctx.stroke();
    // chispa errante
    ctx.fillStyle = 'rgba(255,255,255,' + gl + ')';
    ctx.beginPath(); ctx.arc(Math.sin(game.time * 7) * 10, -6 + Math.cos(game.time * 6) * 4, 1.4, 0, 6.28); ctx.fill();
  }

  _bodyVoid(ctx, game) {
    var gl = 0.5 + 0.5 * Math.sin(game.time * 4);
    // obelisco ahusado
    var bg = ctx.createLinearGradient(-11, -13, 11, 14);
    bg.addColorStop(0, '#3a2a5a');
    bg.addColorStop(1, '#150c24');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-12, 14);
    ctx.lineTo(-8, -13);
    ctx.lineTo(8, -13);
    ctx.lineTo(12, 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-8, -13, 16, 2);
    // runas brillantes
    ctx.fillStyle = 'rgba(160,110,255,' + (0.5 + gl * 0.4) + ')';
    for (var i = 0; i < 3; i++) {
      var rx = -5 + i * 5;
      ctx.beginPath(); ctx.arc(rx, -4 + (i % 2) * 4, 1.4, 0, 6.28); ctx.fill();
    }
    // ojo del vacío
    ctx.fillStyle = '#0e0718';
    ctx.beginPath(); ctx.arc(0, 4, 4.6, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,255,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 4, 4.6 + gl, 0, 6.28); ctx.stroke();
    ctx.fillStyle = '#9a6aff';
    ctx.beginPath(); ctx.arc(0, 4, 1.8 + gl * 1.5, 0, 6.28); ctx.fill();
    // partículas orbitales
    ctx.fillStyle = 'rgba(180,130,255,' + (0.4 + gl * 0.4) + ')';
    for (var p = 0; p < 3; p++) {
      var a = game.time * 1.2 + p * 2.09;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 10, -6 + Math.sin(a) * 4, 1.5, 0, 6.28); ctx.fill();
    }
  }

  // Guarnición de barracas: dos soldados en guardia con idle respirado.
  drawBarracks(ctx, game) {
    var t = game.time;
    for (var s = 0; s < 2; s++) {
      var sx = s === 0 ? -9 : 9;
      var flip = s === 0 ? 1 : -1;
      var breath = Math.sin(t * 2 + s * 2.4) * 0.6;
      var idle = Math.sin(t * 1.3 + s * 1.7) * 0.08;
      ctx.save();
      ctx.translate(sx, 6 + breath * 0.4);
      ctx.rotate(idle * flip);
      // piernas firmes
      ctx.strokeStyle = '#3a3020'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.6, 2); ctx.lineTo(-2.2, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.6, 2); ctx.lineTo(2.2, 7); ctx.stroke();
      // torso con coraza
      ctx.fillStyle = '#5a626e';
      ctx.beginPath(); ctx.roundRect(-3.2, -4.5, 6.4, 7.5, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.roundRect(-2.4, -3.8, 2, 5, 1); ctx.fill();
      // cabeza con casco
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath(); ctx.arc(0, -7, 2.4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#6b6f7c';
      ctx.beginPath(); ctx.arc(0, -7.4, 2.6, Math.PI, 0); ctx.fill();
      ctx.fillRect(-2.6, -7.6, 5.2, 1);
      // lanza en posición de guardia (leve oscilación)
      var lanceSway = Math.sin(t * 1.8 + s * 3) * 0.06;
      ctx.save();
      ctx.translate(flip * 3.4, -3);
      ctx.rotate(flip * (0.12 + lanceSway));
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -13); ctx.stroke();
      ctx.fillStyle = '#c9ccd6';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-1.4, -10); ctx.lineTo(1.4, -10); ctx.closePath(); ctx.fill();
      ctx.restore();
      // escudo redondo al frente
      ctx.fillStyle = '#6b6f7c';
      ctx.beginPath(); ctx.arc(flip * 3.6, 0.5 + breath * 0.2, 3, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#d8dce4'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#c9a84c';
      ctx.beginPath(); ctx.arc(flip * 3.6, 0.5 + breath * 0.2, 1.1, 0, 6.28); ctx.fill();
      ctx.restore();
    }
  }

  drawArcher(ctx, game) {
    var rec = this.recoil * 4;
    var aim = this.aim;
    ctx.save();
    ctx.translate(0, -11);
    // arquero encapuchado
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(-2.2, -5, 4.4, 5);
    ctx.beginPath(); ctx.arc(0, -6.5, 2.6, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#f0d8b8';
    ctx.beginPath(); ctx.arc(0, -6.2, 1.4, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1f3a1f';
    ctx.beginPath(); ctx.arc(0, -6.8, 1.8, 3.1, 6.1); ctx.fill();
    // aljaba
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(-6, -4, 2.5, 5);
    ctx.fillStyle = '#c9c9d4';
    ctx.fillRect(-6, -6.5, 2.5, 2.5);
    // pluma del capuchón ondeando
    ctx.fillStyle = '#d8a040';
    ctx.beginPath();
    ctx.moveTo(0, -9.4);
    ctx.quadraticCurveTo(1.6, -11.8 + Math.sin(game.time * 6) * 0.8, 3.4, -10.4);
    ctx.quadraticCurveTo(1.2, -9.6, 0, -9.1);
    ctx.closePath(); ctx.fill();
    // arco apuntando
    ctx.rotate(aim);
    ctx.strokeStyle = '#8a6434'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 7.5, -1.45, 1.45); ctx.stroke();
    // cuerda tensa por el retroceso y el viento de carga
    var pull = 2.5 + rec * 0.7 + (1 - this.windup) * 1.1;
    ctx.strokeStyle = 'rgba(230,225,210,0.9)'; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(7.5 * Math.cos(-1.45), 7.5 * Math.sin(-1.45));
    ctx.lineTo(-pull, 0);
    ctx.lineTo(7.5 * Math.cos(1.45), 7.5 * Math.sin(1.45));
    ctx.stroke();
    // flecha
    ctx.fillStyle = '#a0a0ac';
    ctx.fillRect(0, -0.6, 9.5, 1.2);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(9.5, 0); ctx.lineTo(6.5, -1.6); ctx.lineTo(6.5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c9d4';
    ctx.beginPath(); ctx.moveTo(-pull - 1, 0); ctx.lineTo(-pull - 4, -2.2); ctx.lineTo(-pull - 4, 2.2); ctx.closePath(); ctx.fill();
    if (this.windup > 0.85) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(-pull, 0, 1.1, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  drawFire(ctx, game) {
    var rec = this.recoil * 4;
    var fl = 0.5 + 0.5 * Math.sin(game.time * 9);
    ctx.save();
    // caldero braza
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.ellipse(0, -9, 5.5, 3.2, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ff9a4a';
    ctx.beginPath(); ctx.ellipse(0, -10.4, 3.6, 2, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.ellipse(0, -10.6, 2, 1.2, 0, 0, 6.28); ctx.fill();
    // brasas ascendiendo
    for (var em = 0; em < 3; em++) {
      var ep = (game.time * 0.7 + em * 0.33) % 1;
      ctx.globalAlpha = (1 - ep) * 0.8;
      ctx.fillStyle = '#ffb04a';
      ctx.beginPath(); ctx.arc(Math.sin(game.time * 3 + em * 2) * 4 * ep, -10 - ep * 14, 1.6, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // surtidor de fuego hacia aim
    ctx.rotate(this.aim);
    ctx.translate(rec, 0);
    var fg = ctx.createLinearGradient(0, -6, 12, -2);
    fg.addColorStop(0, '#ffb04a');
    fg.addColorStop(1, 'rgba(255,90,30,0.1)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.quadraticCurveTo(7 + fl * 3, -9, 13 + fl * 5, -2);
    ctx.quadraticCurveTo(8, -1, 0, -1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,160,' + fl + ')';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(5 + fl * 2, -7, 9 + fl * 3, -2.5);
    ctx.quadraticCurveTo(5, -1, 0, -1.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawIce(ctx, game) {
    var g = 0.5 + 0.5 * Math.sin(this.aim * 3);
    ctx.save();
    ctx.translate(0, -9);
    // halo de escarcha
    ctx.strokeStyle = 'rgba(160,220,255,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 9 + g, 0, 6.28); ctx.stroke();
    // fragmentos giratorios
    ctx.save();
    ctx.rotate(game.time * 1.5);
    for (var i = 0; i < 4; i++) {
      var a = i * 1.5708;
      ctx.fillStyle = i % 2 ? '#9fd4ff' : '#7fb8e0';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
      ctx.lineTo(Math.cos(a + 0.6) * 9.5, Math.sin(a + 0.6) * 9.5);
      ctx.lineTo(Math.cos(a + 0.15) * 12, Math.sin(a + 0.15) * 12);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // orbe de hielo
    var og = ctx.createRadialGradient(0, -1, 1, 0, 0, 6);
    og.addColorStop(0, '#ffffff');
    og.addColorStop(0.5, '#bfe8ff');
    og.addColorStop(1, 'rgba(120,180,230,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, 0, 6 + g, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  drawDwarf(ctx, game) {
    var rec = this.recoil * 4;
    ctx.save();
    // yunque
    ctx.fillStyle = '#5a5a66';
    ctx.beginPath(); ctx.roundRect(-6, -7, 12, 4, 1); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-4, -10, 8, 3, 1); ctx.fill();
    // resplandor del fragua
    var dg = 0.5 + 0.5 * Math.sin(game.time * 4);
    ctx.fillStyle = 'rgba(255,150,60,' + (0.2 + dg * 0.25) + ')';
    ctx.beginPath(); ctx.arc(0, -9, 8 + dg * 2.5, 0, 6.28); ctx.fill();
    // martillo golpeando hacia aim
    ctx.rotate(this.aim);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(10 - rec * 0.5, -14); ctx.stroke();
    ctx.fillStyle = '#8a8a96';
    ctx.beginPath(); ctx.roundRect(8 - rec * 0.5, -16.5, 5, 5, 1); ctx.fill();
    ctx.fillStyle = '#a0a0ac';
    ctx.fillRect(8 - rec * 0.5, -16.5, 5, 1.4);
    // chispas
    if (rec > 1) {
      ctx.fillStyle = 'rgba(255,200,80,0.9)';
      for (var i = 0; i < 3; i++) {
        var a = game.time * 6 + i * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 13, -12 + Math.sin(a) * 4, 1.2, 0, 6.28); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawCrossbow(ctx, game) {
    var rec = this.recoil * 4;
    ctx.save();
    ctx.rotate(this.aim);
    // arco de acero
    ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -9, 6.5, -1.5, 1.5); ctx.stroke();
    // cuerpo de la ballesta
    ctx.fillStyle = '#4a3018';
    ctx.beginPath(); ctx.roundRect(-4, -11, 15, 3, 1); ctx.fill();
    // virote cargado
    ctx.fillStyle = '#a0a0ac';
    ctx.fillRect(11, -9.8, 6, 1.4);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(17, -9.1); ctx.lineTo(14, -10.7); ctx.lineTo(14, -7.5); ctx.closePath(); ctx.fill();
    // cuerda
    ctx.strokeStyle = 'rgba(230,225,210,0.9)'; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-6, -11.5); ctx.lineTo(-6, -8.5); ctx.stroke();
    // rueda de wincha
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.arc(-7, -10, 2, 0, 6.28); ctx.fill();
    // manivela girando mientras carga
    var wa = game.time * 3;
    ctx.strokeStyle = '#9a9aa6'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7 + Math.cos(wa) * 2.6, -10 + Math.sin(wa) * 2.6);
    ctx.lineTo(-7 + Math.cos(wa + 2.4) * 2.6, -10 + Math.sin(wa + 2.4) * 2.6);
    ctx.stroke();
    ctx.restore();
  }

  drawVenom(ctx, game) {
    var bub = 0.5 + 0.5 * Math.sin(game.time * 5);
    ctx.save();
    // caldero
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath(); ctx.arc(0, -10, 6, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#5f4d2a';
    ctx.beginPath(); ctx.arc(0, -10, 4.4, 0, 6.28); ctx.fill();
    // burbujas tóxicas
    ctx.fillStyle = 'rgba(140,230,120,' + (0.5 + bub * 0.4) + ')';
    ctx.beginPath(); ctx.arc(0, -12.5 - bub * 3, 2 + bub, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -13 - bub * 2, 1.4, 0, 6.28); ctx.fill();
    // vapor tóxico ascendiendo
    for (var vm = 0; vm < 2; vm++) {
      var vp = (game.time * 0.6 + vm * 0.5) % 1;
      ctx.globalAlpha = (1 - vp) * 0.3;
      ctx.fillStyle = '#7ad47f';
      ctx.beginPath(); ctx.arc((vm ? 3 : -3) + Math.sin(game.time * 2 + vm * 3) * 1.5, -10 - vp * 12, 2 + vp * 2.5, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // orbe de veneno hacia aim
    ctx.rotate(this.aim);
    ctx.fillStyle = '#7ad47f';
    ctx.beginPath(); ctx.arc(8, -12, 2.6, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(122,212,127,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(8, -12, 5, 0, 6.28); ctx.stroke();
    ctx.restore();
  }

  drawDruid(ctx, game) {
    var g = 0.5 + 0.5 * Math.sin(game.time * 3);
    ctx.save();
    // enredaderas colgantes
    ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 1.4;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 5, -10);
      ctx.quadraticCurveTo(i * 6, -16 + Math.sin(game.time * 2 + i) * 2, i * 7, -13);
      ctx.stroke();
    }
    // espíritu de la naturaleza
    ctx.translate(0, -17 + Math.sin(game.time * 2) * 1.5);
    var og = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
    og.addColorStop(0, '#d8ffc8');
    og.addColorStop(0.5, '#8ae87a');
    og.addColorStop(1, 'rgba(138,232,122,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, 0, 8 + g, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#eaffda';
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 6.28); ctx.fill();
    // hojas flotantes
    ctx.fillStyle = 'rgba(170,235,130,0.8)';
    for (var df = 0; df < 3; df++) {
      var da = game.time * 1.2 + df * 2.09;
      ctx.beginPath(); ctx.arc(Math.cos(da) * 11, Math.sin(da) * 4, 1.4, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  drawTesla(ctx, game) {
    var zap = 0.5 + 0.5 * Math.abs(Math.sin(game.time * 7));
    ctx.save();
    ctx.translate(0, -20);
    // corona
    ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.28); ctx.stroke();
    // arcos eléctricos
    ctx.strokeStyle = 'rgba(200,160,255,' + (0.5 + zap * 0.5) + ')';
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var a = game.time * 2 + i * 1.5708;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.lineTo(Math.cos(a) * 10 + Math.sin(game.time * 20 + i) * 2, Math.sin(a) * 10);
      ctx.stroke();
    }
    // núcleo
    var og = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 4);
    og.addColorStop(0, '#fff');
    og.addColorStop(1, '#b06aff');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, 0, 4 + zap, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  drawKnight(ctx, game) {
    var rec = this.recoil * 4;
    ctx.save();
    // armadura
    ctx.fillStyle = '#9aa0aa';
    ctx.beginPath(); ctx.roundRect(-4, -14, 8, 9, 2); ctx.fill();
    ctx.fillStyle = '#b8bec8';
    ctx.fillRect(-4, -14, 8, 1.6);
    // yelmo
    ctx.fillStyle = '#7a808c';
    ctx.beginPath(); ctx.roundRect(-3.4, -19.5, 6.8, 6, 2.5); ctx.fill();
    ctx.fillStyle = '#23262c';
    ctx.beginPath(); ctx.roundRect(-2.2, -17.5, 4.4, 3.4, 1); ctx.fill();
    // pluma
    ctx.fillStyle = '#c03030';
    ctx.beginPath();
    ctx.moveTo(0, -19.5); ctx.quadraticCurveTo(2.5, -23.5, 4.5, -22.5);
    ctx.quadraticCurveTo(1.5, -22, -1, -18.5); ctx.closePath(); ctx.fill();
    // escudo
    ctx.fillStyle = '#4a6a9a';
    ctx.beginPath();
    ctx.moveTo(-5.5, -14); ctx.lineTo(-2.2, -14); ctx.lineTo(-2.2, -7); ctx.lineTo(-3.9, -4); ctx.lineTo(-5.5, -7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8d24a';
    ctx.beginPath(); ctx.arc(-3.9, -10, 1.2, 0, 6.28); ctx.fill();
    // destello del escudo
    var kg2 = 0.5 + 0.5 * Math.sin(game.time * 5);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.14 + kg2 * 0.26) + ')';
    ctx.beginPath();
    ctx.moveTo(-5.2, -13.4); ctx.lineTo(-3.1, -13.4); ctx.lineTo(-3.1, -11.4); ctx.lineTo(-5.2, -11.4);
    ctx.closePath(); ctx.fill();
    // lanza golpeando hacia aim
    ctx.rotate(this.aim);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(1 - rec * 0.4, -13, 12 + rec * 0.7, 1.6);
    ctx.fillStyle = '#aab2be';
    ctx.beginPath(); ctx.moveTo(13 + rec * 0.7, -12.2); ctx.lineTo(9, -13.8); ctx.lineTo(9, -10.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawSniper(ctx, game) {
    var rec = this.recoil * 4;
    ctx.save();
    // caballete
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(0, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -5); ctx.lineTo(0, -10); ctx.stroke();
    // viga
    ctx.fillStyle = '#5a3a1c';
    ctx.beginPath(); ctx.roundRect(-8, -11, 17, 2.6, 1); ctx.fill();
    // ballesta
    ctx.rotate(this.aim * 0.5);
    ctx.strokeStyle = '#6a6a76'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(2, -9.6, 6, -1.5, 1.5); ctx.stroke();
    // virote largo
    ctx.fillStyle = '#a0a0ac';
    ctx.fillRect(-6 + rec, -10.6, 18, 1.4);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(12 + rec, -9.9); ctx.lineTo(8 + rec, -11.4); ctx.lineTo(8 + rec, -8.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c9d4';
    ctx.beginPath(); ctx.moveTo(-6 + rec, -10.6); ctx.lineTo(-9 + rec, -12.6); ctx.lineTo(-9 + rec, -8.6); ctx.closePath(); ctx.fill();
    // mira telescópica con destello
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.roundRect(0, -13.4, 6, 2.4, 1); ctx.fill();
    var glint = 0.4 + 0.4 * Math.abs(Math.sin(game.time * 1.2));
    ctx.fillStyle = 'rgba(255,255,255,' + glint.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(5, -12.2, 0.9, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  drawHoly(ctx, game) {
    var g = 0.5 + 0.5 * Math.sin(game.time * 3);
    ctx.save();
    ctx.translate(0, -14);
    // rayos
    ctx.strokeStyle = 'rgba(255,220,120,' + (0.4 + g * 0.4) + ')';
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = i * 0.7854 + game.time * 0.3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke();
    }
    // halo
    ctx.strokeStyle = '#e8c85a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 6.5 + g, 0, 6.28); ctx.stroke();
    // motas sagradas flotantes
    ctx.fillStyle = 'rgba(255,230,150,0.9)';
    for (var hm = 0; hm < 3; hm++) {
      var ha = game.time * 0.9 + hm * 2.09;
      ctx.beginPath(); ctx.arc(Math.cos(ha) * 14, Math.sin(ha) * 4, 1.3, 0, 6.28); ctx.fill();
    }
    // relicario
    ctx.fillStyle = '#f2c86a';
    ctx.beginPath(); ctx.moveTo(-3.2, 4.5); ctx.lineTo(0, -5.5); ctx.lineTo(3.2, 4.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath(); ctx.arc(0, -2.5, 1.5, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  drawBanner(ctx, game) {
    var wave = Math.sin(game.time * 4) * 1.5;
    ctx.save();
    // asta
    ctx.fillStyle = '#4a2a12';
    ctx.fillRect(-1, -27, 2, 19);
    // banderín superior
    ctx.fillStyle = this.def.color;
    ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(6, -28.5 + wave * 0.5); ctx.lineTo(6, -25 + wave * 0.5); ctx.closePath(); ctx.fill();
    // bandera ondeando
    ctx.fillStyle = this.def.color;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.quadraticCurveTo(8, -24 + wave, 16, -23 + wave * 1.6);
    ctx.lineTo(16, -13 + wave * 1.6);
    ctx.quadraticCurveTo(8, -13 + wave, 0, -13);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.stroke();
    // emblema
    var bg = 0.35 + 0.3 * Math.abs(Math.sin(game.time * 3));
    ctx.fillStyle = 'rgba(255,240,190,' + bg.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(7.5, -17 + wave, 6.5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(this.def.icon, 7.5, -17 + wave);
    ctx.restore();
  }

  drawWarlock(ctx, game) {
    var rec = this.recoil * 4;
    var g = 0.5 + 0.5 * Math.sin(this.aim * 4);
    ctx.save();
    ctx.rotate(this.angle);
    ctx.translate(-rec, 0);
    // orbe del vacío
    var og = ctx.createRadialGradient(13, -1, 1, 13, -1, 8);
    og.addColorStop(0, '#e8d4ff');
    og.addColorStop(0.4, '#9a5aff');
    og.addColorStop(1, 'rgba(90,30,160,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(13, -1, 8 + g * 2, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#4a2a7a';
    ctx.beginPath(); ctx.arc(13, -1, 4 + g, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#c8a0ff';
    ctx.beginPath(); ctx.arc(12, -2.4, 1.4, 0, 6.28); ctx.fill();
    // runas orbitales
    for (var i = 0; i < 3; i++) {
      var a = this.aim * 2 + i * 2.09;
      ctx.fillStyle = 'rgba(200,150,255,0.9)';
      ctx.beginPath(); ctx.arc(13 + Math.cos(a) * 9, -1 + Math.sin(a) * 3, 1.4, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    // cultista
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath(); ctx.roundRect(-5, -9, 10, 13, 3); ctx.fill();
    ctx.fillStyle = '#3a2a5a';
    ctx.beginPath(); ctx.arc(0, -12, 5.2, 0, 6.28); ctx.fill();
    // capucha
    ctx.fillStyle = '#1a102a';
    ctx.beginPath(); ctx.arc(0, -12, 4.6, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#b08aff';
    ctx.beginPath(); ctx.arc(0, -12.6, 2.6, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#4a2a7a';
    ctx.beginPath(); ctx.arc(0, -12.6, 1.2, 0, 6.28); ctx.fill();
    // báculo
    ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-10, -8); ctx.stroke();
    ctx.fillStyle = '#9a5aff';
    ctx.beginPath(); ctx.arc(-10, -9, 2.4 + Math.sin(game.time * 6) * 0.6, 0, 6.28); ctx.fill();
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(176,138,255,' + (this.flash * 3) + ')';
      ctx.beginPath(); ctx.arc(0, -11, 8, 0, 6.28); ctx.fill();
    }
  }
}

class Projectile {
  constructor(x, y, target, opt) {
    this.x = x;
    this.y = y;
    this.target = target || null;
    this.speed = opt.speed;
    this.damage = opt.damage;
    this.element = opt.element;
    this.tower = opt.tower;
    this.projColor = opt.projColor;
    this.visual = opt.visual || 'arrow';
    this.opts = opt.opts || {};
    this.pierce = this.opts.pierce || 0;
    this.purge = this.opts.purge || 0;
    this.dead = false;
    this.angle = 0;
    this.hitEnemy = null;
    if (opt.tx !== undefined) { this.tx = opt.tx; this.ty = opt.ty; }
    else if (this.target) { this.tx = this.target.x; this.ty = this.target.y; }
    else { this.tx = x; this.ty = y; }
  }

  update(dt, game) {
    var tx, ty;
    if (this.target && this.target.alive) { tx = this.target.x; ty = this.target.y; }
    else { tx = this.tx; ty = this.ty; }
    var dx = tx - this.x, dy = ty - this.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var step = this.speed * dt;
    if (d <= step + 2) {
      if (this.opts.aoe && this.target && this.target.alive) { this.x = tx; this.y = ty; }
      this.hit(game);
      return;
    }
    this.angle = Math.atan2(dy, dx);
    this.x += dx / d * step;
    this.y += dy / d * step;
    if (this.visual === 'fireball' && Math.random() < 0.8) {
      game.particles.push({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, color: '#ff9a4a', size: 3, grav: 0 });
    } else if (this.visual === 'frost' && Math.random() < 0.6) {
      game.particles.push({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.2, max: 0.2, color: '#bfe8ff', size: 2, grav: 0 });
    } else if (this.visual === 'bomb' && Math.random() < 0.4) {
      game.particles.push({ x: this.x, y: this.y - 3, vx: 0, vy: -14, life: 0.4, max: 0.4, color: '#888', size: 2.5, grav: 0 });
    }
  }

  hit(game) {
    var opts = this.opts;
    if (opts.aoe) {
      var cx = this.x, cy = this.y;
      var list = game.enemies;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive) continue;
        if (opts.needGround && e.flying) continue;
        var dx = e.x - cx, dy = e.y - cy;
        if (dx * dx + dy * dy <= opts.aoe * opts.aoe) {
          e.takeDamage(this.damage * game.weatherMult(this.element), this.element, this.tower, this.opts.ignoreArmor);
          if (e.alive) {
            if (opts.burn) e.burn = { dps: this.damage * 0.22 * game.weatherMult(this.element), t: 3, src: this.tower };
            if (opts.poison) e.poison = { dps: opts.poison.dps, t: opts.poison.t, src: this.tower };
            if (opts.hex) e.hex = { mult: opts.hex.mult, t: opts.hex.t };
            if (opts.slow) e.slow = { mult: opts.slow, t: opts.slowDur || 2 };
            if (opts.kb) e.pathPos = Math.max(0, e.pathPos - opts.kb);
          }
        }
      }
      game.explosion(cx, cy, opts.aoe, this.projColor);
      sfx('projectile_explosion', 0.35);
      this.dead = true;
      return;
    }
    if (this.target && this.target.alive) {
      var mult = this.target.corrupted ? 2 : 1;
      this.target.takeDamage(this.damage * mult * game.weatherMult(this.element), this.element, this.tower, this.opts.ignoreArmor);
      if (this.target.alive) {
        if (opts.slow) this.target.slow = { mult: opts.slow, t: opts.slowDur || 2 };
        if (opts.burn) this.target.burn = { dps: this.damage * 0.22 * game.weatherMult(this.element), t: 3 };
        if (opts.poison) this.target.poison = { dps: opts.poison.dps, t: opts.poison.t };
        if (opts.hex) this.target.hex = { mult: opts.hex.mult, t: opts.hex.t };
        if (this.pierce > 0) {
          var next = game.findNextEnemy(this.x, this.y, this.target, 80, this.tower.canHitFlying);
          if (next) { this.target = next; this.tx = next.x; this.ty = next.y; this.pierce--; return; }
        }
      }
    }
    if (this.purge > 0 && game.purify && game.purifyRadius) game.purifyRadius(this.x, this.y, 60, this.purge);
    game.hitSpark(this.x, this.y, this.projColor);
    sfx('projectile_hit', 0.3);
    this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    var glowR = { fireball: 10, frost: 8, venom: 8, hex: 9, holy: 11, arc: 9, snipe: 7 }[this.visual] || 0;
    if (glowR > 0) {
      var gg = ctx.createRadialGradient(0, 0, 1, 0, 0, glowR);
      gg.addColorStop(0, this.projColor);
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(0, 0, glowR, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.rotate(this.angle);
    switch (this.visual) {
      case 'arrow':
        ctx.strokeStyle = this.projColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = this.projColor;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-12, 0); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill();
        break;
      case 'fireball':
        var grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
        grad.addColorStop(0, '#fff6c8');
        grad.addColorStop(0.4, this.projColor);
        grad.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.28); ctx.fill();
        break;
      case 'frost':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(191,232,255,0.7)';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.28); ctx.stroke();
        break;
      case 'bomb':
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(2, -8); ctx.stroke();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(2, -9, 1.2, 0, 6.28); ctx.fill();
        break;
      case 'bolt':
        ctx.strokeStyle = this.projColor; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
        break;
      case 'venom':
        ctx.fillStyle = '#3a8a4a';
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 0); ctx.lineTo(-4, 4); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7ad47f';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#e8ffe8';
        ctx.beginPath(); ctx.arc(-1, -1, 1.4, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(122,212,127,0.7)';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.28); ctx.stroke();
        break;
      case 'snipe':
        ctx.strokeStyle = this.projColor; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(14, 0); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(7, -3); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(232,232,240,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.stroke();
        break;
      case 'hex':
        var hx = this.projColor;
        ctx.fillStyle = hx;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.28); ctx.stroke();
        ctx.fillStyle = '#e8d4ff';
        ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(200,150,255,0.7)';
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.28); ctx.stroke();
        break;
      case 'arc':
        ctx.strokeStyle = this.projColor; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = this.projColor;
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 6.28); ctx.fill();
        break;
      case 'holy':
        var hg = ctx.createRadialGradient(0, 0, 1, 0, 0, 9);
        hg.addColorStop(0, '#ffffff');
        hg.addColorStop(0.5, '#fff6c8');
        hg.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.stroke();
        break;
    }
    ctx.restore();
  }
}
