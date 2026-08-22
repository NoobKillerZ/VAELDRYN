import math
import random
import pygame

from config import CONFIG, TOWERS, ENEMIES, DIFFICULTY
from maps import MAPS, MAPS_BY_ID, THEMES, PAINT_PATH, PAINT_FEATURE, hash2, _round_rect
from enemies import Enemy
from towers import Tower, Projectile, ABILITY_FX, PROJ_SPEED
from waves import WAVE
from director import DIRECTOR
from weather import WEATHER
from relics import RELICS, CONQUEST
from progress import (
    PROGRESS, progressLoad, progressSave, progressGainXp,
    progressAddMaxWave, progressCompleteMap,
    unlockAchievement, ACHIEVEMENTS,
)
from artkit import Ctx, _parse_color, TWO_PI
from audio import AUDIO

_GAME_FONTS = {}
_TEXT_SURF = {}


def _game_font(name, size):
    key = (name, int(size))
    font = _GAME_FONTS.get(key)
    if font is None:
        font = pygame.font.SysFont(name, int(size))
        _GAME_FONTS[key] = font
    return font


def _text_surface(txt, color, size):
    key = (txt, color, int(size))
    surf = _TEXT_SURF.get(key)
    if surf is None:
        if len(_TEXT_SURF) > 800:
            _TEXT_SURF.clear()
        surf = _game_font('arial', size).render(str(txt), True, _parse_color(color))
        _TEXT_SURF[key] = surf
    return surf


def _startGoldBonus():
    try:
        return PROGRESS.get('startGoldBonus', 0) if isinstance(PROGRESS, dict) else 0
    except Exception:
        return 0


class Game:
    def __init__(self, mapId='plains', mode='classic', difficulty=0, relicIds=None):
        self.mapId = mapId or 'plains'
        self.mode = mode
        self.difficulty = difficulty
        self.relicIds = relicIds or []
        m = MAPS_BY_ID.get(self.mapId) or MAPS_BY_ID['plains']
        self.map = m
        self.theme = THEMES.get(m['theme'], THEMES['plains'])
        self.bg = pygame.Surface((CONFIG['WIDTH'], CONFIG['HEIGHT']))
        self.towers = []
        self.enemies = []
        self.projectiles = []
        self.particles = []
        self.texts = []
        self.lightning = []
        self.soldiers = []
        self.gold = m['startGold'] + _startGoldBonus()
        self.lives = m['startLives']
        self.wave = 0
        self.waveState = 'idle'
        self.spawnQueue = []
        self.spawnTimer = 2
        self.hpScale = 1 * m['mult']
        self.diffDef = DIFFICULTY.get(self.difficulty, DIFFICULTY[0])
        self.goldMult = self.diffDef['goldMult']
        self.hpMult = self.diffDef['hpMult']
        self.hpScale *= self.hpMult
        self.startLives = max(1, self.lives + self.diffDef['livesMod'])
        self.lives = self.startLives
        self.gold = round(self.gold * self.goldMult)
        self.eliteChance = self.diffDef['eliteChance']
        self.enemySpeedMult = self.diffDef['speedMult']
        self.time = 0
        self.speed = 1
        self.paused = False
        self.over = False
        self.won = False
        self.continueEndless = False
        self.selected = None
        self.hovered = None
        self.placing = None
        self.mouse = {'c': -1, 'r': -1, 'inside': False}
        self.leaked = 0
        self.kills = 0
        self.bossWarned = False
        self.corruption = {}
        self.corruptTotal = 0
        self.corruptCellCount = 0
        self.purifyRate = 0
        self.corruptMult = 1
        self.upCostMult = 1
        self.critChance = 0
        self.startSlow = 1
        self.autoWave = False
        self.autoTimer = 0
        self.stormImmune = False
        self.castleHit = 0
        self.buildPath()
        self.buildPathCells()
        self.renderBG()
        DIRECTOR.reset()
        WEATHER.init()
        if CONQUEST.get('enabled'):
            cs = CONQUEST.get('SETTINGS', {})
            self.conquestWave = cs.get('startWaves', 10)
            self.wave = self.conquestWave - 1
            self.conquestRelics = []
            self.conquestHpLoss = cs.get('hpLossPerEnd', 10)
            self.conquestGoldPerEnd = cs.get('goldPerEnd', 100)
            self.conquestHpBonus = cs.get('hpBonusPer5Waves', 20)
            self.conquestFinalBonusGold = cs.get('finalBonusGold', 300)
            self.conquestFinalWaves = cs.get('finalWaves', [15, 20, 25, 30])
            self.conquestTimer = cs.get('conquestTimerStart', 100)
            self.conquestTimerMax = cs.get('conquestTimerStart', 100)
            self.conquestTimerEnd = cs.get('conquestTimerEnd', 40)
            self.conquestTimerDec = cs.get('conquestTimerDec', 0.6)
        else:
            self.conquestWave = 0
            self.conquestRelics = []
            self.conquestHpLoss = 0
            self.conquestGoldPerEnd = 0
            self.conquestHpBonus = 0
            self.conquestFinalBonusGold = 0
            self.conquestFinalWaves = []
            self.conquestTimer = 0
            self.conquestTimerMax = 0
            self.conquestTimerEnd = 0
            self.conquestTimerDec = 0

    def buildPath(self):
        wp = [{'x': (p[0] + 0.5) * CONFIG['CELL'], 'y': (p[1] + 0.5) * CONFIG['CELL']} for p in self.map['path']]
        self.wp = wp
        self.cum = [0.0]
        total = 0
        for i in range(1, len(wp)):
            total += math.hypot(wp[i]['x'] - wp[i - 1]['x'], wp[i]['y'] - wp[i - 1]['y'])
            self.cum.append(total)
        self.pathLength = total

    def pathPoint(self, d):
        wp, cum = self.wp, self.cum
        n = len(wp)
        if d <= 0:
            return {'x': wp[0]['x'], 'y': wp[0]['y'], 'angle': math.atan2(wp[1]['y'] - wp[0]['y'], wp[1]['x'] - wp[0]['x'])}
        for i in range(1, n):
            if d <= cum[i]:
                seg = (cum[i] - cum[i - 1]) or 1
                t = (d - cum[i - 1]) / seg
                x = wp[i - 1]['x'] + (wp[i]['x'] - wp[i - 1]['x']) * t
                y = wp[i - 1]['y'] + (wp[i]['y'] - wp[i - 1]['y']) * t
                a = math.atan2(wp[i]['y'] - wp[i - 1]['y'], wp[i]['x'] - wp[i - 1]['x'])
                return {'x': x, 'y': y, 'angle': a}
        last, prev = wp[n - 1], wp[n - 2]
        return {'x': last['x'], 'y': last['y'], 'angle': math.atan2(last['y'] - prev['y'], last['x'] - prev['x'])}

    def pathPosFromXY(self, px, py):
        best, bestD = 0, float('inf')
        acc = 0
        for i in range(1, len(self.wp)):
            seg = math.hypot(self.wp[i]['x'] - self.wp[i-1]['x'], self.wp[i]['y'] - self.wp[i-1]['y'])
            if seg < 0.001:
                acc += seg
                continue
            ax, ay = self.wp[i-1]['x'], self.wp[i-1]['y']
            bx, by = self.wp[i]['x'], self.wp[i]['y']
            t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (seg * seg)))
            cx = ax + t * (bx - ax)
            cy = ay + t * (by - ay)
            d2 = (px - cx) ** 2 + (py - cy) ** 2
            if d2 < bestD:
                bestD = d2
                best = acc + t * seg
            acc += seg
        return best

    def futurePos(self, enemy, t):
        weatherSpeed = WEATHER.fx.get('enemySpeed', 1) if WEATHER.fx else 1
        spd = enemy.speed * (0.1 if enemy.freeze else 1) * (enemy.slow['mult'] if enemy.slow else 1) * enemy.buffed * (1.6 if enemy.enraged else 1) * weatherSpeed
        return self.pathPoint(min(self.pathLength, enemy.pathPos + spd * t))

    def buildPathCells(self):
        self.pathCells = {}
        p = self.map['path']
        for i in range(1, len(p)):
            a, b = p[i - 1], p[i]
            if a[0] == b[0]:
                c0 = a[0]
                r0, r1 = min(a[1], b[1]), max(a[1], b[1])
                for r in range(int(r0), int(r1) + 1):
                    self.setPathCell(c0, r)
            else:
                rr = a[1]
                cc0, cc1 = min(a[0], b[0]), max(a[0], b[0])
                for c in range(int(cc0), int(cc1) + 1):
                    self.setPathCell(c, rr)

    def setPathCell(self, c, r):
        if 0 <= c < CONFIG['COLS'] and 0 <= r < CONFIG['ROWS']:
            self.pathCells[f'{c},{r}'] = True

    def isPathCell(self, c, r):
        return f'{c},{r}' in self.pathCells

    def towerAt(self, c, r):
        for t in self.towers:
            if t.col == c and t.row == r:
                return t
        return None

    def canPlace(self, c, r):
        if c < 0 or c >= CONFIG['COLS'] or r < 0 or r >= CONFIG['ROWS']:
            return False
        if self.isPathCell(c, r):
            return False
        if self.towerAt(c, r):
            return False
        return True

    def buildTower(self, c, r, type_):
        def_ = TOWERS.get(type_)
        if not def_:
            return False
        cost = round(def_['cost'] * self.upCostMult)
        if self.gold < cost:
            return False
        if not self.canPlace(c, r):
            return False
        self.gold -= cost
        t = Tower(c, r, type_, self)
        self.towers.append(t)
        self.selected = t
        self.burst(t.x, t.y, '#ffd24a', 10)
        if type_ == 'barracks' and unlockAchievement('barracks'):
            self._achNotify('General')
        self.particles.append({'x': t.x, 'y': t.y, 'vx': 0, 'vy': 0, 'life': 0.3, 'max': 0.3, 'color': '#ffd24a', 'size': 6, 'grav': 0, 'kind': 'ring', 'r1': 26})
        DIRECTOR.recordBuild(c, r, type_)
        AUDIO.play_sfx(AUDIO.sfx.tower_build())
        return True

    def upgradeTower(self, t):
        u = t.upgrade
        if not u:
            return
        cost = round(u['cost'] * self.upCostMult)
        if self.gold < cost:
            return
        self.gold -= cost
        t.applyUpgrade()
        if t.level >= CONFIG['MAX_LEVEL'] and unlockAchievement('tower_max'):
            self._achNotify('Maestro Constructor')
        self.burst(t.x, t.y, '#f2c86a', 12)
        self.particles.append({'x': t.x, 'y': t.y, 'vx': 0, 'vy': 0, 'life': 0.35, 'max': 0.35, 'color': '#f2c86a', 'size': 8, 'grav': 0, 'kind': 'ring', 'r1': 34})
        self.particles.append({'x': t.x, 'y': t.y - 30, 'vx': 0, 'vy': -16, 'life': 0.6, 'max': 0.6, 'color': '#ffe08a', 'size': 3, 'grav': -24})
        AUDIO.play_sfx(AUDIO.sfx.tower_upgrade())

    def sellTower(self, t):
        v = round(t.sellValue() / self.upCostMult)
        self.gold += v
        if t in self.towers:
            self.towers.remove(t)
        self.soldiers = [s for s in self.soldiers if s.tower is not t]
        if self.selected is t:
            self.selected = None
        AUDIO.play_sfx(AUDIO.sfx.tower_sell())

    def startWave(self):
        if self.waveState != 'idle' or self.over:
            return
        self.wave += 1
        self.hpScale = (1 + (self.wave - 1) ** 1.3 * 0.04) * self.map['mult'] * getattr(self, 'hpMult', 1)
        self.spawnQueue = DIRECTOR.buildWave(self.wave, self)
        eliteChance = min(0.08 + self.wave * 0.008 + DIRECTOR.level * 0.03, 0.35)
        for qi in range(len(self.spawnQueue)):
            if self.spawnQueue[qi]['type'] != 'goblin' and random.random() < eliteChance:
                self.spawnQueue[qi]['elite'] = True
        if self.wave >= 3 and self.corruptTotal > 50 and random.random() < 0.5:
            cPos = random.randint(0, len(self.spawnQueue))
            self.spawnQueue.insert(cPos, {'type': 'hulker', 'gap': 2})
        self.waveState = 'spawning'
        self.spawnTimer = 2.2
        self.bossWarned = False
        AUDIO.play_sfx(AUDIO.sfx.wave_start())
        if self.wave % 5 == 0:
            pass  # boss warning handled by toast in UI layer
        elif DIRECTOR.adapted:
            dom = DIRECTOR.dominantElement()
            if dom and dom['pct'] >= 0.3:
                pass  # director warning handled by toast in UI layer

    def update(self, dt):
        if self.over or self.paused:
            return
        self.time += dt
        WEATHER.tick(dt)
        self.updateWave(dt)
        self.updateCorruption(dt)
        if WEATHER.fx.get('lightning') and self.enemies and not self.stormImmune and random.random() < dt * 0.15:
            victim = random.choice(self.enemies)
            victim.takeDamage(35, 'ice', None)
            self.burst(victim.x, victim.y, '#8ad4ff', 10)
            self.texts.append({'x': victim.x, 'y': victim.y - 20, 'txt': '⚡', 'life': 0.6, 'max': 0.6, 'color': '#8ad4ff', 'vy': -20, 'size': 14})
            AUDIO.play_sfx(AUDIO.sfx.weather_lightning_strike(), 0.6)
        self.applyBuffAuras()
        for e in self.enemies:
            e.update(dt, self)
        for tw in self.towers:
            tw.update(dt, self)
        for s in self.soldiers:
            s.update(dt, self)
        for k in range(len(self.projectiles) - 1, -1, -1):
            p = self.projectiles[k]
            p.update(dt, self)
            if p.dead:
                self.projectiles.pop(k)
        self.processEnemies()
        self.updateEffects(dt)
        if self.autoWave and self.waveState == 'idle' and self.wave > 0 and not self.over:
            self.autoTimer -= dt
            if self.autoTimer <= 0:
                self.startWave()
        if self.waveState == 'fighting' and not self.spawnQueue and not self.enemies:
            self.waveCleared()

    def updateWave(self, dt):
        if self.waveState != 'spawning':
            return
        self.spawnTimer -= dt
        if self.spawnTimer <= 0 and self.spawnQueue:
            e = self.spawnQueue.pop(0)
            boss_mul = e.get('bossHpMul', 1)
            en = Enemy(e['type'], self.map['path'], 0, self.hpScale * boss_mul)
            if hasattr(en, 'mutate') and e.get('elite'):
                en.mutate()
            if self.eliteChance > 0 and not en.boss and random.random() < self.eliteChance:
                en.mutate()
            if self.startSlow < 1 and not en.boss:
                en.slow = {'mult': self.startSlow, 't': 9999}
            if en.corruption and not en.corrupted and self.corruptTotal > 60:
                en.corrupted = True
                en.hpMax *= 1.3
                en.hp = en.hpMax
                en.color = '#7a2a7a'
            if self.enemySpeedMult != 1:
                en.speed *= self.enemySpeedMult
            self.enemies.append(en)
            self.spawnTimer = max(0.15, e['gap'])
            if en.boss:
                AUDIO.play_sfx(AUDIO.sfx.boss_appear(), 0.8)
            else:
                AUDIO.play_sfx(AUDIO.sfx.enemy_spawn(), 0.5)
        elif self.spawnTimer <= 0 and not self.spawnQueue:
            self.waveState = 'fighting'

    def applyBuffAuras(self):
        for e in self.enemies:
            e.buffed = 1
        for s in self.enemies:
            if not s.alive:
                continue
            if s.type == 'sorcerer':
                for e2 in self.enemies:
                    if not e2.alive or e2.type != 'goblin':
                        continue
                    dx = e2.x - s.x
                    dy = e2.y - s.y
                    if dx * dx + dy * dy <= 120 * 120:
                        e2.buffed = max(e2.buffed, 1.3)
            elif s.type == 'orcKing':
                for e2 in self.enemies:
                    if not e2.alive or e2.type not in ('orc', 'berserker'):
                        continue
                    dx = e2.x - s.x
                    dy = e2.y - s.y
                    if dx * dx + dy * dy <= 170 * 170:
                        e2.buffed = max(e2.buffed, 1.35)
            elif s.corruption > 0 and s.alive and s.pathPos > 0:
                self.addCorruption(s.x, s.y, s.corruption * 0.4 * 0.016)
            if s.buffShaman and s.alive:
                for e2 in self.enemies:
                    if not e2.alive or e2 is s or e2.boss:
                        continue
                    dx = e2.x - s.x
                    dy = e2.y - s.y
                    if dx * dx + dy * dy <= 130 * 130:
                        e2.buffed = max(e2.buffed, 1.25)
        for tw in self.towers:
            tw.buffed = 1
            tw.dmgAmp = 1
            tw.rateAura = 1
            rMult = WEATHER.fx.get('rangeMult', 1)
            tw.rangeMult = rMult
            tw.effectiveRange = tw.range * rMult
            if self.getCorruptionAt(tw.col, tw.row) > 0.4:
                tw.buffed *= 0.7
            if self.purifyRate > 0:
                self.purifyRadius(tw.x, tw.y, 70, self.purifyRate)
        for d in self.towers:
            if d.type == 'banner':
                if d.stun > 0:
                    continue
                for tb in self.towers:
                    if tb is d:
                        continue
                    db2 = math.hypot(tb.x - d.x, tb.y - d.y)
                    if db2 <= d.range:
                        tb.dmgAmp *= d.aura
                        tb.rateAura *= d.rateAura
            elif d.type == 'druid' and d.stun <= 0:
                for t2 in self.towers:
                    if t2 is d:
                        continue
                    dd = math.hypot(t2.x - d.x, t2.y - d.y)
                    if dd <= d.range:
                        t2.buffed *= d.aura

    def weatherMult(self, element):
        if not WEATHER.fx:
            return 1
        if element == 'fire':
            return WEATHER.fx.get('fireMult', 1)
        if element == 'ice':
            return WEATHER.fx.get('iceMult', 1)
        if element == 'nature':
            return WEATHER.fx.get('natureMult', 1)
        return 1

    def addCorruption(self, x, y, amount):
        c = int(x / CONFIG['CELL'])
        r = int(y / CONFIG['CELL'])
        if c < 0 or c >= CONFIG['COLS'] or r < 0 or r >= CONFIG['ROWS']:
            return
        key = f'{c},{r}'
        was = self.corruption.get(key, 0)
        val = min(1, was + amount * self.corruptMult)
        self.corruption[key] = val
        self.corruptTotal += val - was

    def getCorruptionAt(self, col, row):
        return self.corruption.get(f'{col},{row}', 0)

    def purifyRadius(self, x, y, radius, amount):
        c0 = int((x - radius) / CONFIG['CELL'])
        c1 = int((x + radius) / CONFIG['CELL'])
        r0 = int((y - radius) / CONFIG['CELL'])
        r1 = int((y + radius) / CONFIG['CELL'])
        for c in range(c0, c1 + 1):
            for r in range(r0, r1 + 1):
                if c < 0 or c >= CONFIG['COLS'] or r < 0 or r >= CONFIG['ROWS']:
                    continue
                cc = (c + 0.5) * CONFIG['CELL']
                rr = (r + 0.5) * CONFIG['CELL']
                if math.hypot(cc - x, rr - y) > radius:
                    continue
                key = f'{c},{r}'
                was = self.corruption.get(key, 0)
                if was > 0:
                    val = max(0, was - amount)
                    self.corruption[key] = val
                    self.corruptTotal += val - was

    def updateCorruption(self, dt):
        if self.corruptTotal <= 0:
            return
        if random.random() < dt * 0.4:
            keys = list(self.corruption.keys())
            if keys:
                k = random.choice(keys)
                was = self.corruption[k]
                if was > 0:
                    val = max(0, was - 0.002)
                    self.corruption[k] = val
                    self.corruptTotal += val - was
                    if val == 0:
                        del self.corruption[k]
        self.corruptCellCount = len(self.corruption)

    def destroyTower(self, t):
        if t in self.towers:
            self.towers.remove(t)
        if self.selected is t:
            self.selected = None
        self.explosion(t.x, t.y, 40, '#ff8a3a')
        self.texts.append({'x': t.x, 'y': t.y - 20, 'txt': '💥', 'life': 1.8, 'max': 1.8, 'color': '#ff6a3a', 'vy': -18, 'size': 13})
        self.addCorruption(t.x, t.y, 20)
        AUDIO.play_sfx(AUDIO.sfx.tower_destroy())

    def findTarget(self, tower):
        best = None
        bestD = -1
        rng = getattr(tower, 'effectiveRange', None) or tower.range
        for e in self.enemies:
            if not e.alive:
                continue
            if e.flying and not tower.canHitFlying:
                continue
            dx = e.x - tower.x
            dy = e.y - tower.y
            if dx * dx + dy * dy <= rng * rng and e.pathPos > bestD:
                best = e
                bestD = e.pathPos
        return best

    def findTargets(self, tower, n):
        inRange = []
        rng = getattr(tower, 'effectiveRange', None) or tower.range
        for e in self.enemies:
            if not e.alive:
                continue
            if e.flying and not tower.canHitFlying:
                continue
            dx = e.x - tower.x
            dy = e.y - tower.y
            if dx * dx + dy * dy <= rng * rng:
                inRange.append(e)
        inRange.sort(key=lambda e: e.pathPos, reverse=True)
        return inRange[:n]

    def findNextEnemy(self, x, y, except_, radius, allowFlying):
        best = None
        bestD = float('inf')
        for e in self.enemies:
            if not e.alive or e is except_:
                continue
            if e.flying and not allowFlying:
                continue
            dx = e.x - x
            dy = e.y - y
            d2 = dx * dx + dy * dy
            if d2 <= radius * radius and e.pathPos > except_.pathPos and d2 < bestD:
                best = e
                bestD = d2
        return best

    def enemyLeaks(self, e):
        e.leaked = True
        if e.steal:
            stolen = min(self.gold, int(self.gold * 0.12) + 10)
            if stolen > 0:
                self.gold -= stolen
            return
        dmg = 8 if e.boss else 1
        if CONQUEST.get('enabled'):
            dmg = max(1, dmg + self.conquestHpLoss // 5)
        self.lives -= dmg
        self.leaked += dmg
        self.castleHit = 0.5
        DIRECTOR.recordLeak(dmg)
        AUDIO.play_sfx(AUDIO.sfx.castle_hit_big() if dmg >= 8 else AUDIO.sfx.castle_hit())
        self.texts.append({'x': e.x, 'y': e.y - 22, 'txt': f'-{dmg}', 'life': 1.2, 'max': 1.2, 'color': '#ff5a5a', 'vy': -28, 'size': 14})
        if self.lives <= 0:
            self.lives = 0
            self.gameOver()
        elif self.lives <= 5 and dmg > 0:
            AUDIO.play_sfx(AUDIO.sfx.castle_low_hp(), 0.4)

    def processEnemies(self):
        alive = []
        dying = []
        revived = []
        for e in self.enemies:
            if e.leaked:
                continue
            if e.alive:
                alive.append(e)
                continue
            if not e.deathHandled:
                self.handleDeath(e, revived)
                e.deathHandled = True
            if e.deadT > 0:
                dying.append(e)
        self.enemies = alive + dying + revived

    def handleDeath(self, e, revived):
        reward = round(e.reward * self.goldMult)
        self.gold += reward
        self.kills += 1
        self.texts.append({'x': e.x, 'y': e.y - 16, 'txt': f'+{reward}', 'life': 0.9, 'max': 0.9, 'color': '#ffd24a', 'vy': -25, 'size': 11})
        self.checkAchievements()
        if e.deathFrozen:
            self.shockRing(e.x, e.y, e.r * 3.4, '#bfe8ff', 0.35)
            count = 22 if e.boss else 9
            for _ in range(count):
                sa = random.random() * TWO_PI
                ss = 40 + random.random() * 120
                self.particles.append({'x': e.x, 'y': e.y, 'vx': math.cos(sa) * ss, 'vy': math.sin(sa) * ss - 30, 'life': 0.5 + random.random() * 0.3, 'max': 0.8, 'color': '#bfe8ff' if random.random() < 0.5 else '#e8f6ff', 'size': 1.6 + random.random() * 1.8, 'grav': 0})
        else:
            self.burst(e.x, e.y, e.color, 20 if e.boss else 6)
            self.shockRing(e.x, e.y, e.r * (5.5 if e.boss else 2.8), e.color, 0.4)
            count = 12 if e.boss else 4
            for _ in range(count):
                self.particles.append({'x': e.x, 'y': e.y, 'vx': (random.random() - 0.5) * 50, 'vy': -28 - random.random() * 44, 'life': 0.6 + random.random() * 0.4, 'max': 1, 'color': '#9a9aa6', 'size': 2 + random.random() * 2.2, 'grav': -22})
        DIRECTOR.recordKill()
        if e.boss:
            AUDIO.play_sfx(AUDIO.sfx.enemy_death_boss())
        else:
            AUDIO.play_sfx(AUDIO.sfx.enemy_death(), 0.5)
        if e.corruption and self.corruptTotal < 240:
            self.addCorruption(e.x, e.y, e.corruption)
        if e.explode:
            rr = e.explode['radius']
            ed = e.explode['dmg']
            for ex in self.enemies:
                if not ex.alive or ex is e:
                    continue
                exd = math.hypot(ex.x - e.x, ex.y - e.y)
                if exd <= rr:
                    ex.takeDamage(ed, 'physical', None)
            self.explosion(e.x, e.y, rr, '#8ad47f')
            AUDIO.play_sfx(AUDIO.sfx.enemy_explode())
        if e.revive and not e.revived and random.random() < e.revive and len(self.enemies) + len(revived) < 60:
            sk = Enemy('skeleton', self.map['path'], 0, self.hpScale)
            sk.revived = True
            sk.hpMax = e.hpMax * 0.3
            sk.hp = sk.hpMax
            sk.pathPos = max(0, e.pathPos - 25)
            revived.append(sk)
            AUDIO.play_sfx(AUDIO.sfx.enemy_revive(), 0.4)
        if e.split and len(self.enemies) + len(revived) < 60:
            into_type = e.split.get('into')
            count = e.split.get('count', 2)
            if into_type and into_type in ENEMIES:
                for _ in range(count):
                    se = Enemy(into_type, self.map['path'], 0, self.hpScale)
                    se.pathPos = max(0, e.pathPos - 10 + random.random() * 10)
                    revived.append(se)
                self.burst(e.x, e.y, ENEMIES[into_type].get('color', e.color), 8)
                AUDIO.play_sfx(AUDIO.sfx.enemy_hurt(), 0.4)

    def waveCleared(self):
        self.waveState = 'idle'
        bonus = round((20 + self.wave * 5) * self.goldMult)
        self.gold += bonus
        progressGainXp(5 + self.wave * 2)
        if CONQUEST.get('enabled'):
            self.gold += self.conquestGoldPerEnd
            self.conquestTimer = max(self.conquestTimerEnd,
                                     self.conquestTimer - self.conquestTimerDec)
            if self.wave % 5 == 0:
                self.conquestRelics = self._pickConquestRelics(2)
                self.waveState = 'relic_choice'
            if self.wave % 5 == 0 and self.wave > 0:
                self.lives = min(self.lives + self.conquestHpBonus,
                                 self.map.get('startLives', 20))
            if self.wave >= max(self.conquestFinalWaves) and not self.continueEndless:
                self.won = True
                self.over = True
                progressCompleteMap(self.mapId)
                progressAddMaxWave(self.wave)
                self.gold += self.conquestFinalBonusGold
                CONQUEST['enabled'] = False
                AUDIO.play_sfx(AUDIO.sfx.victory(), 0.6)
                AUDIO.play_music('victory')
        elif self.wave >= CONFIG['WIN_WAVE'] and not self.continueEndless:
            self.won = True
            self.over = True
            progressCompleteMap(self.mapId)
            progressAddMaxWave(self.wave)
            AUDIO.play_sfx(AUDIO.sfx.victory(), 0.6)
            AUDIO.play_music('victory')
        self.checkAchievements()

    def _pickConquestRelics(self, n):
        from relics import RELICS
        owned = {r['id'] for r in self.conquestRelics}
        pool = [r for r in RELICS if r['id'] not in owned]
        if not pool:
            pool = list(RELICS)
        random.shuffle(pool)
        return pool[:n]

    def applyConquestRelic(self, relic):
        relic.get('apply', lambda g: None)(self)
        if 'goldMult' in relic:
            self.goldMult *= relic['goldMult']
        if 'upCostMult' in relic:
            self.upCostMult *= relic['upCostMult']
        self.conquestRelics.append(relic)
        self.conquestHpLoss = max(1, self.conquestHpLoss - 1)

    def gameOver(self):
        self.over = True
        progressGainXp(self.wave)
        progressAddMaxWave(self.wave)
        AUDIO.play_sfx(AUDIO.sfx.defeat(), 0.6)
        AUDIO.play_music('defeat')

    def checkAchievements(self):
        if self.kills >= 1:
            if unlockAchievement('first_blood'):
                self._achNotify('Primera Sangre')
        if self.kills >= 100:
            if unlockAchievement('kill_100'):
                self._achNotify('Carnicero')
        if self.kills >= 500:
            if unlockAchievement('kill_500'):
                self._achNotify('Destructor')
        if self.wave >= 5:
            if unlockAchievement('wave_5'):
                self._achNotify('Oleada 5')
        if self.wave >= 10:
            if unlockAchievement('wave_10'):
                self._achNotify('Veterano')
        if self.gold >= 500:
            if unlockAchievement('gold_500'):
                self._achNotify('Avaricia')
        if self.won and self.difficulty >= 2:
            if unlockAchievement('hard_win'):
                self._achNotify('Masoquista')
        alive_count = sum(1 for e in self.enemies if e.alive)
        if alive_count == 0 and self.won:
            if len(PROGRESS.get('unlocked', [])) >= 5:
                if unlockAchievement('all_maps'):
                    self._achNotify('Explorador')

    def _achNotify(self, name):
        self.texts.append({
            'x': CONFIG['WIDTH'] // 2, 'y': CONFIG['HEIGHT'] // 2 - 40,
            'txt': f'\U0001f3c6 Logro: {name}', 'life': 2.0, 'max': 2.0,
            'color': '#ffd24a', 'vy': -8, 'size': 14,
        })

    def burst(self, x, y, color, n):
        for _ in range(n):
            a = random.random() * TWO_PI
            sp = 40 + random.random() * 90
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp - 20, 'life': 0.4 + random.random() * 0.4, 'max': 0.8, 'color': color, 'size': 2 + random.random() * 2.5, 'grav': 160})
        for _ in range(n // 2):
            a = random.random() * TWO_PI
            sp = 20 + random.random() * 50
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp - 15, 'life': 0.3 + random.random() * 0.3, 'max': 0.6, 'color': '#fff6c8', 'size': 1 + random.random() * 1.5, 'grav': 120})

    def explosion(self, x, y, radius, color):
        self.burst(x, y, color, 16)
        for i in range(12):
            a = (i / 12) * TWO_PI
            sp = 80 + random.random() * 40
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp, 'life': 0.25 + random.random() * 0.15, 'max': 0.4, 'color': '#fff6c8', 'size': 2 + random.random() * 2, 'grav': 0})
        for i in range(6):
            a = (i / 6) * TWO_PI + 0.3
            sp = 50 + random.random() * 30
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp, 'life': 0.35, 'max': 0.35, 'color': color, 'size': 3 + random.random() * 2, 'grav': 0})
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': 0.4, 'max': 0.4, 'color': color, 'size': 3, 'grav': 0, 'kind': 'ring', 'r1': max(30, radius * 0.8)})
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': 0.2, 'max': 0.2, 'color': '#fff6c8', 'size': max(10, radius * 0.35), 'grav': 0, 'kind': 'flash'})
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': -15, 'life': 0.5, 'max': 0.5, 'color': '#888', 'size': 5, 'grav': -8, 'kind': 'smoke'})

    def hitSpark(self, x, y, color):
        for _ in range(6):
            a = random.random() * TWO_PI
            sp = 50 + random.random() * 80
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp, 'life': 0.15 + random.random() * 0.15, 'max': 0.3, 'color': color, 'size': 1.5 + random.random() * 1.5, 'grav': 0})
        for _ in range(2):
            self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': 0.12, 'max': 0.12, 'color': '#ffffff', 'size': 4 + random.random() * 2, 'grav': 0, 'kind': 'flash'})

    def lightningBolt(self, x1, y1, x2, y2, color='#8ad4ff', dur=0.15):
        self.lightning.append({'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'color': color, 't': dur, 'max': dur})
        self.hitSpark(x2, y2, color)

    def streak(self, x1, y1, x2, y2, color='#ffffff', dur=0.15):
        self.lightning.append({'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'color': color, 't': dur, 'max': dur, 'straight': True})
        self.hitSpark(x2, y2, color)

    def shockRing(self, x, y, r1=40, color='#ffffff', life=0.4):
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': life, 'max': life, 'color': color, 'size': 6, 'grav': 0, 'kind': 'ring', 'r1': r1})

    def frostNova(self, x, y, radius, slow, dur):
        for i in range(16):
            a = (i / 16) * TWO_PI
            sp = 100 + random.random() * 60
            self.particles.append({'x': x + math.cos(a) * radius * 0.3, 'y': y + math.sin(a) * radius * 0.3, 'vx': math.cos(a) * sp, 'vy': math.sin(a) * sp, 'life': 0.35, 'max': 0.35, 'color': '#bfe8ff', 'size': 2.5 + random.random() * 1.5, 'grav': 0})
        for i in range(8):
            a = (i / 8) * TWO_PI
            self.particles.append({'x': x, 'y': y, 'vx': math.cos(a) * 40, 'vy': math.sin(a) * 40, 'life': 0.5, 'max': 0.5, 'color': '#ffffff', 'size': 2, 'grav': 0})
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': 0.45, 'max': 0.45, 'color': '#bfe8ff', 'size': 6, 'grav': 0, 'kind': 'ring', 'r1': radius})
        self.particles.append({'x': x, 'y': y, 'vx': 0, 'vy': 0, 'life': 0.3, 'max': 0.3, 'color': '#e8f6ff', 'size': max(6, radius * 0.25), 'grav': 0, 'kind': 'flash'})
        for e in self.enemies:
            if not e.alive:
                continue
            dx = e.x - x
            dy = e.y - y
            if dx * dx + dy * dy <= radius * radius:
                e.slow = {'mult': slow, 't': dur}

    def greenBurst(self, x, y, radius):
        for _ in range(10):
            a = random.random() * TWO_PI
            r = random.random() * radius * 0.7
            self.particles.append({'x': x + math.cos(a) * r, 'y': y + math.sin(a) * r, 'vx': 0, 'vy': -30 - random.random() * 40, 'life': 0.6, 'max': 0.6, 'color': '#7fd47f', 'size': 3, 'grav': -30})

    def updateEffects(self, dt):
        for i in range(len(self.lightning) - 1, -1, -1):
            lb = self.lightning[i]
            lb['t'] -= dt
            if lb['t'] <= 0:
                self.lightning.pop(i)
        for i in range(len(self.particles) - 1, -1, -1):
            p = self.particles[i]
            p['life'] -= dt
            if p['life'] <= 0:
                self.particles.pop(i)
                continue
            p['vy'] += p.get('grav', 0) * dt
            p['x'] += p['vx'] * dt
            p['y'] += p['vy'] * dt
        for i in range(len(self.texts) - 1, -1, -1):
            t = self.texts[i]
            t['life'] -= dt
            if t['life'] <= 0:
                self.texts.pop(i)
                continue
            t['y'] += t.get('vy', 0) * dt
        if self.castleHit > 0:
            self.castleHit -= dt

    def renderBG(self):
        c = Ctx(self.bg)
        COLS = CONFIG['COLS']
        ROWS = CONFIG['ROWS']
        CELL = CONFIG['CELL']
        th = self.theme
        grad = pygame.Surface((COLS * CELL, ROWS * CELL))
        ground = th['ground']
        for y in range(ROWS * CELL):
            t = y / (ROWS * CELL)
            if t < 0.5:
                r1 = _parse_color(ground[0])
                r2 = _parse_color(ground[1])
                f = t / 0.5
            else:
                r1 = _parse_color(ground[1])
                r2 = _parse_color(ground[2])
                f = (t - 0.5) / 0.5
            col = (int(r1[0] + (r2[0] - r1[0]) * f), int(r1[1] + (r2[1] - r1[1]) * f), int(r1[2] + (r2[2] - r1[2]) * f))
            pygame.draw.line(grad, col, (0, y), (COLS * CELL, y))
        self.bg.blit(grad, (0, 0))
        cell_fn = th.get('cell')
        if cell_fn:
            for br in range(0, ROWS, 2):
                for bc in range(0, COLS, 2):
                    bh = hash2(bc * 0.7 + 3, br * 0.7 + 11)
                    if bh < 0.35:
                        continue
                    bx = (bc + 0.5 + (hash2(bc, br) - 0.5) * 1.6) * CELL
                    by = (br + 0.5 + (hash2(bc + 9, br + 4) - 0.5) * 1.6) * CELL
                    col = cell_fn(bh, math.sin((bc + br) * 0.7) * 6)
                    s = pygame.Surface((int(CELL * (1.1 + bh) * 2), int(CELL * (0.8 + bh * 0.7) * 2)), pygame.SRCALPHA)
                    col_rgba = _parse_color(col)
                    if len(col_rgba) == 3:
                        col_rgba = col_rgba + (int((0.1 + bh * 0.12) * 255),)
                    else:
                        col_rgba = col_rgba[:3] + (int((0.1 + bh * 0.12) * 255),)
                    pygame.draw.ellipse(s, col_rgba, s.get_rect())
                    self.bg.blit(s, (int(bx - CELL * (1.1 + bh)), int(by - CELL * (0.8 + bh * 0.7))))
            for r in range(ROWS):
                for col_i in range(COLS):
                    h = hash2(col_i, r)
                    x0 = col_i * CELL
                    y0 = r * CELL
                    cc = cell_fn(h, math.sin((col_i + r) * 0.7 + h * 9) * 6)
                    s2 = pygame.Surface((CELL + 2, CELL + 2), pygame.SRCALPHA)
                    rect = pygame.Rect(0, 0, CELL + 2, CELL + 2)
                    rr = int(6 + h * 6)
                    pygame.draw.rect(s2, _parse_color(cc), rect, border_radius=rr)
                    self.bg.blit(s2, (x0 - 1, y0 - 1))
                    if h > 0.82:
                        tuft = th['tuft']
                        pts = [(int(x0 + 4 + h * 10), int(y0 + CELL - 3)), (int(x0 + 8 + h * 10), int(y0 + CELL - 8)), (int(x0 + 12 + h * 10), int(y0 + CELL - 3))]
                        pygame.draw.polygon(self.bg, _parse_color(tuft), pts)
                    if h < 0.1:
                        soil = th['soil']
                        es = pygame.Surface((int(CELL * 0.9), int(CELL * 0.6)), pygame.SRCALPHA)
                        pygame.draw.ellipse(es, _parse_color(soil), es.get_rect())
                        self.bg.blit(es, (int(x0 + CELL * 0.05), int(y0 + CELL * 0.2)))
        for nx in range(420):
            nxc = int(hash2(nx, 42) * COLS * CELL)
            nyc = int(hash2(nx, 87) * ROWS * CELL)
            c2 = _parse_color(ground[2]) if hash2(nx, 5) > 0.5 else (0, 0, 0)
            if len(c2) > 3:
                c2 = c2[:3]
            alpha = int((0.05 + hash2(nx, 13) * 0.09) * 255)
            ns = pygame.Surface((6, 6), pygame.SRCALPHA)
            pygame.draw.circle(ns, c2 + (alpha,), (3, 3), int(1 + hash2(nx, 7) * 2.4))
            self.bg.blit(ns, (nxc - 3, nyc - 3))
        if th.get('detail'):
            th['detail'](c, COLS, ROWS, CELL)
        paintDecor = th.get('paintDecor')
        if paintDecor:
            for rr in range(ROWS):
                for cc in range(COLS):
                    if self.isPathCell(cc, rr):
                        continue
                    hh = hash2(cc + 100, rr + 50)
                    cx = (cc + 0.5) * CELL + (hh - 0.5) * 8
                    cy = (rr + 0.5) * CELL + ((hh * 37) % 1 - 0.5) * 8
                    paintDecor(c, cx, cy, hh)
        pathPainter = PAINT_PATH.get(th['path'])
        if pathPainter:
            pathPainter(c, self.pathCells, CELL)
        for pk in self.pathCells:
            pp = pk.split(',')
            pc2, pr2 = int(pp[0]), int(pp[1])
            for nb in range(8):
                dx = (nb % 3) - 1
                dy = (nb // 3) - 1
                if dx == 0 and dy == 0:
                    continue
                nk = f'{pc2 + dx},{pr2 + dy}'
                if nk in self.pathCells:
                    continue
                if pc2 + dx < 0 or pc2 + dx >= COLS or pr2 + dy < 0 or pr2 + dy >= ROWS:
                    continue
                soil = th['soil']
                ns2 = pygame.Surface((int(CELL * 1.16), int(CELL * 1.16)), pygame.SRCALPHA)
                pygame.draw.circle(ns2, _parse_color(soil), (int(CELL * 0.58), int(CELL * 0.58)), int(CELL * 0.58))
                self.bg.blit(ns2, (int(pc2 * CELL + CELL / 2 + dx * CELL / 2 - CELL * 0.58), int(pr2 * CELL + CELL / 2 + dy * CELL / 2 - CELL * 0.58)))
        featurePainter = PAINT_FEATURE.get(self.map['theme'])
        if featurePainter:
            featurePainter(c, CELL)
        # El fondo es estatico. No generamos una capa transparente incompleta
        # aqui: los huecos entre columnas provocaban lineas blancas verticales.

    def drawPortal(self, c):
        px = (self.map['portal'][0] + 0.5) * CONFIG['CELL']
        py = (self.map['portal'][1] + 0.5) * CONFIG['CELL']
        t = self.time
        c.fillStyle = (70, 58, 44, 242)
        c.beginPath(); c.ellipse(px, py + 9, 40, 13, 0, 0, TWO_PI); c.fill()
        c.fillStyle = (120, 102, 74, 230)
        c.beginPath(); c.ellipse(px, py + 7, 34, 10, 0, 0, TWO_PI); c.fill()
        c.fillStyle = (150, 128, 92, 204)
        c.beginPath(); c.ellipse(px, py + 6, 26, 7, 0, 0, TWO_PI); c.fill()
        c.strokeStyle = (255, 210, 74, 128); c.lineWidth = 1.2
        c.beginPath(); c.ellipse(px, py + 6, 22, 6, 0, 0, TWO_PI); c.stroke()
        c.strokeStyle = (255, 210, 74, int((0.3 + 0.2 * math.sin(t * 2)) * 255))
        c.beginPath(); c.ellipse(px, py + 6, 17, 4.6, 0, 0, TWO_PI); c.stroke()
        c.strokeStyle = (0, 0, 0, 90); c.lineWidth = 12
        c.beginPath(); c.ellipse(px + 3, py + 1, 22, 30, 0, 0, TWO_PI); c.stroke()
        for s in range(16):
            a = s / 16 * math.pi * 2
            ax = px + math.cos(a) * 23
            ay = py - 2 + math.sin(a) * 31
            hh = hash2(s, 3)
            sz = 5 + hh * 2.5
            c.fillStyle = '#7a6a52' if hh > 0.5 else '#6a5a44'
            c.save()
            c.translate(ax, ay)
            c.rotate(a + math.pi / 2)
            c.beginPath(); _round_rect(c, -sz / 2, -3.4, sz, 6.8, 2); c.fill()
            c.restore()
        runes = ['ᚠ', 'ᚱ', 'ᚦ', 'ᚨ', 'ᚷ', 'ᛒ', 'ᛞ', 'ᛖ']
        c.fillStyle = '#ffd24a'
        for rn_idx, rn in enumerate(runes):
            ra = rn_idx / len(runes) * math.pi * 2 + 0.4
            try:
                font = _game_font(None, 14)
                surf = font.render(rn, True, (255, 210, 74))
                c.surface.blit(surf, (int(px + math.cos(ra) * 25 - surf.get_width() // 2), int(py + math.sin(ra) * 33 - surf.get_height() // 2)))
            except Exception:
                pass
        g = c.createRadialGradient(px, py - 2, 2, px, py - 2, 26)
        g.addColorStop(0, '#fff6c8')
        g.addColorStop(0.25, '#ffd24a')
        g.addColorStop(0.55, '#b06aff')
        g.addColorStop(0.85, '#4a2a8a')
        g.addColorStop(1, (40, 10, 60, 26))
        c.fillStyle = g
        c.beginPath(); c.ellipse(px, py - 2, 20, 28, 0, 0, TWO_PI); c.fill()
        c.strokeStyle = (255, 242, 200, 140); c.lineWidth = 1.6
        for w in range(3):
            wa = t * 1.6 + w * 2.09
            c.beginPath()
            c.ellipse(px, py - 2, 12 + w * 3, 16 + w * 4, wa, 0, TWO_PI)
            c.stroke()
        c.fillStyle = (255, 250, 220, 242)
        c.beginPath(); c.arc(px, py - 2, 3 + math.sin(t * 4) * 1.2, 0, TWO_PI); c.fill()
        for fr in range(4):
            fa = t * 0.5 + fr * 1.57
            frx = px + math.cos(fa) * 34
            fry = py - 2 + math.sin(fa) * 40
            fsz = 2.4 + hash2(fr, 9) * 1.8
            c.fillStyle = (0, 0, 0, 51)
            c.beginPath(); c.ellipse(frx, fry + fsz + 2, fsz, fsz * 0.4, 0, 0, TWO_PI); c.fill()
            c.fillStyle = '#6a5a44'
            c.save()
            c.translate(frx, fry)
            c.rotate(fa)
            c.beginPath(); _round_rect(c, -fsz / 2, -fsz / 2, fsz, fsz * 0.8, 1); c.fill()
            c.restore()

    def drawCastle(self, c):
        bx = self.map['castle'][0] * CONFIG['CELL']
        by = self.map['castle'][1] * CONFIG['CELL']
        CW = CONFIG['CELL'] * 4
        wh = CONFIG['CELL'] * 1.5
        hp = self.lives / self.map['startLives']
        t = self.time
        vs = 0.6 if by < 160 else 1

        theme_stones = {
            'plains': ('#9aa3b2', '#6e7686', '#c2c9d6', '#3e4a68'),
            'desert': ('#c4a86a', '#96803e', '#ddd0a0', '#705828'),
            'forest': ('#7a8a6a', '#5a6a4a', '#a0b090', '#2e3a20'),
            'frozen': ('#b0c8dc', '#8aa0b4', '#d8e8f4', '#4a6a8a'),
            'void': ('#6a5080', '#4a3060', '#9a70b8', '#2a1840'),
        }
        th_id = self.map.get('theme', 'plains')
        stone, stoneD, stoneL, roof = theme_stones.get(th_id, theme_stones['plains'])

        c.fillStyle = (0, 0, 0, 72)
        c.beginPath(); c.ellipse(bx + CW / 2, by + wh + 3, CW * 0.62, 7, 0, 0, TWO_PI); c.fill()

        main_h = int(62 * vs)
        main_x = bx + 12
        main_w = CW - 24
        tg = c.createLinearGradient(main_x, 0, main_x + main_w, 0)
        tg.addColorStop(0, stoneL); tg.addColorStop(0.3, stone); tg.addColorStop(0.7, stoneD); tg.addColorStop(1, stone)
        c.fillStyle = tg
        c.beginPath(); _round_rect(c, main_x, by - main_h + 8, main_w, int(main_h + wh * 0.3), 3); c.fill()

        for br in range(3):
            bx0 = main_x + 2
            by0 = by - main_h + 10 + br * int(main_h * 0.3)
            bw = main_w - 4
            bh = int(main_h * 0.28)
            c.fillStyle = (0, 0, 0, 25)
            c.beginPath(); _round_rect(c, bx0, by0, bw, bh, 2); c.fill()
            for st in range(int(bw / 8)):
                sx = bx0 + st * 8 + 4
                if sx + 6 > bx0 + bw:
                    break
                h2 = hash2(br * 13 + st, 7)
                sc = stoneL if h2 > 0.6 else stone if h2 > 0.3 else stoneD
                c.fillStyle = sc
                c.beginPath(); _round_rect(c, sx, by0 + 2, 6, bh - 4, 1); c.fill()

        merlon_h = int(8 * vs)
        merlon_w = int(7 * vs)
        merlon_gap = int(5 * vs)
        total_merlons = int(main_w / (merlon_w + merlon_gap))
        for m in range(total_merlons):
            mx = main_x + m * (merlon_w + merlon_gap)
            my = by - main_h + 8 - merlon_h
            h2 = hash2(m, 99)
            mc = stoneL if h2 > 0.5 else stone
            c.fillStyle = mc
            c.beginPath(); _round_rect(c, mx, my, merlon_w, merlon_h, 1); c.fill()

        for tt in range(2):
            tx = bx + (CW - 22 if tt else -2)
            th2 = int(58 * vs)
            tg2 = c.createLinearGradient(tx, 0, tx + 24, 0)
            tg2.addColorStop(0, stoneL); tg2.addColorStop(0.5, stone); tg2.addColorStop(1, stoneD)
            c.fillStyle = tg2
            c.beginPath(); _round_rect(c, tx, by - th2, 24, int(th2 + wh * 0.45), 3); c.fill()
            for mb in range(int(th2 / 6)):
                my2 = by - th2 + mb * 6
                if my2 + 4 > by:
                    break
                h3 = hash2(mb, tt * 7)
                sc = stoneL if h3 > 0.6 else stoneD
                c.fillStyle = sc
                c.fillRect(tx + 2, my2, 20, 1)
            tmerlon_h = int(6 * vs)
            for tm in range(3):
                tmx = tx + tm * (merlon_w + 2)
                c.fillStyle = stone
                c.beginPath(); _round_rect(c, tmx, by - th2 - tmerlon_h, merlon_w, tmerlon_h, 1); c.fill()

        kw = 48
        kx = bx + CW / 2 - kw / 2
        kh = int(78 * vs)
        c.fillStyle = '#0c0e18'
        c.beginPath(); _round_rect(c, kx + kw // 2 - 11, int(by - kh + 14), 22, 24, 4); c.fill()
        door_col = '#ffd24a' if th_id != 'void' else '#b070e0'
        c.fillStyle = door_col
        c.beginPath(); _round_rect(c, kx + kw // 2 - 8, int(by - kh + 17), 7, 18, 3); c.fill()
        c.beginPath(); _round_rect(c, kx + kw // 2 + 1, int(by - kh + 17), 7, 18, 3); c.fill()

        fx0 = kx + kw // 2
        fy0 = int(by - kh - 8)
        c.strokeStyle = '#4a3a24'; c.lineWidth = 2
        c.beginPath(); c.moveTo(fx0, fy0); c.lineTo(fx0, int(fy0 - 30 * vs)); c.stroke()
        c.fillStyle = '#e0b84a'
        c.beginPath(); c.arc(fx0, int(fy0 - 30 * vs), 2.2, 0, TWO_PI); c.fill()
        w1 = math.sin(t * 3.2) * 2.4
        w2 = math.sin(t * 3.2 - 0.9) * 3.2
        flag_col = '#b02828' if th_id != 'void' else '#6a2aaa'
        c.fillStyle = flag_col
        c.beginPath()
        c.moveTo(fx0, int(fy0 - 30 * vs))
        c.quadraticCurveTo(fx0 + 12, int(fy0 - 29 * vs + w1), fx0 + 22, int(fy0 - 27 * vs + w2))
        c.lineTo(fx0 + 22, int(fy0 - 21 * vs + w2))
        c.quadraticCurveTo(fx0 + 12, int(fy0 - 23 * vs + w1), fx0, int(fy0 - 24 * vs))
        c.closePath(); c.fill()

        bar_w = int(CW * 0.6)
        bar_h = 5
        bar_x = bx + CW / 2 - bar_w / 2
        bar_y = by - main_h - merlon_h - 14
        c.fillStyle = (0, 0, 0, 160)
        c.beginPath(); _round_rect(c, bar_x - 1, bar_y - 1, bar_w + 2, bar_h + 2, 3); c.fill()
        c.fillStyle = (80, 20, 20, 200)
        c.beginPath(); _round_rect(c, bar_x, bar_y, bar_w, bar_h, 2); c.fill()
        hp_col = '#44cc44' if hp > 0.6 else '#cccc44' if hp > 0.3 else '#cc4444'
        c.fillStyle = hp_col
        c.beginPath(); _round_rect(c, bar_x, bar_y, int(bar_w * hp), bar_h, 2); c.fill()

    def drawRange(self, t, surface=None):
        rng = getattr(t, 'effectiveRange', None) or t.range
        col = (t.def_ or {}).get('color', '#ffffff')
        target = surface if surface is not None else self.bg
        c = Ctx(target)
        c.save()
        c.globalAlpha = 0.1
        c.beginPath()
        c.arc(t.x, t.y, rng, 0, TWO_PI)
        c.fillStyle = col
        c.fill()
        c.globalAlpha = 0.32
        c.strokeStyle = col
        c.lineWidth = 1.5
        c.stroke()
        c.restore()

    def drawCorruption(self, c):
        for key, v in self.corruption.items():
            if v <= 0.02:
                continue
            parts = key.split(',')
            col_c, col_r = int(parts[0]), int(parts[1])
            cx = (col_c + 0.5) * CONFIG['CELL']
            cy = (col_r + 0.5) * CONFIG['CELL']
            c.globalAlpha = v * 0.5
            c.fillStyle = '#2a0a2a'
            c.beginPath(); c.arc(cx, cy, CONFIG['CELL'] * 0.5, 0, TWO_PI); c.fill()
            c.globalAlpha = v
            c.strokeStyle = (90, 20, 110, 191); c.lineWidth = 1.4
            for tt in range(4):
                ta = (tt / 4) * TWO_PI + self.time * 0.5 * (1 if tt % 2 else -1)
                c.beginPath()
                c.moveTo(cx + math.cos(ta) * 6, cy + math.sin(ta) * 6)
                c.quadraticCurveTo(cx + math.cos(ta) * 16, cy + math.sin(ta) * 16, cx + math.cos(ta + 0.5) * 22, cy + math.sin(ta + 0.5) * 22)
                c.stroke()
            c.strokeStyle = '#6a1a6a'; c.lineWidth = 2
            c.beginPath(); c.arc(cx, cy, CONFIG['CELL'] * 0.35 * (0.8 + 0.2 * math.sin(self.time * 3 + col_c)), 0, TWO_PI); c.stroke()
            c.fillStyle = (120, 40, 160, int((0.3 + 0.2 * math.sin(self.time * 2 + col_r)) * 255))
            c.beginPath(); c.arc(cx, cy, 4, 0, TWO_PI); c.fill()
            c.globalAlpha = 1

    def drawLightning(self, c):
        for lb in self.lightning:
            alpha = max(0, lb['t'] / lb['max'])
            if lb.get('straight'):
                pts = [{'x': lb['x1'], 'y': lb['y1']}, {'x': lb['x2'], 'y': lb['y2']}]
            else:
                segs = 8
                pts = [{'x': lb['x1'], 'y': lb['y1']}]
                for s in range(1, segs):
                    tt = s / segs
                    px = lb['x1'] + (lb['x2'] - lb['x1']) * tt
                    py = lb['y1'] + (lb['y2'] - lb['y1']) * tt
                    pts.append({'x': px + (random.random() - 0.5) * 14, 'y': py + (random.random() - 0.5) * 14})
                pts.append({'x': lb['x2'], 'y': lb['y2']})
            c.save()
            c.globalAlpha = alpha * 0.2
            c.strokeStyle = lb['color']; c.lineWidth = 8
            c.beginPath(); c.moveTo(pts[0]['x'], pts[0]['y'])
            for p2 in pts[1:]:
                c.lineTo(p2['x'], p2['y'])
            c.stroke()
            c.globalAlpha = alpha * 0.5
            c.strokeStyle = '#ffffff'; c.lineWidth = 3.5
            c.beginPath(); c.moveTo(pts[0]['x'], pts[0]['y'])
            for p2 in pts[1:]:
                c.lineTo(p2['x'], p2['y'])
            c.stroke()
            c.globalAlpha = alpha
            c.strokeStyle = lb['color']; c.lineWidth = 1.8
            c.beginPath(); c.moveTo(pts[0]['x'], pts[0]['y'])
            for p3 in pts[1:]:
                c.lineTo(p3['x'], p3['y'])
            c.stroke()
            c.globalAlpha = alpha * 0.6
            c.strokeStyle = '#ffffff'; c.lineWidth = 0.8
            c.beginPath(); c.moveTo(pts[0]['x'], pts[0]['y'])
            for p3 in pts[1:]:
                c.lineTo(p3['x'], p3['y'])
            c.stroke()
            c.restore()

    def drawBossBars(self, c):
        idx = 0
        for e in self.enemies:
            if not e.boss or not e.alive:
                continue
            x = CONFIG['WIDTH'] / 2 - 170
            y = 18 + idx * 28
            idx += 1
            c.fillStyle = (0, 0, 0, 180)
            c.fillRect(x - 3, y - 3, 346, 22)
            c.strokeStyle = '#f2c86a'; c.lineWidth = 1.5
            c.strokeRect(x - 3, y - 3, 346, 22)
            c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 0.5
            c.strokeRect(x - 2, y - 2, 344, 20)
            pct = max(0, e.hp / e.hpMax)
            bg_col = (60, 15, 15, 220)
            c.fillStyle = bg_col
            c.fillRect(x, y, 340, 16)
            grad = c.createLinearGradient(x, 0, x + 340, 0)
            if pct > 0.5:
                grad.addColorStop(0, '#e05050')
                grad.addColorStop(1, '#c02020')
            else:
                grad.addColorStop(0, '#ff4040')
                grad.addColorStop(1, '#aa1010')
            c.fillStyle = grad
            c.fillRect(x, y, int(340 * pct), 16)
            hi = c.createLinearGradient(0, y, 0, y + 8)
            hi.addColorStop(0, 'rgba(255,255,255,0.2)')
            hi.addColorStop(1, 'rgba(255,255,255,0)')
            c.fillStyle = hi
            c.fillRect(x, y, int(340 * pct), 8)
            c.fillStyle = '#fff'
            try:
                font = _game_font('arial', 11)
                txt = f'{e.name}  {int(pct * 100)}%'
                surf = font.render(txt, True, (255, 255, 255))
                shd = font.render(txt, True, (0, 0, 0))
                c.surface.blit(shd, (int(CONFIG['WIDTH'] / 2 - surf.get_width() // 2 + 1), int(y + 3)))
                c.surface.blit(surf, (int(CONFIG['WIDTH'] / 2 - surf.get_width() // 2), int(y + 2)))
            except Exception:
                pass

    def render(self, surface):
        surface.blit(self.bg, (0, 0))
        c = Ctx(surface)
        self.drawPortal(c)
        self.drawCastle(c)
        gp = 0.5 + 0.5 * math.sin(self.time * 3)
        gpx = (self.map['portal'][0] + 0.5) * CONFIG['CELL']
        gpy = (self.map['portal'][1] + 0.5) * CONFIG['CELL']
        g2 = c.createRadialGradient(gpx, gpy, 2, gpx, gpy, 34)
        g2.addColorStop(0, (255, 235, 150, int((0.35 + gp * 0.4) * 255)))
        g2.addColorStop(1, (150, 70, 190, 0))
        c.fillStyle = g2
        c.beginPath(); c.ellipse(gpx, gpy, 30, 36, 0, 0, TWO_PI); c.fill()
        for sp in range(3):
            sphase = (self.time * 0.6 + sp * 0.34) % 1
            c.fillStyle = (255, 240, 190, int(0.6 * (1 - sphase) * 255))
            c.beginPath(); c.arc(gpx + math.sin(self.time * 2 + sp * 2) * 8, gpy + 12 - sphase * 30, 1.5, 0, TWO_PI); c.fill()
        fpx = (self.map['featurePos'][0] + 0.5) * CONFIG['CELL']
        fpy = (self.map['featurePos'][1] + 0.5) * CONFIG['CELL']
        for lm in range(3):
            lph = (self.time * 0.5 + lm * 0.3) % 1
            c.fillStyle = (255, 255, 255, int(0.5 * (0.5 - abs(lph - 0.5)) * 255))
            c.beginPath(); c.ellipse(fpx - 24 + lm * 24 + math.sin(self.time + lm * 3) * 4, fpy + (lm % 2) * 12, 6, 2, 0, 0, TWO_PI); c.fill()
        self.drawCorruption(c)
        if self.placing and self.mouse['inside']:
            mc = self.mouse['c']
            mr = self.mouse['r']
            ok = self.canPlace(mc, mr)
            gx = (mc + 0.5) * CONFIG['CELL']
            gy = (mr + 0.5) * CONFIG['CELL']
            def_ = TOWERS.get(self.placing, {})
            rng = def_.get('range', 100)
            c.globalAlpha = 0.25
            c.fillStyle = 'rgba(120,220,120,0.9)' if ok else 'rgba(220,80,80,0.9)'
            c.beginPath(); c.arc(gx, gy, rng, 0, TWO_PI); c.fill()
            c.globalAlpha = 0.5
            c.fillStyle = '#7ad47f' if ok else '#e05050'
            c.beginPath(); c.arc(gx, gy, CONFIG['CELL'] * 0.42, 0, TWO_PI); c.fill()
            c.globalAlpha = 1
            c.strokeStyle = '#7ad47f' if ok else '#e05050'
            c.lineWidth = 2
            c.strokeRect(mc * CONFIG['CELL'] + 1, mr * CONFIG['CELL'] + 1, CONFIG['CELL'] - 2, CONFIG['CELL'] - 2)
        sel = self.selected
        hover = self.hovered
        for tw in self.towers:
            if tw is sel or tw is hover:
                rng = getattr(tw, 'effectiveRange', None) or tw.range
                col = (tw.def_ or {}).get('color', '#ffffff')
                c.save()
                c.globalAlpha = 0.1
                c.beginPath(); c.arc(tw.x, tw.y, rng, 0, TWO_PI)
                c.fillStyle = col; c.fill()
                c.globalAlpha = 0.32
                c.strokeStyle = col; c.lineWidth = 1.5
                c.stroke()
                c.restore()
        for tw in self.towers:
            tw.draw(c, self)
        for e in self.enemies:
            e.draw(surface, 0, 0, self)
        for s in self.soldiers:
            s.draw(surface, 0, 0)
        for p in self.projectiles:
            p.draw(c)
        self.drawLightning(c)
        for p in self.particles:
            al = max(0, p['life'] / p['max'])
            if p.get('kind') == 'ring':
                rr = p['size'] + (p['r1'] - p['size']) * (1 - p['life'] / p['max'])
                c.globalAlpha = al * 0.85
                c.strokeStyle = p['color']; c.lineWidth = 2
                c.beginPath(); c.arc(p['x'], p['y'], rr, 0, TWO_PI); c.stroke()
                if al > 0.5:
                    c.globalAlpha = (al - 0.5) * 0.6
                    c.lineWidth = 1
                    c.beginPath(); c.arc(p['x'], p['y'], rr * 0.7, 0, TWO_PI); c.stroke()
                continue
            if p.get('kind') == 'flash':
                fsz = p['size'] * (1.4 - al * 0.4)
                c.globalAlpha = al * 0.6
                fg = c.createRadialGradient(p['x'], p['y'], 0, p['x'], p['y'], fsz)
                fg.addColorStop(0, p['color'])
                fg.addColorStop(1, 'rgba(255,255,255,0)')
                c.fillStyle = fg
                c.beginPath(); c.arc(p['x'], p['y'], fsz, 0, TWO_PI); c.fill()
                c.globalAlpha = al
                c.fillStyle = '#ffffff'
                c.beginPath(); c.arc(p['x'], p['y'], fsz * 0.3, 0, TWO_PI); c.fill()
                continue
            if p.get('kind') == 'smoke':
                sm_sz = p['size'] * (2 - al)
                c.globalAlpha = al * 0.25
                c.fillStyle = p['color']
                c.beginPath(); c.arc(p['x'], p['y'], sm_sz, 0, TWO_PI); c.fill()
                c.globalAlpha = al * 0.1
                c.beginPath(); c.arc(p['x'], p['y'], sm_sz * 1.3, 0, TWO_PI); c.fill()
                continue
            c.globalAlpha = al
            c.fillStyle = p['color']
            c.beginPath(); c.arc(p['x'], p['y'], p['size'], 0, TWO_PI); c.fill()
            sp2 = math.hypot(p.get('vx', 0), p.get('vy', 0))
            if sp2 > 40 and al > 0.2:
                c.globalAlpha = al * 0.5
                c.strokeStyle = p['color']
                c.lineWidth = max(1, p['size'] * 0.6)
                c.beginPath()
                c.moveTo(p['x'], p['y'])
                c.lineTo(p['x'] - p.get('vx', 0) * 0.045, p['y'] - p.get('vy', 0) * 0.045)
                c.stroke()
        c.globalAlpha = 1
        for t in self.texts:
            c.globalAlpha = max(0, t['life'] / t['max'])
            c.fillStyle = t['color']
            try:
                surf = _text_surface(t['txt'], t['color'], t.get('size', 12))
                surface.blit(surf, (int(t['x'] - surf.get_width() // 2), int(t['y'] - surf.get_height() // 2)))
            except Exception:
                pass
        c.globalAlpha = 1
        self.drawBossBars(c)
        WEATHER.draw_overlay(surface)
