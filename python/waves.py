import random
import math


def shuffle(a):
    for i in range(len(a) - 1, 0, -1):
        j = int(random.random() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


class Wave:
    BOSSES = ['dragon', 'orcKing', 'lord', 'iceDragon', 'warMachine', 'voidLord']

    THEME_FLAVOR = {
        'plains': {'n': 12, 'picks': [['skeleton', 0.5], ['orc', 0.4], ['undead', 0.4]]},
        'desert': {'n': 11, 'picks': [['skeleton', 0.7], ['undead', 0.5], ['fireGolem', 0.4]]},
        'forest': {'n': 11, 'picks': [['treant', 0.7], ['wisp', 0.6], ['troll', 0.4], ['crawler', 0.5]]},
        'frozen': {'n': 10, 'picks': [['iceWraith', 0.7], ['stoneGolem', 0.5], ['stormSpirit', 0.5]]},
        'void': {'n': 9, 'picks': [['voidWalker', 0.8], ['hulker', 0.5], ['crawler', 0.5], ['demon', 0.5]]},
    }

    def build(self, n):
        return self.build_for(n, 'plains')

    def build_for(self, n, map_id):
        if n == 0:
            return []
        from maps import MAPS_BY_ID
        m = MAPS_BY_ID.get(map_id, MAPS_BY_ID.get('plains'))
        theme = m['theme'] if m else 'plains'
        lst = []
        gap = max(0.35, 1.4 - n * 0.06)

        if n % 5 == 0:
            idx = ((n // 5) - 1) % len(self.BOSSES)
            boss = self.BOSSES[idx]
            esc = []
            bg = max(0.3, 1.1 - n * 0.05)
            goblins = int(n * 1.5)
            for _ in range(goblins):
                esc.append({'type': 'goblin', 'gap': bg})
            orcs = int(n * 0.6)
            for _ in range(orcs):
                esc.append({'type': 'orc', 'gap': bg})
            if n >= 10:
                sks = int(n * 0.4)
                for _ in range(sks):
                    esc.append({'type': 'skeleton', 'gap': bg})
            if n >= 15:
                uds = int(n * 0.3)
                for _ in range(uds):
                    esc.append({'type': 'undead', 'gap': bg})
            if n >= 20 and boss != 'iceDragon':
                for _ in range(int(n * 0.3)):
                    esc.append({'type': 'stormSpirit', 'gap': bg})
            shuffle(esc)
            boss_hp_mul = 1 + (n - 5) * 0.08
            esc.insert(0, {'type': boss, 'gap': 3, 'bossHpMul': boss_hp_mul})
            lst = esc
        else:
            types = []
            types.append(['goblin', 3 + n * 2])
            if n >= 3:
                types.append(['orc', int(n * 1.2)])
            if n >= 5:
                types.append(['skeleton', int(n * 0.9)])
            if n >= 6:
                types.append(['crawler', int((n - 4) * 0.9)])
            if n >= 7:
                types.append(['berserker', int((n - 4) * 0.9)])
            if n >= 8:
                types.append(['gargoyle', int((n - 6) * 0.5)])
            if n >= 9:
                types.append(['bat', int(n * 0.6)])
            if n >= 11:
                types.append(['sorcerer', int((n - 8) * 0.5)])
                types.append(['wisp', int((n - 9) * 0.5)])
            if n >= 12:
                types.append(['shaman', int((n - 10) * 0.35)])
            if n >= 13:
                types.append(['troll', int((n - 10) * 0.5)])
            if n >= 14:
                types.append(['fireGolem', int((n - 12) * 0.4)])
                types.append(['demon', int((n - 12) * 0.45)])
            if n >= 15:
                types.append(['iceWraith', int((n - 12) * 0.5)])
            if n >= 16:
                types.append(['undead', int((n - 12) * 0.5)])
            if n >= 17:
                types.append(['stoneGolem', int((n - 14) * 0.4)])
                types.append(['lich', int((n - 15) * 0.35)])
            if n >= 18:
                types.append(['treant', int((n - 15) * 0.5)])
                types.append(['necromancer', int((n - 14) * 0.4)])
            if n >= 19:
                types.append(['stormSpirit', int((n - 15) * 0.5)])
                types.append(['voidWalker', int((n - 17) * 0.5)])
            if n >= 8:
                types.append(['saboteur', int((n - 6) * 0.4)])
            if n >= 10:
                types.append(['assassin', int((n - 8) * 0.45)])
            if n >= 12:
                types.append(['thief', int((n - 10) * 0.3)])
            if n >= 18:
                types.append(['hulker', int((n - 16) * 0.3)])
            if n >= 7:
                types.append(['splitter', int((n - 5) * 0.4)])
            for t_type, count in types:
                for _ in range(count):
                    lst.append({'type': t_type, 'gap': gap})
            fl = self.THEME_FLAVOR.get(theme)
            if fl and n >= fl['n']:
                for pk_type, pk_weight in fl['picks']:
                    count = int((n - fl['n'] + 3) * pk_weight)
                    for _ in range(count):
                        lst.append({'type': pk_type, 'gap': gap})
            shuffle(lst)
            if lst:
                lst[0]['gap'] = 2

        if len(lst) > 90:
            lst = lst[:90]
        return lst


WAVE = Wave()
