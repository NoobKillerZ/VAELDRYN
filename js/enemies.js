'use strict';

function hash2(x, y) {
  var n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

class Enemy {
  constructor(type, game, hpMul) {
    var def = ENEMIES[type];
    this.type = type;
    this.game = game;
    this.name = def.name;
    this.desc = def.desc;
    this.hpMax = def.hp * game.hpScale * (hpMul || 1);
    this.hp = this.hpMax;
    this.speed = def.speed;
    this.reward = def.reward;
    this.r = def.r;
    this.color = def.color;
    this.armor = def.armor || 0;
    this.flying = !!def.flying;
    this.boss = !!def.boss;
    this.enrage = !!def.enrage;
    this.revive = def.revive || 0;
    this.revived = false;
    this.regen = def.regen || 0;
    this.buff = !!def.buff;
    this.necro = !!def.necro;
    this.resist = Object.assign({}, def.resist);
    this.weak = Object.assign({}, def.weak);
    this.pathPos = 0;
    this.alive = true;
    this.leaked = false;
    this.burn = null;
    this.slow = null;
    this.freeze = null;
    this.buffed = 1;
    this.anim = Math.random() * 6.28;
    this.walkPhase = Math.random() * 6.28;
    this.spawnT = 0;
    this._stepCycle = -1;
    this.fxSeed = Math.random() * 1000;
    this.wobbleS = 0;
    this.flash = 0;
    this.face = 1;
    this.deathHandled = false;
    this.deadT = 0;
    this.deadTMax = 0.8;
    this.deathFrozen = false;
    this.enraged = false;
    this.summonCd = def.summonCd || 6;
    this.summonType = def.summonType || 'goblin';
    this.flyPhase = def.flyPhase || 1;
    this.ragePhase = def.ragePhase || 0;
    this.fireStun = def.fireStun || 0;
    this.fireCd = 6 + Math.random() * 3;
    this.announced = false;
    this.x = game.pathPoint(0).x;
    this.y = game.pathPoint(0).y;
    this.angle = 0;
    this.dist = 0;
    this.targetsTowers = !!def.targetsTowers;
    this.towerDmg = def.towerDmg || 0;
    this.steal = !!def.steal;
    this.corruption = def.corruption || 0;
    this.corrupted = false;
    this.poison = null;
    this.hex = null;
    this.explode = def.explode || null;
    this.buffShaman = !!def.buffShaman;
    this.frostStun = def.frostStun || 0;
    this.mutation = null;
    this.towerTarget = null;
    this.towerAtkCd = 0;
    this.towerLeash = false;
    this.split = def.split || null;
    this.blockedBy = null;
    this.meleeCd = 0;
    this.meleeDmg = Math.max(5, Math.floor(def.hp * 0.08));
    this.shieldHits = def.shieldHits || 0;
    this.healAura = def.healAura || null;
    this.healCd = this.healAura ? 1 + Math.random() : 0;
    this.cloakDef = def.cloak || null;
    if (this.cloakDef) {
      this.cloakTimer = Math.random() * this.cloakDef.visible;
      this.hidden = true; // entra en fase espectral
    } else this.hidden = false;
    if (def.boss) this.corruption = Math.max(this.corruption, 15);
  }

  mutate() {
    var traits = [
      { id: 'armored', name: 'Blindado', icon: '🛡️', desc: '+50% vida y +4 armadura', hp: 1.5, armor: 4, color: '#9a9a9a' },
      { id: 'swift', name: 'Veloz', icon: '💨', desc: '+50% velocidad', speed: 1.5, color: '#8ad4ff' },
      { id: 'regen', name: 'Regenerador', icon: '💚', desc: 'Regenera 5/s', regen: 5, color: '#7ad47f' },
      { id: 'frenzy', name: 'Frenético', icon: '😡', desc: '+70% daño, -20% vida', damage: 1.7, hp: 0.8, color: '#ff5a3a' },
      { id: 'void', name: 'Del Vacío', icon: '🌌', desc: 'Resiste toda la magia 40%', resAll: 0.6, color: '#b08aff' },
      { id: 'giant', name: 'Gigante', icon: '🐘', desc: '+80% vida, +20% tamaño', hp: 1.8, rMult: 1.25, color: '#e0b05a' }
    ];
    var t = traits[Math.floor(Math.random() * traits.length)];
    this.mutation = t;
    if (t.hp) { this.hpMax *= t.hp; this.hp = this.hpMax; }
    if (t.armor) this.armor += t.armor;
    if (t.speed) this.speed *= t.speed;
    if (t.regen) this.regen = (this.regen || 0) + t.regen;
    if (t.damage) this.attackMult = t.damage;
    if (t.rMult) this.r *= t.rMult;
    if (t.resAll) {
      var els = ['fire', 'ice', 'earth', 'nature'];
      for (var i = 0; i < els.length; i++) this.resist[els[i]] = Math.min(this.resist[els[i]] || 1, t.resAll);
    }
    return t;
  }

  get effectiveName() {
    return this.mutation ? '⭐ ' + this.mutation.name + ' ' + this.name : this.name;
  }

  takeDamage(dmg, element, tower, ignoreArmor) {
    if (!this.alive) return;
    // Escudo: bloquea por completo los impactos directos (torres/soldados).
    // Los daños de área y venas/quemaduras (sin torre) lo rodean.
    if (this.shieldHits > 0 && tower) {
      this.shieldHits--;
      this.flash = 0.12;
      sfx('shield_block', 0.4);
      var g = this.game;
      g.burst(this.x + this.face * this.r * 0.7, this.y - this.r * 0.2, '#c9ccd6', 5);
      if (g.addShake) g.addShake(0.6);
      g.texts.push({ x: this.x, y: this.y - this.r - 10, txt: '🛡', life: 0.45, max: 0.45, color: '#c9ccd6', vy: -30, size: 13 });
      return;
    }
    var mult = 1;
    if (this.resist[element]) mult *= this.resist[element];
    if (this.weak[element]) mult *= this.weak[element];
    if (this.hex && this.hex.t > 0) mult *= this.hex.mult;
    var d = dmg * mult;
    if (element === 'physical' && !ignoreArmor) d -= this.armor;
    d = Math.max(1, d);
    // Crítico (reliquia Trébol de la Suerte): golpe x1.5 desde torres.
    var crit = false;
    if (tower && tower.game && tower.game.critChance > 0 && Math.random() < tower.game.critChance) { d *= 1.5; crit = true; }
    this.hp -= d;
    this.flash = 0.1;
    // crédito de baja: la última torre que golpeó se lleva el kill
    if (tower) this.lastHitBy = tower;
    // Número flotante de daño con anti-spam por enemigo
    if (tower && this.game.addDmgText && (!this.lastDmgShow || this.game.time - this.lastDmgShow > 0.09)) {
      this.lastDmgShow = this.game.time;
      this.game.addDmgText(this.x, this.y - this.r - 8, d, element, crit);
    }
    if (tower) tower.totalDamage += d;
    if (typeof DIRECTOR !== 'undefined' && DIRECTOR.recordDamage) DIRECTOR.recordDamage(element, d);
    sfx('enemy_hurt', 0.25);
    if (this.enrage && !this.enraged && this.hp <= this.hpMax * 0.5) {
      this.enraged = true;
      sfx('boss_enrage', 0.5);
    }
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      this.deathFrozen = !!this.freeze;
      this.deadTMax = this.deathFrozen ? 0.3 : 0.8;
      this.deadT = this.deadTMax;
    }
  }

  update(dt, game) {
    this.anim += dt * (this.flying ? 9 : 5);
    this.wobbleS = this.anim;
    this.spawnT += dt;
    if (!this.alive) { this.deadT -= dt; return; }
    if (this.flash > 0) this.flash -= dt;
    if (this.burn) {
      this.burn.t -= dt;
      if (this.burn.src) this.lastHitBy = this.burn.src;
      this.takeDamage(this.burn.dps * dt, 'fire');
      if (this.burn.t <= 0) this.burn = null;
    }
    if (this.poison) {
      this.poison.t -= dt;
      if (this.poison.src) this.lastHitBy = this.poison.src;
      this.takeDamage(this.poison.dps * dt, 'nature');
      if (this.poison.t <= 0) this.poison = null;
    }
    if (this.hex) {
      this.hex.t -= dt;
      if (this.hex.t <= 0) this.hex = null;
    }
    // Camuflaje fásico: alterna visible/invisible; las torres no apuntan a ocultos
    if (this.cloakDef) {
      this.cloakTimer -= dt;
      if (this.cloakTimer <= 0) {
        this.hidden = !this.hidden;
        this.cloakTimer = this.hidden ? this.cloakDef.hidden : this.cloakDef.visible;
        if (!this.hidden) {
          game.burst(this.x, this.y, '#9fb4e8', 6);
          sfx('cloak_on', 0.35);
        }
      }
      // congelar al espectro lo revela mientras se recompone
      if (this.freeze && this.hidden) {
        this.hidden = false;
        this.cloakTimer = this.cloakDef.visible;
        game.texts.push({ x: this.x, y: this.y - this.r - 12, txt: '👁 ¡Revelado!', life: 0.8, max: 0.8, color: '#bfe8ff', vy: -24, size: 10 });
      }
    }
    // Aura sanadora: pulso que cura aliados cercanos
    if (this.healAura) {
      this.healCd -= dt;
      if (this.healCd <= 0) {
        this.healCd = this.healAura.cd;
        var healed = false;
        for (var hi = 0; hi < game.enemies.length; hi++) {
          var ally = game.enemies[hi];
          if (!ally.alive || ally === this) continue;
          var hdx = ally.x - this.x, hdy = ally.y - this.y;
          if (hdx * hdx + hdy * hdy <= this.healAura.radius * this.healAura.radius && ally.hp < ally.hpMax) {
            ally.hp = Math.min(ally.hpMax, ally.hp + this.healAura.amount);
            healed = true;
            game.particles.push({ x: ally.x, y: ally.y - ally.r, vx: 0, vy: -26, life: 0.5, max: 0.5, color: '#7aff9a', size: 2.2, grav: 0 });
          }
        }
        if (healed) {
          sfx('heal_pulse', 0.3);
          game.shockRing(this.x, this.y, this.healAura.radius * 0.55, 'rgba(122,255,154,0.8)', 0.5);
        }
      }
    }
    var slowMult = 1;
    if (this.slow) {
      this.slow.t -= dt;
      if (this.slow.t > 0) slowMult = this.slow.mult; else this.slow = null;
    }
    if (this.freeze) {
      this.freeze.t -= dt;
      if (this.freeze.t <= 0) this.freeze = null;
    }
    var weatherSpeed = 1;
    if (typeof WEATHER !== 'undefined' && WEATHER.fx && WEATHER.fx.enemySpeed) weatherSpeed = WEATHER.fx.enemySpeed;
    var spd = this.speed * (this.freeze ? 0.1 : 1) * slowMult * this.buffed * (this.enraged ? 1.6 : 1) * weatherSpeed;
    this.walkPhase += dt * spd * 0.085;
    // polvo de pisadas al caminar (más denso en brutes y jefes)
    if (!this.flying) {
      var step = Math.floor(this.walkPhase * 2);
      if (step !== this._step) {
        this._step = step;
        var heavy = this.boss || this.r >= 14;
        game.particles.push({
          x: this.x - this.face * 2, y: this.y + this.r * 0.85,
          vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 8,
          life: 0.32, max: 0.32, color: 'rgba(150,130,100,0.45)', size: 1.8, grav: -4
        });
        if (heavy) {
          game.particles.push({
            x: this.x - this.face * this.r * 0.5, y: this.y + this.r * 0.9,
            vx: (Math.random() - 0.5) * 26, vy: -10 - Math.random() * 12,
            life: 0.42, max: 0.42, color: 'rgba(160,140,105,0.5)', size: 2.6, grav: -6
          });
        }
      }
    }
    if (this.regen > 0 && !this.freeze && !this.burn) {
      this.hp = Math.min(this.hpMax, this.hp + this.regen * dt);
    }
    if (this.targetsTowers) {
      this.updateTowerAttack(dt, game);
      return;
    }
    if (!this.flying && !this.steal) {
      var blocker = null;
      if (this.blockedBy && this.blockedBy.alive) {
        var bdx = this.blockedBy.x - this.x;
        var bdy = this.blockedBy.y - this.y;
        if (bdx * bdx + bdy * bdy < Math.pow(CONFIG.CELL * 3, 2)) {
          blocker = this.blockedBy;
        } else {
          this.blockedBy = null;
        }
      }
      if (!blocker) {
        for (var bs = 0; bs < game.soldiers.length; bs++) {
          var s = game.soldiers[bs];
          if (!s.alive) continue;
          var sdx = s.x - this.x, sdy = s.y - this.y;
          if (sdx * sdx + sdy * sdy < Math.pow(CONFIG.CELL * 2.5, 2)) {
            if (s.engaged && s.engaged !== this) continue;
            blocker = s;
            this.blockedBy = s;
            s.engaged = this;
            break;
          }
        }
      }
      if (blocker) {
        this.meleeCd -= dt;
        this.angle = Math.atan2(blocker.y - this.y, blocker.x - this.x);
        if (this.meleeCd <= 0) {
          this.meleeCd = 1.0;
          blocker.takeDamage(this.meleeDmg, 'physical');
          this.flash = 0.1;
          sfx('enemy_attack_tower', 0.3);
          // chispas de impacto sincronizadas con el golpe
          for (var mk = 0; mk < 3; mk++) {
            game.particles.push({
              x: blocker.x + (Math.random() - 0.5) * 8, y: blocker.y - 4 + (Math.random() - 0.5) * 8,
              vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40,
              life: 0.22, max: 0.22, color: mk === 0 ? '#fff4d0' : '#ffca6a', size: 1.6, grav: 40
            });
          }
        }
        var bp = game.pathPoint(this.pathPos);
        this.x = bp.x;
        this.y = bp.y;
        return;
      }
    }
    if (this.steal) {
      this.pathPos += spd * dt;
      var p = game.pathPoint(this.pathPos);
      this.x = p.x; this.y = p.y; this.angle = p.angle;
      if (this.pathPos >= game.pathLength) game.enemyLeaks(this);
      return;
    }
    this.pathPos += spd * dt;
    if (this.boss) this.bossUpdate(dt, game);
    var p2 = game.pathPoint(this.pathPos);
    this.x = p2.x; this.y = p2.y; this.angle = p2.angle;
    if (this.pathPos >= game.pathLength) game.enemyLeaks(this);
  }

  updateTowerAttack(dt, game) {
    if (!this.towerTarget || !this.towerTarget.game || this.towerTarget.hp <= 0) {
      this.towerTarget = this.findTowerTarget(game);
      if (!this.towerTarget) { this.towerTarget = null; return; }
    }
    var dx = this.towerTarget.x - this.x, dy = this.towerTarget.y - this.y;
    var d = Math.hypot(dx, dy);
    var spd = this.speed * (this.freeze ? 0.1 : 1) * (this.enraged ? 1.6 : 1);
    if (d > this.r + 14) {
      this.x += dx / d * spd * dt;
      this.y += dy / d * spd * dt;
      this.angle = Math.atan2(dy, dx);
    } else {
      this.towerAtkCd -= dt;
      var atk = this._atk();
      if (this.towerAtkCd <= 0) {
        this.towerAtkCd = 1.1;
        this.towerTarget.takeDamage(this.towerDmg, this);
        game.burst(this.towerTarget.x, this.towerTarget.y, '#ff8a3a', 6);
        game.burst(this.towerTarget.x, this.towerTarget.y, '#ffe08a', 4);
        game.hitSpark(this.towerTarget.x, this.towerTarget.y, '#ff6a2a');
        game.shockRing(this.towerTarget.x, this.towerTarget.y, 30, '#ff8a3a', 0.3);
        game.texts.push({ x: this.towerTarget.x, y: this.towerTarget.y - 22, txt: '💥', life: 0.5, max: 0.5, color: '#ff8a3a', vy: -14, size: 11 });
        sfx('enemy_attack_tower', 0.3);
      } else if (atk > 0.35 && atk < 0.65) {
        // embestida al golpear
        var lunge = Math.sin((atk - 0.35) / 0.3 * Math.PI) * 9 * dt;
        this.x += dx / d * lunge;
        this.y += dy / d * lunge;
      }
    }
    if (game.towers.length === 0) this.towerTarget = null;
  }

  findTowerTarget(game) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < game.towers.length; i++) {
      var t = game.towers[i];
      if (t.hp <= 0) continue;
      var dx = t.x - this.x, dy = t.y - this.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  bossUpdate(dt, game) {
    if (this.type === 'dragon' || this.type === 'iceDragon') {
      if (this.hp < this.hpMax * this.flyPhase && !this.flying) {
        this.flying = true;
        game.texts.push({ x: this.x, y: this.y - 50, txt: this.type === 'dragon' ? '🐉 ¡El dragón alza el vuelo!' : '🐉 ¡El dragón de hielo alza el vuelo!', life: 2, max: 2, color: this.type === 'dragon' ? '#ff8a6a' : '#9fd4ff', vy: -20, size: 16 });
      }
      if (this.hp < this.hpMax * this.ragePhase && !this.enraged) {
        this.enraged = true;
        this.speed *= 1.7;
        game.texts.push({ x: this.x, y: this.y - 50, txt: '😡 ¡FURIA!', life: 2, max: 2, color: '#ff5a3a', vy: -20, size: 16 });
        sfx('boss_enrage', 0.5);
      }
      if (this.flying) {
        this.fireCd -= dt;
        if (this.fireCd <= 0) {
          this.fireCd = this.fireStun || this.frostStun;
          var ts = game.towers;
          if (ts.length) {
            var t = ts[Math.floor(Math.random() * ts.length)];
            t.stun = 3.5;
            var breathCol = this.type === 'dragon' ? '#ff9a3a' : '#bfe8ff';
            var ang = Math.atan2(t.y - this.y, t.x - this.x);
            for (var fl = 0; fl < 12; fl++) {
              var fa = ang + (Math.random() - 0.5) * 0.35;
              var fsp = 130 + Math.random() * 90;
              game.particles.push({
                x: this.x + Math.cos(ang) * this.r * 0.7, y: this.y - this.r * 0.4 + Math.sin(ang) * this.r * 0.7,
                vx: Math.cos(fa) * fsp, vy: Math.sin(fa) * fsp,
                life: 0.35 + Math.random() * 0.2, max: 0.5, color: breathCol,
                size: 3 + Math.random() * 3, grav: 0
              });
            }
            game.burst(t.x, t.y, this.type === 'dragon' ? '#ff7a30' : '#9fd4ff', 16);
            game.shockRing(t.x, t.y, 60, breathCol, 0.35);
            game.texts.push({ x: t.x, y: t.y - 24, txt: this.type === 'dragon' ? '🔥 ¡Torre en llamas!' : '❄️ ¡Torre congelada!', life: 1.5, max: 1.5, color: this.type === 'dragon' ? '#ff6a3a' : '#bfe8ff', vy: -16, size: 12 });
            sfx('boss_attack_dragon_breath', 0.4);
            if (this.type === 'iceDragon') game.frostNova(t.x, t.y, 90, 0.55, 2.5);
          }
        }
      }
    } else if (this.necro || this.type === 'orcKing' || this.type === 'voidLord') {
      this.summonCd -= dt;
      if (this.summonCd <= 0) {
        this.summonCd = this.type === 'lord' ? 5 : (this.type === 'voidLord' ? 7 : 6);
        var n = this.type === 'lord' || this.type === 'voidLord' ? 2 : 1;
        var portalCol = this.type === 'voidLord' ? '#b08aff' : (this.type === 'lord' ? '#8aff9a' : '#ffb03a');
        game.shockRing(this.x, this.y, this.r * 2.6, portalCol, 0.45);
        for (var i = 0; i < n; i++) {
          if (game.enemies.length > 70) break;
          var sk = new Enemy(this.summonType, game);
          sk.pathPos = Math.max(0, this.pathPos - 20 - i * 30);
          sk.hpMax *= 0.9; sk.hp = sk.hpMax;
          game.enemies.push(sk);
          game.burst(sk.x, sk.y, portalCol, 8);
        }
        sfx('boss_summon', 0.4);
      }
    }
  }

  draw(ctx, game) {
    var dying = !this.alive;
    var bob = dying ? 0 : (this.freeze ? Math.sin(this.anim) * 0.4 : (this.flying ? Math.sin(this.anim) * 4 : Math.sin(this.walkPhase * 2) * this.r * 0.07));
    var y = this.y + bob;
    // soft contact shadow (shrinks as flying enemies rise)
    ctx.save();
    ctx.globalAlpha = dying ? 0.06 : (this.flying ? 0.16 : 0.26);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.8, this.r * (this.flying ? 0.75 : 1.1), this.r * 0.3, 0, 0, 6.28);
    ctx.fill();
    ctx.restore();
    // ---- capa de suelo: efectos que nacen del terreno (detrás del cuerpo) ----
    if (!dying) this.drawGroundFx(ctx, y);
    var c = this.flash > 0 ? '#ffffff' : this.color;
    this.face = Math.cos(this.angle) >= 0 ? 1 : -1;
    var hitKick = this.flash > 0 ? (this.flash / 0.1) * 0.045 * this.face : 0;
    ctx.save();
    if (dying) {
      var fall = Math.max(0, Math.min(1, this.deadT / this.deadTMax));
      var spec0 = this._spec();
      // los arquetipos con muerte propia (desplome/disolución/pop) se
      // gestionan dentro de ART.figure; fuera solo se traslada
      var figDeath = !this.deathFrozen && typeof spec0 === 'object' &&
        (spec0.deathStyle || (spec0.build && spec0.build !== 'warrior'));
      ctx.translate(this.x, this.y);
      if (figDeath) {
        ctx.globalAlpha = 1; // el desvanecimiento lo aplica figure()
      } else if (this.deathFrozen) {
        ctx.globalAlpha = fall * fall;
        ctx.translate(0, (1 - fall) * 8);
        ctx.rotate((1 - fall) * 0.5);
      } else {
        ctx.globalAlpha = fall;
        ctx.rotate(0.08 - this.face * (1 - fall) * 1.15);
        ctx.translate(0, (1 - fall) * 4);
      }
    } else {
      // balanceo de caminata con zancada más marcada
      ctx.translate(this.x, y);
      var stride = Math.sin(this.walkPhase * 2);
      ctx.rotate(stride * 0.07 * (this.freeze ? 0.3 : 1) + hitKick + (this.enraged ? Math.sin(this.anim * 3) * 0.02 : 0));
    }
    if (!dying && this.hidden) ctx.globalAlpha = 0.16;
    this.drawBody(ctx, y, c);
    ctx.restore();
    if (dying) return;
    if (this.enraged) {
      var pulse = 0.22 + 0.14 * Math.sin(this.anim * 6);
      ctx.globalAlpha = pulse * 0.7;
      ctx.fillStyle = '#ff3a2a';
      ctx.beginPath(); ctx.arc(this.x, y, this.r + 8, 0, 6.28); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(this.x, y, this.r + 4, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.corrupted) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#8a2a8a';
      ctx.beginPath(); ctx.arc(this.x, y, this.r + 6 + Math.sin(this.anim * 3) * 2, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#a040a0';
      for (var ci = 0; ci < 3; ci++) {
        var ca = this.anim * 1.5 + ci * 2.09;
        var cr = this.r + 3 + Math.sin(this.anim * 2 + ci) * 2;
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(ca) * cr * 0.3, y + Math.sin(ca) * cr * 0.3, 2, 0, 6.28);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.shieldHits > 0) {
      // torre de escudos al frente; el broque muestra las cargas restantes
      var shx = this.x + this.face * this.r * 0.8;
      var shp = 1 + Math.sin(this.anim * 4) * 0.05;
      ctx.save();
      ctx.translate(shx, y);
      ctx.scale(this.face * shp, shp);
      ctx.fillStyle = '#8a8f9c';
      ctx.beginPath();
      ctx.moveTo(-6, -13); ctx.lineTo(7, -9); ctx.lineTo(7, 4);
      ctx.quadraticCurveTo(7, 12, 0, 15);
      ctx.quadraticCurveTo(-7, 12, -6, 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d8dce4'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = this.shieldHits >= 3 ? '#c9a84c' : '#a03428';
      ctx.beginPath(); ctx.arc(0.5, -2, 2.6, 0, 6.28); ctx.fill();
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 6;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 17, -0.9, 0.9); ctx.stroke();
      }
      ctx.restore();
    }
    if (this.healAura) {
      var hp2 = 0.5 + 0.5 * Math.sin(this.anim * 3);
      ctx.globalAlpha = 0.55 + 0.35 * hp2;
      ctx.fillStyle = '#7aff9a';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('✚', this.x, y - this.r - 8);
      ctx.globalAlpha = 1;
    }
    if (this.mutation) {
      ctx.fillStyle = this.mutation.color;
      ctx.beginPath(); ctx.arc(this.x, y - this.r - 14, 7, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(this.x, y - this.r - 14, 7, 0, 6.28); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.mutation.icon, this.x, y - this.r - 11);
    }
    if (this.freeze) {
      var fSrc = this.freeze.src || 'ice';
      var fDur = this.freeze.dur || 2;
      var fP = Math.max(0, Math.min(1, 1 - this.freeze.t / fDur)); // 0 recién aplicado → 1 acabando
      if (fSrc === 'root') {
        // ---- ENREDADERAS DEL DRUIDA ----
        // crecimiento → sujeción con vaivén → liberación
        var grow = Math.min(1, fP / 0.22);
        var release = fP > 0.82 ? (fP - 0.82) / 0.18 : 0;
        var sway = Math.sin(this.anim * 2.1 + this.fxSeed) * 0.35 * (1 - release);
        var vCol = '#3f7a34', vDark = '#245020';
        // enredaderas envolventes: suben por el cuerpo rodeándolo
        for (var vv = 0; vv < 3; vv++) {
          var vSeed = this.fxSeed + vv * 37.7;
          var side = vv % 2 ? 1 : -1;
          var baseX = this.x + side * this.r * 0.55;
          var topY = y - this.r * (1.15 + (vv % 2) * 0.5);
          var wrapX = this.x - side * this.r * (0.35 + (vv % 2) * 0.25);
          ctx.globalAlpha = 1 - release * 0.9;
          ART.vine(ctx, baseX, this.y + this.r * 0.85, wrapX + side * this.r * 0.15, topY,
            Math.max(0.04, grow * (1 - release)), vSeed, sway, vCol, vDark, 2.1 - vv * 0.35);
          // zarcillo que se enrolla sobre el hombro
          if (grow > 0.75 && vv === 1) {
            ART.vine(ctx, wrapX, topY, wrapX - side * this.r * 0.7, topY + this.r * 0.25,
              (grow - 0.75) / 0.25 * (1 - release), vSeed + 5, sway, vCol, vDark, 1.4);
          }
        }
        ctx.globalAlpha = 1;
        if (release > 0) {
          // hojas sueltas que caen al liberarse
          for (var fl2 = 0; fl2 < 3; fl2++) {
            var flp = (release * 1.4 + fl2 * 0.3) % 1;
            ART.leaf(ctx, this.x + Math.sin(this.fxSeed + fl2 * 2) * this.r,
              y - this.r + flp * this.r * 2.2, flp * 3 + fl2, 3.2 * (1 - flp * 0.5), vCol, vDark);
          }
        }
      } else {
        // ---- CONGELACIÓN POR HIELO ----
        // escarcha + cristales que crecen sobre el cuerpo
        var iceGrow = Math.min(1, fP / 0.18);
        // vaho gélido a los pies
        ctx.globalAlpha = 0.25 + 0.12 * Math.sin(this.anim * 3);
        ctx.fillStyle = '#cfe8ff';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.75, this.r * 1.15, this.r * 0.32, 0, 0, 6.28); ctx.fill();
        // cristales sobre el cuerpo (posiciones deterministas)
        for (var ic = 0; ic < 4; ic++) {
          var ia = this.fxSeed * 1.7 + ic * 2.3;
          var ix = this.x + Math.cos(ia) * this.r * 0.62;
          var iy = y + Math.sin(ia) * this.r * 0.72 - this.r * 0.15;
          ART.iceShard(ctx, ix, iy, this.r * (0.5 + (ic % 2) * 0.28), iceGrow * (0.7 + 0.3 * Math.sin(ic * 1.9 + this.anim * 0.7)), this.fxSeed + ic * 11);
        }
        // destello frío ocasional
        var tw = Math.sin(this.anim * 2.4 + this.fxSeed);
        if (tw > 0.86) ART.star4(ctx, this.x + Math.cos(this.fxSeed) * this.r * 0.7, y - this.r * 0.5, (tw - 0.86) * 26, 'rgba(235,250,255,0.95)');
        ctx.globalAlpha = 1;
      }
    }
    if (this.hex && this.hex.t > 0) {
      // ---- MALEDICCIÓN DEL BRUJO ----
      // hilillos violeta orbitando el cuerpo + runa sobre la cabeza
      var hxP = this.anim * 1.6 + this.fxSeed;
      for (var hw = 0; hw < 3; hw++) {
        var ha = hxP + hw * 2.09;
        var hwr = this.r + 5 + Math.sin(ha * 1.7) * 2.5;
        var hwx = this.x + Math.cos(ha) * hwr;
        var hwy = y + Math.sin(ha * 1.3) * this.r * 0.55 - this.r * 0.1;
        var hTail = (ha + 0.9) % 6.28;
        ctx.strokeStyle = 'rgba(176,138,255,' + (0.55 - hw * 0.12).toFixed(2) + ')';
        ctx.lineWidth = 1.6 - hw * 0.3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(hTail) * hwr, y + Math.sin(hTail * 1.3) * this.r * 0.55 - this.r * 0.1);
        ctx.quadraticCurveTo(
          this.x + Math.cos((ha + hTail) / 2) * (hwr + 4), y - this.r * 0.4,
          hwx, hwy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(210,170,255,0.9)';
        ctx.beginPath(); ctx.arc(hwx, hwy, 1.5, 0, 6.28); ctx.fill();
      }
      // runa parpadeante
      var runeA = 0.45 + 0.4 * Math.sin(this.anim * 4 + this.fxSeed);
      ctx.save();
      ART.rune(ctx, this.x, y - this.r - 12, 5.5, this.fxSeed, '#c8a0ff', Math.max(0.15, runeA));
      ctx.restore();
      // volutas oscuras en los pies
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.anim * 3);
      ctx.fillStyle = '#3a2a6a';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.8, this.r * 0.95, this.r * 0.26, 0, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.burn) {
      // ---- INCENDIO ----
      // llamas en capas ancladas al cuerpo + chispas + humo
      var bFl = 0.75 + 0.25 * Math.sin(this.anim * 2.3 + this.fxSeed);
      // resplandor en el suelo
      ctx.globalAlpha = 0.16 * bFl;
      ctx.fillStyle = '#ff7a30';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.85, this.r * 1.25, this.r * 0.34, 0, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      // llamas ancladas: flanco, cabeza y flanco opuesto
      ART.flame(ctx, this.x - this.r * 0.55, y - this.r * 0.15, this.r * 0.75, this.r * 1.15 * bFl, this.anim, this.fxSeed);
      ART.flame(ctx, this.x + this.r * 0.5, y - this.r * 0.3, this.r * 0.7, this.r * 1.0 * bFl, this.anim + 1.7, this.fxSeed + 3);
      ART.flame(ctx, this.x + Math.sin(this.fxSeed) * this.r * 0.2, y - this.r * 1.15, this.r * 0.85, this.r * 1.3 * bFl, this.anim + 3.1, this.fxSeed + 7);
      // chispas ascendentes (2 deterministas)
      for (var bk = 0; bk < 2; bk++) {
        var bp3 = ((this.anim * 0.9 + this.fxSeed * 0.13 + bk * 0.5) % 1);
        ctx.globalAlpha = (1 - bp3) * 0.85;
        ctx.fillStyle = bk % 2 ? '#ffca6a' : '#ff8a3a';
        ctx.beginPath();
        ctx.arc(this.x + Math.sin(this.fxSeed + bk * 4 + this.anim) * this.r * 0.5, y - this.r - bp3 * this.r * 1.8, 1.4 - bp3 * 0.7, 0, 6.28);
        ctx.fill();
      }
      // humillo
      ctx.globalAlpha = 0.14 * bFl;
      ctx.fillStyle = '#5a5048';
      ctx.beginPath();
      ctx.arc(this.x + Math.sin(this.anim * 1.4 + this.fxSeed) * this.r * 0.3, y - this.r * 2.1, this.r * 0.5, 0, 6.28);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.poison) {
      // ---- ENVENENAMIENTO ----
      // burbujas tóxicas que emanan del cuerpo + goteo + aura verdosa
      var pnP = this.poison.t % 1.4 / 1.4;
      // aura enfermiza sutil sobre el cuerpo
      ctx.globalAlpha = 0.1 + 0.06 * Math.sin(this.anim * 4 + this.fxSeed);
      ctx.fillStyle = '#7ac83a';
      ctx.beginPath(); ctx.arc(this.x, y - this.r * 0.2, this.r * 0.95, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      // tres burbujeras que suben por el contorno
      for (var tb = 0; tb < 3; tb++) {
        var tbP = ((pnP + tb * 0.33 + this.fxSeed * 0.017) % 1);
        var tbX = this.x + Math.sin(this.fxSeed + tb * 2.6) * this.r * 0.6;
        var tbY = y + this.r * 0.4 - tbP * this.r * 1.7;
        ART.toxinBubble(ctx, tbX, tbY, 2.4 + (tb % 2), tbP, null);
      }
      // gota que cae al suelo ocasionalmente
      var drip = (this.anim * 0.5 + this.fxSeed * 0.05) % 2;
      if (drip < 0.5) {
        ctx.globalAlpha = 0.8 - drip * 1.4;
        ctx.fillStyle = '#8adf4a';
        ctx.beginPath();
        ctx.arc(this.x + Math.sin(this.fxSeed * 2) * this.r * 0.5, y + this.r * 0.5 + drip * this.r * 1.2, 1.6, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (this.slow && this.slow.t > 0) {
      // ---- RALENTIZACIÓN ----
      // estela plateada de escarcha que queda atrás al avanzar
      for (var sl3 = 1; sl3 <= 3; sl3++) {
        var slA = (0.4 - sl3 * 0.11) * (this.slow.mult < 0.6 ? 1.3 : 1);
        if (slA <= 0) continue;
        ctx.globalAlpha = slA;
        ctx.fillStyle = '#bfe0f5';
        ctx.beginPath();
        ctx.arc(this.x - this.face * sl3 * this.r * 0.42, y + this.r * 0.55 - sl3 * 1.2, this.r * (0.3 - sl3 * 0.06), 0, 6.28);
        ctx.fill();
      }
      // brillo gélido intermitente en el cuerpo
      ctx.globalAlpha = 0.08 + 0.05 * Math.sin(this.anim * 5 + this.fxSeed);
      ctx.fillStyle = '#a8d4f0';
      ctx.beginPath(); ctx.arc(this.x, y - this.r * 0.2, this.r * 0.9, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.buffed > 1) {
      // ---- APRESURAMIENTO ----
      // ráfagas de viento a la espalda
      for (var wf = 0; wf < 2; wf++) {
        var wPh = ((this.anim * 1.8 + wf * 0.5) % 1);
        ctx.globalAlpha = (1 - wPh) * 0.5;
        ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x - this.face * (this.r * 0.8 + wPh * this.r * 1.4), y - this.r * 0.5 + wf * this.r * 0.7 - 2);
        ctx.quadraticCurveTo(
          this.x - this.face * (this.r * 1.3 + wPh * this.r * 1.4), y - this.r * 0.2 + wf * this.r * 0.7,
          this.x - this.face * (this.r * 1.8 + wPh * this.r * 1.4), y - this.r * 0.6 + wf * this.r * 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.enraged) {
      // ---- FURIA ----
      // vapor de los hombros + brasas, en lugar de aro rojo
      var enP = 0.5 + 0.5 * Math.sin(this.anim * 6);
      for (var es = 0; es < 2; es++) {
        var esX = this.x + (es ? 1 : -1) * this.r * 0.6;
        var esP = ((this.anim * 1.1 + es * 0.5) % 1);
        ctx.globalAlpha = (1 - esP) * 0.5;
        ctx.fillStyle = '#ff5a3a';
        ctx.beginPath(); ctx.arc(esX + Math.sin(esP * 5 + es) * 2, y - this.r * 0.9 - esP * this.r, 2.2 - esP, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 0.1 + enP * 0.08;
      ctx.fillStyle = '#ff3a2a';
      ctx.beginPath(); ctx.arc(this.x, y - this.r * 0.1, this.r * 1.05, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.healAura) {
      // ---- SANADOR ----
      // motos de energía verde ascendiendo en espiral suave
      for (var hm = 0; hm < 3; hm++) {
        var hmP = ((this.anim * 0.7 + hm * 0.33) % 1);
        var hmAng = hmP * 4.5 + hm * 2.09 + this.fxSeed;
        ctx.globalAlpha = (1 - hmP) * 0.85;
        ctx.fillStyle = '#7aff9a';
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(hmAng) * this.r * (0.9 - hmP * 0.5), y + this.r * 0.6 - hmP * this.r * 1.9, 1.7 - hmP, 0, 6.28);
        ctx.fill();
      }
      // cruz sanitaria discreta dibujada (no emoji)
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(this.anim * 3);
      ctx.strokeStyle = '#7aff9a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - 3.5, y - this.r - 10); ctx.lineTo(this.x + 3.5, y - this.r - 10);
      ctx.moveTo(this.x, y - this.r - 13.5); ctx.lineTo(this.x, y - this.r - 6.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.drawHpBar(ctx, y);
    this.drawResistBadges(ctx, y);
  }

  // Efectos de estado que nacen del terreno (se dibujan DETRÁS del cuerpo)
  drawGroundFx(ctx, y) {
    var gy = this.y + this.r * 0.85;
    // raíces del druida extendiéndose por el suelo
    if (this.freeze && this.freeze.src === 'root') {
      var fDur2 = this.freeze.dur || 2;
      var fP2 = Math.max(0, Math.min(1, 1 - this.freeze.t / fDur2));
      var grow2 = Math.min(1, fP2 / 0.22);
      var release2 = fP2 > 0.82 ? (fP2 - 0.82) / 0.18 : 0;
      for (var gr = 0; gr < 4; gr++) {
        var ga = (gr / 4) * 6.28 + this.fxSeed * 0.13 + Math.sin(this.anim * 1.5 + gr) * 0.06 * (1 - release2);
        ctx.globalAlpha = (1 - release2) * 0.9;
        ART.groundRoot(ctx, this.x, gy, ga, this.r * (1.5 + (gr % 2) * 0.8),
          Math.max(0.05, grow2), this.fxSeed + gr * 7, '#3f7a34', '#245020', 2.4 - gr * 0.25);
      }
      ctx.globalAlpha = 1;
      // brote central que empuja la tierra
      if (grow2 > 0.3 && release2 < 1) {
        ctx.globalAlpha = (1 - release2) * 0.8;
        ctx.fillStyle = '#4a8a3a';
        ctx.beginPath();
        ctx.ellipse(this.x, gy - grow2 * 2, 2.2, grow2 * 3.2, 0, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // charco tóxico bajo enemigos envenenados
    if (this.poison) {
      var puA = 0.16 + 0.05 * Math.sin(this.anim * 3 + this.fxSeed);
      ctx.globalAlpha = puA;
      ctx.fillStyle = '#5a9a2a';
      ctx.beginPath();
      ctx.ellipse(this.x, gy + 2, this.r * 1.15, this.r * 0.34, 0, 0, 6.28);
      ctx.fill();
      // ribete burbujeante
      ctx.globalAlpha = puA + 0.08;
      ctx.strokeStyle = '#8adf4a';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(this.x, gy + 2, this.r * 1.15, this.r * 0.34, 0, 0.3, 2.2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // resplandor de fuego ya está en el overlay (anclado al cuerpo)
  }

  drawBody(ctx, y, c) {
    var atk = this._atk();
    var st = {
      r: this.r,
      walk: this.walkPhase,
      atk: atk,
      anim: this.anim,
      freeze: !!this.freeze,
      flying: !!this.flying,
      enraged: !!this.enraged,
      ghost: null,
      flap: Math.sin(this.anim),
      blink: (this.anim % 8.5) > 8.18,
      face: this.face,
      // estados de animación por arquetipo
      hurt: this.flash > 0 ? Math.max(0, Math.min(1, this.flash / 0.12)) : 0,
      death: !this.alive && this.deadTMax > 0 ? Math.max(0, Math.min(1, 1 - this.deadT / this.deadTMax)) : -1,
      spawn: this.spawnT < 0.45 ? 1 - this.spawnT / 0.45 : 0
    };
    var spec = this._spec();
    if (typeof spec === 'string') {
      if (spec === 'art:fireGolem') { ART.fireGolem(ctx, this.r, st); return; }
      if (spec === 'art:stoneGolem') { ART.stoneGolem(ctx, this.r, st); return; }
      if (spec === 'art:bat') { ART.bat(ctx, this.r, st); return; }
      if (spec === 'art:wisp') { ART.wisp(ctx, this.r, st); return; }
      if (spec === 'art:crawler') { ART.spider(ctx, this.r, st); return; }
      if (spec === 'dragon') { this._drawDragon(ctx, st, false); return; }
      if (spec === 'iceDragon') { this._drawDragon(ctx, st, true); return; }
      if (spec === 'treant') { this._drawTreant(ctx, st); return; }
      if (spec === 'warMachine') { this._drawWarMachine(ctx, st); return; }
      if (spec === 'voidLord') { this._drawVoidLord(ctx, st); return; }
      if (spec === 'iceWraith') { this._drawIceWraith(ctx, st); return; }
      if (spec === 'stormSpirit') { this._drawStormSpirit(ctx, st); return; }
    }
    if (this.flash > 0) whitewash(spec);
    // sprite oficial si está disponible: hereda bob/lean/squash del caller
    var deathA = -1;
    if (st.death != null && st.death >= 0) {
      var dFall = st.death;
      deathA = Math.max(0, 1 - dFall * 1.15);
      ctx.save();
      ctx.translate(this.x, y);
      ctx.rotate(this.face * dFall * dFall * 1.3);
      ctx.translate(-this.x, -y);
    }
    if (typeof SPRITES !== 'undefined' && SPRITES.draw(ctx, 'e', this.type, this.x, y + this.r * 0.85, this.r * 3.1, st.hurt, deathA)) {
      if (deathA >= 0) ctx.restore();
      return;
    }
    if (deathA >= 0) ctx.restore();
    ART.figure(ctx, spec, st);
  }

  _atk() {
    var e = this;
    if (e.towerAtkCd > 0) return Math.max(0, Math.min(1, 1 - e.towerAtkCd / 1.1));
    var fs = e.fireStun || e.frostStun;
    if (e.fireCd > 0 && fs) return Math.max(0, Math.min(1, 1 - e.fireCd / fs));
    var sc = e.type === 'lord' || e.type === 'voidLord' ? 5 : 6;
    if (e.summonCd > 0) return Math.max(0, Math.min(1, 1 - e.summonCd / sc));
    return 0;
  }

  _spec() {
    var m = {
      goblin: { build: 'imp', skin: '#4a8f4f', tunic: '#5a4a28', armor: '#66512d', bracer: '#806634', belt: '#3a2a14', head: 'human', ears: 'goblin', eyeCol: '#ffd23a', smile: true, weapon: 'club', headR: 0.6, bodyW: 0.8, torso: 0.85 },
      sorcerer: { build: 'caster', skin: '#4a8f4f', body: 'robe', tunic: '#4a2a6a', hoodCol: '#3a1f55', head: 'hood', eyeCol: '#c8a0ff', weapon: 'staff', glowCol: '#9a6aff', headR: 0.55, torso: 0.95, trim: '#6a4a8a' },
      orc: { build: 'brute', hump: 0.35, skin: '#5a8a3a', tunic: '#6a4a2a', armor: '#4a3a2a', belt: '#2e2010', head: 'orc', eyeCol: '#ff5a3a', hair: 'topknot', earring: true, weapon: 'axe', headR: 0.55, bodyW: 0.95, torso: 1.0 },
      berserker: { build: 'brute', hump: 0.45, spikes: 0.35, skin: '#8a5a2a', tunic: '#6a2a1a', armor: '#7b3b20', bracer: '#9a5428', belt: '#2e2010', head: 'orc', eyeCol: '#ff3a2a', hair: 'wild', scar: true, weapon: 'cleaver', headR: 0.55, bodyW: 0.95, torso: 0.95 },
      skeleton: { build: 'warrior', deathStyle: 'crumble', skin: '#d8d6c8', tunic: '#c4c2b2', bones: true, armor: '#6a6a78', belt: '#4a4a4a', head: 'skull', eyeCol: '#5a5a6a', weapon: 'sword', headR: 0.52, torso: 1.0, bodyW: 0.85 },
      undead: { build: 'warrior', deathStyle: 'collapse', skin: '#9aa48c', tunic: '#3a4048', armor: '#4a4a5a', belt: '#2a2a34', head: 'rot', eyeCol: '#ffd23a', weapon: 'sword', headR: 0.52, torso: 1.0 },
      troll: { build: 'brute', hump: 0.55, tail: { len: 1.1, col: '#6a9a6a', dark: '#3a5a3a' }, skin: '#6a9a6a', tunic: '#4a5a2a', armor: '#5c552c', bracer: '#7f7438', belt: '#2e2a10', head: 'human', ears: 'goblin', eyeCol: '#ff8a2a', smile: true, weapon: 'club', headR: 0.6, bodyW: 1.1, torso: 1.1 },
      necromancer: { build: 'caster', skin: '#7a8a8a', body: 'robe', tunic: '#2a1a3a', hoodCol: '#1f142a', head: 'hood', eyeCol: '#7aff9a', weapon: 'staff', glowCol: '#7aff9a', headR: 0.52, torso: 1.0, cape: '#1f142a' },
      orcKing: { build: 'brute', hump: 0.3, skin: '#4a7a2a', tunic: '#4a2a1a', armor: '#9a9aa8', trim: '#e0b84a', belt: '#2e2010', skirt: '#4a3a2a', cape: '#b03030', head: 'orc', eyeCol: '#ffb03a', hair: 'topknot', earring: true, crown: true, weapon: 'axe', headR: 0.58, bodyW: 1.05, torso: 1.05 },
      lord: { build: 'caster', skin: '#5a4a5a', body: 'robe', tunic: '#1a1024', hoodCol: '#120a1a', head: 'rot', eyeCol: '#c8a0ff', crown: true, trim: '#8a5aff', weapon: 'scythe', glowCol: '#a08aff', headR: 0.54, torso: 1.05, cape: '#120a1a' },
      voidWalker: { build: 'spectral', skin: '#8a7aaa', body: 'robe', tunic: '#120a1f', hoodCol: '#0a0612', head: 'hood', eyeCol: '#b08aff', weapon: 'staff', glowCol: '#b08aff', headR: 0.54, torso: 1.0, cape: '#0a0612', trim: '#5a3a8a' },
      saboteur: { build: 'imp', skin: '#8a7a4a', tunic: '#4a3a22', armor: '#68502b', bracer: '#97713a', belt: '#2a1c0e', head: 'human', ears: 'goblin', eyeCol: '#ffd23a', smile: true, weapon: 'torch', headR: 0.55, bodyW: 0.8, torso: 0.85 },
      assassin: { build: 'imp', skin: '#c8b8a8', body: 'robe', tunic: '#2a2530', hoodCol: '#1f1a26', head: 'hood', eyeCol: '#ff5a3a', weapon: 'dagger', headR: 0.52, torso: 0.95, trim: '#3a3a4a' },
      thief: { build: 'imp', skin: '#c8b8a8', tunic: '#5a5a2a', armor: '#4b4926', bracer: '#77713c', belt: '#2e2a14', head: 'human', eyeCol: '#3a3a4a', weapon: 'dagger', headR: 0.52, torso: 0.9, bodyW: 0.8 },
      hulker: { build: 'brute', hump: 0.7, spikes: 0.5, skin: '#5a1a5a', tunic: '#3a122a', belt: '#24101a', head: 'orc', eyeCol: '#ff2a6a', scar: true, hair: 'wild', weapon: 'cleaver', headR: 0.6, bodyW: 1.25, torso: 1.2 },
      gargoyle: { build: 'flyer', skin: '#6a6a72', tunic: '#4a4a52', armor: '#8a8a94', belt: '#3a3a44', head: 'demon', eyeCol: '#ff3a2a', wings: true, wingCol: '#5a5a64', weapon: 'club', headR: 0.55, torso: 1.0, bodyW: 1.0 },
      shaman: { build: 'caster', skin: '#a07a3a', tunic: '#6a4a2a', armor: '#80602d', bracer: '#a57e3c', belt: '#3a2a14', skirt: '#5a4a3a', head: 'orc', eyeCol: '#ffd23a', earring: true, scar: true, totem: true, weapon: 'staff', glowCol: '#ffb04a', headR: 0.55, torso: 0.95, bodyW: 0.9 },
      orcShield: { build: 'brute', hump: 0.25, skin: '#5a8a3a', tunic: '#4a3a22', armor: '#6b6f7c', bracer: '#806634', belt: '#2e2010', head: 'orc', eyeCol: '#ff5a3a', hair: 'topknot', weapon: 'club', headR: 0.58, bodyW: 1.05, torso: 1.0 },
      mender: { build: 'caster', skin: '#4a8f4f', body: 'robe', tunic: '#2a5a38', hoodCol: '#1f4529', head: 'hood', eyeCol: '#8affb0', weapon: 'staff', glowCol: '#7aff9a', headR: 0.55, torso: 0.95, trim: '#4a8a5a' },
      phaseStalker: { build: 'spectral', skin: '#aab8d8', body: 'robe', tunic: '#2a3048', hoodCol: '#1c2236', head: 'hood', eyeCol: '#9fd0ff', weapon: 'dagger', headR: 0.52, torso: 0.95, trim: '#4a5a8a' },
      demon: { build: 'brute', tail: { len: 1.2, col: '#c8382a', dark: '#7a1f16' }, skin: '#c8382a', tunic: '#6a1f1a', armor: '#8a3a3a', belt: '#3a1210', trim: '#ff8a3a', head: 'demon', eyeCol: '#ffe23a', weapon: 'cleaver', headR: 0.58, bodyW: 1.0, torso: 1.0 },
      lich: { build: 'caster', skin: '#7a6a9a', body: 'robe', tunic: '#2a1a3a', hoodCol: '#1f142a', head: 'rot', eyeCol: '#8aff9a', crown: true, weapon: 'staff', glowCol: '#8aff9a', headR: 0.52, torso: 1.0, cape: '#1f142a', trim: '#c9a54a' },
      fireGolem: 'art:fireGolem',
      stoneGolem: 'art:stoneGolem',
      bat: 'art:bat',
      wisp: 'art:wisp',
      crawler: 'art:crawler',
      dragon: 'dragon',
      iceDragon: 'iceDragon',
      treant: 'treant',
      warMachine: 'warMachine',
      voidLord: 'voidLord',
      iceWraith: 'iceWraith',
      stormSpirit: 'stormSpirit',
      splitter: { build: 'imp', skin: '#9a6aaa', tunic: '#5a3a6a', head: 'human', eyeCol: '#d8a8ff', smile: true, weapon: 'club', headR: 0.6, torso: 0.8, bodyW: 1.15 },
      splitterSmall: { build: 'imp', skin: '#ba8aca', tunic: '#7a4a8a', head: 'human', eyeCol: '#e8c0ff', smile: true, headR: 0.65, torso: 0.75, bodyW: 1.1 },
      splitterTiny: { build: 'imp', skin: '#d8a8e8', tunic: '#9a6aaa', head: 'human', eyeCol: '#f8d8ff', smile: true, headR: 0.7, torso: 0.7, bodyW: 1.05 }
    };
    return m[this.type] || { skin: this.color || '#8a8a8a', head: 'human', weapon: 'club', headR: 0.52, torso: 0.9 };
  }

  // DRAGÓN — perfil lateral completo: cola con púas, torso escamoso,
  // alas membranosas barridas hacia atrás, cuello serpentino y cabeza
  // con mandíbula articulada. La variante de hielo usa púas de cristal.
  _drawDragon(ctx, st, ice) {
    var r = st.r;
    var col = ice ? '#9fd4ee' : '#c04028';
    var dark = ART.shade(col, -42);
    var belly = ice ? '#eaf6ff' : '#f2cd96';
    var glow = ice ? '#bfeaff' : '#ffc06a';
    var spine = ice ? 'rgba(225,245,255,0.95)' : ART.shade(col, -55);
    var flap = st.flap != null ? st.flap : Math.sin(st.anim);
    var jaw = st.atk > 0.72 ? 0.9 : (st.atk > 0.45 ? 0.35 : 0.08);
    var wag = Math.sin(st.anim * 1.3) * r * 0.12;
    var bobN = Math.sin(st.anim * 1.1) * r * 0.05;
    var tuck = st.flying ? 1 : 0; // patas recogidas en vuelo
    var i;
    ctx.save();
    ctx.scale(st.face === -1 ? -1 : 1, 1);
    ctx.translate(0, Math.sin(st.anim * 1.3) * r * 0.08);

    // ---------- COLA (cónica, con púas y punta en flecha) ----------
    var tg = ctx.createLinearGradient(-r * 0.8, 0, -r * 2.3, 0);
    tg.addColorStop(0, col); tg.addColorStop(1, dark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.82, -r * 0.3);
    ctx.quadraticCurveTo(-r * 1.5, -r * 0.12, -r * 2.28, r * 0.02 + wag);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.42, -r * 0.78, r * 0.24);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ART.rgba(dark, 0.6); ctx.lineWidth = Math.max(1, r * 0.04); ctx.stroke();
    // punta en flecha
    ctx.fillStyle = spine;
    ctx.beginPath();
    ctx.moveTo(-r * 2.24, r * 0.02 + wag);
    ctx.lineTo(-r * 2.62, -r * 0.16 + wag);
    ctx.lineTo(-r * 2.44, r * 0.06 + wag);
    ctx.lineTo(-r * 2.6, r * 0.24 + wag);
    ctx.closePath(); ctx.fill();
    // púas dorsales de la cola
    for (i = 0; i < 3; i++) {
      var tx = -r * (1.15 + i * 0.38), ty = -r * (0.24 - i * 0.04) + wag * i * 0.35;
      ctx.beginPath();
      ctx.moveTo(tx - r * 0.1, ty);
      ctx.lineTo(tx - r * 0.02, ty - r * (0.2 - i * 0.04));
      ctx.lineTo(tx + r * 0.1, ty + r * 0.02);
      ctx.closePath(); ctx.fill();
    }

    // ---------- ALA LEJANA ----------
    ART.wing(ctx, r * 0.02, -r * 0.68, -1, r * 1.65, flap * 0.85, ART.shade(col, -16), dark);

    // ---------- PATA TRASERA LEJANA ----------
    ctx.fillStyle = ART.shade(col, -22);
    ctx.beginPath(); ctx.ellipse(-r * 0.55, r * 0.08, r * 0.24, r * 0.34, 0.2, 0, 6.28); ctx.fill();
    ctx.strokeStyle = ART.shade(col, -22); ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.3); ctx.lineTo(-r * 0.72, r * (0.62 - tuck * 0.25)); ctx.stroke();

    // ---------- TORSO ----------
    var bg = ctx.createLinearGradient(-r * 0.6, -r * 0.85, r * 0.4, r * 0.5);
    bg.addColorStop(0, ART.shade(col, 26)); bg.addColorStop(0.55, col); bg.addColorStop(1, dark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(-r * 0.08, -r * 0.18, r * 1.02, r * 0.62, -0.06, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,8,0.85)'; ctx.lineWidth = Math.max(1.5, r * 0.055); ctx.stroke();
    // placas ventrales
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(r * 0.02, r * 0.2, r * 0.68, r * 0.3, -0.04, 0, 6.28); ctx.fill();
    ctx.strokeStyle = ART.rgba(ART.shade(belly, -70), 0.55); ctx.lineWidth = Math.max(1, r * 0.035);
    for (i = 0; i < 5; i++) {
      var px = -r * 0.5 + i * r * 0.26;
      ctx.beginPath();
      ctx.moveTo(px, r * 0.02);
      ctx.quadraticCurveTo(px + r * 0.06, r * 0.22, px - r * 0.02, r * 0.42);
      ctx.stroke();
    }
    // escamas del lomo (tres hileras de arcos)
    ctx.strokeStyle = ART.rgba(dark, 0.28); ctx.lineWidth = Math.max(0.8, r * 0.03);
    for (var row = 0; row < 3; row++) {
      for (var k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(-r * 0.72 + k * r * 0.27 + (row % 2) * r * 0.13, -r * 0.58 + row * r * 0.15, r * 0.11, Math.PI * 1.15, Math.PI * 1.95);
        ctx.stroke();
      }
    }
    // espinas dorsales del lomo
    ctx.fillStyle = spine;
    for (i = 0; i < 4; i++) {
      var sx2 = -r * 0.75 + i * r * 0.42, sy2 = -r * 0.66 - Math.sin(i * 0.9) * r * 0.08;
      ctx.beginPath();
      ctx.moveTo(sx2 - r * 0.11, sy2 + r * 0.06);
      ctx.lineTo(sx2, sy2 - r * (0.24 - i * 0.02));
      ctx.lineTo(sx2 + r * 0.12, sy2 + r * 0.08);
      ctx.closePath(); ctx.fill();
      if (ice) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke(); }
    }

    // ---------- PATAS CERCANAS ----------
    // trasera: muslo poderoso + garras
    var lg = ctx.createLinearGradient(-r * 0.5, -r * 0.1, -r * 0.3, r * 0.9);
    lg.addColorStop(0, ART.shade(col, 12)); lg.addColorStop(1, dark);
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(-r * 0.38, r * 0.2, r * 0.3, r * 0.42, 0.22, 0, 6.28); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = r * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.34, r * 0.48); ctx.lineTo(-r * 0.44, r * (0.82 - tuck * 0.3)); ctx.stroke();
    // delantera
    ctx.strokeStyle = ART.shade(col, -8); ctx.lineWidth = r * 0.14;
    ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.3); ctx.lineTo(r * 0.68, r * (0.1 - tuck * 0.1)); ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = r * 0.11;
    ctx.beginPath(); ctx.moveTo(r * 0.68, r * (0.1 - tuck * 0.1)); ctx.lineTo(r * 0.6, r * (0.48 - tuck * 0.26)); ctx.stroke();
    // garras (tres por pie)
    ctx.fillStyle = ice ? '#ffffff' : '#e8e0c8';
    var feet = [[-r * 0.44, r * (0.86 - tuck * 0.3)], [r * 0.6, r * (0.52 - tuck * 0.26)]];
    for (var f = 0; f < feet.length; f++) {
      for (var cl = 0; cl < 3; cl++) {
        var cxx = feet[f][0] + cl * r * 0.09, cyy = feet[f][1];
        ctx.beginPath();
        ctx.moveTo(cxx - r * 0.035, cyy - r * 0.05);
        ctx.lineTo(cxx + r * 0.05, cyy + r * 0.06);
        ctx.lineTo(cxx - r * 0.01, cyy + r * 0.06);
        ctx.closePath(); ctx.fill();
      }
    }

    // ---------- ALA CERCANA ----------
    ART.wing(ctx, r * 0.28, -r * 0.75, -1, r * 2.1, flap, col, dark);

    // ---------- CUELLO (serpentino, con garganta placada) ----------
    var ng = ctx.createLinearGradient(r * 0.6, -r * 0.4, r * 1.5, -r * 1.4);
    ng.addColorStop(0, ART.shade(col, 10)); ng.addColorStop(1, col);
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.72);
    ctx.quadraticCurveTo(r * 1.0, -r * 1.2 + bobN, r * 1.48, -r * 1.32 + bobN);
    ctx.lineTo(r * 1.64, -r * 1.14 + bobN);
    ctx.quadraticCurveTo(r * 1.12, -r * 0.88 + bobN, r * 0.82, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.66, -r * 0.4, r * 0.5, -r * 0.72);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ART.rgba(dark, 0.5); ctx.lineWidth = Math.max(1, r * 0.04); ctx.stroke();
    // placas de la garganta
    ctx.strokeStyle = ART.rgba(ART.shade(belly, -50), 0.65); ctx.lineWidth = Math.max(1, r * 0.04);
    var throat = [[1.5, -1.18], [1.34, -1.04], [1.18, -0.86], [1.02, -0.64]];
    for (i = 0; i < throat.length; i++) {
      ctx.beginPath();
      ctx.moveTo(r * throat[i][0], r * throat[i][1] + bobN);
      ctx.quadraticCurveTo(r * (throat[i][0] + 0.08), r * (throat[i][1] + 0.08) + bobN, r * (throat[i][0] - 0.04), r * (throat[i][1] + 0.14) + bobN);
      ctx.stroke();
    }
    // púas del cuello
    ctx.fillStyle = spine;
    var nsp = [[0.72, -0.86, 0.2], [0.94, -1.1, 0.17], [1.16, -1.28, 0.14], [1.38, -1.42, 0.11]];
    for (i = 0; i < nsp.length; i++) {
      ctx.beginPath();
      ctx.moveTo(r * (nsp[i][0] - 0.09), r * nsp[i][1] + bobN + r * 0.05);
      ctx.lineTo(r * nsp[i][0], r * nsp[i][1] + bobN - r * nsp[i][2]);
      ctx.lineTo(r * (nsp[i][0] + 0.1), r * nsp[i][1] + bobN + r * 0.06);
      ctx.closePath(); ctx.fill();
      if (ice) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke(); }
    }

    // ---------- CABEZA ----------
    ctx.save();
    ctx.translate(r * 1.64, -r * 1.46 + bobN);
    ART.dragonHead(ctx, r * 0.58, col, dark, glow, jaw);
    ctx.restore();

    // ---------- ALIENTO (cono estratificado) ----------
    if (st.atk > 0.72) {
      var fl = 0.5 + 0.5 * Math.sin(st.anim * 4);
      var mx = r * 2.42, my = -r * 1.38 + bobN;
      var layers = ice
        ? [[1.55, 0.5, 'rgba(150,215,255,0.45)'], [1.15, 0.33, 'rgba(200,240,255,0.7)'], [0.7, 0.18, '#ffffff']]
        : [[1.55, 0.5, 'rgba(255,96,26,0.5)'], [1.15, 0.33, 'rgba(255,166,64,0.75)'], [0.7, 0.18, '#fff2b0']];
      for (i = 0; i < layers.length; i++) {
        var L = layers[i], len = r * L[0] * (0.92 + fl * 0.16), w = r * L[1];
        ctx.fillStyle = L[2];
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.quadraticCurveTo(mx + len * 0.45, my - w * (1 + fl * 0.35), mx + len, my + w * 0.08);
        ctx.quadraticCurveTo(mx + len * 0.5, my + w * 0.95, mx, my + w * 0.22);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawTreant(ctx, st) {
    var r = st.r, bark = '#6a4f33', dark = ART.shade(bark, -35), leaf = '#5a9a4a', leafDark = ART.shade(leaf, -30);
    ctx.save();
    var sway = Math.sin(st.anim * 1.2) * 0.04;
    ctx.rotate(sway);
    // raíces
    ctx.strokeStyle = dark; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round';
    for (var i = -1; i <= 1; i += 2) {
      ctx.beginPath(); ctx.moveTo(i * r * 0.3, r * 0.3); ctx.quadraticCurveTo(i * r * 0.8, r * 0.8, i * r * 0.95, r * 1.15); ctx.stroke();
    }
    // tronco
    var tg = ctx.createLinearGradient(-r * 0.5, -r * 0.4, r * 0.5, r * 0.3);
    tg.addColorStop(0, ART.shade(bark, 12)); tg.addColorStop(1, dark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.7, -r * 0.4, -r * 1.0);
    ctx.lineTo(r * 0.4, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.7, r * 0.42, r * 0.3);
     ctx.closePath(); ctx.fill();
     ctx.strokeStyle = 'rgba(16,12,18,0.92)'; ctx.lineWidth = Math.max(1.4, r * 0.05); ctx.stroke();
    // nudos
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.1, r * 0.2, r * 0.4, 0.3, 0, 6.28); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.05, r * 0.16, r * 0.34, -0.3, 0, 6.28); ctx.stroke();
    // ramas brazo
    ctx.strokeStyle = dark; ctx.lineWidth = r * 0.22;
    for (var a = -1; a <= 1; a += 2) {
      var lift = Math.sin(st.walk + a) * r * 0.2;
      ctx.beginPath(); ctx.moveTo(a * r * 0.4, -r * 0.75); ctx.quadraticCurveTo(a * r * 0.95, -r * 0.6 + lift, a * r * 1.25, -r * 0.3 + lift); ctx.stroke();
      ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(a * r * 1.25, -r * 0.3 + lift); ctx.quadraticCurveTo(a * r * 1.5, -r * 0.1 + lift, a * r * 1.4, r * 0.05 + lift); ctx.stroke();
      ctx.lineWidth = r * 0.22;
    }
    // cara en la corteza
    ctx.fillStyle = '#160c06';
    ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.72, r * 0.12, r * 0.2, 0.15, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.18, -r * 0.72, r * 0.12, r * 0.2, -0.15, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#8aff6a';
    ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.72, r * 0.05, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.72, r * 0.05, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-r * 0.28, -r * 0.45); ctx.quadraticCurveTo(0, -r * 0.3, r * 0.28, -r * 0.45); ctx.stroke();
    // copa de hojas
    ctx.fillStyle = leaf;
    ctx.beginPath(); ctx.ellipse(0, -r * 1.25, r * 0.7, r * 0.4, 0, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r * 0.55, -r * 1.0, r * 0.4, r * 0.3, 0.4, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 1.0, r * 0.4, r * 0.3, -0.4, 0, 6.28); ctx.fill();
    ctx.fillStyle = leafDark;
    ctx.beginPath(); ctx.ellipse(0, -r * 1.3, r * 0.55, r * 0.32, 0, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  _drawWarMachine(ctx, st) {
    var r = st.r, iron = '#6a6a76', dark = ART.shade(iron, -38), wood = '#6a4a2a', glow = '#ff6a3a';
    ctx.save();
    // ruedas
    for (var s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * r * 0.75, r * 0.5);
      ctx.rotate(st.walk * 1.4);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 6.28); ctx.fill();
      ctx.fillStyle = iron;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 6.28); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = r * 0.1;
      for (var sp = 0; sp < 5; sp++) {
        var ang = sp * 1.2566;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 0.4, Math.sin(ang) * r * 0.4); ctx.stroke();
      }
      ctx.fillStyle = '#8a8a96';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    // casco
    var hg = ctx.createLinearGradient(-r * 0.9, -r * 0.3, r * 0.9, -r * 0.5);
    hg.addColorStop(0, ART.shade(iron, 20)); hg.addColorStop(1, dark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.15);
    ctx.lineTo(-r * 0.8, -r * 0.75);
    ctx.lineTo(r * 0.55, -r * 0.75);
    ctx.lineTo(r * 0.9, r * 0.15);
     ctx.closePath(); ctx.fill();
     ctx.strokeStyle = 'rgba(18,18,24,0.9)'; ctx.lineWidth = Math.max(1.4, r * 0.05); ctx.stroke();
    // remaches
    ctx.fillStyle = '#9a9aa6';
    for (var rv = -1; rv <= 1; rv++) {
      ctx.beginPath(); ctx.arc(rv * r * 0.55, -r * 0.55, 1.6, 0, 6.28); ctx.fill();
    }
    // madera frontal
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.75);
    ctx.lineTo(r * 0.95, -r * 0.55);
    ctx.lineTo(r * 1.0, r * 0.1);
    ctx.lineTo(r * 0.5, r * 0.1);
    ctx.closePath(); ctx.fill();
    // taladro giratorio
    ctx.save();
    ctx.translate(r * 1.0, -r * 0.1);
    ctx.rotate(st.anim * 2);
    ctx.fillStyle = '#a0a0ac';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 0.16, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#5a5a64'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
    ctx.restore();
    // humo
    ctx.fillStyle = 'rgba(140,130,120,' + (0.3 + 0.2 * Math.sin(st.anim * 3)) + ')';
    ctx.beginPath(); ctx.arc(-r * 0.5, -r * 1.0 + Math.sin(st.anim) * 2, r * 0.16, 0, 6.28); ctx.fill();
    // brasa
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, 2 + Math.sin(st.anim * 5) * 1.2, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  _drawVoidLord(ctx, st) {
    var r = st.r, v = '#2a1a4a', dark = ART.shade(v, -38), glow = '#b08aff';
    var pulse = 0.5 + 0.5 * Math.sin(st.anim * 2);
    ctx.save();
    ctx.globalAlpha = 0.4;
    var aura = ctx.createRadialGradient(0, -r * 0.2, r * 0.2, 0, -r * 0.2, r * 2.1);
    aura.addColorStop(0, 'rgba(150,80,255,0.5)');
    aura.addColorStop(1, 'rgba(150,80,255,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 2.1, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(0, Math.sin(st.anim * 1.4) * r * 0.08);
    // túnica flotante
    var fg = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.7);
    fg.addColorStop(0, v); fg.addColorStop(1, dark);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.35);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.2, -r * 0.8, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.45, r * 0.7, 0, r * 0.6);
    ctx.quadraticCurveTo(r * 0.45, r * 0.7, r * 0.8, r * 0.5);
    ctx.quadraticCurveTo(r * 0.95, r * 0.2, r * 0.85, -r * 0.35);
    ctx.quadraticCurveTo(0, -r * 0.7, -r * 0.85, -r * 0.35);
    ctx.closePath(); ctx.fill();
    // tentáculos
    ctx.strokeStyle = dark; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    for (var t = 0; t < 4; t++) {
      var tx = -r * 0.5 + t * r * 0.33;
      var w = Math.sin(st.anim * 2 + t * 1.7) * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.55);
      ctx.quadraticCurveTo(tx + w * 0.4, r * 0.9, tx + w, r * 1.05);
      ctx.stroke();
    }
    // hombros + cuello
    ctx.fillStyle = ART.shade(v, -15);
    ctx.beginPath(); ctx.arc(-r * 0.7, -r * 0.5, r * 0.3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.5, r * 0.3, 0, 6.28); ctx.fill();
    // brazo garra
    ctx.strokeStyle = v; ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.45); ctx.quadraticCurveTo(-r * 1.3, -r * 0.1, -r * 1.15, r * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.45); ctx.quadraticCurveTo(r * 1.3, -r * 0.1, r * 1.15, r * 0.3); ctx.stroke();
    ctx.fillStyle = '#1a0e2e';
    ctx.beginPath(); ctx.arc(-r * 1.2, r * 0.32, r * 0.18, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 1.2, r * 0.32, r * 0.18, 0, 6.28); ctx.fill();
    // yelmo con cuernos
    ctx.fillStyle = '#1a0e2e';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.78, r * 0.48, r * 0.55, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#2a1a4a';
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.9); ctx.lineTo(-r * 0.75, -r * 1.55); ctx.lineTo(-r * 0.15, -r * 1.05); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.9); ctx.lineTo(r * 0.75, -r * 1.55); ctx.lineTo(r * 0.15, -r * 1.05); ctx.closePath(); ctx.fill();
    // ojo del vacío
    ART.orb(ctx, 0, -r * 0.75, r * 0.16 + pulse * 0.05, '#fff', glow);
    ctx.restore();
  }

  _drawIceWraith(ctx, st) {
    var r = st.r, ice = '#bfe8ff', dark = ART.shade(ice, -45), glow = '#e0f4ff';
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.translate(0, Math.sin(st.anim * 1.6) * r * 0.25);
    // estela
    ctx.fillStyle = 'rgba(150,210,255,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.7, r * 0.5, 0, 0, 6.28); ctx.fill();
    // ropajes desgarrados
    var fg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.7);
    fg.addColorStop(0, ice); fg.addColorStop(1, dark);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.85, r * 0.3, -r * 0.6, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.2, r * 0.8);
    ctx.quadraticCurveTo(0, r * 0.55, r * 0.2, r * 0.8);
    ctx.quadraticCurveTo(r * 0.4, r * 0.5, r * 0.6, r * 0.7);
    ctx.quadraticCurveTo(r * 0.85, r * 0.3, r * 0.7, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.6, -r * 0.7, -r * 0.3);
    ctx.closePath(); ctx.fill();
    // capucha
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.25);
    ctx.quadraticCurveTo(-r * 0.55, -r * 1.0, 0, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.55, -r * 1.0, r * 0.6, -r * 0.25);
    ctx.quadraticCurveTo(0, -r * 0.55, -r * 0.6, -r * 0.25);
    ctx.closePath(); ctx.fill();
    // ojos de hielo
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.5, r * 0.09, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.5, r * 0.09, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.5, r * 0.2, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.5, r * 0.2, 0, 6.28); ctx.fill();
    // brazos espectrales
    ctx.strokeStyle = ice; ctx.lineWidth = r * 0.18; ctx.lineCap = 'round';
    var w = Math.sin(st.anim * 2) * r * 0.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, -r * 0.8, r * 0.3 + w); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.3); ctx.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.8, r * 0.3 - w); ctx.stroke();
    ctx.restore();
  }

  _drawStormSpirit(ctx, st) {
    var r = st.r, core = '#4a3a6a', dark = ART.shade(core, -35), glow = '#7ae0ff';
    ctx.save();
    ctx.translate(0, Math.sin(st.anim * 1.8) * r * 0.2);
    // nube
    ctx.fillStyle = 'rgba(80,70,110,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.1, r * 0.85, r * 0.55, 0, 0, 6.28);
    ctx.ellipse(-r * 0.55, -r * 0.35, r * 0.45, r * 0.35, 0, 0, 6.28);
    ctx.ellipse(r * 0.55, -r * 0.35, r * 0.45, r * 0.35, 0, 0, 6.28);
    ctx.ellipse(0, -r * 0.55, r * 0.5, r * 0.3, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,130,180,0.7)';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.25, r * 0.55, r * 0.3, 0, 0, 6.28); ctx.fill();
    // ojos eléctricos
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.1, r * 0.1 + Math.sin(st.anim * 6) * 0.03, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.1, r * 0.1 + Math.cos(st.anim * 6) * 0.03, 0, 6.28); ctx.fill();
    // relámpagos
    ctx.strokeStyle = glow; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var a = st.anim * 3 + i * 2.1;
      var z = 0.6 + 0.4 * Math.abs(Math.sin(st.anim * 5 + i));
      ctx.globalAlpha = z;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.6, -r * 0.3 + Math.sin(a) * r * 0.3);
      ctx.lineTo(Math.cos(a) * r * 1.1, -r * 0.15 + Math.sin(a) * r * 0.5);
      ctx.lineTo(Math.cos(a) * r * 1.3, r * 0.1 + Math.sin(a) * r * 0.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(122,224,255,0.5)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.6, r * 0.3, 0, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  drawResistBadges(ctx, y) {
    var hasResist = false, hasWeak = false;
    for (var k in this.resist) { if (this.resist[k] < 1) hasResist = true; }
    for (var w in this.weak) { if (this.weak[w] > 1) hasWeak = true; }
    if (!hasResist && !hasWeak) return;
    var colors = { physical: '#d8d8d8', fire: '#ff5a2a', ice: '#6fd0ff', earth: '#c09a5a', nature: '#7fd47f' };
    var icons = { physical: '⚔', fire: '🔥', ice: '❄', earth: '🪨', nature: '🌿' };
    var list = [];
    for (var rk in this.resist) if (this.resist[rk] < 1) list.push([rk, 'r']);
    for (var wk in this.weak) if (this.weak[wk] > 1) list.push([wk, 'w']);
    var x = this.x - (list.length - 1) * 9;
    var yy = y - this.r - 16;
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < list.length; i++) {
      var col = colors[list[i][0]] || '#ffffff';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x + i * 18, yy, 7, 0, 6.28); ctx.fill();
      ctx.fillStyle = list[i][1] === 'r' ? '#222' : '#fff';
      ctx.fillText(icons[list[i][0]] || '?', x + i * 18, yy + 1);
      if (list[i][1] === 'r') {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + i * 18, yy, 7, 0, 6.28); ctx.stroke();
      }
    }
  }

  drawHpBar(ctx, y) {
    var w = Math.max(18, this.r * 2.2);
    var x = this.x - w / 2;
    var yy = y - this.r - 10;
    var pct = Math.max(0, Math.min(1, this.hp / this.hpMax));
    if (pct >= 1 && !this.boss) return; // oculta con vida llena, salvo jefes
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(x - 1, yy - 1, w + 2, 6, 3); ctx.fill();
    if (pct > 0) {
      var col = pct > 0.5 ? '#5ad45a' : (pct > 0.25 ? '#e8d24a' : '#e05050');
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(x, yy, Math.max(2, w * pct), 4, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.roundRect(x, yy, Math.max(2, w * pct), 2, 1); ctx.fill();
    }
  }
}

function whitewash(obj) {
  for (var k in obj) {
    var v = obj[k];
    if (typeof v === 'string' && v.charAt(0) === '#') obj[k] = '#ffffff';
    else if (v && typeof v === 'object') whitewash(v);
  }
}
