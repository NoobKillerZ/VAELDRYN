import random
import math
from waves import WAVE
from waves import shuffle


class Director:
    LEVELS = ['Relajado', 'Agresivo', 'Pesadilla']

    def __init__(self):
        self.level = 0
        self.stats = {
            'dmg': {
                'physical': 0, 'fire': 0, 'ice': 0,
                'earth': 0, 'nature': 0, 'lightning': 0, 'void': 0
            },
            'kills': 0,
            'livesLost': 0,
            'leaks': 0,
            'goldEarned': 0,
            'towersBuilt': 0,
            'placements': []
        }
        self.adapted = False
        self.lastReport = ''

    def reset(self):
        self.stats['dmg'] = {
            'physical': 0, 'fire': 0, 'ice': 0,
            'earth': 0, 'nature': 0, 'lightning': 0, 'void': 0
        }
        self.stats['kills'] = 0
        self.stats['livesLost'] = 0
        self.stats['leaks'] = 0
        self.stats['goldEarned'] = 0
        self.stats['towersBuilt'] = 0
        self.stats['placements'] = []
        self.adapted = False

    def recordDamage(self, element, amount):
        if element not in self.stats['dmg']:
            self.stats['dmg'][element] = 0
        self.stats['dmg'][element] += amount

    def recordKill(self):
        self.stats['kills'] += 1

    def recordLeak(self, dmg):
        self.stats['leaks'] += 1
        self.stats['livesLost'] += dmg

    def recordGold(self, amt):
        self.stats['goldEarned'] += amt

    def recordBuild(self, c, r, type_):
        self.stats['towersBuilt'] += 1
        self.stats['placements'].append({'c': c, 'r': r, 'type': type_})

    def dominantElement(self):
        d = self.stats['dmg']
        total = d['physical'] + d['fire'] + d['ice'] + d['earth'] + d['nature'] + d['lightning'] + d['void']
        if total <= 0:
            return None
        best = None
        bestPct = 0
        for k in d:
            pct = d[k] / total
            if pct > bestPct:
                best = k
                bestPct = pct
        return {'element': best, 'pct': bestPct}

    def elementCounter(self, element):
        counter_map = {
            'fire': ['fireGolem', 'treant'],
            'ice': ['iceWraith', 'stormSpirit'],
            'earth': ['stoneGolem', 'treant'],
            'nature': ['treant', 'fireGolem'],
            'physical': ['undead', 'stoneGolem']
        }
        return counter_map.get(element, [])

    def weaknessOf(self, element):
        weakness_map = {
            'fire': 'ice',
            'ice': 'fire',
            'earth': 'nature',
            'nature': 'fire',
            'physical': 'fire'
        }
        return weakness_map.get(element, 'fire')

    def analyze(self, game):
        dom = self.dominantElement()
        if not dom:
            return 'Aun no hay datos suficientes...'
        total = (
            self.stats['dmg']['physical'] + self.stats['dmg']['fire'] +
            self.stats['dmg']['ice'] + self.stats['dmg']['earth'] +
            self.stats['dmg']['nature'] + self.stats['dmg']['lightning'] +
            self.stats['dmg']['void']
        )
        element_names = {
            'physical': 'Fisico',
            'fire': 'Fuego',
            'ice': 'Hielo',
            'earth': 'Tierra',
            'nature': 'Naturaleza',
            'lightning': 'Rayo',
            'void': 'Vacio'
        }
        lines = []
        lines.append(
            'Elemento dominante: <b>' + element_names[dom['element']] +
            '</b> (' + str(math.floor(dom['pct'] * 100)) +
            '% de ' + str(math.floor(total)) + ' de dano)'
        )
        if self.stats['livesLost'] > 0:
            lines.append('Vidas perdidas: ' + str(self.stats['livesLost']))
        return '<br>'.join(lines)

    def buildWave(self, n, game):
        if hasattr(WAVE, 'build_for') and game is not None and hasattr(game, 'mapId'):
            list_ = WAVE.build_for(n, game.mapId)
        else:
            list_ = WAVE.build(n)
        dom = self.dominantElement()
        if not dom or dom['pct'] < 0.3:
            return list_
        diff = self.level
        strength = max(1, math.floor((n - 4) * 0.35))
        counters = self.elementCounter(dom['element'])
        if not counters:
            return list_
        idx = random.randint(0, len(counters) - 1)
        counter = counters[idx]
        extra = []
        for i in range(strength):
            extra.append({'type': counter, 'gap': 0.6})
        if diff >= 1 and n >= 7:
            second = self.elementCounter(dom['element'])
            if len(second) > 1:
                idx2 = (idx + 1 + random.randint(0, len(second) - 2)) % len(second)
                for j in range(math.floor(strength / 2)):
                    extra.append({'type': second[idx2], 'gap': 0.7})
            if diff >= 2 and n >= 10:
                for k in range(math.floor(strength / 3)):
                    extra.append({'type': 'voidWalker', 'gap': 1})
        list_ = shuffle(list_ + extra)
        if len(list_) > 90:
            list_ = list_[:90]
        self.adapted = True
        return list_


DIRECTOR = Director()
