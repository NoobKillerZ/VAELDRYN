import math
import random
import pygame

from config import CONFIG, ENEMIES
from artkit import (
    figure, dragonHead, bat_draw, wisp_draw, spider_draw,
    stoneGolem_draw, fireGolem_draw, shade, rgba, hex2rgb,
    wing, orb, Ctx, _parse_color, _int, TWO_PI,
)
from director import DIRECTOR
from weather import WEATHER
from audio import AUDIO

_fonts = {}

_SPECS = {
    'goblin': {'skin': '#4a8f4f', 'tunic': '#5a4a28', 'armor': '#66512d', 'bracer': '#806634', 'belt': '#3a2a14', 'head': 'human', 'ears': 'goblin', 'eyeCol': '#ffd23a', 'smile': True, 'weapon': 'club', 'headR': 0.6, 'bodyW': 0.8, 'torso': 0.85},
    'sorcerer': {'skin': '#4a8f4f', 'body': 'robe', 'tunic': '#4a2a6a', 'hoodCol': '#3a1f55', 'head': 'hood', 'eyeCol': '#c8a0ff', 'weapon': 'staff', 'glowCol': '#9a6aff', 'headR': 0.55, 'torso': 0.95, 'trim': '#6a4a8a'},
    'orc': {'skin': '#5a8a3a', 'tunic': '#6a4a2a', 'armor': '#4a3a2a', 'belt': '#2e2010', 'head': 'orc', 'eyeCol': '#ff5a3a', 'hair': 'topknot', 'earring': True, 'weapon': 'axe', 'headR': 0.55, 'bodyW': 0.95, 'torso': 1.0},
    'berserker': {'skin': '#8a5a2a', 'tunic': '#6a2a1a', 'armor': '#7b3b20', 'bracer': '#9a5428', 'belt': '#2e2010', 'head': 'orc', 'eyeCol': '#ff3a2a', 'hair': 'wild', 'scar': True, 'weapon': 'cleaver', 'headR': 0.55, 'bodyW': 0.95, 'torso': 0.95},
    'skeleton': {'skin': '#d8d6c8', 'tunic': '#c4c2b2', 'bones': True, 'armor': '#6a6a78', 'belt': '#4a4a4a', 'head': 'skull', 'eyeCol': '#5a5a6a', 'weapon': 'sword', 'headR': 0.52, 'torso': 1.0, 'bodyW': 0.85},
    'undead': {'skin': '#9aa48c', 'tunic': '#3a4048', 'armor': '#4a4a5a', 'belt': '#2a2a34', 'head': 'rot', 'eyeCol': '#ffd23a', 'weapon': 'sword', 'headR': 0.52, 'torso': 1.0},
    'troll': {'skin': '#6a9a6a', 'tunic': '#4a5a2a', 'armor': '#5c552c', 'bracer': '#7f7438', 'belt': '#2e2a10', 'head': 'human', 'ears': 'goblin', 'eyeCol': '#ff8a2a', 'smile': True, 'weapon': 'club', 'headR': 0.6, 'bodyW': 1.1, 'torso': 1.1},
    'necromancer': {'skin': '#7a8a8a', 'body': 'robe', 'tunic': '#2a1a3a', 'hoodCol': '#1f142a', 'head': 'hood', 'eyeCol': '#7aff9a', 'weapon': 'staff', 'glowCol': '#7aff9a', 'headR': 0.52, 'torso': 1.0, 'cape': '#1f142a'},
    'orcKing': {'skin': '#4a7a2a', 'tunic': '#4a2a1a', 'armor': '#9a9aa8', 'trim': '#e0b84a', 'belt': '#2e2010', 'skirt': '#4a3a2a', 'cape': '#b03030', 'head': 'orc', 'eyeCol': '#ffb03a', 'hair': 'topknot', 'earring': True, 'crown': True, 'weapon': 'axe', 'headR': 0.58, 'bodyW': 1.05, 'torso': 1.05},
    'lord': {'skin': '#5a4a5a', 'body': 'robe', 'tunic': '#1a1024', 'hoodCol': '#120a1a', 'head': 'rot', 'eyeCol': '#c8a0ff', 'crown': True, 'trim': '#8a5aff', 'weapon': 'scythe', 'glowCol': '#a08aff', 'headR': 0.54, 'torso': 1.05, 'cape': '#120a1a'},
    'voidWalker': {'skin': '#8a7aaa', 'body': 'robe', 'tunic': '#120a1f', 'hoodCol': '#0a0612', 'head': 'hood', 'eyeCol': '#b08aff', 'weapon': 'staff', 'glowCol': '#b08aff', 'headR': 0.54, 'torso': 1.0, 'cape': '#0a0612', 'trim': '#5a3a8a'},
    'saboteur': {'skin': '#8a7a4a', 'tunic': '#4a3a22', 'armor': '#68502b', 'bracer': '#97713a', 'belt': '#2a1c0e', 'head': 'human', 'ears': 'goblin', 'eyeCol': '#ffd23a', 'smile': True, 'weapon': 'torch', 'headR': 0.55, 'bodyW': 0.8, 'torso': 0.85},
    'assassin': {'skin': '#c8b8a8', 'body': 'robe', 'tunic': '#2a2530', 'hoodCol': '#1f1a26', 'head': 'hood', 'eyeCol': '#ff5a3a', 'weapon': 'dagger', 'headR': 0.52, 'torso': 0.95, 'trim': '#3a3a4a'},
    'thief': {'skin': '#c8b8a8', 'tunic': '#5a5a2a', 'armor': '#4b4926', 'bracer': '#77713c', 'belt': '#2e2a14', 'head': 'human', 'eyeCol': '#3a3a4a', 'weapon': 'dagger', 'headR': 0.52, 'torso': 0.9, 'bodyW': 0.8},
    'hulker': {'skin': '#5a1a5a', 'tunic': '#3a122a', 'belt': '#24101a', 'head': 'orc', 'eyeCol': '#ff2a6a', 'scar': True, 'hair': 'wild', 'weapon': 'cleaver', 'headR': 0.6, 'bodyW': 1.25, 'torso': 1.2},
    'gargoyle': {'skin': '#6a6a72', 'tunic': '#4a4a52', 'armor': '#8a8a94', 'belt': '#3a3a44', 'head': 'demon', 'eyeCol': '#ff3a2a', 'wings': True, 'wingCol': '#5a5a64', 'weapon': 'club', 'headR': 0.55, 'torso': 1.0, 'bodyW': 1.0},
    'shaman': {'skin': '#a07a3a', 'tunic': '#6a4a2a', 'armor': '#80602d', 'bracer': '#a57e3c', 'belt': '#3a2a14', 'skirt': '#5a4a3a', 'head': 'orc', 'eyeCol': '#ffd23a', 'earring': True, 'scar': True, 'totem': True, 'weapon': 'staff', 'glowCol': '#ffb04a', 'headR': 0.55, 'torso': 0.95, 'bodyW': 0.9},
    'demon': {'skin': '#c8382a', 'tunic': '#6a1f1a', 'armor': '#8a3a3a', 'belt': '#3a1210', 'trim': '#ff8a3a', 'head': 'demon', 'eyeCol': '#ffe23a', 'weapon': 'cleaver', 'headR': 0.58, 'bodyW': 1.0, 'torso': 1.0},
    'lich': {'skin': '#7a6a9a', 'body': 'robe', 'tunic': '#2a1a3a', 'hoodCol': '#1f142a', 'head': 'rot', 'eyeCol': '#8aff9a', 'crown': True, 'weapon': 'staff', 'glowCol': '#8aff9a', 'headR': 0.52, 'torso': 1.0, 'cape': '#1f142a', 'trim': '#c9a54a'},
}
_ART_MAP = {
    'fireGolem': 'art:fireGolem', 'stoneGolem': 'art:stoneGolem', 'bat': 'art:bat',
    'wisp': 'art:wisp', 'crawler': 'art:crawler',
    'dragon': 'dragon', 'iceDragon': 'iceDragon', 'treant': 'treant',
    'warMachine': 'warMachine', 'voidLord': 'voidLord',
    'iceWraith': 'iceWraith', 'stormSpirit': 'stormSpirit',
}
_DEFAULT_SPEC = {'skin': '#8a8a8a', 'head': 'human', 'weapon': 'club', 'headR': 0.52, 'torso': 0.9}


def _get_font(size):
    key = int(size)
    if key not in _fonts:
        _fonts[key] = pygame.font.SysFont('arial,sans-serif', key)
    return _fonts[key]


def _fill_text(surface, ctx, text, x, y, size=10, color='#ffffff', baseline='top'):
    try:
        font = _get_font(size)
        col = _parse_color(color)
        surf = font.render(str(text), True, col[:3])
        p = ctx._apply(x, y)
        r = surf.get_rect()
        if baseline == 'middle':
            r.center = (int(p[0]), int(p[1]))
        else:
            r.midtop = (int(p[0]), int(p[1]))
        surface.blit(surf, r)
    except Exception:
        pass


def whitewash(obj):
    for k in obj:
        v = obj[k]
        if isinstance(v, str) and len(v) > 0 and v[0] == '#':
            obj[k] = '#ffffff'
        elif isinstance(v, dict):
            whitewash(v)


class Enemy:
    def __init__(self, type, path, pathIndex=0, hpScale=1):
        def_ = ENEMIES[type]
        self.type = type
        self.name = def_['name']
        self.desc = def_['desc']
        self.hpMax = def_['hp'] * hpScale
        self.hp = self.hpMax
        self.speed = def_['speed']
        self.reward = def_['reward']
        self.r = def_['r']
        self.color = def_['color']
        self.armor = def_.get('armor', 0)
        self.flying = bool(def_.get('flying', False))
        self.boss = bool(def_.get('boss', False))
        self.enrage = bool(def_.get('enrage', False))
        self.revive = def_.get('revive', 0)
        self.revived = False
        self.regen = def_.get('regen', 0)
        self.buff = bool(def_.get('buff', False))
        self.necro = bool(def_.get('necro', False))
        self.resist = dict(def_.get('resist', {}))
        self.weak = dict(def_.get('weak', {}))
        self.pathPos = 0
        self.alive = True
        self.leaked = False
        self.burn = None
        self.slow: dict | None = None
        self.freeze = None
        self.buffed = 1
        self.anim = random.random() * 6.28
        self.walkPhase = random.random() * 6.28
        self.wobbleS = 0
        self.flash = 0
        self.face = 1
        self.deathHandled = False
        self.deadT = 0
        self.deadTMax = 0.8
        self.deathFrozen = False
        self.enraged = False
        self._spr = None
        self._spr_key = None
        self.summonCd = def_.get('summonCd', 6)
        self.summonType = def_.get('summonType', 'goblin')
        self.flyPhase = def_.get('flyPhase', 1)
        self.ragePhase = def_.get('ragePhase', 0)
        self.fireStun = def_.get('fireStun', 0)
        self.fireCd = 6 + random.random() * 3
        self.announced = False
        self.path = path
        self.pathIndex = pathIndex
        self.x = 0
        self.y = 0
        self.angle = 0
        self.dist = 0
        self.targetsTowers = bool(def_.get('targetsTowers', False))
        self.towerDmg = def_.get('towerDmg', 0)
        self.steal = bool(def_.get('steal', False))
        self.corruption = def_.get('corruption', 0)
        self.corrupted = False
        self.poison = None
        self.hex = None
        self.split = def_.get('split', None)
        self.explode = def_.get('explode', None)
        self.buffShaman = bool(def_.get('buffShaman', False))
        self.frostStun = def_.get('frostStun', 0)
        self.mutation = None
        self.towerTarget = None
        self.towerAtkCd = 0
        self.towerLeash = False
        self.blockedBy = None
        self.meleeCd = 0
        self.meleeDmg = max(5, int(def_.get('hp', 50) * 0.08))
        self._step = None
        self.attackMult = 1
        self.pathLength = self._computePathLength()
        p0 = self._pathPoint(0)
        self.x = p0['x']
        self.y = p0['y']
        if self.boss:
            self.corruption = max(self.corruption, 15)

    def _computePathLength(self):
        length = 0
        steps = 200
        for i in range(steps):
            p1 = self._pathPoint(i)
            p2 = self._pathPoint(i + 1)
            dx = p2['x'] - p1['x']
            dy = p2['y'] - p1['y']
            length += math.sqrt(dx * dx + dy * dy)
        return length

    def _pathPoint(self, pos):
        path = self.path
        if not path:
            return {'x': 0, 'y': 0, 'angle': 0}
        cell = CONFIG['CELL']
        totalSegs = len(path) - 1
        segLen = cell
        if pos < 0:
            p = path[0]
            return {'x': p[0] * cell + cell // 2, 'y': p[1] * cell + cell // 2, 'angle': 0}
        seg = int(pos / segLen) if segLen > 0 else 0
        t = (pos / segLen) - seg if segLen > 0 else 0
        if seg >= totalSegs:
            p = path[-1]
            return {'x': p[0] * cell + cell // 2, 'y': p[1] * cell + cell // 2, 'angle': 0}
        p1 = path[seg]
        p2 = path[seg + 1]
        x1 = p1[0] * cell + cell // 2
        y1 = p1[1] * cell + cell // 2
        x2 = p2[0] * cell + cell // 2
        y2 = p2[1] * cell + cell // 2
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        angle = math.atan2(y2 - y1, x2 - x1)
        return {'x': x, 'y': y, 'angle': angle}

    def mutate(self):
        traits = [
            {'id': 'armored', 'name': 'Blindado', 'icon': '\U0001f6e1\ufe0f', 'desc': '+50% vida y +4 armadura', 'hp': 1.5, 'armor': 4, 'color': '#9a9a9a'},
            {'id': 'swift', 'name': 'Veloz', 'icon': '\U0001f4a8', 'desc': '+50% velocidad', 'speed': 1.5, 'color': '#8ad4ff'},
            {'id': 'regen', 'name': 'Regenerador', 'icon': '\U0001f49a', 'desc': 'Regenera 5/s', 'regen': 5, 'color': '#7ad47f'},
            {'id': 'frenzy', 'name': 'Fren\u00e9tico', 'icon': '\U0001f621', 'desc': '+70% da\u00f1o, -20% vida', 'damage': 1.7, 'hp': 0.8, 'color': '#ff5a3a'},
            {'id': 'void', 'name': 'Del Vac\u00edo', 'icon': '\U0001f30c', 'desc': 'Resiste toda la magia 40%', 'resAll': 0.6, 'color': '#b08aff'},
            {'id': 'giant', 'name': 'Gigante', 'icon': '\U0001f418', 'desc': '+80% vida, +20% tama\u00f1o', 'hp': 1.8, 'rMult': 1.25, 'color': '#e0b05a'},
        ]
        t = traits[random.randint(0, len(traits) - 1)]
        self.mutation = t
        if t.get('hp'):
            self.hpMax *= t['hp']
            self.hp = self.hpMax
        if t.get('armor'):
            self.armor += t['armor']
        if t.get('speed'):
            self.speed *= t['speed']
        if t.get('regen'):
            self.regen = (self.regen or 0) + t['regen']
        if t.get('damage'):
            self.attackMult = t['damage']
        if t.get('rMult'):
            self.r *= t['rMult']
        if t.get('resAll'):
            for el in ['fire', 'ice', 'earth', 'nature']:
                self.resist[el] = min(self.resist.get(el, 1), t['resAll'])
        return t

    @property
    def effectiveName(self):
        if self.mutation:
            return '\u2b50 ' + self.mutation['name'] + ' ' + self.name
        return self.name

    def takeDamage(self, dmg, element, tower=None, ignoreArmor=False):
        if not self.alive:
            return
        mult = 1
        if self.resist.get(element):
            mult *= self.resist[element]
        if self.weak.get(element):
            mult *= self.weak[element]
        if self.hex and self.hex['t'] > 0:
            mult *= self.hex['mult']
        d = dmg * mult
        if element == 'physical' and not ignoreArmor:
            d -= self.armor
        d = max(1, d)
        self.hp -= d
        self.flash = 0.1
        AUDIO.play_sfx(AUDIO.sfx.enemy_hurt(), 0.25)
        if tower:
            tower.totalDamage = getattr(tower, 'totalDamage', 0) + d
        try:
            if DIRECTOR and DIRECTOR.recordDamage:
                DIRECTOR.recordDamage(element, d)
        except NameError:
            pass
        if self.enrage and not self.enraged and self.hp <= self.hpMax * 0.5:
            self.enraged = True
            if self.boss:
                AUDIO.play_sfx(AUDIO.sfx.boss_enrage(), 0.5)
        if self.hp <= 0:
            self.hp = 0
            self.alive = False
            self.deathFrozen = bool(self.freeze)
            self.deadTMax = 0.3 if self.deathFrozen else 0.8
            self.deadT = self.deadTMax

    def update(self, dt, game):
        self.anim += dt * (9 if self.flying else 5)
        self.wobbleS = self.anim
        if not self.alive:
            self.deadT -= dt
            return
        if self.flash > 0:
            self.flash -= dt
        if self.burn:
            self.burn['t'] -= dt
            self.takeDamage(self.burn['dps'] * dt, 'fire')
            if self.burn['t'] <= 0:
                self.burn = None
        if self.poison:
            self.poison['t'] -= dt
            self.takeDamage(self.poison['dps'] * dt, 'nature')
            if self.poison['t'] <= 0:
                self.poison = None
        if self.hex:
            self.hex['t'] -= dt
            if self.hex['t'] <= 0:
                self.hex = None
        slowMult = 1
        if self.slow:
            self.slow['t'] -= dt
            if self.slow['t'] > 0:
                slowMult = self.slow['mult']
            else:
                self.slow = None
        if self.freeze:
            self.freeze['t'] -= dt
            if self.freeze['t'] <= 0:
                self.freeze = None
        weatherSpeed = 1
        try:
            if WEATHER.fx and WEATHER.fx.enemySpeed:
                weatherSpeed = WEATHER.fx.enemySpeed
        except (NameError, AttributeError):
            pass
        spd = self.speed * (0.1 if self.freeze else 1) * slowMult * self.buffed * (1.6 if self.enraged else 1) * weatherSpeed
        self.walkPhase += dt * spd * 0.085
        if not self.flying:
            step = int(self.walkPhase * 2)
            if step != self._step:
                self._step = step
                game.particles.append({
                    'x': self.x - self.face * 2, 'y': self.y + self.r * 0.85,
                    'vx': (random.random() - 0.5) * 12, 'vy': -6 - random.random() * 8,
                    'life': 0.32, 'max': 0.32, 'color': (150, 130, 100, 115), 'size': 1.8, 'grav': -4,
                })
        if self.regen > 0 and not self.freeze and not self.burn:
            self.hp = min(self.hpMax, self.hp + self.regen * dt)
        if self.targetsTowers:
            self.updateTowerAttack(dt, game)
            return
        if not self.flying and not self.steal:
            blocker = None
            if self.blockedBy and self.blockedBy.alive:
                dx = self.blockedBy.x - self.x
                dy = self.blockedBy.y - self.y
                if dx * dx + dy * dy < (CONFIG['CELL'] * 3) ** 2:
                    blocker = self.blockedBy
                else:
                    self.blockedBy = None
            if not blocker:
                for s in game.soldiers:
                    if not s.alive:
                        continue
                    dx = s.x - self.x
                    dy = s.y - self.y
                    if dx * dx + dy * dy < (CONFIG['CELL'] * 2.5) ** 2:
                        if s.engaged and s.engaged is not self:
                            continue
                        blocker = s
                        self.blockedBy = s
                        s.engaged = self
                        break
            if blocker:
                self.meleeCd -= dt
                self.angle = math.atan2(blocker.y - self.y, blocker.x - self.x)
                if self.meleeCd <= 0:
                    self.meleeCd = 1.0
                    blocker.takeDamage(self.meleeDmg, 'physical')
                    self.flash = 0.1
                p2 = game.pathPoint(self.pathPos)
                self.x = p2['x']
                self.y = p2['y']
                return
        if self.steal:
            self.pathPos += spd * dt
            p = game.pathPoint(self.pathPos)
            self.x = p['x']
            self.y = p['y']
            self.angle = p['angle']
            if self.pathPos >= game.pathLength:
                game.enemyLeaks(self)
            return
        self.pathPos += spd * dt
        if self.boss:
            self.bossUpdate(dt, game)
        p2 = game.pathPoint(self.pathPos)
        self.x = p2['x']
        self.y = p2['y']
        self.angle = p2['angle']
        if self.pathPos >= game.pathLength:
            game.enemyLeaks(self)

    def updateTowerAttack(self, dt, game):
        if not self.towerTarget or not hasattr(self.towerTarget, 'hp') or self.towerTarget.hp <= 0:
            self.towerTarget = self.findTowerTarget(game)
            if not self.towerTarget:
                self.towerTarget = None
                return
        dx = self.towerTarget.x - self.x
        dy = self.towerTarget.y - self.y
        d = math.hypot(dx, dy)
        spd = self.speed * (0.1 if self.freeze else 1) * (1.6 if self.enraged else 1)
        if d > self.r + 14:
            self.x += dx / d * spd * dt
            self.y += dy / d * spd * dt
            self.angle = math.atan2(dy, dx)
        else:
            self.towerAtkCd -= dt
            atk = self._atk()
            if self.towerAtkCd <= 0:
                self.towerAtkCd = 1.1
                self.towerTarget.takeDamage(self.towerDmg, self)
                game.burst(self.towerTarget.x, self.towerTarget.y, '#ff8a3a', 6)
                game.burst(self.towerTarget.x, self.towerTarget.y, '#ffe08a', 4)
                game.hitSpark(self.towerTarget.x, self.towerTarget.y, '#ff6a2a')
                AUDIO.play_sfx(AUDIO.sfx.enemy_attack_tower(), 0.3)
                game.shockRing(self.towerTarget.x, self.towerTarget.y, 30, '#ff8a3a', 0.3)
                game.texts.append({
                    'x': self.towerTarget.x, 'y': self.towerTarget.y - 22,
                    'txt': '\U0001f4a5', 'life': 0.5, 'max': 0.5,
                    'color': '#ff8a3a', 'vy': -14, 'size': 11,
                })
            elif atk > 0.35 and atk < 0.65:
                lunge = math.sin((atk - 0.35) / 0.3 * math.pi) * 9 * dt
                self.x += dx / d * lunge
                self.y += dy / d * lunge
        if len(game.towers) == 0:
            self.towerTarget = None

    def findTowerTarget(self, game):
        best = None
        bestD = float('inf')
        for t in game.towers:
            if t.hp <= 0:
                continue
            dx = t.x - self.x
            dy = t.y - self.y
            d = dx * dx + dy * dy
            if d < bestD:
                bestD = d
                best = t
        return best

    def bossUpdate(self, dt, game):
        if self.type in ('dragon', 'iceDragon'):
            if self.hp < self.hpMax * self.flyPhase and not self.flying:
                self.flying = True
                AUDIO.play_sfx(AUDIO.sfx.boss_appear(), 0.5)
                game.texts.append({
                    'x': self.x, 'y': self.y - 50,
                    'txt': '\U0001f409 \u00a1El drag\u00f3n alza el vuelo!' if self.type == 'dragon' else '\U0001f409 \u00a1El drag\u00f3n de hielo alza el vuelo!',
                    'life': 2, 'max': 2,
                    'color': '#ff8a6a' if self.type == 'dragon' else '#9fd4ff',
                    'vy': -20, 'size': 16,
                })
            if self.hp < self.hpMax * self.ragePhase and not self.enraged:
                self.enraged = True
                self.speed *= 1.7
                game.texts.append({
                    'x': self.x, 'y': self.y - 50,
                    'txt': '\U0001f621 \u00a1FURIA!',
                    'life': 2, 'max': 2, 'color': '#ff5a3a',
                    'vy': -20, 'size': 16,
                })
            if self.flying:
                self.fireCd -= dt
                if self.fireCd <= 0:
                    self.fireCd = self.fireStun or self.frostStun
                    ts = game.towers
                    if ts:
                        t = ts[random.randint(0, len(ts) - 1)]
                        t.stun = 3.5
                        breathCol = '#ff9a3a' if self.type == 'dragon' else '#bfe8ff'
                        ang = math.atan2(t.y - self.y, t.x - self.x)
                        for fl in range(12):
                            fa = ang + (random.random() - 0.5) * 0.35
                            fsp = 130 + random.random() * 90
                            game.particles.append({
                                'x': self.x + math.cos(ang) * self.r * 0.7,
                                'y': self.y - self.r * 0.4 + math.sin(ang) * self.r * 0.7,
                                'vx': math.cos(fa) * fsp, 'vy': math.sin(fa) * fsp,
                                'life': 0.35 + random.random() * 0.2, 'max': 0.5,
                                'color': breathCol, 'size': 3 + random.random() * 3, 'grav': 0,
                            })
                        game.burst(t.x, t.y, '#ff7a30' if self.type == 'dragon' else '#9fd4ff', 16)
                        game.shockRing(t.x, t.y, 60, breathCol, 0.35)
                        AUDIO.play_sfx(AUDIO.sfx.boss_attack_dragon_breath(), 0.4)
                        game.texts.append({
                            'x': t.x, 'y': t.y - 24,
                            'txt': '\U0001f525 \u00a1Torre en llamas!' if self.type == 'dragon' else '\u2744\ufe0f \u00a1Torre congelada!',
                            'life': 1.5, 'max': 1.5,
                            'color': '#ff6a3a' if self.type == 'dragon' else '#bfe8ff',
                            'vy': -16, 'size': 12,
                        })
                        if self.type == 'iceDragon':
                            game.frostNova(t.x, t.y, 90, 0.55, 2.5)
        elif self.necro or self.type in ('orcKing', 'voidLord'):
            self.summonCd -= dt
            if self.summonCd <= 0:
                self.summonCd = 5 if self.type == 'lord' else (7 if self.type == 'voidLord' else 6)
                n = 2 if self.type in ('lord', 'voidLord') else 1
                portalCol = '#b08aff' if self.type == 'voidLord' else ('#8aff9a' if self.type == 'lord' else '#ffb03a')
                game.shockRing(self.x, self.y, self.r * 2.6, portalCol, 0.45)
                AUDIO.play_sfx(AUDIO.sfx.boss_summon(), 0.4)
                for i in range(n):
                    if len(game.enemies) > 70:
                        break
                    sk = Enemy(self.summonType, self.path, self.pathIndex)
                    sk.pathPos = max(0, self.pathPos - 20 - i * 30)
                    sk.hpMax *= 0.9
                    sk.hp = sk.hpMax
                    game.enemies.append(sk)
                    game.burst(sk.x, sk.y, portalCol, 8)

    def draw(self, surface, camX, camY, game):
        ctx = Ctx(surface)
        ctx.translate(-camX, -camY)
        dying = not self.alive
        bob = 0
        if not dying:
            if self.freeze:
                bob = math.sin(self.anim) * 0.4
            elif self.flying:
                bob = math.sin(self.anim) * 4
            else:
                bob = math.sin(self.walkPhase * 2) * self.r * 0.07
        y = self.y + bob
        shR = self.r * (0.7 if self.flying else 1.15)
        shAlpha = 0.04 if dying else (0.12 if self.flying else 0.22)
        ctx.globalAlpha = shAlpha
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(self.x, self.y + self.r * 0.85, shR, self.r * 0.28, 0, 0, TWO_PI)
        ctx.fill()
        if not dying and not self.flying and self.r > 6:
            ctx.globalAlpha = shAlpha * 0.4
            ctx.beginPath()
            ctx.ellipse(self.x + 1, self.y + self.r * 0.9, shR * 0.7, self.r * 0.2, 0, 0, TWO_PI)
            ctx.fill()
        ctx.globalAlpha = 1.0
        c = '#ffffff' if self.flash > 0 else self.color
        self.face = 1 if math.cos(self.angle) >= 0 else -1
        hitKick = (self.flash / 0.1) * 0.045 * self.face if self.flash > 0 else 0
        if dying:
            ctx.save()
            fall = max(0, min(1, self.deadT / self.deadTMax))
            ctx.globalAlpha = fall * fall if self.deathFrozen else fall
            ctx.translate(self.x, self.y)
            if self.deathFrozen:
                ctx.translate(0, (1 - fall) * 8)
                ctx.rotate((1 - fall) * 0.5)
            else:
                ctx.rotate(0.08 - self.face * (1 - fall) * 1.15)
                ctx.translate(0, (1 - fall) * 4)
            self.drawBody(ctx, y, c)
            ctx.restore()
        else:
            spr = self._body_sprite(c)
            if spr is not None:
                w, h = spr.get_size()
                surface.blit(spr, (int(self.x - w * 0.5), int(y - h * 0.5)))
            else:
                ctx.save()
                ctx.translate(self.x, y)
                stride = math.sin(self.walkPhase * 2)
                ctx.rotate(stride * 0.07 * (0.3 if self.freeze else 1) + hitKick + (math.sin(self.anim * 3) * 0.02 if self.enraged else 0))
                self.drawBody(ctx, y, c)
                ctx.restore()
        if dying:
            return
        if self.enraged:
            pulse = 0.22 + 0.14 * math.sin(self.anim * 6)
            ctx.globalAlpha = pulse * 0.7
            ctx.fillStyle = '#ff3a2a'
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 8, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = pulse
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 4, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = 1.0
        if self.corrupted:
            ctx.globalAlpha = 0.25
            ctx.fillStyle = '#8a2a8a'
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 6 + math.sin(self.anim * 3) * 2, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = 0.4
            ctx.strokeStyle = '#a040a0'
            ctx.lineWidth = 1.5
            for ci in range(3):
                ca = self.anim * 1.5 + ci * 2.09
                cr = self.r + 3 + math.sin(self.anim * 2 + ci) * 2
                ctx.beginPath()
                ctx.arc(self.x + math.cos(ca) * cr * 0.3, y + math.sin(ca) * cr * 0.3, 2, 0, TWO_PI)
                ctx.fill()
            ctx.globalAlpha = 1.0
        if self.mutation:
            ctx.fillStyle = self.mutation['color']
            ctx.beginPath()
            ctx.arc(self.x, y - self.r - 14, 7, 0, TWO_PI)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(self.x, y - self.r - 14, 7, 0, TWO_PI)
            ctx.stroke()
            _fill_text(surface, ctx, self.mutation.get('icon', ''), self.x, y - self.r - 16, size=9, color='#ffffff', baseline='middle')
        if self.freeze:
            ctx.globalAlpha = 0.35
            ctx.fillStyle = '#bfe8ff'
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 4, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = 0.2
            ctx.fillStyle = '#e8f6ff'
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 2, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = 0.5
            ctx.strokeStyle = '#d0eeff'
            ctx.lineWidth = 1
            for fi in range(3):
                fa = self.anim * 0.8 + fi * 2.09
                fx = self.x + math.cos(fa) * (self.r + 2)
                fy = y + math.sin(fa) * (self.r + 2)
                ctx.beginPath()
                ctx.moveTo(fx - 2, fy - 2)
                ctx.lineTo(fx + 2, fy + 2)
                ctx.moveTo(fx + 2, fy - 2)
                ctx.lineTo(fx - 2, fy + 2)
                ctx.stroke()
            ctx.globalAlpha = 1.0
            _fill_text(surface, ctx, '\u2744', self.x, y - self.r - 10, size=10, color='#ffffff', baseline='middle')
        if self.hex and self.hex['t'] > 0:
            hAlpha = 0.35 + 0.25 * math.sin(self.anim * 5)
            ctx.globalAlpha = hAlpha * 0.5
            ctx.fillStyle = '#8060c0'
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 4, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = hAlpha
            ctx.strokeStyle = '#b08aff'
            ctx.lineWidth = 1.6
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 5 + math.sin(self.anim * 3) * 1.5, 0, TWO_PI)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(200,160,255,0.4)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.arc(self.x, y, self.r + 8 + math.sin(self.anim * 2) * 2, 0, TWO_PI)
            ctx.stroke()
            ctx.globalAlpha = 1.0
            _fill_text(surface, ctx, '\u2744', self.x, y - self.r - 10, size=10, color='#c8a0ff', baseline='middle')
        if self.burn:
            bFl = 0.6 + 0.4 * math.sin(self.anim * 2)
            for bi in range(3):
                ba = self.anim * 4 + bi * 2.09
                bx = self.x + math.sin(ba) * self.r * 0.4
                by2 = y - self.r - bi * 3
                bs = (4 - bi) * bFl
                ctx.globalAlpha = (0.7 - bi * 0.15) * bFl
                ctx.fillStyle = '#ff7a30' if bi == 0 else '#ffaa40'
                ctx.beginPath()
                ctx.arc(bx, by2, bs, 0, TWO_PI)
                ctx.fill()
            ctx.globalAlpha = 0.4 * bFl
            ctx.fillStyle = '#ffcc60'
            ctx.beginPath()
            ctx.arc(self.x, y - self.r, 2, 0, TWO_PI)
            ctx.fill()
            ctx.globalAlpha = 1.0
        self.drawHpBar(ctx, y)
        self.drawResistBadges(ctx, y)

    def drawBody(self, ctx, y, c):
        atk = self._atk()
        st = {
            'r': self.r,
            'walk': self.walkPhase,
            'atk': atk,
            'anim': self.anim,
            'freeze': bool(self.freeze),
            'flying': bool(self.flying),
            'enraged': bool(self.enraged),
            'ghost': None,
            'flap': math.sin(self.anim),
            'blink': (self.anim % 8.5) > 8.18,
            'face': self.face,
        }
        art = _ART_MAP.get(self.type)
        if art is not None:
            art_draws = {
                'art:fireGolem': lambda: fireGolem_draw(ctx, self.r, st),
                'art:stoneGolem': lambda: stoneGolem_draw(ctx, self.r, st),
                'art:bat': lambda: bat_draw(ctx, self.r, st),
                'art:wisp': lambda: wisp_draw(ctx, self.r, st),
                'art:crawler': lambda: spider_draw(ctx, self.r, st),
                'dragon': lambda: self._drawDragon(ctx, st, False),
                'iceDragon': lambda: self._drawDragon(ctx, st, True),
                'treant': lambda: self._drawTreant(ctx, st),
                'warMachine': lambda: self._drawWarMachine(ctx, st),
                'voidLord': lambda: self._drawVoidLord(ctx, st),
                'iceWraith': lambda: self._drawIceWraith(ctx, st),
                'stormSpirit': lambda: self._drawStormSpirit(ctx, st),
            }
            art_draws[art]()
            return
        spec = _SPECS.get(self.type)
        if spec is None:
            spec = dict(_DEFAULT_SPEC)
            spec['skin'] = c
        if self.flash > 0:
            spec = dict(spec)
            whitewash(spec)
        figure(ctx, spec, st)

    def _atk(self):
        e = self
        if e.towerAtkCd > 0:
            return max(0, min(1, 1 - e.towerAtkCd / 1.1))
        fs = e.fireStun or e.frostStun
        if e.fireCd > 0 and fs:
            return max(0, min(1, 1 - e.fireCd / fs))
        sc = 5 if e.type in ('lord', 'voidLord') else 6
        if e.summonCd > 0:
            return max(0, min(1, 1 - e.summonCd / sc))
        return 0

    def _body_sprite(self, c):
        if self.flash > 0:
            return None
        walk_q = round(self.walkPhase * 2) / 2
        anim_q = round(self.anim * 2) / 2
        atk = self._atk()
        key = (walk_q, anim_q, self.face, bool(self.freeze), bool(self.enraged),
               bool(self.corrupted), self.mutation is not None, round(atk * 5) / 5)
        if self._spr is not None and self._spr_key == key:
            return self._spr
        r = self.r
        pad = int(r * 3.4) + 10
        spr = pygame.Surface((pad * 2, pad * 2), pygame.SRCALPHA)
        sctx = Ctx(spr)
        sctx.translate(pad, pad)
        stride = math.sin(walk_q * 2)
        rot = stride * 0.07 * (0.3 if self.freeze else 1) + (math.sin(anim_q * 3) * 0.02 if self.enraged else 0)
        if rot:
            sctx.rotate(rot)
        self.drawBody(sctx, 0.0, c)
        self._spr = spr
        self._spr_key = key
        return spr

    def _drawDragon(self, ctx, st, ice):
        r = st['r']
        col = '#9fd4ee' if ice else '#c04028'
        dark = shade(col, -42)
        belly = '#eaf6ff' if ice else '#f2cd96'
        glow = '#bfeaff' if ice else '#ffc06a'
        spine = rgba('#e1f5ff', 0.95) if ice else shade(col, -55)
        flap = st.get('flap', math.sin(st['anim']))
        jaw = 0.9 if st['atk'] > 0.72 else (0.35 if st['atk'] > 0.45 else 0.08)
        wag = math.sin(st['anim'] * 1.3) * r * 0.12
        bobN = math.sin(st['anim'] * 1.1) * r * 0.05
        tuck = 1 if st['flying'] else 0
        ctx.save()
        ctx.scale(-1 if st['face'] == -1 else 1, 1)
        ctx.translate(0, math.sin(st['anim'] * 1.3) * r * 0.08)
        # COLA
        ctx.beginPath()
        ctx.moveTo(-r * 0.82, -r * 0.3)
        ctx.quadraticCurveTo(-r * 1.5, -r * 0.12, -r * 2.28, r * 0.02 + wag)
        ctx.quadraticCurveTo(-r * 1.5, r * 0.42, -r * 0.78, r * 0.24)
        ctx.closePath()
        ctx.fillStyle = col
        ctx.fill()
        ctx.strokeStyle = rgba(dark, 0.6)
        ctx.lineWidth = max(1, r * 0.04)
        ctx.stroke()
        # punta en flecha
        ctx.beginPath()
        ctx.moveTo(-r * 2.24, r * 0.02 + wag)
        ctx.lineTo(-r * 2.62, -r * 0.16 + wag)
        ctx.lineTo(-r * 2.44, r * 0.06 + wag)
        ctx.lineTo(-r * 2.6, r * 0.24 + wag)
        ctx.closePath()
        ctx.fillStyle = spine
        ctx.fill()
        # púas dorsales de la cola
        for i in range(3):
            tx = -r * (1.15 + i * 0.38)
            ty = -r * (0.24 - i * 0.04) + wag * i * 0.35
            ctx.beginPath()
            ctx.moveTo(tx - r * 0.1, ty)
            ctx.lineTo(tx - r * 0.02, ty - r * (0.2 - i * 0.04))
            ctx.lineTo(tx + r * 0.1, ty + r * 0.02)
            ctx.closePath()
            ctx.fill()
        # ALA LEJANA
        wing(ctx, r * 0.02, -r * 0.68, -1, r * 1.65, flap * 0.85, shade(col, -16), dark)
        # PATA TRASERA LEJANA
        ctx.fillStyle = shade(col, -22)
        ctx.beginPath()
        ctx.ellipse(-r * 0.55, r * 0.08, r * 0.24, r * 0.34, 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = shade(col, -22)
        ctx.lineWidth = r * 0.13
        ctx.beginPath()
        ctx.moveTo(-r * 0.6, r * 0.3)
        ctx.lineTo(-r * 0.72, r * (0.62 - tuck * 0.25))
        ctx.stroke()
        # TORSO
        ctx.beginPath()
        ctx.ellipse(-r * 0.08, -r * 0.18, r * 1.02, r * 0.62, -0.06, 0, TWO_PI)
        ctx.fillStyle = shade(col, 26)
        ctx.fill()
        ctx.strokeStyle = rgba('#140a08', 0.85)
        ctx.lineWidth = max(1.5, r * 0.055)
        ctx.stroke()
        # placas ventrales
        ctx.beginPath()
        ctx.ellipse(r * 0.02, r * 0.2, r * 0.68, r * 0.3, -0.04, 0, TWO_PI)
        ctx.fillStyle = belly
        ctx.fill()
        ctx.strokeStyle = rgba(shade(belly, -70), 0.55)
        ctx.lineWidth = max(1, r * 0.035)
        for i in range(5):
            px = -r * 0.5 + i * r * 0.26
            ctx.beginPath()
            ctx.moveTo(px, r * 0.02)
            ctx.quadraticCurveTo(px + r * 0.06, r * 0.22, px - r * 0.02, r * 0.42)
            ctx.stroke()
        # escamas del lomo
        ctx.strokeStyle = rgba(dark, 0.28)
        ctx.lineWidth = max(0.8, r * 0.03)
        for row in range(3):
            for k in range(6):
                ctx.beginPath()
                ctx.arc(-r * 0.72 + k * r * 0.27 + (row % 2) * r * 0.13, -r * 0.58 + row * r * 0.15, r * 0.11, math.pi * 1.15, math.pi * 1.95)
                ctx.stroke()
        # escamas con highlight
        ctx.strokeStyle = rgba('#ffffff', 0.06)
        ctx.lineWidth = max(0.5, r * 0.02)
        for row2 in range(3):
            for k2 in range(4):
                sx_h = -r * 0.55 + k2 * r * 0.35 + (row2 % 2) * r * 0.15
                sy_h = -r * 0.55 + row2 * r * 0.15
                ctx.beginPath()
                ctx.arc(sx_h, sy_h, r * 0.08, math.pi * 1.3, math.pi * 1.7)
                ctx.stroke()
        # espinas dorsales del lomo
        ctx.fillStyle = spine
        for i in range(4):
            sx2 = -r * 0.75 + i * r * 0.42
            sy2 = -r * 0.66 - math.sin(i * 0.9) * r * 0.08
            ctx.beginPath()
            ctx.moveTo(sx2 - r * 0.11, sy2 + r * 0.06)
            ctx.lineTo(sx2, sy2 - r * (0.24 - i * 0.02))
            ctx.lineTo(sx2 + r * 0.12, sy2 + r * 0.08)
            ctx.closePath()
            ctx.fill()
            if ice:
                ctx.strokeStyle = rgba('#ffffff', 0.7)
                ctx.lineWidth = 1
                ctx.stroke()
        # PATAS CERCANAS
        ctx.fillStyle = shade(col, 12)
        ctx.beginPath()
        ctx.ellipse(-r * 0.38, r * 0.2, r * 0.3, r * 0.42, 0.22, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = dark
        ctx.lineWidth = r * 0.15
        ctx.beginPath()
        ctx.moveTo(-r * 0.34, r * 0.48)
        ctx.lineTo(-r * 0.44, r * (0.82 - tuck * 0.3))
        ctx.stroke()
        # delantera
        ctx.strokeStyle = shade(col, -8)
        ctx.lineWidth = r * 0.14
        ctx.beginPath()
        ctx.moveTo(r * 0.55, -r * 0.3)
        ctx.lineTo(r * 0.68, r * (0.1 - tuck * 0.1))
        ctx.stroke()
        ctx.strokeStyle = dark
        ctx.lineWidth = r * 0.11
        ctx.beginPath()
        ctx.moveTo(r * 0.68, r * (0.1 - tuck * 0.1))
        ctx.lineTo(r * 0.6, r * (0.48 - tuck * 0.26))
        ctx.stroke()
        # garras
        clawCol = '#ffffff' if ice else '#e8e0c8'
        ctx.fillStyle = clawCol
        feet = [[-r * 0.44, r * (0.86 - tuck * 0.3)], [r * 0.6, r * (0.52 - tuck * 0.26)]]
        for f in range(len(feet)):
            for cl in range(3):
                cxx = feet[f][0] + cl * r * 0.09
                cyy = feet[f][1]
                ctx.beginPath()
                ctx.moveTo(cxx - r * 0.035, cyy - r * 0.05)
                ctx.lineTo(cxx + r * 0.05, cyy + r * 0.06)
                ctx.lineTo(cxx - r * 0.01, cyy + r * 0.06)
                ctx.closePath()
                ctx.fill()
        # ALA CERCANA
        wing(ctx, r * 0.28, -r * 0.75, -1, r * 2.1, flap, col, dark)
        # CUELLO
        ctx.beginPath()
        ctx.moveTo(r * 0.5, -r * 0.72)
        ctx.quadraticCurveTo(r * 1.0, -r * 1.2 + bobN, r * 1.48, -r * 1.32 + bobN)
        ctx.lineTo(r * 1.64, -r * 1.14 + bobN)
        ctx.quadraticCurveTo(r * 1.12, -r * 0.88 + bobN, r * 0.82, -r * 0.28)
        ctx.quadraticCurveTo(r * 0.66, -r * 0.4, r * 0.5, -r * 0.72)
        ctx.closePath()
        ctx.fillStyle = shade(col, 10)
        ctx.fill()
        ctx.strokeStyle = rgba(dark, 0.5)
        ctx.lineWidth = max(1, r * 0.04)
        ctx.stroke()
        # placas de la garganta
        ctx.strokeStyle = rgba(shade(belly, -50), 0.65)
        ctx.lineWidth = max(1, r * 0.04)
        throat = [[1.5, -1.18], [1.34, -1.04], [1.18, -0.86], [1.02, -0.64]]
        for i in range(len(throat)):
            ctx.beginPath()
            ctx.moveTo(r * throat[i][0], r * throat[i][1] + bobN)
            ctx.quadraticCurveTo(
                r * (throat[i][0] + 0.08), r * (throat[i][1] + 0.08) + bobN,
                r * (throat[i][0] - 0.04), r * (throat[i][1] + 0.14) + bobN,
            )
            ctx.stroke()
        # púas del cuello
        ctx.fillStyle = spine
        nsp = [[0.72, -0.86, 0.2], [0.94, -1.1, 0.17], [1.16, -1.28, 0.14], [1.38, -1.42, 0.11]]
        for i in range(len(nsp)):
            ctx.beginPath()
            ctx.moveTo(r * (nsp[i][0] - 0.09), r * nsp[i][1] + bobN + r * 0.05)
            ctx.lineTo(r * nsp[i][0], r * nsp[i][1] + bobN - r * nsp[i][2])
            ctx.lineTo(r * (nsp[i][0] + 0.1), r * nsp[i][1] + bobN + r * 0.06)
            ctx.closePath()
            ctx.fill()
            if ice:
                ctx.strokeStyle = rgba('#ffffff', 0.7)
                ctx.lineWidth = 1
                ctx.stroke()
        # CABEZA
        ctx.save()
        ctx.translate(r * 1.64, -r * 1.46 + bobN)
        dragonHead(ctx, r * 0.58, col, dark, glow, jaw)
        ctx.restore()
        # ALIENTO
        if st['atk'] > 0.72:
            fl = 0.5 + 0.5 * math.sin(st['anim'] * 4)
            mx = r * 2.42
            my = -r * 1.38 + bobN
            if ice:
                layers = [
                    [1.55, 0.5, rgba('#96d7ff', 0.45)],
                    [1.15, 0.33, rgba('#c8f0ff', 0.7)],
                    [0.7, 0.18, '#ffffff'],
                ]
            else:
                layers = [
                    [1.55, 0.5, rgba('#ff601a', 0.5)],
                    [1.15, 0.33, rgba('#ffa640', 0.75)],
                    [0.7, 0.18, '#fff2b0'],
                ]
            for i in range(len(layers)):
                L = layers[i]
                length = r * L[0] * (0.92 + fl * 0.16)
                w = r * L[1]
                ctx.fillStyle = L[2]
                ctx.beginPath()
                ctx.moveTo(mx, my)
                ctx.quadraticCurveTo(mx + length * 0.45, my - w * (1 + fl * 0.35), mx + length, my + w * 0.08)
                ctx.quadraticCurveTo(mx + length * 0.5, my + w * 0.95, mx, my + w * 0.22)
                ctx.closePath()
                ctx.fill()
        ctx.restore()

    def _drawTreant(self, ctx, st):
        r = st['r']
        bark = '#6a4f33'
        dark = shade(bark, -35)
        leaf = '#5a9a4a'
        leafDark = shade(leaf, -30)
        ctx.save()
        sway = math.sin(st['anim'] * 1.2) * 0.04
        ctx.rotate(sway)
        ctx.strokeStyle = dark
        ctx.lineWidth = r * 0.28
        for i in [-1, 1]:
            ctx.beginPath()
            ctx.moveTo(i * r * 0.3, r * 0.3)
            ctx.quadraticCurveTo(i * r * 0.8, r * 0.8, i * r * 0.95, r * 1.15)
            ctx.stroke()
        ctx.strokeStyle = shade(dark, 20)
        ctx.lineWidth = r * 0.12
        for i2 in [-1, 1]:
            ctx.beginPath()
            ctx.moveTo(i2 * r * 0.35, r * 0.35)
            ctx.quadraticCurveTo(i2 * r * 0.7, r * 0.7, i2 * r * 0.8, r * 1.0)
            ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-r * 0.42, r * 0.3)
        ctx.quadraticCurveTo(-r * 0.55, -r * 0.7, -r * 0.4, -r * 1.0)
        ctx.lineTo(r * 0.4, -r * 1.0)
        ctx.quadraticCurveTo(r * 0.55, -r * 0.7, r * 0.42, r * 0.3)
        ctx.closePath()
        ctx.fillStyle = shade(bark, 12)
        ctx.fill()
        ctx.strokeStyle = rgba('#100c12', 0.92)
        ctx.lineWidth = max(1.4, r * 0.05)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(60,40,20,0.15)'
        ctx.lineWidth = 0.6
        for bv in range(-3, 4, 2):
            bvs = math.sin(bv * 0.8 + 0.5) * 1.0
            ctx.beginPath()
            ctx.moveTo(bv * r * 0.1, -r * 0.9 + bvs)
            ctx.quadraticCurveTo(bv * r * 0.08, -r * 0.3, bv * r * 0.12, r * 0.2 + bvs * 0.5)
            ctx.stroke()
        ctx.strokeStyle = rgba('#000000', 0.25)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.ellipse(-r * 0.2, -r * 0.1, r * 0.2, r * 0.4, 0.3, 0, TWO_PI)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(r * 0.22, r * 0.05, r * 0.16, r * 0.34, -0.3, 0, TWO_PI)
        ctx.stroke()
        ctx.fillStyle = 'rgba(50,80,30,0.1)'
        ctx.beginPath()
        ctx.ellipse(r * 0.1, -r * 0.5, r * 0.08, r * 0.14, 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = dark
        ctx.lineWidth = r * 0.22
        for a in [-1, 1]:
            lift = math.sin(st['walk'] + a) * r * 0.2
            ctx.beginPath()
            ctx.moveTo(a * r * 0.4, -r * 0.75)
            ctx.quadraticCurveTo(a * r * 0.95, -r * 0.6 + lift, a * r * 1.25, -r * 0.3 + lift)
            ctx.stroke()
            ctx.lineWidth = r * 0.12
            ctx.beginPath()
            ctx.moveTo(a * r * 1.25, -r * 0.3 + lift)
            ctx.quadraticCurveTo(a * r * 1.5, -r * 0.1 + lift, a * r * 1.4, r * 0.05 + lift)
            ctx.stroke()
            ctx.lineWidth = r * 0.22
        ctx.fillStyle = '#160c06'
        ctx.beginPath()
        ctx.ellipse(-r * 0.18, -r * 0.72, r * 0.12, r * 0.2, 0.15, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(r * 0.18, -r * 0.72, r * 0.12, r * 0.2, -0.15, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = '#8aff6a'
        ctx.beginPath()
        ctx.arc(-r * 0.18, -r * 0.72, r * 0.05, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.18, -r * 0.72, r * 0.05, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = 'rgba(100,255,80,0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(-r * 0.18, -r * 0.72, r * 0.08, 0, TWO_PI)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(r * 0.18, -r * 0.72, r * 0.08, 0, TWO_PI)
        ctx.stroke()
        ctx.strokeStyle = '#2a1a08'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(-r * 0.28, -r * 0.45)
        ctx.quadraticCurveTo(0, -r * 0.3, r * 0.28, -r * 0.45)
        ctx.stroke()
        ctx.fillStyle = leaf
        ctx.beginPath()
        ctx.ellipse(0, -r * 1.25, r * 0.7, r * 0.4, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(-r * 0.55, -r * 1.0, r * 0.4, r * 0.3, 0.4, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(r * 0.55, -r * 1.0, r * 0.4, r * 0.3, -0.4, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = leafDark
        ctx.beginPath()
        ctx.ellipse(0, -r * 1.3, r * 0.55, r * 0.32, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = 'rgba(70,140,50,0.4)'
        ctx.beginPath()
        ctx.ellipse(-r * 0.3, -r * 1.2, r * 0.25, r * 0.15, 0.5, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(r * 0.35, -r * 1.15, r * 0.2, r * 0.12, -0.3, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = 'rgba(40,80,25,0.12)'
        ctx.lineWidth = 0.5
        for lf in range(4):
            lx = -r * 0.4 + lf * r * 0.25
            ly = -r * 1.2 - abs(lf - 1.5) * r * 0.08
            ctx.beginPath()
            ctx.moveTo(lx - r * 0.08, ly + r * 0.02)
            ctx.lineTo(lx + r * 0.08, ly - r * 0.04)
            ctx.stroke()
        ctx.restore()

    def _drawWarMachine(self, ctx, st):
        r = st['r']
        iron = '#6a6a76'
        dark = shade(iron, -38)
        wood = '#6a4a2a'
        glow = '#ff6a3a'
        ctx.save()
        for s in [-1, 1]:
            ctx.save()
            ctx.translate(s * r * 0.75, r * 0.5)
            ctx.rotate(st['walk'] * 1.4)
            ctx.fillStyle = dark
            ctx.beginPath()
            ctx.arc(0, 0, r * 0.55, 0, TWO_PI)
            ctx.fill()
            ctx.fillStyle = iron
            ctx.beginPath()
            ctx.arc(0, 0, r * 0.42, 0, TWO_PI)
            ctx.fill()
            wg = ctx.createRadialGradient(-r * 0.08, -r * 0.08, 0, 0, 0, r * 0.42)
            wg.addColorStop(0, 'rgba(160,160,170,0.3)')
            wg.addColorStop(1, 'rgba(0,0,0,0.15)')
            ctx.fillStyle = wg
            ctx.beginPath()
            ctx.arc(0, 0, r * 0.42, 0, TWO_PI)
            ctx.fill()
            ctx.strokeStyle = dark
            ctx.lineWidth = r * 0.1
            for sp in range(5):
                ang = sp * 1.2566
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(math.cos(ang) * r * 0.4, math.sin(ang) * r * 0.4)
                ctx.stroke()
            ctx.fillStyle = '#8a8a96'
            ctx.beginPath()
            ctx.arc(0, 0, r * 0.12, 0, TWO_PI)
            ctx.fill()
            ctx.fillStyle = 'rgba(200,200,210,0.3)'
            ctx.beginPath()
            ctx.arc(-r * 0.03, -r * 0.03, r * 0.06, 0, TWO_PI)
            ctx.fill()
            ctx.restore()
        ctx.beginPath()
        ctx.moveTo(-r * 0.9, r * 0.15)
        ctx.lineTo(-r * 0.8, -r * 0.75)
        ctx.lineTo(r * 0.55, -r * 0.75)
        ctx.lineTo(r * 0.9, r * 0.15)
        ctx.closePath()
        ctx.fillStyle = shade(iron, 20)
        ctx.fill()
        ctx.strokeStyle = rgba('#121218', 0.9)
        ctx.lineWidth = max(1.4, r * 0.05)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(100,100,110,0.2)'
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(-r * 0.85, -r * 0.3)
        ctx.lineTo(r * 0.72, -r * 0.3)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-r * 0.88, r * 0.0)
        ctx.lineTo(r * 0.82, r * 0.0)
        ctx.stroke()
        ctx.fillStyle = '#9a9aa6'
        for rv in [-1, 0, 1]:
            ctx.beginPath()
            ctx.arc(rv * r * 0.55, -r * 0.55, 1.6, 0, TWO_PI)
            ctx.fill()
        ctx.fillStyle = 'rgba(180,180,190,0.3)'
        for rv2 in [-1, 0, 1]:
            ctx.beginPath()
            ctx.arc(rv2 * r * 0.55 - 0.3, -r * 0.58, 0.6, 0, TWO_PI)
            ctx.fill()
        for rv3 in [-0.5, 0.5]:
            ctx.fillStyle = '#9a9aa6'
            ctx.beginPath()
            ctx.arc(rv3 * r * 0.6, -r * 0.05, 1.4, 0, TWO_PI)
            ctx.fill()
        ctx.fillStyle = wood
        ctx.beginPath()
        ctx.moveTo(r * 0.5, -r * 0.75)
        ctx.lineTo(r * 0.95, -r * 0.55)
        ctx.lineTo(r * 1.0, r * 0.1)
        ctx.lineTo(r * 0.5, r * 0.1)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(50,30,15,0.3)'
        ctx.lineWidth = 0.5
        for wg2 in range(3):
            wy = -r * 0.6 + wg2 * r * 0.25
            ctx.beginPath()
            ctx.moveTo(r * 0.55, wy)
            ctx.lineTo(r * 0.92, wy)
            ctx.stroke()
        ctx.save()
        ctx.translate(r * 1.0, -r * 0.1)
        ctx.rotate(st['anim'] * 2)
        ctx.fillStyle = '#a0a0ac'
        ctx.beginPath()
        ctx.ellipse(0, 0, r * 0.42, r * 0.16, 0, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = '#5a5a64'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(-r * 0.4, 0)
        ctx.lineTo(r * 0.4, 0)
        ctx.stroke()
        ctx.restore()
        smokeAlpha = 0.3 + 0.2 * math.sin(st['anim'] * 3)
        ctx.fillStyle = rgba('#8c8278', smokeAlpha)
        ctx.beginPath()
        ctx.arc(-r * 0.5, -r * 1.0 + math.sin(st['anim']) * 2, r * 0.16, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#a09890', smokeAlpha * 0.5)
        ctx.beginPath()
        ctx.arc(-r * 0.55, -r * 1.15 + math.sin(st['anim'] + 1) * 3, r * 0.1, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(-r * 0.2, -r * 0.2, 2 + math.sin(st['anim'] * 5) * 1.2, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,150,60,0.2)'
        ctx.beginPath()
        ctx.arc(-r * 0.2, -r * 0.2, 4 + math.sin(st['anim'] * 5) * 1.5, 0, TWO_PI)
        ctx.fill()
        ctx.restore()

    def _drawVoidLord(self, ctx, st):
        r = st['r']
        v = '#2a1a4a'
        dark = shade(v, -38)
        glow = '#b08aff'
        pulse = 0.5 + 0.5 * math.sin(st['anim'] * 2)
        ctx.save()
        ctx.globalAlpha = 0.4
        ctx.fillStyle = rgba('#9650ff', 0.5)
        ctx.beginPath()
        ctx.arc(0, -r * 0.2, r * 2.1, 0, TWO_PI)
        ctx.fill()
        ctx.globalAlpha = 1.0
        ctx.translate(0, math.sin(st['anim'] * 1.4) * r * 0.08)
        ctx.beginPath()
        ctx.moveTo(-r * 0.85, -r * 0.35)
        ctx.quadraticCurveTo(-r * 0.95, r * 0.2, -r * 0.8, r * 0.5)
        ctx.quadraticCurveTo(-r * 0.45, r * 0.7, 0, r * 0.6)
        ctx.quadraticCurveTo(r * 0.45, r * 0.7, r * 0.8, r * 0.5)
        ctx.quadraticCurveTo(r * 0.95, r * 0.2, r * 0.85, -r * 0.35)
        ctx.quadraticCurveTo(0, -r * 0.7, -r * 0.85, -r * 0.35)
        ctx.closePath()
        ctx.fillStyle = v
        ctx.fill()
        ctx.strokeStyle = rgba(dark, 0.4)
        ctx.lineWidth = max(1, r * 0.04)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(120,80,200,0.12)'
        ctx.lineWidth = 0.6
        for rf in range(3):
            rf_y = -r * 0.2 + rf * r * 0.3
            ctx.beginPath()
            ctx.moveTo(-r * 0.7, rf_y)
            ctx.quadraticCurveTo(0, rf_y + math.sin(st['anim'] + rf) * r * 0.1, r * 0.7, rf_y)
            ctx.stroke()
        ctx.strokeStyle = dark
        ctx.lineWidth = r * 0.14
        for ti in range(4):
            tx = -r * 0.5 + ti * r * 0.33
            w = math.sin(st['anim'] * 2 + ti * 1.7) * r * 0.25
            ctx.beginPath()
            ctx.moveTo(tx, r * 0.55)
            ctx.quadraticCurveTo(tx + w * 0.4, r * 0.9, tx + w, r * 1.05)
            ctx.stroke()
        ctx.fillStyle = shade(v, -15)
        ctx.beginPath()
        ctx.arc(-r * 0.7, -r * 0.5, r * 0.3, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.7, -r * 0.5, r * 0.3, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = v
        ctx.lineWidth = r * 0.16
        ctx.beginPath()
        ctx.moveTo(-r * 0.85, -r * 0.45)
        ctx.quadraticCurveTo(-r * 1.3, -r * 0.1, -r * 1.15, r * 0.3)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(r * 0.85, -r * 0.45)
        ctx.quadraticCurveTo(r * 1.3, -r * 0.1, r * 1.15, r * 0.3)
        ctx.stroke()
        ctx.fillStyle = '#1a0e2e'
        ctx.beginPath()
        ctx.arc(-r * 1.2, r * 0.32, r * 0.18, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 1.2, r * 0.32, r * 0.18, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = 'rgba(160,110,255,0.5)'
        ctx.beginPath()
        ctx.arc(-r * 1.2, r * 0.32, r * 0.08, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 1.2, r * 0.32, r * 0.08, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = '#1a0e2e'
        ctx.beginPath()
        ctx.ellipse(0, -r * 0.78, r * 0.48, r * 0.55, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = '#2a1a4a'
        ctx.beginPath()
        ctx.moveTo(-r * 0.4, -r * 0.9)
        ctx.lineTo(-r * 0.75, -r * 1.55)
        ctx.lineTo(-r * 0.15, -r * 1.05)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(r * 0.4, -r * 0.9)
        ctx.lineTo(r * 0.75, -r * 1.55)
        ctx.lineTo(r * 0.15, -r * 1.05)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = rgba(shade(v, -20), 0.4)
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(-r * 0.42, -r * 0.92)
        ctx.lineTo(-r * 0.73, -r * 1.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(r * 0.42, -r * 0.92)
        ctx.lineTo(r * 0.73, -r * 1.5)
        ctx.stroke()
        orb(ctx, 0, -r * 0.75, r * 0.16 + pulse * 0.05, '#fff', glow)
        ctx.restore()

    def _drawIceWraith(self, ctx, st):
        r = st['r']
        ice = '#bfe8ff'
        dark = shade(ice, -45)
        ctx.save()
        ctx.globalAlpha = 0.78
        ctx.translate(0, math.sin(st['anim'] * 1.6) * r * 0.25)
        ctx.fillStyle = rgba('#96d2ff', 0.25)
        ctx.beginPath()
        ctx.ellipse(0, r * 0.1, r * 0.7, r * 0.5, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#c8eeff', 0.1)
        ctx.beginPath()
        ctx.ellipse(0, r * 0.15, r * 0.5, r * 0.3, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(-r * 0.7, -r * 0.3)
        ctx.quadraticCurveTo(-r * 0.85, r * 0.3, -r * 0.6, r * 0.7)
        ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.2, r * 0.8)
        ctx.quadraticCurveTo(0, r * 0.55, r * 0.2, r * 0.8)
        ctx.quadraticCurveTo(r * 0.4, r * 0.5, r * 0.6, r * 0.7)
        ctx.quadraticCurveTo(r * 0.85, r * 0.3, r * 0.7, -r * 0.3)
        ctx.quadraticCurveTo(0, -r * 0.6, -r * 0.7, -r * 0.3)
        ctx.closePath()
        ctx.fillStyle = ice
        ctx.fill()
        ctx.strokeStyle = rgba(shade(ice, -30), 0.3)
        ctx.lineWidth = 0.6
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.beginPath()
        ctx.moveTo(-r * 0.3, -r * 0.2)
        ctx.lineTo(-r * 0.15, -r * 0.4)
        ctx.lineTo(0, -r * 0.2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = dark
        ctx.beginPath()
        ctx.moveTo(-r * 0.6, -r * 0.25)
        ctx.quadraticCurveTo(-r * 0.55, -r * 1.0, 0, -r * 1.05)
        ctx.quadraticCurveTo(r * 0.55, -r * 1.0, r * 0.6, -r * 0.25)
        ctx.quadraticCurveTo(0, -r * 0.55, -r * 0.6, -r * 0.25)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = rgba(ice, 0.3)
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(-r * 0.3, -r * 0.7)
        ctx.quadraticCurveTo(0, -r * 0.85, r * 0.3, -r * 0.7)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(-r * 0.22, -r * 0.5, r * 0.09, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.22, -r * 0.5, r * 0.09, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#ffffff', 0.35)
        ctx.beginPath()
        ctx.arc(-r * 0.22, -r * 0.5, r * 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.22, -r * 0.5, r * 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#88ddff', 0.25)
        ctx.beginPath()
        ctx.arc(-r * 0.22, -r * 0.5, r * 0.3, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.22, -r * 0.5, r * 0.3, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = ice
        ctx.lineWidth = r * 0.18
        w = math.sin(st['anim'] * 2) * r * 0.2
        ctx.beginPath()
        ctx.moveTo(-r * 0.6, -r * 0.3)
        ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, -r * 0.8, r * 0.3 + w)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(r * 0.6, -r * 0.3)
        ctx.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.8, r * 0.3 - w)
        ctx.stroke()
        ctx.strokeStyle = rgba(ice, 0.4)
        ctx.lineWidth = r * 0.08
        for fi in range(2):
            fa = st['anim'] * 1.5 + fi * 3.14
            fd = -r * 0.7 - fi * r * 0.1
            ctx.beginPath()
            ctx.moveTo(fd, -r * 0.3 + math.sin(fa) * r * 0.15)
            ctx.lineTo(fd - r * 0.15, -r * 0.15 + math.sin(fa + 0.5) * r * 0.1)
            ctx.stroke()
        ctx.restore()

    def _drawStormSpirit(self, ctx, st):
        r = st['r']
        glow = '#7ae0ff'
        ctx.save()
        ctx.translate(0, math.sin(st['anim'] * 1.8) * r * 0.2)
        ctx.fillStyle = rgba('#50466e', 0.85)
        ctx.beginPath()
        ctx.ellipse(0, -r * 0.1, r * 0.85, r * 0.55, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(-r * 0.55, -r * 0.35, r * 0.45, r * 0.35, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(r * 0.55, -r * 0.35, r * 0.45, r * 0.35, 0, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(0, -r * 0.55, r * 0.5, r * 0.3, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#8c82b4', 0.7)
        ctx.beginPath()
        ctx.ellipse(0, -r * 0.25, r * 0.55, r * 0.3, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#605078', 0.5)
        ctx.beginPath()
        ctx.ellipse(-r * 0.3, -r * 0.45, r * 0.3, r * 0.2, 0.2, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(r * 0.35, -r * 0.4, r * 0.25, r * 0.18, -0.2, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(-r * 0.25, -r * 0.1, r * 0.1 + math.sin(st['anim'] * 6) * 0.03, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.25, -r * 0.1, r * 0.1 + math.cos(st['anim'] * 6) * 0.03, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba(glow, 0.3)
        ctx.beginPath()
        ctx.arc(-r * 0.25, -r * 0.1, r * 0.18, 0, TWO_PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(r * 0.25, -r * 0.1, r * 0.18, 0, TWO_PI)
        ctx.fill()
        ctx.strokeStyle = glow
        ctx.lineWidth = 1.4
        for i in range(3):
            a = st['anim'] * 3 + i * 2.1
            z = 0.6 + 0.4 * abs(math.sin(st['anim'] * 5 + i))
            ctx.globalAlpha = z
            ctx.beginPath()
            ctx.moveTo(math.cos(a) * r * 0.6, -r * 0.3 + math.sin(a) * r * 0.3)
            lx1 = math.cos(a) * r * 1.1
            ly1 = -r * 0.15 + math.sin(a) * r * 0.5
            ctx.lineTo(lx1, ly1)
            lx2 = math.cos(a) * r * 1.3
            ly2 = r * 0.1 + math.sin(a) * r * 0.3
            ctx.lineTo(lx2, ly2)
            ctx.stroke()
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(lx1, ly1)
            ctx.lineTo(lx1 + math.sin(a * 2) * r * 0.15, ly1 + math.cos(a * 2) * r * 0.15)
            ctx.stroke()
            ctx.lineWidth = 1.4
        ctx.globalAlpha = 1.0
        ctx.fillStyle = rgba('#7ae0ff', 0.5)
        ctx.beginPath()
        ctx.ellipse(0, r * 0.3, r * 0.6, r * 0.3, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = rgba('#a0e8ff', 0.2)
        ctx.beginPath()
        ctx.ellipse(0, r * 0.2, r * 0.4, r * 0.2, 0, 0, TWO_PI)
        ctx.fill()
        ctx.restore()

    def drawResistBadges(self, ctx, y):
        hasResist = False
        hasWeak = False
        for k in self.resist:
            if self.resist[k] < 1:
                hasResist = True
        for w in self.weak:
            if self.weak[w] > 1:
                hasWeak = True
        if not hasResist and not hasWeak:
            return
        colors = {'physical': '#d8d8d8', 'fire': '#ff5a2a', 'ice': '#6fd0ff', 'earth': '#c09a5a', 'nature': '#7fd47f'}
        icons = {'physical': '\u2694', 'fire': '\U0001f525', 'ice': '\u2744', 'earth': '\U0001faa8', 'nature': '\U0001f33f'}
        lst = []
        for rk in self.resist:
            if self.resist[rk] < 1:
                lst.append((rk, 'r'))
        for wk in self.weak:
            if self.weak[wk] > 1:
                lst.append((wk, 'w'))
        x = self.x - (len(lst) - 1) * 9
        yy = y - self.r - 16
        for i in range(len(lst)):
            col = colors.get(lst[i][0], '#ffffff')
            ctx.fillStyle = col
            ctx.beginPath()
            ctx.arc(x + i * 18, yy, 7, 0, TWO_PI)
            ctx.fill()
            if lst[i][1] == 'r':
                ctx.strokeStyle = rgba('#000000', 0.6)
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.arc(x + i * 18, yy, 7, 0, TWO_PI)
                ctx.stroke()
            _fill_text(ctx.surface, ctx, icons.get(lst[i][0], '?'), x + i * 18, yy + 1, size=8, color='#222' if lst[i][1] == 'r' else '#fff', baseline='middle')

    def drawHpBar(self, ctx, y):
        w = max(18, self.r * 2.2)
        x = self.x - w / 2
        yy = y - self.r - 10
        pct = max(0, min(1, self.hp / self.hpMax))
        if pct >= 1 and not self.boss:
            return
        ctx.fillStyle = rgba('#000000', 0.6)
        ctx.beginPath()
        ctx.moveTo(x - 1, yy - 1)
        ctx.lineTo(x + w + 1, yy - 1)
        ctx.lineTo(x + w + 1, yy + 5)
        ctx.lineTo(x - 1, yy + 5)
        ctx.closePath()
        ctx.fill()
        if pct > 0:
            fill_w = max(2, w * pct)
            col = '#5ad45a' if pct > 0.5 else ('#e8d24a' if pct > 0.25 else '#e05050')
            ctx.fillStyle = col
            ctx.beginPath()
            ctx.moveTo(x, yy)
            ctx.lineTo(x + fill_w, yy)
            ctx.lineTo(x + fill_w, yy + 4)
            ctx.lineTo(x, yy + 4)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = rgba('#ffffff', 0.3)
            ctx.beginPath()
            ctx.moveTo(x, yy)
            ctx.lineTo(x + fill_w, yy)
            ctx.lineTo(x + fill_w, yy + 1.5)
            ctx.lineTo(x, yy + 1.5)
            ctx.closePath()
            ctx.fill()
        if self.hp < self.hpMax:
            ctx.strokeStyle = rgba('#ffffff', 0.3)
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(x - 1, yy - 1)
            ctx.lineTo(x + w + 1, yy - 1)
            ctx.lineTo(x + w + 1, yy + 5)
            ctx.lineTo(x - 1, yy + 5)
            ctx.closePath()
            ctx.stroke()
