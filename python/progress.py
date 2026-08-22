import os
import json

PROGRESS_PATH = os.path.join(os.path.dirname(__file__), 'progress_vael.json')

PROGRESS = {
    'xp': 0,
    'level': 0,
    'unlocked': ['plains'],
    'towers': {
        'archer': True, 'fire': True, 'ice': False, 'dwarf': True,
        'crossbow': False, 'venom': False, 'druid': False, 'tesla': False,
        'knight': False, 'sniper': False, 'holy': False, 'banner': False, 'warlock': False,
    },
    'maxWaveBeaten': 0,
    'conquestUnlocked': False,
    'completed': False,
    'achievements': {},
}

ACHIEVEMENTS = [
    {'id': 'first_blood', 'name': 'Primera Sangre', 'desc': 'Mata tu primer enemigo', 'icon': '\U0001f5e1\ufe0f'},
    {'id': 'wave_5', 'name': 'Oleada 5', 'desc': 'Sobrevive 5 oleadas', 'icon': '\u2694\ufe0f'},
    {'id': 'wave_10', 'name': 'Veterano', 'desc': 'Sobrevive 10 oleadas', 'icon': '\U0001f6e1\ufe0f'},
    {'id': 'wave_20', 'name': 'Invicto', 'desc': 'Completa todas las 20 oleadas', 'icon': '\U0001f451'},
    {'id': 'all_maps', 'name': 'Explorador', 'desc': 'Desbloquea todos los mapas', 'icon': '\U0001f5fa\ufe0f'},
    {'id': 'gold_500', 'name': 'Avaricia', 'desc': 'Acumula 500 de oro en una partida', 'icon': '\U0001f4b0'},
    {'id': 'kill_100', 'name': 'Carnicero', 'desc': 'Mata 100 enemigos en total', 'icon': '\U0001f480'},
    {'id': 'kill_500', 'name': 'Destructor', 'desc': 'Mata 500 enemigos en total', 'icon': '\U0001f525'},
    {'id': 'hard_win', 'name': 'Masoquista', 'desc': 'Gana en Dificil o superior', 'icon': '\U0001f31f'},
    {'id': 'tower_max', 'name': 'Maestro Constructor', 'desc': 'Mejora una torre al maximo nivel', 'icon': '\U0001f3f7\ufe0f'},
    {'id': 'splitter_kill', 'name': 'Atomizador', 'desc': 'Mata un Escindido y todos sus fragmentos', 'icon': '\U0001f4a5'},
    {'id': 'barracks', 'name': 'General', 'desc': 'Coloca una torre Barracas', 'icon': '\U0001f3d8\ufe0f'},
]

_XP_TABLE = [0, 40, 100, 220, 400, 700, 1100, 1800, 2800, 4500, 7000]

def _load():
    try:
        if os.path.exists(PROGRESS_PATH):
            with open(PROGRESS_PATH, 'r') as f:
                data = json.load(f)
                for k, v in data.items():
                    PROGRESS[k] = v
    except Exception:
        pass

def _save():
    try:
        with open(PROGRESS_PATH, 'w') as f:
            json.dump(PROGRESS, f, indent=2)
    except Exception:
        pass

def progressLoad():
    _load()
    return PROGRESS

def progressSave():
    _save()

def progressGainXp(amount):
    PROGRESS['xp'] += amount
    leveled = False
    while PROGRESS['level'] < len(_XP_TABLE) - 1 and PROGRESS['xp'] >= _XP_TABLE[PROGRESS['level'] + 1]:
        PROGRESS['level'] += 1
        leveled = True
        tower = _unlockTowerForLevel(PROGRESS['level'])
        if tower:
            PROGRESS['towers'][tower] = True
    return leveled

def progressAddMaxWave(n):
    if n > PROGRESS['maxWaveBeaten']:
        PROGRESS['maxWaveBeaten'] = n
    if PROGRESS['maxWaveBeaten'] >= 10:
        PROGRESS['conquestUnlocked'] = True
    _save()

def progressCompleteMap(map_id):
    MAP_ORDER = ['plains', 'desert', 'forest', 'frozen', 'void']
    if map_id not in PROGRESS['unlocked']:
        PROGRESS['unlocked'].append(map_id)
    idx = MAP_ORDER.index(map_id) if map_id in MAP_ORDER else -1
    if 0 <= idx < len(MAP_ORDER) - 1:
        nxt = MAP_ORDER[idx + 1]
        if nxt not in PROGRESS['unlocked']:
            PROGRESS['unlocked'].append(nxt)
    progressGainXp(50)
    _save()

def progressReset():
    PROGRESS['xp'] = 0
    PROGRESS['level'] = 0
    PROGRESS['unlocked'] = ['plains']
    PROGRESS['towers'] = {
        'archer': True, 'fire': True, 'ice': False, 'dwarf': True,
        'crossbow': False, 'venom': False, 'druid': False, 'tesla': False,
        'knight': False, 'sniper': False, 'holy': False, 'banner': False, 'warlock': False,
    }
    PROGRESS['maxWaveBeaten'] = 0
    PROGRESS['conquestUnlocked'] = False
    PROGRESS['completed'] = False
    PROGRESS['achievements'] = {}
    _save()


def unlockAchievement(aid):
    if 'achievements' not in PROGRESS:
        PROGRESS['achievements'] = {}
    if PROGRESS['achievements'].get(aid):
        return False
    PROGRESS['achievements'][aid] = True
    _save()
    return True


def isAchievementUnlocked(aid):
    return PROGRESS.get('achievements', {}).get(aid, False)


def achievementCount():
    return sum(1 for a in ACHIEVEMENTS if isAchievementUnlocked(a['id']))

def _unlockTowerForLevel(level):
    mapping = {
        2: 'ice', 3: 'crossbow', 4: 'venom', 5: 'druid',
        6: 'tesla', 7: 'knight', 8: 'sniper', 9: 'holy',
        10: 'banner', 11: 'warlock',
    }
    return mapping.get(level)

def progressNextMap(last_map_id):
    order = ['plains', 'desert', 'forest', 'frozen', 'void']
    idx = order.index(last_map_id) if last_map_id in order else -1
    if idx < len(order) - 1:
        nxt = order[idx + 1]
        if nxt in PROGRESS['unlocked']:
            return nxt
    return None

_load()
