import math
import random
import pygame
from config import CONFIG, TOWERS, TOWER_TYPES
from artkit import figure, shade, rgba, orb, rod, hex2rgb, Ctx, _parse_color, _int, _quad_bezier, TWO_PI

SOLDIER_TYPES = {
    'swordsman': {'color': '#8a7a5a', 'dark': '#5a4a3a', 'weapon': 'sword'},
    'archer':    {'color': '#5a7a3a', 'dark': '#3a5a2a', 'weapon': 'bow'},
    'shieldbearer': {'color': '#7a7a8a', 'dark': '#4a4a5a', 'weapon': 'shield'},
    'mage':      {'color': '#5a3a8a', 'dark': '#3a2a5a', 'weapon': 'staff'},
}


class AlliedSoldier:
    def __init__(self, x, y, stype, stats, tower):
        self.x = x
        self.y = y
        self.stype = stype
        self.tower = tower
        self.hpMax = stats.get('hp', 80)
        self.hp = self.hpMax
        self.dmg = stats.get('dmg', 8)
        self.rate = stats.get('rate', 0.8)
        self.attackRange = stats.get('range', 28)
        self.armor = stats.get('armor', 0)
        self.ranged = stats.get('ranged', False)
        self.element = stats.get('element', 'physical')
        self.cooldown = 0
        self.angle = 0
        self.flash = 0
        self.alive = True
        self.respawnTimer = 0
        self.anim = 0
        self.homeX = x
        self.homeY = y
        self.engaged = None
        self.blockPos = 0
        self.facing = 0

    def update(self, dt, game):
        if not self.alive:
            self.respawnTimer -= dt
            if self.respawnTimer <= 0:
                self.alive = True
                self.hp = self.hpMax
                self.x = self.homeX
                self.y = self.homeY
            return
        self.anim += dt
        if self.flash > 0:
            self.flash -= dt
        self.cooldown -= dt
        if self.engaged is not None:
            e = self.engaged
            if not e.alive:
                self.engaged = None
                return
            dx = e.x - self.x
            dy = e.y - self.y
            d2 = dx * dx + dy * dy
            if d2 > (self.attackRange * 4) ** 2:
                self.engaged = None
                e.blockedBy = None
                return
            self.facing = math.atan2(dy, dx)
            self.angle = self.facing
            if self.cooldown <= 0:
                self.cooldown = self.rate
                self.flash = 0.15
                mult = 1
                if hasattr(e, 'hex') and e.hex:
                    mult = e.hex.get('mult', 1)
                e.takeDamage(self.dmg * mult * game.weatherMult(self.element), self.element, self.tower)
                if not self.ranged and e.alive:
                    e.pathPos = max(0, e.pathPos - 2)
            return
        best = None
        bestDist = self.attackRange * self.attackRange
        for e in game.enemies:
            if not e.alive:
                continue
            if not self.ranged and e.flying:
                continue
            if hasattr(e, 'blockedBy') and e.blockedBy is not None and e.blockedBy is not self:
                continue
            dx = e.x - self.x
            dy = e.y - self.y
            d2 = dx * dx + dy * dy
            if d2 <= bestDist:
                best = e
                bestDist = d2
        if best and self.cooldown <= 0:
            self.engaged = best
            best.blockedBy = self
            self.facing = math.atan2(best.y - self.y, best.x - self.x)
            self.angle = self.facing
            self.cooldown = self.rate
            self.flash = 0.15
            mult = 1
            if hasattr(best, 'hex') and best.hex:
                mult = best.hex.get('mult', 1)
            best.takeDamage(self.dmg * mult * game.weatherMult(self.element), self.element, self.tower)
            if not self.ranged and best.alive:
                best.pathPos = max(0, best.pathPos - 2)

    def takeDamage(self, dmg, element=None, tower=None):
        arm = self.armor
        d = max(1, dmg - arm)
        self.hp -= d
        self.flash = 0.15
        if self.hp <= 0:
            self.alive = False
            self.respawnTimer = 10
            if self.engaged:
                self.engaged.blockedBy = None
                self.engaged = None

    def draw(self, surface, camX, camY):
        if not self.alive:
            return
        ctx = Ctx(surface)
        ctx.save()
        ctx.translate(self.x - camX, self.y - camY)
        r = 7
        if self.engaged:
            glow = pygame.Surface((r * 4, r * 4), pygame.SRCALPHA)
            pygame.draw.circle(glow, (255, 80, 40, 55), (r * 2, r * 2), r * 2)
            surface.blit(glow, (int(self.x - camX - r * 2), int(self.y - camY - r * 2)))
        alpha = 0.22
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(0, r * 0.85, r * 1.1, r * 0.28, 0, 0, TWO_PI)
        ctx.fill()
        ctx.globalAlpha = 1.0
        info = SOLDIER_TYPES.get(self.stype, SOLDIER_TYPES['swordsman'])
        col = info['color']
        if self.flash > 0:
            col = '#ffffff'
        ctx.fillStyle = col
        bw = r * 0.55
        bh = r * 0.7
        ctx.fillRect(-bw, -bh + r * 0.3, bw * 2, bh)
        headR = r * 0.38
        ctx.fillStyle = '#f0d4a8'
        ctx.beginPath()
        ctx.arc(0, -bh + r * 0.3 - headR - 1, headR, 0, TWO_PI)
        ctx.fill()
        if self.stype == 'shieldbearer':
            ctx.fillStyle = '#8a8a9a'
            ctx.beginPath()
            ctx.ellipse(r * 0.3, 0, r * 0.3, r * 0.4, 0, 0, TWO_PI)
            ctx.fill()
        elif self.stype == 'mage':
            orb(ctx, r * 0.6, -r * 0.5, 3, '#b08aff', '#7040c0')
        elif self.stype == 'archer':
            ctx.strokeStyle = info['dark']
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(r * 0.5, -r * 0.2, r * 0.35, -1.2, 1.2)
            ctx.stroke()
        else:
            info2 = info
            ctx.strokeStyle = '#ccccdd'
            ctx.lineWidth = 1.2
            if self.engaged:
                ctx.beginPath()
                ctx.moveTo(0, -bh + r * 0.3)
                dx = math.cos(self.facing)
                dy = math.sin(self.facing)
                ctx.lineTo(dx * r * 0.6, -bh + r * 0.3 + dy * r * 0.4)
                ctx.stroke()
            else:
                ctx.beginPath()
                ctx.moveTo(0, -bh + r * 0.3)
                ctx.lineTo(r * 0.4, -r * 0.8)
                ctx.stroke()
        ctx.restore()
        barW = 14
        barH = 2
        barX = self.x - camX - barW / 2
        barY = self.y - camY - r - 6
        pct = max(0, self.hp / self.hpMax)
        bg = pygame.Surface((barW, barH), pygame.SRCALPHA)
        bg.fill((0, 0, 0, 140))
        surface.blit(bg, (int(barX), int(barY)))
        if pct > 0:
            fg = pygame.Surface((max(1, int(barW * pct)), barH), pygame.SRCALPHA)
            fg.fill((90, 212, 90, 220))
            surface.blit(fg, (int(barX), int(barY)))
from audio import AUDIO


def ability_targets(g, x, y, r):
    out = []
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - x
        dy = e.y - y
        if dx * dx + dy * dy <= r * r:
            out.append(e)
    out.sort(key=lambda e: e.pathPos)
    return out


def ability_towers(g, x, y, r):
    out = []
    for t in g.towers:
        dx = t.x - x
        dy = t.y - y
        if dx * dx + dy * dy <= r * r:
            out.append(t)
    return out


def turn_toward(cur, target, maxDelta):
    d = ((target - cur + math.pi * 3) % (math.pi * 2)) - math.pi
    if d > maxDelta:
        d = maxDelta
    if d < -maxDelta:
        d = -maxDelta
    return cur + d


PROJ_SPEED = {
    'archer': 430, 'fire': 280, 'ice': 400, 'venom': 320, 'dwarf': 260,
    'crossbow': 620, 'sniper': 780, 'holy': 380, 'warlock': 340,
}


ABILITY_FX = {}


def _abi_archer(g, t):
    lst = ability_targets(g, t.x, t.y, t.range + 30)
    for i in range(min(10, len(lst))):
        e = lst[i]
        e.takeDamage(t.damage * 1.4 * g.weatherMult(t.element), t.element, t)
        if e.alive:
            e.slow = {'mult': 0.75, 't': 1.5}
            g.hitSpark(e.x, e.y, '#e8d48a')
    g.burst(t.x, t.y, '#e8d48a', 10)
    g.shockRing(t.x, t.y, t.range + 30, '#e8d48a', 0.4)


def _abi_fire(g, t):
    lst = ability_targets(g, t.x, t.y, t.range)
    cx, cy = t.x, t.y
    if lst:
        cx = lst[-1].x
        cy = lst[-1].y
    r = max(46, (t.aoe or 46) + 28)
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - cx
        dy = e.y - cy
        if dx * dx + dy * dy <= r * r:
            e.takeDamage(t.damage * 2.2 * g.weatherMult('fire'), 'fire', t)
            if e.alive:
                e.burn = {'dps': t.damage * 0.5 * g.weatherMult('fire'), 't': 3}
    g.explosion(cx, cy, r, '#ff7a30')
    g.shockRing(cx, cy, r, '#ffb04a', 0.5)


def _abi_ice(g, t):
    r = t.range * 1.4
    g.frostNova(t.x, t.y, r, 0.35 + t.level * 0.1, 4)
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r:
            e.takeDamage(t.damage * 2 * g.weatherMult('ice'), 'ice', t)
            if e.alive:
                e.freeze = {'t': max(e.freeze['t'] if e.freeze else 0, 1.2 + t.level * 0.3)}
    g.shockRing(t.x, t.y, r, '#bfe8ff', 0.55)


def _abi_dwarf(g, t):
    lst = ability_targets(g, t.x, t.y, t.range + 40)
    if not lst:
        g.burst(t.x, t.y, '#ffb04a', 6)
        return
    n = min(6, max(3, len(lst)))
    for i in range(n):
        e = lst[i % len(lst)]
        ex, ey = e.x, e.y
        for o in g.enemies:
            if not o.alive or o.flying:
                continue
            dx = o.x - ex
            dy = o.y - ey
            if dx * dx + dy * dy <= 50 * 50:
                o.takeDamage(t.damage * 1.5 * g.weatherMult('earth'), 'earth', t)
                if o.alive:
                    o.pathPos = max(0, o.pathPos - 12)
        g.explosion(ex, ey, 50, '#ffb04a')


def _abi_crossbow(g, t):
    lst = ability_targets(g, t.x, t.y, t.range)
    if not lst:
        g.shockRing(t.x, t.y, t.range, '#9a8a5a', 0.3)
        return
    tx2 = lst[0]
    ang = math.atan2(tx2.y - t.y, tx2.x - t.x)
    cosA = math.cos(ang)
    sinA = math.sin(ang)
    dmg = t.damage * 3
    hit = 0
    for e in g.enemies:
        if not e.alive:
            continue
        rx = e.x - t.x
        ry = e.y - t.y
        proj = rx * cosA + ry * sinA
        if proj < 0 or proj > t.range + 30:
            continue
        perp = abs(rx * sinA - ry * cosA)
        if perp < 16:
            e.takeDamage(dmg * g.weatherMult('physical'), 'physical', t, t.ignoreArmor)
            if e.alive:
                e.slow = {'mult': 0.8, 't': 2}
            g.hitSpark(e.x, e.y, '#9a8a5a')
            hit += 1
    g.streak(t.x, t.y, t.x + cosA * (t.range + 20), t.y + sinA * (t.range + 20), '#e8d48a', 0.16)
    g.texts.append({
        'x': t.x, 'y': t.y - 24,
        'txt': '\U0001f3af \u00a1Perforaci\u00f3n! \u00d7' + str(hit),
        'life': 0.8, 'max': 0.8, 'color': '#e8d48a', 'vy': -16, 'size': 12,
    })


def _abi_venom(g, t):
    r = t.range * 1.3
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r:
            e.takeDamage(t.damage * 1.5 * g.weatherMult('nature'), 'nature', t)
            if e.alive:
                e.poison = {'dps': (t.poison['dps'] if t.poison else 8) * 3, 't': 4}
    for _j in range(18):
        a = random.random() * 6.28
        rr = random.random() * r * 0.9
        g.particles.append({
            'x': t.x + math.cos(a) * rr, 'y': t.y + math.sin(a) * rr,
            'vx': 0, 'vy': -20 - random.random() * 20,
            'life': 0.8, 'max': 0.8, 'color': '#7ad47f',
            'size': 3 + random.random() * 2.5, 'grav': -12,
        })
    g.shockRing(t.x, t.y, r, '#7ad47f', 0.5)


def _abi_druid(g, t):
    r = t.range * 1.2
    n = 0
    for e in g.enemies:
        if not e.alive or e.flying:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r:
            e.takeDamage(t.damage * 2.5 * g.weatherMult('nature') if t.damage > 0 else 40, 'nature', t)
            if e.alive:
                e.freeze = {'t': max(e.freeze['t'] if e.freeze else 0, 1.6 + t.level * 0.4)}
            g.burst(e.x, e.y, '#7fd47f', 4)
            n += 1
    g.texts.append({
        'x': t.x, 'y': t.y - 24,
        'txt': ('\U0001f33f \u00a1Enraizados! \u00d7' + str(n)) if n else '\U0001f33f',
        'life': 0.8, 'max': 0.8, 'color': '#7fd47f', 'vy': -16, 'size': 12,
    })
    g.shockRing(t.x, t.y, r, '#7fd47f', 0.5)


def _abi_tesla(g, t):
    lst = ability_targets(g, t.x, t.y, t.range + 30)
    n = min(10, len(lst))
    fx, fy = t.x, t.y - 20
    for i in range(n):
        e = lst[i]
        g.lightningBolt(fx, fy, e.x, e.y, '#8ad4ff', 0.18)
        e.takeDamage(t.damage * (1 - i * 0.06) * g.weatherMult('lightning'), 'lightning', t)
        if e.alive:
            e.slow = {'mult': 0.8, 't': 1.5}
        fx, fy = e.x, e.y
    g.burst(t.x, t.y, '#8ad4ff', 8)


def _abi_knight(g, t):
    r = 74
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r:
            e.pathPos = max(0, e.pathPos - 20)
            e.freeze = {'t': max(e.freeze['t'] if e.freeze else 0, 1.1)}
            e.takeDamage(t.damage * 1.5 * g.weatherMult('physical'), 'physical', t)
            g.burst(e.x, e.y, '#ccccdd', 4)
    g.shockRing(t.x, t.y, r, '#ccccdd', 0.45)


def _abi_sniper(g, t):
    lst = ability_targets(g, t.x, t.y, t.range)
    if not lst:
        g.shockRing(t.x, t.y, t.range, '#e8e8f0', 0.3)
        return
    target = lst[-1]
    dmg = t.damage * 4
    target.takeDamage(dmg * g.weatherMult('physical'), 'physical', t, True)
    g.texts.append({
        'x': target.x, 'y': target.y - 20,
        'txt': '\U0001f4a5 ' + str(math.floor(dmg)),
        'life': 0.9, 'max': 0.9, 'color': '#fff', 'vy': -24, 'size': 15,
    })
    g.hitSpark(target.x, target.y, '#fff')
    g.streak(t.x, t.y - 6, target.x, target.y, '#e8e8f0', 0.14)
    g.burst(t.x, t.y, '#e8e8f0', 8)
    g.shockRing(target.x, target.y, 26, '#fff', 0.35)


def _abi_holy(g, t):
    r = t.range * 1.3
    tws = ability_towers(g, t.x, t.y, r)
    for tw in tws:
        tw.hp = min(tw.hpMax, tw.hp + 35)
        tw.burnT = 0
        g.burst(tw.x, tw.y, '#fff6c8', 4)
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r and (e.corrupted or e.revive or e.necro):
            e.takeDamage(t.damage * 3 * g.weatherMult('nature'), 'nature', t)
    if g.purifyRadius:
        g.purifyRadius(t.x, t.y, r, (t.purge or 4) * 2)
    g.shockRing(t.x, t.y, r, '#ffe08a', 0.55)


def _abi_banner(g, t):
    r = t.range * 1.4
    tws = ability_towers(g, t.x, t.y, r)
    for tw in tws:
        tw.tempMul = 1.5
        tw.tempMulT = 8
        g.burst(tw.x, tw.y, '#ffe08a', 4)
    g.texts.append({
        'x': t.x, 'y': t.y - 24,
        'txt': '\U0001f6a9 \u00a1Furia! \u00d7' + str(len(tws)),
        'life': 1, 'max': 1, 'color': '#ffe08a', 'vy': -16, 'size': 13,
    })
    g.shockRing(t.x, t.y, r, '#ffe08a', 0.55)


def _abi_warlock(g, t):
    r = t.range * 1.3
    for e in g.enemies:
        if not e.alive:
            continue
        dx = e.x - t.x
        dy = e.y - t.y
        if dx * dx + dy * dy <= r * r:
            e.takeDamage(t.damage * 2.2 * g.weatherMult('void'), 'void', t)
            if e.alive:
                e.hex = {'mult': t.hex['mult'] if t.hex else 1.4, 't': 5}
    for _j in range(16):
        a = random.random() * 6.28
        rr = random.random() * r * 0.8
        g.particles.append({
            'x': t.x + math.cos(a) * rr, 'y': t.y + math.sin(a) * rr,
            'vx': 0, 'vy': -24 - random.random() * 24,
            'life': 0.7, 'max': 0.7, 'color': '#b08aff',
            'size': 3, 'grav': -16,
        })
    g.shockRing(t.x, t.y, r, '#b08aff', 0.5)


def _abi_barracks(g, t):
    for s in g.soldiers:
        if s.tower is t:
            s.hp = s.hpMax
            s.alive = True
            s.respawnTimer = 0
            g.burst(s.x, s.y, '#ffe08a', 6)
    g.shockRing(t.x, t.y, t.range, '#ffe08a', 0.5)


ABILITY_FX = {
    'archer': _abi_archer, 'fire': _abi_fire, 'ice': _abi_ice,
    'dwarf': _abi_dwarf, 'crossbow': _abi_crossbow, 'venom': _abi_venom,
    'druid': _abi_druid, 'tesla': _abi_tesla, 'knight': _abi_knight,
    'sniper': _abi_sniper, 'holy': _abi_holy, 'banner': _abi_banner,
    'warlock': _abi_warlock, 'barracks': _abi_barracks,
}


class Tower:
    def __init__(self, col, row, type_, game):
        self.col = col
        self.row = row
        self.type = type_
        self.game = game
        self.x = (col + 0.5) * CONFIG['CELL']
        self.y = (row + 0.5) * CONFIG['CELL']
        self.def_ = TOWERS[type_]
        self.name = self.def_['name']
        self.icon = self.def_['icon']
        self.level = 0
        self.element = self.def_['element']
        self.range = self.def_['range']
        self.damage = self.def_['damage']
        self.rate = self.def_['rate']
        self.canHitFlying = self.def_.get('canHitFlying', True) is not False
        self.targetCap = self.def_.get('targetCap', 1)
        self.pierce = self.def_.get('pierce', 0)
        self.aoe = self.def_.get('aoe', 0)
        self.rootDur = self.def_.get('rootDur', 1.0)
        self.aura = 1
        self.rateAura = 1
        self.dmgAmp = 1
        self.chains = self.def_.get('chains', 0)
        self.poison = self.def_.get('poison', None)
        self.hex = self.def_.get('hex', None)
        self.ignoreArmor = bool(self.def_.get('ignoreArmor', False))
        self.cooldown = random.random() * 0.3
        self.angle = -math.pi / 2
        self.flash = 0
        self.kills = 0
        self.totalDamage = 0
        self.totalSpent = self.def_['cost']
        self.stun = 0
        self.buffed = 1
        self.novaCd = 4
        self.rootTimer = 2
        self.hpMax = 100
        self.hp = 100
        self.burnT = 0
        self.recoil = 0
        self.windup = 0
        self.aim = random.random() * 6.28
        self.abilityCd = 0
        self.tempMul = 1
        self.tempMulT = 0
        self.purge = self.def_.get('purge', 0)

    _ATTACK_SOUNDS = {
        'archer': 'tower_attack_archer', 'crossbow': 'tower_attack_crossbow',
        'sniper': 'tower_attack_sniper', 'fire': 'tower_attack_fire',
        'ice': 'tower_attack_ice', 'dwarf': 'tower_attack_dwarf',
        'venom': 'tower_attack_venom', 'tesla': 'tower_attack_tesla',
        'knight': 'tower_attack_knight', 'holy': 'tower_attack_holy',
        'druid': 'tower_attack_druid', 'banner': 'tower_attack_banner',
        'warlock': 'tower_attack_warlock',
    }

    def fireFX(self, game, tipDist=None):
        self.recoil = 1
        snd_name = self._ATTACK_SOUNDS.get(self.type)
        if snd_name:
            snd = getattr(AUDIO.sfx, snd_name)()
            AUDIO.play_sfx(snd, 0.4)
        d = tipDist or 18
        tx = self.x + math.cos(self.angle) * d
        ty = self.y - 6 + math.sin(self.angle) * d
        for i in range(4):
            a = self.angle + (random.random() - 0.5) * 0.9
            sp = 70 + random.random() * 70
            game.particles.append({
                'x': tx, 'y': ty,
                'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp - 10,
                'life': 0.12 + random.random() * 0.1, 'max': 0.22,
                'color': '#ffd24a' if i % 2 else '#fff6c8',
                'size': 3 + random.random() * 2, 'grav': 0,
            })
        game.particles.append({
            'x': tx, 'y': ty,
            'vx': (random.random() - 0.5) * 14, 'vy': -26 - random.random() * 14,
            'life': 0.5 + random.random() * 0.3, 'max': 0.8,
            'color': '#8a8a96', 'size': 2.4 + random.random() * 1.8, 'grav': -26,
        })

    @property
    def upgrade(self):
        if self.level >= CONFIG['MAX_LEVEL']:
            return None
        return self.def_['upgrades'][self.level]

    def upgradeCost(self):
        u = self.upgrade
        return u['cost'] if u else None

    def applyUpgrade(self):
        u = self.upgrade
        if not u:
            return False
        self.level += 1
        if 'damage' in u:
            self.damage = u['damage']
        if 'rate' in u:
            self.rate = u['rate']
        if 'range' in u:
            self.range = u['range']
        if 'targetCap' in u:
            self.targetCap = u['targetCap']
        if 'pierce' in u:
            self.pierce = u['pierce']
        if 'aoe' in u:
            self.aoe = u['aoe']
        if 'rootDur' in u:
            self.rootDur = u['rootDur']
        if 'aura' in u:
            self.aura = u['aura']
        if 'rateAura' in u:
            self.rateAura = u['rateAura']
        if 'poison' in u:
            self.poison = u['poison']
        if 'chains' in u:
            self.chains = u['chains']
        if 'hex' in u:
            self.hex = u['hex']
        if u.get('ignoreArmor'):
            self.ignoreArmor = True
        if 'purge' in u:
            self.purge = u['purge']
        if self.type == 'barracks':
            self._soldiers_spawned = False
            old_soldiers = [s for s in self.game.soldiers if s.tower is not self]
            self.game.soldiers = old_soldiers
        self.totalSpent += u['cost']
        self.flash = 0.5
        return True

    def sellValue(self):
        return round(self.totalSpent * CONFIG['SELL_RATIO'])

    def repairCost(self):
        if self.hp >= self.hpMax:
            return 0
        missing = self.hpMax - self.hp
        return max(5, round(missing * 0.25))

    def repair(self):
        cost = self.repairCost()
        if cost <= 0:
            return
        if self.game.gold < cost:
            return
        self.game.gold -= cost
        self.hp = self.hpMax
        self.burnT = 0

    def takeDamage(self, dmg, source=None):
        self.hp -= dmg
        self.flash = max(self.flash, 0.25)
        if self.hp <= 0:
            self.hp = 0
            self.game.destroyTower(self)

    def update(self, dt, game):
        if self.stun > 0:
            self.stun -= dt
            self.flash = max(self.flash, 0.3)
            return
        if self.flash > 0:
            self.flash -= dt
        if self.recoil > 0:
            self.recoil = max(0, self.recoil - dt * 4)
        aimT = game.findTarget(self)
        want = -math.pi / 2
        if aimT:
            adx = aimT.x - self.x
            ady = aimT.y - self.y
            dist = math.sqrt(adx * adx + ady * ady)
            ps = PROJ_SPEED.get(self.type, 0)
            leadT = (dist / ps) if (ps > 0 and aimT.speed > 0) else 0
            want = math.atan2(
                aimT.y + math.cos(aimT.angle) * aimT.speed * leadT - self.y,
                aimT.x + math.sin(aimT.angle) * aimT.speed * leadT - self.x,
            )
        self.aim = turn_toward(self.aim, want, dt * (7 + self.level * 1.5))
        if self.abilityCd > 0:
            self.abilityCd -= dt
        if self.tempMulT > 0:
            self.tempMulT -= dt
            if self.tempMulT <= 0:
                self.tempMul = 1
        if self.burnT > 0:
            self.burnT -= dt
            self.takeDamage(1.5 * dt, 'burn')
            if self.hp <= 0:
                return
        self.cooldown -= dt * self.buffed * (self.rateAura or 1)
        if self.type == 'ice':
            self.novaCd -= dt
        self.windup = self.cooldown > 0 and max(0, min(1, 1 - self.cooldown / (self.rate or 1))) or 0
        fn = {
            'archer': self._actArcher,
            'fire': self._actFire,
            'ice': self._actIce,
            'venom': self._actVenom,
            'dwarf': self._actDwarf,
            'crossbow': self._actCrossbow,
            'druid': self._actDruid,
            'tesla': self._actTesla,
            'knight': self._actKnight,
            'sniper': self._actSniper,
            'holy': self._actHoly,
            'banner': self._actBanner,
            'warlock': self._actWarlock,
            'barracks': self._actBarracks,
        }.get(self.type)
        if fn:
            baseDmg = self.damage
            self.damage = self.damage * (self.dmgAmp or 1) * (self.tempMul or 1)
            fn(dt, game)
            self.damage = baseDmg

    def useAbility(self, game):
        ab = self.def_.get('ability')
        if not ab:
            return False
        if self.abilityCd > 0:
            return False
        fx = ABILITY_FX.get(self.type)
        if not fx:
            return False
        fx(game, self)
        self.abilityCd = ab['cd']
        self.flash = max(self.flash, 0.3)
        AUDIO.play_sfx(AUDIO.sfx.ability_generic(), 0.6)
        return True

    def _actHoly(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.15
        self.fireFX(game, 16)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 380, 'damage': self.damage, 'element': 'nature',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': 'holy',
            'opts': {'purge': self.purge or 4},
        }))

    def _actArcher(self, dt, game):
        if self.cooldown > 0:
            return
        targets = game.findTargets(self, self.targetCap)
        if not targets:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(targets[0].y - self.y, targets[0].x - self.x)
        self.flash = 0.12
        self.fireFX(game, 17)
        for tgt in targets:
            game.projectiles.append(Projectile(self.x, self.y, tgt, {
                'speed': 430, 'damage': self.damage, 'element': self.element,
                'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
                'opts': {'pierce': self.pierce, 'aoe': self.aoe},
            }))

    def _actFire(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.2
        self.fireFX(game, 14)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 280, 'damage': self.damage, 'element': 'fire',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'aoe': self.aoe, 'burn': True},
        }))

    def _actIce(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.15
        self.fireFX(game, 15)
        slow = 0.35 + self.level * 0.12
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 400, 'damage': self.damage, 'element': 'ice',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'slow': slow, 'slowDur': 2},
        }))
        if self.novaCd <= 0:
            self.novaCd = 5 - self.level
            game.frostNova(self.x, self.y, self.range * 0.65, 0.5 - self.level * 0.05, 2.5)

    def _actDwarf(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.25
        self.fireFX(game, 22)
        tt = max(0.3, math.hypot(t.x - self.x, t.y - self.y) / 260)
        fut = game.futurePos(t, tt)
        game.projectiles.append(Projectile(self.x, self.y, None, {
            'speed': 260, 'damage': self.damage, 'element': 'earth',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'tx': fut['x'], 'ty': fut['y'],
            'opts': {'aoe': self.aoe, 'needGround': True, 'kb': 26},
        }))

    def _actCrossbow(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.2
        self.fireFX(game, 20)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 620, 'damage': self.damage, 'element': 'physical',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'pierce': self.pierce},
        }))

    def _actDruid(self, dt, game):
        self.rootTimer -= dt
        if self.rootTimer > 0:
            return
        self.rootTimer = 2.6 - self.level * 0.3
        rooted = False
        for e in game.enemies:
            if not e.alive or e.flying:
                continue
            dx = e.x - self.x
            dy = e.y - self.y
            if dx * dx + dy * dy <= self.range * self.range:
                e.freeze = {'t': max(e.freeze['t'] if e.freeze else 0, self.rootDur)}
                rooted = True
        if rooted:
            self.flash = 0.3
            game.greenBurst(self.x, self.y, self.range)
        for tt in game.towers:
            if tt is self:
                continue
            d2 = (tt.x - self.x) * (tt.x - self.x) + (tt.y - self.y) * (tt.y - self.y)
            if d2 <= self.range * self.range and tt.stun > 0:
                tt.stun = 0

    def _actKnight(self, dt, game):
        if self.cooldown > 0:
            self.angle += dt * 2
            return
        best = None
        bestD = -1
        for e in game.enemies:
            if not e.alive or e.flying:
                continue
            dx = e.x - self.x
            dy = e.y - self.y
            if dx * dx + dy * dy <= self.range * self.range and e.pathPos > bestD:
                best = e
                bestD = e.pathPos
        if not best:
            self.angle += dt * 2
            return
        self.cooldown = self.rate
        self.angle = math.atan2(best.y - self.y, best.x - self.x)
        self.flash = 0.2
        self.recoil = 0.8
        best.takeDamage(self.damage * game.weatherMult('physical'), 'physical', self)
        if best.alive:
            best.pathPos = max(0, best.pathPos - 6)
            if self.level >= 2:
                best.slow = {'mult': 0.7, 't': 0.8}
            if self.level >= 3:
                best.freeze = {'t': max(best.freeze['t'] if best.freeze else 0, 0.3)}

    def _actVenom(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.15
        self.fireFX(game, 13)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 320, 'damage': self.damage, 'element': 'nature',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'poison': self.poison, 'aoe': self.aoe},
        }))

    def _actTesla(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.2
        hit = []
        cx, cy = t.x, t.y
        t.takeDamage(self.damage * game.weatherMult('lightning'), 'lightning', self)
        if t.alive:
            t.slow = {'mult': 0.75, 't': 1.2}
        hit.append(t)
        game.lightningBolt(self.x, self.y - 6, t.x, t.y, '#8ad4ff', 0.16)
        for c in range(self.chains):
            if len(hit) >= 8:
                break
            next_ = None
            nextD = float('inf')
            for e in game.enemies:
                if not e.alive or e in hit:
                    continue
                dx = e.x - cx
                dy = e.y - cy
                d = dx * dx + dy * dy
                if d < nextD and d <= 90 * 90:
                    nextD = d
                    next_ = e
            if not next_:
                break
            chainDmg = self.damage * (1 - c * 0.15) * game.weatherMult('lightning')
            next_.takeDamage(chainDmg, 'lightning', self)
            if next_.alive:
                next_.slow = {'mult': 0.75, 't': 1.2}
            hit.append(next_)
            game.lightningBolt(cx, cy, next_.x, next_.y, '#b8e4ff', 0.16)
            cx, cy = next_.x, next_.y

    def _actSniper(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.25
        self.recoil = 1
        self.fireFX(game, 26)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 780, 'damage': self.damage, 'element': 'physical',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'pierce': self.pierce, 'ignoreArmor': self.ignoreArmor},
        }))

    def _actBanner(self, dt, game):
        self.angle += dt * 0.5
        g = 0.5 + 0.5 * math.sin(game.time * 4)
        if random.random() < 0.15:
            game.particles.append({
                'x': self.x, 'y': self.y - 16,
                'vx': (random.random() - 0.5) * 10,
                'vy': -14 - random.random() * 10,
                'life': 0.5, 'max': 0.5, 'color': '#ffe08a', 'size': 2, 'grav': 0,
            })
        if g > 0.96:
            self.flash = max(self.flash, 0.1)

    def _actWarlock(self, dt, game):
        if self.cooldown > 0:
            return
        t = game.findTarget(self)
        if not t:
            return
        self.cooldown = self.rate
        self.angle = math.atan2(t.y - self.y, t.x - self.x)
        self.flash = 0.2
        self.fireFX(game, 14)
        game.projectiles.append(Projectile(self.x, self.y, t, {
            'speed': 340, 'damage': self.damage, 'element': 'void',
            'tower': self, 'projColor': self.def_['projColor'], 'visual': self.def_['visual'],
            'opts': {'hex': self.hex, 'aoe': self.aoe},
        }))

    def _actBarracks(self, dt, game):
        if not hasattr(self, '_soldiers_spawned'):
            self._soldiers_spawned = False
        if not self._soldiers_spawned:
            self._soldiers_spawned = True
            self._spawnSoldiers(game)

    def _spawnSoldiers(self, game):
        CELL = CONFIG['CELL']
        path = game.map['path']
        path_cells = set()
        for i in range(1, len(path)):
            a, b = path[i - 1], path[i]
            if a[0] == b[0]:
                for r in range(int(min(a[1], b[1])), int(max(a[1], b[1])) + 1):
                    path_cells.add((a[0], r))
            else:
                for c in range(int(min(a[0], b[0])), int(max(a[0], b[0])) + 1):
                    path_cells.add((c, a[1]))
        occupied = {(s.homeX, s.homeY) for s in game.soldiers}
        upg = self.def_.get('upgrades', [])
        soldier_specs = dict(self.def_.get('soldiers', {}))
        types_to_spawn = ['swordsman']
        if self.level >= 1 and upg:
            u = upg[0]
            if 'soldiers' in u:
                soldier_specs.update(u['soldiers'])
        if self.level >= 2 and upg:
            u = upg[1]
            if 'soldiers' in u:
                soldier_specs.update(u['soldiers'])
            types_to_spawn.append('archer')
        if self.level >= 3 and upg:
            u = upg[2]
            if 'soldiers' in u:
                soldier_specs.update(u['soldiers'])
            types_to_spawn = ['swordsman', 'archer', 'shieldbearer', 'mage']
        for stype in types_to_spawn:
            stats = soldier_specs.get(stype, soldier_specs.get('swordsman', {}))
            best_cell = None
            best_dist = float('inf')
            for pc in path_cells:
                px = (pc[0] + 0.5) * CELL
                py = (pc[1] + 0.5) * CELL
                if (px, py) in occupied:
                    continue
                dx = px - self.x
                dy = py - self.y
                d = dx * dx + dy * dy
                if d < best_dist:
                    best_dist = d
                    best_cell = (px, py)
            if best_cell:
                occupied.add(best_cell)
                game.soldiers.append(
                    AlliedSoldier(best_cell[0], best_cell[1], stype, stats, self))

    def respawnSoldiers(self, game):
        for s in list(game.soldiers):
            if s.tower is self:
                s.alive = True
                s.hp = s.hpMax
                s.respawnTimer = 0

    def draw(self, ctx, game):
        isStun = self.stun > 0
        lv = self.level
        ap = 0.5 + 0.5 * math.sin(game.time * 2.5)
        ctx.save()
        ctx.translate(self.x, self.y)
        ctx.translate(0, math.sin(game.time * 1.8 + self.x * 0.06 + self.y * 0.04) * 0.6)
        if isStun:
            t = game.time
            for s in range(3):
                ctx.globalAlpha = 0.5 - s * 0.12
                ctx.fillStyle = '#555'
                ctx.beginPath()
                ctx.arc(((s * 7 + t * 30) % 22) - 11, -14 - ((t * 22 + s * 9) % 14), 3, 0, 6.28)
                ctx.fill()
            ctx.globalAlpha = 1
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(0, 13, 20 + lv * 1.5, 5.5 + lv * 0.3, 0, 0, 6.28)
        ctx.fill()
        ctx.restore()
        ctx.save()
        glowA = 0.1 + lv * 0.05 + ap * (0.04 + lv * 0.01)
        ctx.globalAlpha = glowA * 0.6
        ctx.fillStyle = self.def_['color']
        ctx.beginPath()
        ctx.arc(0, -2, 22 + lv * 4 + ap * 3, 0, 6.28)
        ctx.fill()
        ctx.globalAlpha = glowA * 0.3
        ctx.beginPath()
        ctx.arc(0, -2, 30 + lv * 6 + ap * 4, 0, 6.28)
        ctx.fill()
        ctx.restore()
        bg = ctx.createLinearGradient(-21, 9, 21, 18)
        bg.addColorStop(0, '#7a746c')
        bg.addColorStop(0.25, '#6a645c')
        bg.addColorStop(0.5, '#5a5650')
        bg.addColorStop(0.75, '#4a4640')
        bg.addColorStop(1, '#3e3a34')
        ctx.fillStyle = bg
        ctx.beginPath()
        _roundRect(ctx, -21, 9, 42, 7, 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(-21, 13.5, 42, 1.4)
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.fillRect(-21, 15, 42, 1)
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(-21, 9, 5, 7)
        ctx.fillRect(16, 9, 5, 7)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(-21, 9, 42, 1.5)
        for rb in range(5):
            bx = -19 + rb * 8
            ctx.fillStyle = 'rgba(0,0,0,0.12)'
            ctx.fillRect(bx, 9, 1, 7)
        bm = ctx.createLinearGradient(-21, 5, 21, 10)
        bm.addColorStop(0, '#8a8278')
        bm.addColorStop(0.5, '#7a746c')
        bm.addColorStop(1, '#6a645c')
        ctx.fillStyle = bm
        ctx.beginPath()
        _roundRect(ctx, -21, 5, 42, 5, 1)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(-21, 5, 42, 1.2)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(-21, 8.8, 42, 0.8)
        for rv in range(4):
            ctx.fillStyle = 'rgba(0,0,0,0.1)'
            ctx.fillRect(-21 + rv * 11, 5, 1, 5)
        trm = ctx.createLinearGradient(0, -13, 0, -8)
        trm.addColorStop(0, '#9a9288')
        trm.addColorStop(0.5, '#8a8278')
        trm.addColorStop(1, '#7a746c')
        ctx.fillStyle = trm
        ctx.beginPath()
        _roundRect(ctx, -17, -11, 34, 4, 1)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(-17, -11, 34, 1.2)
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(-17, -7.8, 34, 0.6)
        for rn in range(4):
            nx = -12 + rn * 8
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.beginPath()
            ctx.arc(nx + 0.5, -9 + 0.5, 1.4, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = '#b0a898'
            ctx.beginPath()
            ctx.arc(nx, -9, 1.4, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,255,255,0.4)'
            ctx.beginPath()
            ctx.arc(nx - 0.4, -9.6, 0.5, 0, 6.28)
            ctx.fill()
        self._body(ctx, game)
        bodyH = 27 + lv * 4
        hw = 16 + lv * 2
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath()
        _roundRect(ctx, -hw - 1, -13, (hw + 1) * 2, 3, 1)
        ctx.fill()
        if lv >= 2:
            for r3 in range(lv + 1):
                ra = game.time * 1.2 + r3 * (6.28 / (lv + 1))
                rdist = hw + 5 + math.sin(game.time * 2 + r3) * 2
                px = math.cos(ra) * rdist
                py = -8 + math.sin(ra) * 4
                ctx.fillStyle = 'rgba(0,0,0,0.2)'
                ctx.beginPath()
                ctx.arc(px + 0.5, py + 0.5, 2, 0, 6.28)
                ctx.fill()
                ctx.fillStyle = 'rgba(242,200,106,0.9)'
                ctx.beginPath()
                ctx.arc(px, py, 2, 0, 6.28)
                ctx.fill()
                ctx.fillStyle = 'rgba(255,255,220,0.6)'
                ctx.beginPath()
                ctx.arc(px - 0.4, py - 0.5, 0.7, 0, 6.28)
                ctx.fill()
        if lv >= 3:
            ctx.save()
            ctx.globalAlpha = 0.18
            ctx.translate(0, -5)
            ctx.rotate(game.time * 0.35)
            for ray in range(6):
                ctx.fillStyle = self.def_['color']
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(10, -3)
                ctx.lineTo(28, 0)
                ctx.lineTo(10, 3)
                ctx.closePath()
                ctx.fill()
                ctx.rotate(1.0472)
            ctx.restore()
            ctx.save()
            ctx.globalAlpha = 0.1 + ap * 0.08
            ctx.translate(0, -5)
            ctx.rotate(-game.time * 0.2)
            for ray in range(4):
                ctx.fillStyle = 'rgba(255,255,255,0.6)'
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(7, -2)
                ctx.lineTo(20, 0)
                ctx.lineTo(7, 2)
                ctx.closePath()
                ctx.fill()
                ctx.rotate(1.5708)
            ctx.restore()
        ebg = ctx.createRadialGradient(0, -9, 1, 0, -9, 12)
        ebg.addColorStop(0, 'rgba(0,0,0,0.45)')
        ebg.addColorStop(0.7, 'rgba(0,0,0,0.25)')
        ebg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = ebg
        ctx.beginPath()
        _roundRect(ctx, -10, -13, 20, 12, 3)
        ctx.fill()
        ctx.fillStyle = self.def_['color']
        ctx.beginPath()
        ctx.arc(0, -7, 4, 0, 6.28)
        ctx.fill()
        eg = ctx.createRadialGradient(0, -7, 0.5, 0, -7, 4)
        eg.addColorStop(0, 'rgba(255,255,255,0.5)')
        eg.addColorStop(0.5, self.def_['color'])
        eg.addColorStop(1, 'rgba(0,0,0,0.2)')
        ctx.fillStyle = eg
        ctx.beginPath()
        ctx.arc(0, -7, 4, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        _drawText(ctx, self.def_['icon'], 0, -6.5, 7, 'center', 'middle', 'rgba(255,255,255,0.85)')
        if lv >= 2:
            ctx.globalAlpha = 0.4 + 0.35 * ap
            ctx.fillStyle = self.def_['color']
            ctx.beginPath()
            ctx.arc(0, -7, 7 + ap * 2, 0, 6.28)
            ctx.fill()
            ctx.globalAlpha = 1
        drawFn = {
            'archer': self._drawArcher,
            'fire': self._drawFire,
            'ice': self._drawIce,
            'venom': self._drawVenom,
            'dwarf': self._drawDwarf,
            'crossbow': self._drawCrossbow,
            'druid': self._drawDruid,
            'tesla': self._drawTesla,
            'knight': self._drawKnight,
            'sniper': self._drawSniper,
            'holy': self._drawHoly,
            'banner': self._drawBanner,
            'warlock': self._drawWarlock,
        }.get(self.type)
        if drawFn:
            ws = 1 + lv * 0.14
            ctx.save()
            ctx.scale(ws, ws)
            drawFn(ctx, game)
            ctx.restore()
        for i in range(self.level):
            px2 = -13 + i * 6
            ctx.fillStyle = 'rgba(0,0,0,0.5)'
            ctx.beginPath()
            ctx.arc(px2 + 0.6, 13.6, 2.1, 0, 6.28)
            ctx.fill()
            pip_col = ['#f2c86a', '#7fe8a0', '#7fb4ff'][i] if i < 3 else '#f2c86a'
            ctx.fillStyle = pip_col
            ctx.beginPath()
            ctx.arc(px2, 13, 2.1, 0, 6.28)
            ctx.fill()
            pip_g = ctx.createRadialGradient(px2 - 0.5, 12.4, 0.3, px2, 13, 2.1)
            pip_g.addColorStop(0, 'rgba(255,255,255,0.75)')
            pip_g.addColorStop(0.5, 'rgba(255,255,255,0.2)')
            pip_g.addColorStop(1, 'rgba(0,0,0,0.15)')
            ctx.fillStyle = pip_g
            ctx.beginPath()
            ctx.arc(px2, 13, 2.1, 0, 6.28)
            ctx.fill()
        if self.flash > 0:
            ctx.strokeStyle = 'rgba(255,255,255,' + str(self.flash * 2) + ')'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(-hw - 1, -13)
            ctx.lineTo(hw + 1, -13)
            ctx.lineTo(hw + 1, -13 + bodyH + 1)
            ctx.lineTo(-hw - 1, -13 + bodyH + 1)
            ctx.closePath()
            ctx.stroke()
        pct = self.hp / self.hpMax
        if pct < 1:
            barW = 32
            barX = -barW // 2
            barY = 17
            ctx.fillStyle = 'rgba(0,0,0,0.7)'
            ctx.beginPath()
            _roundRect(ctx, barX - 1, barY - 1, barW + 2, 5, 2)
            ctx.fill()
            hp_col = '#5ad45a' if pct > 0.5 else ('#e8d24a' if pct > 0.25 else '#e05050')
            ctx.fillStyle = hp_col
            ctx.beginPath()
            _roundRect(ctx, barX, barY, max(1, int(barW * pct)), 3, 1.5)
            ctx.fill()
            hp_g = ctx.createLinearGradient(0, barY, 0, barY + 3)
            hp_g.addColorStop(0, 'rgba(255,255,255,0.25)')
            hp_g.addColorStop(1, 'rgba(0,0,0,0.15)')
            ctx.fillStyle = hp_g
            ctx.beginPath()
            _roundRect(ctx, barX, barY, max(1, int(barW * pct)), 3, 1.5)
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            _roundRect(ctx, barX - 0.5, barY - 0.5, barW + 1, 4, 2)
            ctx.stroke()
        if pct < 0.5:
            ctx.strokeStyle = 'rgba(30,30,30,0.7)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(-10, -6)
            ctx.lineTo(2, 4)
            ctx.lineTo(10, -2)
            ctx.moveTo(-4, 8)
            ctx.lineTo(6, 2)
            ctx.stroke()
        if pct < 0.25:
            ctx.strokeStyle = 'rgba(20,20,20,0.85)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(-8, 10)
            ctx.lineTo(4, -8)
            ctx.lineTo(12, -4)
            ctx.moveTo(-12, -4)
            ctx.lineTo(0, 2)
            ctx.stroke()
        if self.burnT > 0 or (self.type == 'fire' and game.time % 0.1 < 0.05):
            fl = 0.6 + 0.4 * math.sin(game.time * 10)
            ctx.fillStyle = 'rgba(255,100,20,' + str(0.4 + fl * 0.5) + ')'
            for fi in range(3):
                fa = game.time * 5 + fi * 2.09
                fx = math.sin(fa) * 3
                fy = -18 - fl * 3 - fi * 2
                fs = 3 - fi * 0.8
                ctx.beginPath()
                ctx.moveTo(fx, fy)
                ctx.lineTo(fx - fs, -13)
                ctx.lineTo(fx + fs, -13)
                ctx.closePath()
                ctx.fill()
            ctx.fillStyle = 'rgba(255,220,120,' + str(fl) + ')'
            ctx.beginPath()
            ctx.arc(0, -15, 2.5, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,255,200,' + str(fl * 0.6) + ')'
            ctx.beginPath()
            ctx.arc(0, -15, 1.2, 0, 6.28)
            ctx.fill()
        ctx.restore()

    def _body(self, ctx, game):
        t = self.type
        if t in ('archer', 'crossbow', 'venom', 'banner'):
            self._bodyWood(ctx, game, t)
        elif t in ('fire', 'ice', 'dwarf', 'knight', 'sniper', 'holy'):
            self._bodyStone(ctx, game, t)
        elif t == 'druid':
            self._bodyLiving(ctx, game)
        elif t == 'tesla':
            self._bodyCrystal(ctx, game)
        elif t == 'warlock':
            self._bodyVoid(ctx, game)

    def _bodyWood(self, ctx, game, t):
        w = '#6a4a2a'
        wd = '#4a3018'
        dl = '#8a6434'
        wh = '#7a5a34'
        raised = t == 'crossbow'
        top = -23 - (8 if raised else 0)
        ctx.fillStyle = wd
        ctx.fillRect(-14.5, -13, 4.5, 29)
        ctx.fillRect(10, -13, 4.5, 29)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(-14.5, -13, 1.2, 29)
        ctx.fillRect(13.3, -13, 1.2, 29)
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'
        ctx.lineWidth = 0.8
        for wg in range(4):
            wy = -10 + wg * 7
            ctx.beginPath()
            ctx.moveTo(-10, wy)
            ctx.lineTo(10, wy)
            ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,0.32)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-12, -12)
        ctx.lineTo(12, 5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(12, -12)
        ctx.lineTo(-12, 5)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(90,60,30,0.18)'
        ctx.lineWidth = 0.6
        for gv in range(3):
            gx = -7 + gv * 7
            for gy_i in range(5):
                gy = -12 + gy_i * 5.5
                waveOff = math.sin(gy * 0.5 + gv * 2.1) * 1.5
                ctx.beginPath()
                ctx.moveTo(gx + waveOff, gy)
                ctx.quadraticCurveTo(gx + waveOff + 1.2, gy + 2.5, gx + waveOff - 0.6, gy + 5)
                ctx.stroke()
        ctx.strokeStyle = 'rgba(50,30,15,0.2)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(-6, -4, 2.2, 0, TWO_PI)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(5, 2, 1.6, 0, TWO_PI)
        ctx.stroke()
        ctx.fillStyle = w
        ctx.beginPath()
        _roundRect(ctx, -16, top, 32, 5, 1.5)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(-16, top, 32, 1.2)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(-16, top + 4, 32, 1)
        ctx.strokeStyle = 'rgba(90,60,30,0.15)'
        ctx.lineWidth = 0.5
        for gg in range(-14, 15, 3):
            gwave = math.sin(gg * 0.8) * 0.7
            ctx.beginPath()
            ctx.moveTo(gg, top + gwave)
            ctx.lineTo(gg, top + 5 + gwave * 0.5)
            ctx.stroke()
        ctx.fillStyle = dl
        ctx.fillRect(-16, top - 6, 32, 7)
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(-16, top - 0.5, 32, 1)
        ctx.strokeStyle = 'rgba(255,220,160,0.1)'
        ctx.lineWidth = 0.6
        for dg in range(-14, 15, 4):
            dwa = math.sin(dg * 0.6 + 1.3) * 0.8
            ctx.beginPath()
            ctx.moveTo(dg, top - 6 + dwa)
            ctx.lineTo(dg, top + 1 + dwa)
            ctx.stroke()
        for mb in range(-1, 2):
            ctx.fillStyle = dl
            ctx.fillRect(mb * 8 - 2.5, top - 9, 5, 9)
            ctx.fillStyle = 'rgba(255,255,255,0.14)'
            ctx.fillRect(mb * 8 - 2.5, top - 9, 5, 1.2)
            ctx.fillStyle = 'rgba(0,0,0,0.12)'
            ctx.fillRect(mb * 8 - 2.5, top + 7, 5, 1)
            npx = mb * 8
            ctx.fillStyle = 'rgba(0,0,0,0.3)'
            ctx.beginPath()
            ctx.arc(npx, top - 8.5, 0.8, 0, TWO_PI)
            ctx.fill()
            ctx.fillStyle = '#9a8a70'
            ctx.beginPath()
            ctx.arc(npx - 0.15, top - 8.8, 0.7, 0, TWO_PI)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,255,255,0.35)'
            ctx.beginPath()
            ctx.arc(npx - 0.25, top - 9.1, 0.25, 0, TWO_PI)
            ctx.fill()
        ctx.fillStyle = dl
        ctx.fillRect(-14, -5, 28, 2.8)
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(-14, -2.5, 28, 0.8)
        ctx.strokeStyle = 'rgba(90,60,30,0.12)'
        ctx.lineWidth = 0.5
        for gv2 in range(-12, 13, 4):
            wv = math.sin(gv2 * 0.7 + 3.2) * 0.6
            ctx.beginPath()
            ctx.moveTo(gv2, -5 + wv)
            ctx.lineTo(gv2 + wv * 0.5, -2.5 + wv)
            ctx.stroke()
        ctx.fillStyle = wd
        ctx.fillRect(-2.6, top + 2, 5.2, 15)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(-2.6, top + 2, 1.2, 15)
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(-1.5, top + 5)
        ctx.lineTo(-1.5, top + 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(1.2, top + 4)
        ctx.lineTo(1.2, top + 16)
        ctx.stroke()
        ctx.fillStyle = w
        ctx.beginPath()
        _roundRect(ctx, -16, 3, 32, 8, 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.fillRect(-16, 3.5, 32, 1)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(-16, 3, 32, 1.5)
        ctx.fillStyle = '#1c1208'
        ctx.beginPath()
        _roundRect(ctx, -16, 3.5, 2, 2, 1)
        ctx.fill()
        ctx.beginPath()
        _roundRect(ctx, 14, 3.5, 2, 2, 1)
        ctx.fill()
        ctx.fillStyle = 'rgba(50,30,15,0.12)'
        ctx.fillRect(-8, 3, 1, 8)
        ctx.fillRect(7, 3, 1, 8)
        ctx.fillRect(-1, 3, 1, 8)

    def _bodyStone(self, ctx, game, t):
        holy = t == 'holy'
        light = '#efe9d8' if holy else '#9aa0a8'
        mid = '#d5cdb8' if holy else '#757b84'
        dark = '#a89f8c' if holy else '#4a5058'
        darkest = '#8a8070' if holy else '#3a4048'
        bg = ctx.createLinearGradient(-16, -14, 16, 15)
        bg.addColorStop(0, light)
        bg.addColorStop(0.3, mid)
        bg.addColorStop(0.7, dark)
        bg.addColorStop(1, darkest)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(-16, 15)
        ctx.lineTo(-13, -13)
        ctx.lineTo(13, -13)
        ctx.lineTo(16, 15)
        ctx.closePath()
        ctx.fillStyle = bg
        ctx.fillRect(-19, -19, 38, 36)
        ctx.restore()
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 0.7
        for br in range(4):
            by = -10 + br * 5.5
            ctx.beginPath()
            ctx.moveTo(-14, by)
            ctx.lineTo(14, by)
            ctx.stroke()
        for bc in range(-1, 2):
            ctx.beginPath()
            ctx.moveTo(bc * 8, -13)
            ctx.lineTo(bc * 7, 15)
            ctx.stroke()
        ctx.strokeStyle = 'rgba(200,195,180,0.12)'
        ctx.lineWidth = 0.4
        for cr_row in range(4):
            cy2 = -11 + cr_row * 5.5
            for cr_off in [(-8, 0.3), (2, -0.2), (10, 0.1)]:
                ctx.beginPath()
                ctx.arc(cr_off[0], cy2 + cr_off[1], 0.8, 0, TWO_PI)
                ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'
        ctx.lineWidth = 0.4
        ctx.beginPath()
        ctx.moveTo(-6, -8)
        ctx.lineTo(-4.5, -3)
        ctx.lineTo(-5.5, 4)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(8, -5)
        ctx.lineTo(7, 1)
        ctx.lineTo(8.5, 8)
        ctx.stroke()
        if not holy:
            ctx.fillStyle = 'rgba(80,100,60,0.08)'
            ctx.beginPath()
            ctx.ellipse(-13, 8, 2, 1.2, 0.3, 0, TWO_PI)
            ctx.fill()
            ctx.fillStyle = 'rgba(80,100,60,0.06)'
            ctx.beginPath()
            ctx.ellipse(12, 4, 1.5, 1, -0.2, 0, TWO_PI)
            ctx.fill()
        ctx.fillStyle = dark
        ctx.beginPath()
        _roundRect(ctx, -19, 3, 5, 12, 1)
        ctx.fill()
        ctx.beginPath()
        _roundRect(ctx, 14, 3, 5, 12, 1)
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.arc(0, 2, 4.5, math.pi, 0)
        ctx.lineTo(4.5, 7)
        ctx.lineTo(-4.5, 7)
        ctx.closePath()
        ctx.fill()
        ag = ctx.createLinearGradient(-4, 2, 4, 2)
        ag.addColorStop(0, '#1a1510')
        ag.addColorStop(0.5, '#0c0a08')
        ag.addColorStop(1, '#1a1510')
        ctx.fillStyle = ag
        ctx.beginPath()
        ctx.arc(0, 2, 4.2, math.pi, 0)
        ctx.lineTo(4.2, 6.5)
        ctx.lineTo(-4.2, 6.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(-4.2, 3, 8.4, 0.8)
        ctx.strokeStyle = 'rgba(60,50,40,0.2)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(-4, 2.5)
        ctx.quadraticCurveTo(0, 1.5, 4, 2.5)
        ctx.stroke()
        ctx.fillStyle = mid
        ctx.fillRect(-13, -16, 26, 3.5)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(-13, -16, 26, 1)
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(-13, -13, 26, 0.5)
        for c in range(-1, 2):
            ctx.fillStyle = dark
            ctx.fillRect(c * 8 - 2.2, -19, 4.4, 6.5)
            ctx.fillStyle = light
            ctx.fillRect(c * 8 - 2.2, -19, 4.4, 1)
            ctx.fillStyle = 'rgba(0,0,0,0.1)'
            ctx.fillRect(c * 8 - 2.2, -13, 4.4, 0.5)
            ctx.fillStyle = 'rgba(255,255,255,0.06)'
            ctx.fillRect(c * 8 - 2.2, -19, 1, 6.5)
        if t == 'fire':
            gl = 0.5 + 0.5 * math.sin(game.time * 8)
            ctx.fillStyle = '#1a1008'
            ctx.beginPath()
            ctx.arc(0, -1, 5.5, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,120,30,' + str(0.4 + gl * 0.5) + ')'
            ctx.beginPath()
            ctx.arc(0, -2, 4 + gl * 2, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,220,130,' + str(gl) + ')'
            ctx.beginPath()
            ctx.arc(0, -2.4, 2, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = 'rgba(180,180,180,' + str(0.2 + gl * 0.2) + ')'
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.arc(0, -7 - gl * 2, 2 + gl, 3.4, 5.8)
            ctx.stroke()
        elif t == 'ice':
            ctx.fillStyle = '#bfe8ff'
            ctx.beginPath()
            ctx.moveTo(-5, -13)
            ctx.lineTo(-2, -28)
            ctx.lineTo(1, -13)
            ctx.fill()
            ctx.beginPath()
            ctx.moveTo(1, -13)
            ctx.lineTo(5, -25)
            ctx.lineTo(9, -13)
            ctx.fill()
            ctx.beginPath()
            ctx.moveTo(-10, -13)
            ctx.lineTo(-7, -22)
            ctx.lineTo(-4, -13)
            ctx.fill()
            ctx.fillStyle = '#e8f6ff'
            ctx.beginPath()
            ctx.moveTo(-4, -13)
            ctx.lineTo(-2, -26)
            ctx.lineTo(0, -13)
            ctx.fill()
            ctx.fillStyle = 'rgba(160,220,255,0.35)'
            ctx.beginPath()
            ctx.arc(0, -8, 7, 0, 6.28)
            ctx.fill()
        elif t == 'dwarf':
            ctx.fillStyle = '#5c5448'
            ctx.fillRect(5, -24, 9, 11)
            ctx.fillRect(4, -26.5, 11, 3)
            ctx.fillStyle = 'rgba(0,0,0,0.3)'
            ctx.fillRect(5.5, -22, 8, 1.4)
            ctx.fillStyle = '#c9b26a'
            ctx.beginPath()
            ctx.arc(0, 5, 1, 0, 6.28)
            ctx.fill()
        elif t == 'sniper':
            ctx.fillStyle = '#1a160f'
            ctx.beginPath()
            _roundRect(ctx, -1.6, -9, 3.2, 14, 1.6)
            ctx.fill()
        elif t == 'knight':
            ctx.strokeStyle = '#5a4a2a'
            ctx.lineWidth = 1.6
            ctx.beginPath()
            ctx.moveTo(-10, -17)
            ctx.lineTo(-10, -30)
            ctx.stroke()
            ctx.fillStyle = '#c03030'
            ctx.beginPath()
            ctx.moveTo(-10, -30)
            ctx.lineTo(-3, -27)
            ctx.lineTo(-10, -24)
            ctx.closePath()
            ctx.fill()
            ctx.strokeStyle = '#2e2a26'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(-2, 2)
            ctx.lineTo(-2, 6.5)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(2, 2)
            ctx.lineTo(2, 6.5)
            ctx.stroke()
        elif t == 'holy':
            ctx.fillStyle = 'rgba(232,200,90,0.9)'
            ctx.fillRect(-1, -28, 2, 13)
            ctx.fillRect(-4, -25, 8, 2)
            ctx.strokeStyle = 'rgba(232,200,90,0.5)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(-9, -9)
            ctx.lineTo(9, -9)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(-7, -5)
            ctx.lineTo(7, -5)
            ctx.stroke()

    def _bodyLiving(self, ctx, game):
        bark = '#5a4a34'
        dark = '#3f3323'
        gl = 0.5 + 0.5 * math.sin(game.time * 3)
        ctx.strokeStyle = dark
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-9, 10)
        _quadTo(ctx, -15, 13, -17, 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(9, 10)
        _quadTo(ctx, 15, 13, 17, 15)
        ctx.stroke()
        bg = ctx.createLinearGradient(-12, -13, 12, 14)
        bg.addColorStop(0, bark)
        bg.addColorStop(1, dark)
        ctx.fillStyle = bg
        ctx.beginPath()
        ctx.moveTo(-10, 14)
        _quadTo(ctx, -14, -6, -9, -13)
        ctx.lineTo(9, -13)
        _quadTo(ctx, 14, -6, 10, 14)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-4, -10)
        _quadTo(ctx, -3, 0, -5, 10)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(5, -8)
        _quadTo(ctx, 3, 2, 6, 9)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-1, -9)
        _quadTo(ctx, -1, 1, -2, 9)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(70,50,30,0.14)'
        ctx.lineWidth = 0.6
        for bv in range(-8, 9, 3):
            bv2 = math.sin(bv * 0.7 + 1.5) * 1.2
            ctx.beginPath()
            ctx.moveTo(bv, -12 + bv2)
            ctx.quadraticCurveTo(bv + bv2 * 0.5, -2, bv - bv2 * 0.3, 13)
            ctx.stroke()
        ctx.fillStyle = 'rgba(40,60,20,0.1)'
        ctx.beginPath()
        ctx.ellipse(-3, 4, 2, 1.5, 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(4, -2, 1.5, 1, -0.3, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = bark
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-8, -9)
        _quadTo(ctx, -13, -13, -14, -19)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(8, -9)
        _quadTo(ctx, 13, -13, 14, -19)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(3, -11)
        _quadTo(ctx, 4, -16, 2, -20)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(70,50,30,0.15)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(-10, -11)
        _quadTo(ctx, -12, -15, -13, -18)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(10, -11)
        _quadTo(ctx, 12, -15, 13, -18)
        ctx.stroke()
        ctx.fillStyle = '#5a9a4a'
        ctx.beginPath()
        ctx.arc(-11, -20, 6.5, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(11, -20, 6.5, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(0, -20, 9, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(0, -24, 6, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(-6, -24, 5, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(6, -24, 5, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#4a7a3a'
        ctx.beginPath()
        ctx.arc(0, -25, 6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(80,140,60,0.3)'
        ctx.beginPath()
        ctx.arc(-3, -22, 4, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(4, -21, 3, 0, 6.28)
        ctx.fill()
        ctx.strokeStyle = 'rgba(40,80,25,0.15)'
        ctx.lineWidth = 0.5
        for li in range(3):
            lx = -8 + li * 8
            ly = -20 - li * 2
            ctx.beginPath()
            ctx.moveTo(lx - 2, ly + 1)
            ctx.lineTo(lx + 2, ly - 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(lx + 1, ly + 2)
            ctx.lineTo(lx - 1, ly - 1)
            ctx.stroke()
        ctx.fillStyle = 'rgba(255,180,120,' + str(0.5 + gl * 0.4) + ')'
        ctx.beginPath()
        ctx.arc(-11, -20, 1.8, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(10, -17, 1.8, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(0, -27, 1.8, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,200,' + str(gl * 0.4) + ')'
        ctx.beginPath()
        ctx.arc(-11, -20.5, 0.8, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(0, -27.5, 0.8, 0, 6.28)
        ctx.fill()

    def _bodyCrystal(self, ctx, game):
        gl = 0.5 + 0.5 * math.sin(game.time * 5)
        rg = ctx.createLinearGradient(-17, 2, 17, 15)
        rg.addColorStop(0, '#6a6a78')
        rg.addColorStop(0.5, '#5a5a68')
        rg.addColorStop(1, '#3a3a46')
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.moveTo(-17, 15)
        ctx.lineTo(-13, 4)
        ctx.lineTo(-4, 2)
        ctx.lineTo(4, 2)
        ctx.lineTo(13, 4)
        ctx.lineTo(17, 15)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 0.8
        for cr in range(3):
            cy = 5 + cr * 3.5
            ctx.beginPath()
            ctx.moveTo(-15 + cr, cy)
            ctx.lineTo(15 - cr, cy)
            ctx.stroke()
        ctx.strokeStyle = 'rgba(100,90,120,0.1)'
        ctx.lineWidth = 0.4
        ctx.beginPath()
        ctx.moveTo(-10, 4)
        ctx.lineTo(-8, 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, 2)
        ctx.lineTo(0, 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(10, 4)
        ctx.lineTo(8, 15)
        ctx.stroke()
        g2 = ctx.createLinearGradient(-9, -28, 9, 2)
        g2.addColorStop(0, '#e8d4ff')
        g2.addColorStop(0.3, '#c8a0ff')
        g2.addColorStop(0.6, '#9a6aff')
        g2.addColorStop(1, '#5a2a8a')
        ctx.fillStyle = g2
        ctx.beginPath()
        ctx.moveTo(-8, 2)
        ctx.lineTo(8, 2)
        ctx.lineTo(4, -28)
        ctx.lineTo(-4, -28)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, -28)
        ctx.lineTo(0, 2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(200,180,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(-2.5, -26)
        ctx.lineTo(-1.5, 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(2.5, -26)
        ctx.lineTo(1.5, 2)
        ctx.stroke()
        ctx.fillStyle = '#a87aff'
        ctx.beginPath()
        ctx.moveTo(-14, 4)
        ctx.lineTo(-5, 4)
        ctx.lineTo(-9, -16)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(5, 4)
        ctx.lineTo(14, 4)
        ctx.lineTo(9, -16)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(160,130,220,0.2)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(-10, 4)
        ctx.lineTo(-10.5, -6)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(10, 4)
        ctx.lineTo(10.5, -6)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.beginPath()
        ctx.moveTo(-3, -26)
        ctx.lineTo(-1.5, -10)
        ctx.lineTo(-0.5, -26)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.moveTo(-8, -14)
        ctx.lineTo(-6, 2)
        ctx.lineTo(-5, -14)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath()
        ctx.moveTo(2, -26)
        ctx.lineTo(3.5, -8)
        ctx.lineTo(4, -26)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(180,140,255,0.12)'
        ctx.beginPath()
        ctx.moveTo(7, -14)
        ctx.lineTo(9, 2)
        ctx.lineTo(10, -14)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(200,160,255,' + str(0.3 + gl * 0.35) + ')'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(0, -6, 13 + gl * 3, 0, 6.28)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,' + str(0.15 + gl * 0.2) + ')'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(0, -6, 16 + gl * 2, 0, 6.28)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,' + str(gl) + ')'
        ctx.beginPath()
        ctx.arc(math.sin(game.time * 7) * 10, -6 + math.cos(game.time * 6) * 4, 1.6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(200,160,255,' + str(0.4 + gl * 0.3) + ')'
        for sp in range(3):
            sa = game.time * 2 + sp * 2.09
            ctx.beginPath()
            ctx.arc(math.cos(sa) * 14, -8 + math.sin(sa) * 3, 1.2, 0, 6.28)
            ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,' + str(0.3 + gl * 0.2) + ')'
        for sp2 in range(2):
            sa2 = game.time * 1.5 + sp2 * 3.14 + 0.8
            ctx.beginPath()
            ctx.arc(math.cos(sa2) * 18, -5 + math.sin(sa2) * 6, 0.8, 0, 6.28)
            ctx.fill()

    def _bodyVoid(self, ctx, game):
        gl = 0.5 + 0.5 * math.sin(game.time * 4)
        bg = ctx.createLinearGradient(-13, -14, 13, 15)
        bg.addColorStop(0, '#4a3a6a')
        bg.addColorStop(0.5, '#3a2a5a')
        bg.addColorStop(1, '#150c24')
        ctx.fillStyle = bg
        ctx.beginPath()
        ctx.moveTo(-13, 15)
        ctx.lineTo(-9, -13)
        ctx.lineTo(9, -13)
        ctx.lineTo(13, 15)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(-9, -13, 18, 2.5)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(-9, -8, 18, 1.5)
        ctx.strokeStyle = 'rgba(120,80,200,0.25)'
        ctx.lineWidth = 0.7
        for vr in range(3):
            vy = -8 + vr * 6
            ctx.beginPath()
            ctx.moveTo(-10 + vr, vy)
            ctx.lineTo(10 - vr, vy)
            ctx.stroke()
        ctx.strokeStyle = 'rgba(100,60,180,0.1)'
        ctx.lineWidth = 0.4
        for vs in range(4):
            vsx = -7 + vs * 4.5
            vsb = math.sin(vsx * 0.5 + game.time * 2) * 1.2
            ctx.beginPath()
            ctx.moveTo(vsx, -12 + vsb)
            ctx.quadraticCurveTo(vsx + vsb, -3, vsx - vsb * 0.5, 14)
            ctx.stroke()
        ctx.fillStyle = 'rgba(160,110,255,' + str(0.5 + gl * 0.4) + ')'
        for i in range(3):
            rx = -5 + i * 5
            ctx.beginPath()
            ctx.arc(rx, -4 + (i % 2) * 4, 1.6, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,255,255,' + str(0.3 + gl * 0.2) + ')'
            ctx.beginPath()
            ctx.arc(rx - 0.3, -4.5 + (i % 2) * 4, 0.5, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(160,110,255,' + str(0.5 + gl * 0.4) + ')'
        ctx.fillStyle = 'rgba(120,80,200,0.08)'
        for vr2 in range(2):
            vr2x = -4 + vr2 * 8
            ctx.beginPath()
            ctx.arc(vr2x, 8, 2 + gl * 0.5, 0, TWO_PI)
            ctx.fill()
        vg = ctx.createRadialGradient(0, 4, 1, 0, 4, 6)
        vg.addColorStop(0, '#2a1a4a')
        vg.addColorStop(0.7, '#0e0718')
        vg.addColorStop(1, 'rgba(10,5,20,0.8)')
        ctx.fillStyle = vg
        ctx.beginPath()
        ctx.arc(0, 4, 5, 0, 6.28)
        ctx.fill()
        ctx.strokeStyle = 'rgba(150,110,255,' + str(0.6 + gl * 0.3) + ')'
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.arc(0, 4, 5 + gl, 0, 6.28)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(100,60,180,' + str(0.3 + gl * 0.2) + ')'
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.arc(0, 4, 7 + gl * 1.5, 0, 6.28)
        ctx.stroke()
        ctx.fillStyle = '#b08aff'
        ctx.beginPath()
        ctx.arc(0, 4, 2 + gl * 1.5, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,' + str(0.3 + gl * 0.3) + ')'
        ctx.beginPath()
        ctx.arc(-0.5, 3.5, 0.8, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(180,130,255,' + str(0.4 + gl * 0.4) + ')'
        for p in range(4):
            a = game.time * 1.2 + p * 1.57
            ctx.beginPath()
            ctx.arc(math.cos(a) * 11, -6 + math.sin(a) * 5, 1.6, 0, 6.28)
            ctx.fill()
        ctx.fillStyle = 'rgba(140,100,220,' + str(0.2 + gl * 0.15) + ')'
        for p2 in range(3):
            a2 = game.time * 0.8 + p2 * 2.09 + 1.0
            ctx.beginPath()
            ctx.arc(math.cos(a2) * 16, -4 + math.sin(a2) * 7, 1.0, 0, 6.28)
            ctx.fill()

    def _drawArcher(self, ctx, game):
        rec = self.recoil * 4
        aim = self.aim
        ctx.save()
        ctx.translate(0, -11)
        ctx.fillStyle = '#2a4a2a'
        ctx.fillRect(-2.2, -5, 4.4, 5)
        ctx.beginPath()
        ctx.arc(0, -6.5, 2.6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#f0d8b8'
        ctx.beginPath()
        ctx.arc(0, -6.2, 1.4, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#1f3a1f'
        ctx.beginPath()
        ctx.arc(0, -6.8, 1.8, 3.1, 6.1)
        ctx.fill()
        ctx.fillStyle = '#4a3018'
        ctx.fillRect(-6, -4, 2.5, 5)
        ctx.fillStyle = '#c9c9d4'
        ctx.fillRect(-6, -6.5, 2.5, 2.5)
        ctx.fillStyle = '#d8a040'
        ctx.beginPath()
        ctx.moveTo(0, -9.4)
        _quadTo(ctx, 1.6, -11.8 + math.sin(game.time * 6) * 0.8, 3.4, -10.4)
        _quadTo(ctx, 1.2, -9.6, 0, -9.1)
        ctx.closePath()
        ctx.fill()
        ctx.rotate(aim)
        ctx.strokeStyle = '#8a6434'
        ctx.lineWidth = 1.7
        ctx.beginPath()
        ctx.arc(0, 0, 7.5, -1.45, 1.45)
        ctx.stroke()
        pull = 2.5 + rec * 0.7 + (1 - self.windup) * 1.1
        ctx.strokeStyle = 'rgba(230,225,210,0.9)'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.moveTo(7.5 * math.cos(-1.45), 7.5 * math.sin(-1.45))
        ctx.lineTo(-pull, 0)
        ctx.lineTo(7.5 * math.cos(1.45), 7.5 * math.sin(1.45))
        ctx.stroke()
        ctx.fillStyle = '#a0a0ac'
        ctx.fillRect(0, -0.6, 9.5, 1.2)
        ctx.fillStyle = '#e8e8e8'
        ctx.beginPath()
        ctx.moveTo(9.5, 0)
        ctx.lineTo(6.5, -1.6)
        ctx.lineTo(6.5, 1.6)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#c9c9d4'
        ctx.beginPath()
        ctx.moveTo(-pull - 1, 0)
        ctx.lineTo(-pull - 4, -2.2)
        ctx.lineTo(-pull - 4, 2.2)
        ctx.closePath()
        ctx.fill()
        if self.windup > 0.85:
            ctx.fillStyle = 'rgba(255,255,255,0.95)'
            ctx.beginPath()
            ctx.arc(-pull, 0, 1.1, 0, 6.28)
            ctx.fill()
        ctx.restore()

    def _drawFire(self, ctx, game):
        rec = self.recoil * 4
        fl = 0.5 + 0.5 * math.sin(game.time * 9)
        ctx.save()
        ctx.fillStyle = '#3a3a44'
        ctx.beginPath()
        ctx.ellipse(0, -9, 5.5, 3.2, 0, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#ff9a4a'
        ctx.beginPath()
        ctx.ellipse(0, -10.4, 3.6, 2, 0, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#ffd27a'
        ctx.beginPath()
        ctx.ellipse(0, -10.6, 2, 1.2, 0, 0, 6.28)
        ctx.fill()
        for em in range(3):
            ep = (game.time * 0.7 + em * 0.33) % 1
            ctx.globalAlpha = (1 - ep) * 0.8
            ctx.fillStyle = '#ffb04a'
            ctx.beginPath()
            ctx.arc(math.sin(game.time * 3 + em * 2) * 4 * ep, -10 - ep * 14, 1.6, 0, 6.28)
            ctx.fill()
        ctx.globalAlpha = 1
        ctx.rotate(self.aim)
        ctx.translate(rec, 0)
        fg = ctx.createLinearGradient(0, -6, 12, -2)
        fg.addColorStop(0, '#ffb04a')
        fg.addColorStop(1, 'rgba(255,90,30,0.1)')
        ctx.fillStyle = fg
        ctx.beginPath()
        ctx.moveTo(0, -5)
        _quadTo(ctx, 7 + fl * 3, -9, 13 + fl * 5, -2)
        _quadTo(ctx, 8, -1, 0, -1)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,235,160,' + str(fl) + ')'
        ctx.beginPath()
        ctx.moveTo(0, -4)
        _quadTo(ctx, 5 + fl * 2, -7, 9 + fl * 3, -2.5)
        _quadTo(ctx, 5, -1, 0, -1.5)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

    def _drawIce(self, ctx, game):
        g = 0.5 + 0.5 * math.sin(self.aim * 3)
        ctx.save()
        ctx.translate(0, -9)
        ctx.strokeStyle = 'rgba(160,220,255,0.5)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(0, 0, 9 + g, 0, 6.28)
        ctx.stroke()
        ctx.save()
        ctx.rotate(game.time * 1.5)
        for i in range(4):
            a = i * 1.5708
            ctx.fillStyle = '#9fd4ff' if i % 2 else '#7fb8e0'
            ctx.beginPath()
            ctx.moveTo(math.cos(a) * 7, math.sin(a) * 7)
            ctx.lineTo(math.cos(a + 0.6) * 9.5, math.sin(a + 0.6) * 9.5)
            ctx.lineTo(math.cos(a + 0.15) * 12, math.sin(a + 0.15) * 12)
            ctx.closePath()
            ctx.fill()
        ctx.restore()
        og = ctx.createRadialGradient(0, -1, 1, 0, 0, 6)
        og.addColorStop(0, '#ffffff')
        og.addColorStop(0.5, '#bfe8ff')
        og.addColorStop(1, 'rgba(120,180,230,0)')
        ctx.fillStyle = og
        ctx.beginPath()
        ctx.arc(0, 0, 6 + g, 0, 6.28)
        ctx.fill()
        ctx.restore()

    def _drawDwarf(self, ctx, game):
        rec = self.recoil * 4
        ctx.save()
        ctx.fillStyle = '#5a5a66'
        ctx.beginPath()
        _roundRect(ctx, -6, -7, 12, 4, 1)
        ctx.fill()
        ctx.beginPath()
        _roundRect(ctx, -4, -10, 8, 3, 1)
        ctx.fill()
        dg = 0.5 + 0.5 * math.sin(game.time * 4)
        ctx.fillStyle = 'rgba(255,150,60,' + str(0.2 + dg * 0.25) + ')'
        ctx.beginPath()
        ctx.arc(0, -9, 8 + dg * 2.5, 0, 6.28)
        ctx.fill()
        ctx.rotate(self.aim)
        ctx.strokeStyle = '#4a3018'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(2, -8)
        ctx.lineTo(10 - rec * 0.5, -14)
        ctx.stroke()
        ctx.fillStyle = '#8a8a96'
        ctx.beginPath()
        _roundRect(ctx, 8 - rec * 0.5, -16.5, 5, 5, 1)
        ctx.fill()
        ctx.fillStyle = '#a0a0ac'
        ctx.fillRect(8 - rec * 0.5, -16.5, 5, 1.4)
        if rec > 1:
            ctx.fillStyle = 'rgba(255,200,80,0.9)'
            for i in range(3):
                a = game.time * 6 + i * 2.1
                ctx.beginPath()
                ctx.arc(math.cos(a) * 13, -12 + math.sin(a) * 4, 1.2, 0, 6.28)
                ctx.fill()
        ctx.restore()

    def _drawCrossbow(self, ctx, game):
        rec = self.recoil * 4
        ctx.save()
        ctx.rotate(self.aim)
        ctx.strokeStyle = '#5a5a66'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.arc(0, -9, 6.5, -1.5, 1.5)
        ctx.stroke()
        ctx.fillStyle = '#4a3018'
        ctx.beginPath()
        _roundRect(ctx, -4, -11, 15, 3, 1)
        ctx.fill()
        ctx.fillStyle = '#a0a0ac'
        ctx.fillRect(11, -9.8, 6, 1.4)
        ctx.fillStyle = '#e8e8e8'
        ctx.beginPath()
        ctx.moveTo(17, -9.1)
        ctx.lineTo(14, -10.7)
        ctx.lineTo(14, -7.5)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(230,225,210,0.9)'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.moveTo(-6, -11.5)
        ctx.lineTo(-6, -8.5)
        ctx.stroke()
        ctx.fillStyle = '#3a3a44'
        ctx.beginPath()
        ctx.arc(-7, -10, 2, 0, 6.28)
        ctx.fill()
        wa = game.time * 3
        ctx.strokeStyle = '#9a9aa6'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-7 + math.cos(wa) * 2.6, -10 + math.sin(wa) * 2.6)
        ctx.lineTo(-7 + math.cos(wa + 2.4) * 2.6, -10 + math.sin(wa + 2.4) * 2.6)
        ctx.stroke()
        ctx.restore()

    def _drawVenom(self, ctx, game):
        bub = 0.5 + 0.5 * math.sin(game.time * 5)
        ctx.save()
        ctx.fillStyle = '#4a3a2a'
        ctx.beginPath()
        ctx.arc(0, -10, 6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#5f4d2a'
        ctx.beginPath()
        ctx.arc(0, -10, 4.4, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(140,230,120,' + str(0.5 + bub * 0.4) + ')'
        ctx.beginPath()
        ctx.arc(0, -12.5 - bub * 3, 2 + bub, 0, 6.28)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(3, -13 - bub * 2, 1.4, 0, 6.28)
        ctx.fill()
        for vm in range(2):
            vp = (game.time * 0.6 + vm * 0.5) % 1
            ctx.globalAlpha = (1 - vp) * 0.3
            ctx.fillStyle = '#7ad47f'
            ctx.beginPath()
            ctx.arc((3 if vm else -3) + math.sin(game.time * 2 + vm * 3) * 1.5, -10 - vp * 12, 2 + vp * 2.5, 0, 6.28)
            ctx.fill()
        ctx.globalAlpha = 1
        ctx.rotate(self.aim)
        ctx.fillStyle = '#7ad47f'
        ctx.beginPath()
        ctx.arc(8, -12, 2.6, 0, 6.28)
        ctx.fill()
        ctx.strokeStyle = 'rgba(122,212,127,0.6)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(8, -12, 5, 0, 6.28)
        ctx.stroke()
        ctx.restore()

    def _drawDruid(self, ctx, game):
        g = 0.5 + 0.5 * math.sin(game.time * 3)
        ctx.save()
        ctx.strokeStyle = '#4a7a3a'
        ctx.lineWidth = 1.4
        for i in range(-1, 2):
            ctx.beginPath()
            ctx.moveTo(i * 5, -10)
            _quadTo(ctx, i * 6, -16 + math.sin(game.time * 2 + i) * 2, i * 7, -13)
            ctx.stroke()
        ctx.translate(0, -17 + math.sin(game.time * 2) * 1.5)
        og = ctx.createRadialGradient(0, 0, 1, 0, 0, 8)
        og.addColorStop(0, '#d8ffc8')
        og.addColorStop(0.5, '#8ae87a')
        og.addColorStop(1, 'rgba(138,232,122,0)')
        ctx.fillStyle = og
        ctx.beginPath()
        ctx.arc(0, 0, 8 + g, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#eaffda'
        ctx.beginPath()
        ctx.arc(0, 0, 3.2, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(170,235,130,0.8)'
        for df in range(3):
            da = game.time * 1.2 + df * 2.09
            ctx.beginPath()
            ctx.arc(math.cos(da) * 11, math.sin(da) * 4, 1.4, 0, 6.28)
            ctx.fill()
        ctx.restore()

    def _drawTesla(self, ctx, game):
        zap = 0.5 + 0.5 * abs(math.sin(game.time * 7))
        ctx.save()
        ctx.translate(0, -20)
        ctx.strokeStyle = '#8a8a96'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(0, 0, 6, 0, 6.28)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(200,160,255,' + str(0.5 + zap * 0.5) + ')'
        ctx.lineWidth = 1.2
        for i in range(4):
            a = game.time * 2 + i * 1.5708
            ctx.beginPath()
            ctx.moveTo(math.cos(a) * 5, math.sin(a) * 5)
            ctx.lineTo(math.cos(a) * 10 + math.sin(game.time * 20 + i) * 2, math.sin(a) * 10)
            ctx.stroke()
        og = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 4)
        og.addColorStop(0, '#fff')
        og.addColorStop(1, '#b06aff')
        ctx.fillStyle = og
        ctx.beginPath()
        ctx.arc(0, 0, 4 + zap, 0, 6.28)
        ctx.fill()
        ctx.restore()

    def _drawKnight(self, ctx, game):
        rec = self.recoil * 4
        ctx.save()
        ctx.fillStyle = '#9aa0aa'
        ctx.beginPath()
        _roundRect(ctx, -4, -14, 8, 9, 2)
        ctx.fill()
        ctx.fillStyle = '#b8bec8'
        ctx.fillRect(-4, -14, 8, 1.6)
        ctx.fillStyle = '#7a808c'
        ctx.beginPath()
        _roundRect(ctx, -3.4, -19.5, 6.8, 6, 2.5)
        ctx.fill()
        ctx.fillStyle = '#23262c'
        ctx.beginPath()
        _roundRect(ctx, -2.2, -17.5, 4.4, 3.4, 1)
        ctx.fill()
        ctx.fillStyle = '#c03030'
        ctx.beginPath()
        ctx.moveTo(0, -19.5)
        _quadTo(ctx, 2.5, -23.5, 4.5, -22.5)
        _quadTo(ctx, 1.5, -22, -1, -18.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#4a6a9a'
        ctx.beginPath()
        ctx.moveTo(-5.5, -14)
        ctx.lineTo(-2.2, -14)
        ctx.lineTo(-2.2, -7)
        ctx.lineTo(-3.9, -4)
        ctx.lineTo(-5.5, -7)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#e8d24a'
        ctx.beginPath()
        ctx.arc(-3.9, -10, 1.2, 0, 6.28)
        ctx.fill()
        kg2 = 0.5 + 0.5 * math.sin(game.time * 5)
        ctx.fillStyle = 'rgba(255,255,255,' + str(0.14 + kg2 * 0.26) + ')'
        ctx.beginPath()
        ctx.moveTo(-5.2, -13.4)
        ctx.lineTo(-3.1, -13.4)
        ctx.lineTo(-3.1, -11.4)
        ctx.lineTo(-5.2, -11.4)
        ctx.closePath()
        ctx.fill()
        ctx.rotate(self.aim)
        ctx.fillStyle = '#6a4a2a'
        ctx.fillRect(1 - rec * 0.4, -13, 12 + rec * 0.7, 1.6)
        ctx.fillStyle = '#aab2be'
        ctx.beginPath()
        ctx.moveTo(13 + rec * 0.7, -12.2)
        ctx.lineTo(9, -13.8)
        ctx.lineTo(9, -10.6)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

    def _drawSniper(self, ctx, game):
        rec = self.recoil * 4
        ctx.save()
        ctx.strokeStyle = '#4a3018'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-7, -5)
        ctx.lineTo(0, -10)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(7, -5)
        ctx.lineTo(0, -10)
        ctx.stroke()
        ctx.fillStyle = '#5a3a1c'
        ctx.beginPath()
        _roundRect(ctx, -8, -11, 17, 2.6, 1)
        ctx.fill()
        ctx.rotate(self.aim * 0.5)
        ctx.strokeStyle = '#6a6a76'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.arc(2, -9.6, 6, -1.5, 1.5)
        ctx.stroke()
        ctx.fillStyle = '#a0a0ac'
        ctx.fillRect(-6 + rec, -10.6, 18, 1.4)
        ctx.fillStyle = '#e8e8e8'
        ctx.beginPath()
        ctx.moveTo(12 + rec, -9.9)
        ctx.lineTo(8 + rec, -11.4)
        ctx.lineTo(8 + rec, -8.4)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#c9c9d4'
        ctx.beginPath()
        ctx.moveTo(-6 + rec, -10.6)
        ctx.lineTo(-9 + rec, -12.6)
        ctx.lineTo(-9 + rec, -8.6)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#3a3a44'
        ctx.beginPath()
        _roundRect(ctx, 0, -13.4, 6, 2.4, 1)
        ctx.fill()
        glint = 0.4 + 0.4 * abs(math.sin(game.time * 1.2))
        ctx.fillStyle = 'rgba(255,255,255,' + str(round(glint, 2)) + ')'
        ctx.beginPath()
        ctx.arc(5, -12.2, 0.9, 0, 6.28)
        ctx.fill()
        ctx.restore()

    def _drawHoly(self, ctx, game):
        g = 0.5 + 0.5 * math.sin(game.time * 3)
        ctx.save()
        ctx.translate(0, -14)
        ctx.strokeStyle = 'rgba(255,220,120,' + str(0.4 + g * 0.4) + ')'
        ctx.lineWidth = 1.2
        for i in range(8):
            a = i * 0.7854 + game.time * 0.3
            ctx.beginPath()
            ctx.moveTo(math.cos(a) * 5, math.sin(a) * 5)
            ctx.lineTo(math.cos(a) * 11, math.sin(a) * 11)
            ctx.stroke()
        ctx.strokeStyle = '#e8c85a'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(0, 0, 6.5 + g, 0, 6.28)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,230,150,0.9)'
        for hm in range(3):
            ha = game.time * 0.9 + hm * 2.09
            ctx.beginPath()
            ctx.arc(math.cos(ha) * 14, math.sin(ha) * 4, 1.3, 0, 6.28)
            ctx.fill()
        ctx.fillStyle = '#f2c86a'
        ctx.beginPath()
        ctx.moveTo(-3.2, 4.5)
        ctx.lineTo(0, -5.5)
        ctx.lineTo(3.2, 4.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff8e0'
        ctx.beginPath()
        ctx.arc(0, -2.5, 1.5, 0, 6.28)
        ctx.fill()
        ctx.restore()

    def _drawBanner(self, ctx, game):
        wave = math.sin(game.time * 4) * 1.5
        ctx.save()
        ctx.fillStyle = '#4a2a12'
        ctx.fillRect(-1, -27, 2, 19)
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.beginPath()
        ctx.arc(0, -8.5, 1.8, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#3a1a08'
        ctx.beginPath()
        ctx.arc(0, -8.5, 1.4, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = self.def_['color']
        ctx.beginPath()
        ctx.moveTo(0, -27)
        ctx.lineTo(6, -28.5 + wave * 0.5)
        ctx.lineTo(6, -25 + wave * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = self.def_['color']
        ctx.beginPath()
        ctx.moveTo(0, -25)
        _quadTo(ctx, 8, -24 + wave, 16, -23 + wave * 1.6)
        ctx.lineTo(16, -13 + wave * 1.6)
        _quadTo(ctx, 8, -13 + wave, 0, -13)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 0.8
        for fi in range(3):
            fy = -23 + fi * 4 + wave * (0.6 + fi * 0.3)
            ctx.beginPath()
            ctx.moveTo(1, fy)
            _quadTo(ctx, 8, fy + wave * 0.4, 14, fy + wave * 0.8)
            ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.beginPath()
        ctx.moveTo(0, -25)
        _quadTo(ctx, 8, -24 + wave, 16, -23 + wave * 1.6)
        ctx.lineTo(16, -19 + wave * 1.2)
        _quadTo(ctx, 8, -19 + wave * 0.6, 0, -19)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.beginPath()
        ctx.moveTo(0, -17)
        _quadTo(ctx, 8, -17 + wave * 0.8, 16, -15 + wave * 1.4)
        ctx.lineTo(16, -13 + wave * 1.6)
        _quadTo(ctx, 8, -13 + wave, 0, -13)
        ctx.closePath()
        ctx.fill()
        bg = 0.35 + 0.3 * abs(math.sin(game.time * 3))
        ctx.fillStyle = 'rgba(255,240,190,' + str(round(bg, 2)) + ')'
        ctx.beginPath()
        ctx.arc(7.5, -17 + wave, 6.5, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.beginPath()
        ctx.arc(7.5, -17 + wave + 0.8, 6.5, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,240,190,' + str(round(bg, 2)) + ')'
        ctx.beginPath()
        ctx.arc(7.5, -17 + wave, 6.5, 0, 6.28)
        ctx.fill()
        _drawText(ctx, self.def_['icon'], 7.5, -17 + wave, 7, 'center', 'middle', '#fff')
        ctx.restore()

    def _drawWarlock(self, ctx, game):
        rec = self.recoil * 4
        g = 0.5 + 0.5 * math.sin(self.aim * 4)
        ctx.save()
        ctx.rotate(self.angle)
        ctx.translate(-rec, 0)
        og = ctx.createRadialGradient(13, -1, 1, 13, -1, 8)
        og.addColorStop(0, '#e8d4ff')
        og.addColorStop(0.4, '#9a5aff')
        og.addColorStop(1, 'rgba(90,30,160,0)')
        ctx.fillStyle = og
        ctx.beginPath()
        ctx.arc(13, -1, 8 + g * 2, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#4a2a7a'
        ctx.beginPath()
        ctx.arc(13, -1, 4 + g, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#c8a0ff'
        ctx.beginPath()
        ctx.arc(12, -2.4, 1.4, 0, 6.28)
        ctx.fill()
        for i in range(3):
            a = self.aim * 2 + i * 2.09
            ctx.fillStyle = 'rgba(200,150,255,0.9)'
            ctx.beginPath()
            ctx.arc(13 + math.cos(a) * 9, -1 + math.sin(a) * 3, 1.4, 0, 6.28)
            ctx.fill()
        ctx.restore()
        ctx.fillStyle = '#2a1a3a'
        ctx.beginPath()
        _roundRect(ctx, -5, -9, 10, 13, 3)
        ctx.fill()
        ctx.fillStyle = '#3a2a5a'
        ctx.beginPath()
        ctx.arc(0, -12, 5.2, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#1a102a'
        ctx.beginPath()
        ctx.arc(0, -12, 4.6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#b08aff'
        ctx.beginPath()
        ctx.arc(0, -12.6, 2.6, 0, 6.28)
        ctx.fill()
        ctx.fillStyle = '#4a2a7a'
        ctx.beginPath()
        ctx.arc(0, -12.6, 1.2, 0, 6.28)
        ctx.fill()
        ctx.strokeStyle = '#4a2a10'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.moveTo(-4, 2)
        ctx.lineTo(-10, -8)
        ctx.stroke()
        ctx.fillStyle = '#9a5aff'
        ctx.beginPath()
        ctx.arc(-10, -9, 2.4 + math.sin(game.time * 6) * 0.6, 0, 6.28)
        ctx.fill()
        if self.flash > 0:
            ctx.fillStyle = 'rgba(176,138,255,' + str(self.flash * 3) + ')'
            ctx.beginPath()
            ctx.arc(0, -11, 8, 0, 6.28)
            ctx.fill()


class Projectile:
    def __init__(self, x, y, target, opt):
        self.x = x
        self.y = y
        self.target = target
        self.speed = opt['speed']
        self.damage = opt['damage']
        self.element = opt['element']
        self.tower = opt['tower']
        self.projColor = opt['projColor']
        self.visual = opt.get('visual', 'arrow')
        self.opts = opt.get('opts', {})
        self.pierce = self.opts.get('pierce', 0)
        self.purge = self.opts.get('purge', 0)
        self.dead = False
        self.angle = 0
        self.hitEnemy = None
        if 'tx' in opt:
            self.tx = opt['tx']
            self.ty = opt['ty']
        elif self.target:
            self.tx = self.target.x
            self.ty = self.target.y
        else:
            self.tx = x
            self.ty = y

    def update(self, dt, game):
        if self.target and self.target.alive:
            tx, ty = self.target.x, self.target.y
        else:
            tx, ty = self.tx, self.ty
        dx = tx - self.x
        dy = ty - self.y
        d = math.sqrt(dx * dx + dy * dy)
        step = self.speed * dt
        if d <= step + 2:
            if self.opts.get('aoe') and self.target and self.target.alive:
                self.x = tx
                self.y = ty
            self.hit(game)
            return
        self.angle = math.atan2(dy, dx)
        self.x += dx / d * step
        self.y += dy / d * step
        if self.visual == 'fireball' and random.random() < 0.8:
            game.particles.append({
                'x': self.x, 'y': self.y,
                'vx': (random.random() - 0.5) * 30, 'vy': (random.random() - 0.5) * 30,
                'life': 0.25, 'max': 0.25, 'color': '#ff9a4a', 'size': 3, 'grav': 0,
            })
        elif self.visual == 'frost' and random.random() < 0.6:
            game.particles.append({
                'x': self.x, 'y': self.y,
                'vx': (random.random() - 0.5) * 20, 'vy': (random.random() - 0.5) * 20,
                'life': 0.2, 'max': 0.2, 'color': '#bfe8ff', 'size': 2, 'grav': 0,
            })
        elif self.visual == 'bomb' and random.random() < 0.4:
            game.particles.append({
                'x': self.x, 'y': self.y - 3,
                'vx': 0, 'vy': -14,
                'life': 0.4, 'max': 0.4, 'color': '#888', 'size': 2.5, 'grav': 0,
            })
        elif self.visual == 'arrow' and random.random() < 0.5:
            game.particles.append({
                'x': self.x, 'y': self.y,
                'vx': (random.random() - 0.5) * 8, 'vy': (random.random() - 0.5) * 8,
                'life': 0.12, 'max': 0.12, 'color': '#c9c9d4', 'size': 1.2, 'grav': 0,
            })
        elif self.visual == 'hex' and random.random() < 0.5:
            game.particles.append({
                'x': self.x, 'y': self.y,
                'vx': (random.random() - 0.5) * 18, 'vy': (random.random() - 0.5) * 18,
                'life': 0.18, 'max': 0.18, 'color': '#c8a0ff', 'size': 1.8, 'grav': 0,
            })
        elif self.visual == 'bolt' and random.random() < 0.4:
            game.particles.append({
                'x': self.x, 'y': self.y,
                'vx': (random.random() - 0.5) * 15, 'vy': (random.random() - 0.5) * 15,
                'life': 0.1, 'max': 0.1, 'color': '#aaccff', 'size': 1.5, 'grav': 0,
            })

    def hit(self, game):
        opts = self.opts
        if opts.get('aoe'):
            cx, cy = self.x, self.y
            for e in game.enemies:
                if not e.alive:
                    continue
                if opts.get('needGround') and e.flying:
                    continue
                dx = e.x - cx
                dy = e.y - cy
                if dx * dx + dy * dy <= opts['aoe'] * opts['aoe']:
                    e.takeDamage(self.damage * game.weatherMult(self.element), self.element, self.tower, opts.get('ignoreArmor'))
                    if e.alive:
                        if opts.get('burn'):
                            e.burn = {'dps': self.damage * 0.22 * game.weatherMult(self.element), 't': 3}
                        if opts.get('poison'):
                            e.poison = {'dps': opts['poison']['dps'], 't': opts['poison']['t']}
                        if opts.get('hex'):
                            e.hex = {'mult': opts['hex']['mult'], 't': opts['hex']['t']}
                        if opts.get('slow'):
                            e.slow = {'mult': opts['slow'], 't': opts.get('slowDur', 2)}
                        if opts.get('kb'):
                            e.pathPos = max(0, e.pathPos - opts['kb'])
            game.explosion(cx, cy, opts['aoe'], self.projColor)
            AUDIO.play_sfx(AUDIO.sfx.projectile_explosion(), 0.35)
            self.dead = True
            return
        if self.target and self.target.alive:
            mult = 2 if self.target.corrupted else 1
            self.target.takeDamage(self.damage * mult * game.weatherMult(self.element), self.element, self.tower, opts.get('ignoreArmor'))
            if self.target.alive:
                if opts.get('slow'):
                    self.target.slow = {'mult': opts['slow'], 't': opts.get('slowDur', 2)}
                if opts.get('burn'):
                    self.target.burn = {'dps': self.damage * 0.22 * game.weatherMult(self.element), 't': 3}
                if opts.get('poison'):
                    self.target.poison = {'dps': opts['poison']['dps'], 't': opts['poison']['t']}
                if opts.get('hex'):
                    self.target.hex = {'mult': opts['hex']['mult'], 't': opts['hex']['t']}
            if self.pierce > 0:
                next_ = game.findNextEnemy(self.x, self.y, self.target, 80, self.tower.canHitFlying)
                if next_:
                    self.target = next_
                    self.tx = next_.x
                    self.ty = next_.y
                    self.pierce -= 1
                    return
        if self.purge > 0 and game.purifyRadius:
            game.purifyRadius(self.x, self.y, 60, self.purge)
        game.hitSpark(self.x, self.y, self.projColor)
        AUDIO.play_sfx(AUDIO.sfx.projectile_hit(), 0.3)
        self.dead = True

    def draw(self, ctx):
        ctx.save()
        ctx.translate(self.x, self.y)
        glow_r = {'fireball': 12, 'frost': 10, 'venom': 10, 'hex': 11, 'holy': 13, 'arc': 11, 'snipe': 9, 'bomb': 8}.get(self.visual, 0)
        if glow_r > 0:
            gg = ctx.createRadialGradient(0, 0, 1, 0, 0, glow_r)
            gg.addColorStop(0, self.projColor)
            gg.addColorStop(0.5, 'rgba(255,255,255,0.3)')
            gg.addColorStop(1, 'rgba(255,255,255,0)')
            ctx.fillStyle = gg
            ctx.globalAlpha = 0.55
            ctx.beginPath()
            ctx.arc(0, 0, glow_r, 0, 6.28)
            ctx.fill()
            ctx.globalAlpha = 1
        ctx.rotate(self.angle)
        vis = self.visual
        if vis == 'arrow':
            ctx.strokeStyle = '#8a7a5a'
            ctx.lineWidth = 2.4
            ctx.beginPath()
            ctx.moveTo(-9, 0)
            ctx.lineTo(7, 0)
            ctx.stroke()
            ctx.fillStyle = self.projColor
            ctx.beginPath()
            ctx.moveTo(9, 0)
            ctx.lineTo(4, -3.5)
            ctx.lineTo(5, 0)
            ctx.lineTo(4, 3.5)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = '#e8e8e8'
            ctx.beginPath()
            ctx.moveTo(-9, -2.5)
            ctx.lineTo(-13, 0)
            ctx.lineTo(-9, 2.5)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = '#c9c9d4'
            ctx.fillRect(-9, -0.6, 16, 1.2)
        elif vis == 'fireball':
            grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 10)
            grad.addColorStop(0, '#fff6c8')
            grad.addColorStop(0.3, '#ffd070')
            grad.addColorStop(0.6, self.projColor)
            grad.addColorStop(1, 'rgba(255,60,10,0)')
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(0, 0, 10, 0, 6.28)
            ctx.fill()
            ig = ctx.createRadialGradient(0, 0, 0, 0, 0, 4)
            ig.addColorStop(0, '#fff')
            ig.addColorStop(1, '#ffd070')
            ctx.fillStyle = ig
            ctx.beginPath()
            ctx.arc(0, 0, 3.5, 0, 6.28)
            ctx.fill()
        elif vis == 'frost':
            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(0, 0, 4.5, 0, 6.28)
            ctx.fill()
            fg = ctx.createRadialGradient(0, 0, 1, 0, 0, 8)
            fg.addColorStop(0, 'rgba(191,232,255,0.8)')
            fg.addColorStop(1, 'rgba(120,200,255,0)')
            ctx.fillStyle = fg
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 1
            for i in range(4):
                a = i * 1.5708
                ctx.beginPath()
                ctx.moveTo(math.cos(a) * 3, math.sin(a) * 3)
                ctx.lineTo(math.cos(a) * 7, math.sin(a) * 7)
                ctx.stroke()
        elif vis == 'bomb':
            ctx.fillStyle = '#3a3a3a'
            ctx.beginPath()
            ctx.arc(0, 0, 5.5, 0, 6.28)
            ctx.fill()
            bg2 = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5.5)
            bg2.addColorStop(0, '#5a5a5a')
            bg2.addColorStop(1, '#2a2a2a')
            ctx.fillStyle = bg2
            ctx.beginPath()
            ctx.arc(0, 0, 5, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = '#555'
            ctx.lineWidth = 1.8
            ctx.beginPath()
            ctx.moveTo(0, -5)
            ctx.lineTo(2, -9)
            ctx.stroke()
            ctx.fillStyle = '#ffd24a'
            ctx.beginPath()
            ctx.arc(2, -10, 1.8, 0, 6.28)
            ctx.fill()
            fg2 = ctx.createRadialGradient(2, -10, 0.3, 2, -10, 1.8)
            fg2.addColorStop(0, '#fff')
            fg2.addColorStop(1, '#ffd24a')
            ctx.fillStyle = fg2
            ctx.beginPath()
            ctx.arc(2, -10, 1.5, 0, 6.28)
            ctx.fill()
        elif vis == 'bolt':
            ctx.strokeStyle = self.projColor
            ctx.lineWidth = 3.8
            ctx.beginPath()
            ctx.moveTo(-14, 0)
            ctx.lineTo(14, 0)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(-12, 0)
            ctx.lineTo(10, 0)
            ctx.stroke()
            ctx.fillStyle = '#e8e8e8'
            ctx.beginPath()
            ctx.moveTo(15, 0)
            ctx.lineTo(6, -4)
            ctx.lineTo(7, 0)
            ctx.lineTo(6, 4)
            ctx.closePath()
            ctx.fill()
            bg3 = ctx.createRadialGradient(0, 0, 1, 0, 0, 6)
            bg3.addColorStop(0, 'rgba(180,220,255,0.4)')
            bg3.addColorStop(1, 'rgba(100,160,255,0)')
            ctx.fillStyle = bg3
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, 6.28)
            ctx.fill()
        elif vis == 'venom':
            ctx.fillStyle = '#2a6a2a'
            ctx.beginPath()
            ctx.moveTo(-5, -5)
            ctx.lineTo(5, 0)
            ctx.lineTo(-5, 5)
            ctx.lineTo(-1, 0)
            ctx.closePath()
            ctx.fill()
            vg2 = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 5)
            vg2.addColorStop(0, '#b0ffb0')
            vg2.addColorStop(0.5, '#7ad47f')
            vg2.addColorStop(1, '#3a8a4a')
            ctx.fillStyle = vg2
            ctx.beginPath()
            ctx.arc(0, 0, 4.5, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = '#e8ffe8'
            ctx.beginPath()
            ctx.arc(-1.2, -1.2, 1.5, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = 'rgba(122,212,127,0.5)'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(0, 0, 7, 0, 6.28)
            ctx.stroke()
        elif vis == 'snipe':
            ctx.strokeStyle = '#6a6a76'
            ctx.lineWidth = 2.8
            ctx.beginPath()
            ctx.moveTo(-20, 0)
            ctx.lineTo(14, 0)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(-18, 0)
            ctx.lineTo(12, 0)
            ctx.stroke()
            sg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 5)
            sg.addColorStop(0, '#fff')
            sg.addColorStop(1, 'rgba(200,220,240,0)')
            ctx.fillStyle = sg
            ctx.beginPath()
            ctx.arc(0, 0, 5, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = '#fff'
            ctx.beginPath()
            ctx.moveTo(16, 0)
            ctx.lineTo(8, -3.5)
            ctx.lineTo(9, 0)
            ctx.lineTo(8, 3.5)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = '#c9c9d4'
            ctx.beginPath()
            ctx.moveTo(-20, 0)
            ctx.lineTo(-23, -2)
            ctx.lineTo(-23, 2)
            ctx.closePath()
            ctx.fill()
        elif vis == 'hex':
            hx = self.projColor
            hg2 = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 8)
            hg2.addColorStop(0, '#e8d4ff')
            hg2.addColorStop(0.4, hx)
            hg2.addColorStop(1, 'rgba(100,50,180,0)')
            ctx.fillStyle = hg2
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = '#c8a0ff'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, 6.28)
            ctx.stroke()
            ctx.fillStyle = '#e8d4ff'
            ctx.beginPath()
            ctx.arc(0, 0, 2.8, 0, 6.28)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            ctx.beginPath()
            ctx.arc(-0.5, -0.8, 1, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = 'rgba(200,150,255,0.5)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(0, 0, 10, 0, 6.28)
            ctx.stroke()
        elif vis == 'arc':
            ctx.strokeStyle = self.projColor
            ctx.lineWidth = 2.8
            ctx.beginPath()
            ctx.moveTo(-12, 0)
            ctx.lineTo(12, 0)
            ctx.stroke()
            ctx.strokeStyle = '#eaffff'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(-8, 0)
            ctx.lineTo(8, 0)
            ctx.stroke()
            ag2 = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 4)
            ag2.addColorStop(0, '#fff')
            ag2.addColorStop(1, self.projColor)
            ctx.fillStyle = ag2
            ctx.beginPath()
            ctx.arc(0, 0, 3, 0, 6.28)
            ctx.fill()
            eg3 = ctx.createRadialGradient(0, 0, 1, 0, 0, 7)
            eg3.addColorStop(0, 'rgba(100,220,240,0.3)')
            eg3.addColorStop(1, 'rgba(60,180,220,0)')
            ctx.fillStyle = eg3
            ctx.beginPath()
            ctx.arc(0, 0, 7, 0, 6.28)
            ctx.fill()
        elif vis == 'holy':
            hg3 = ctx.createRadialGradient(0, 0, 1, 0, 0, 11)
            hg3.addColorStop(0, '#ffffff')
            hg3.addColorStop(0.3, '#fff6c8')
            hg3.addColorStop(0.7, 'rgba(255,240,180,0.3)')
            hg3.addColorStop(1, 'rgba(255,220,140,0)')
            ctx.fillStyle = hg3
            ctx.beginPath()
            ctx.arc(0, 0, 11, 0, 6.28)
            ctx.fill()
            ctx.strokeStyle = '#ffe08a'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(0, 0, 5, 0, 6.28)
            ctx.stroke()
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            for hr in range(4):
                ha = hr * 1.5708
                ctx.beginPath()
                ctx.arc(math.cos(ha) * 3.5, math.sin(ha) * 3.5, 0.8, 0, 6.28)
                ctx.fill()
        ctx.restore()


def _roundRect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.lineTo(x + w, y + h - r)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.lineTo(x + r, y + h)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.lineTo(x, y + r)
    ctx.arc(x + r, y + r, r, math.pi, math.pi * 1.5)
    ctx.closePath()


def _quadTo(ctx, cpx, cpy, x, y):
    if ctx._path:
        last = ctx._path[-1]
        start = last[1] if len(last) > 1 else (0, 0)
        cp = ctx._apply(cpx, cpy)
        end = ctx._apply(x, y)
        pts = _quad_bezier(start, cp, end, 8)
        for p in pts[1:]:
            ctx._path.append(('L', p))


_TXT_FONTS = {}

def _drawText(ctx, text, x, y, size, align='center', baseline='middle', color='#fff'):
    try:
        sz = max(8, int(size * 2))
        font = _TXT_FONTS.get(sz)
        if font is None:
            font = pygame.font.SysFont(None, sz)
            _TXT_FONTS[sz] = font
        surf = font.render(str(text), True, _parse_color(color))
        p = ctx._apply(x, y)
        rx = p[0] - surf.get_width() // 2 if align == 'center' else p[0]
        ry = p[1] - surf.get_height() // 2 if baseline == 'middle' else p[1]
        ctx.surface.blit(surf, (int(rx), int(ry)))
    except Exception:
        pass
