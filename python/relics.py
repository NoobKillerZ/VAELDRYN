import copy


CONQUEST = {
    'SELECTED': [
        {'id': 'berserker', 'name': 'Corazón del Berserker', 'icon': '\U0001fa78',
         'desc': '+25% daño en todas las torres, pero -15% alcance.', 'goldMult': 1.0},
        {'id': 'merchant', 'name': 'Corona del Mercader', 'icon': '\U0001fa99',
         'desc': '+30% de oro por derrota, pero las mejoras cuestan +25%.', 'goldMult': 1.3},
    ],
    'SETTINGS': {
        'startWaves': 10,
        'finalWaves': [15, 20, 25, 30],
        'goldPerEnd': 100,
        'hpLossPerEnd': 10,
        'hpBonusPer5Waves': 20,
        'finalBonusGold': 300,
        'conquestTimerStart': 100,
        'conquestTimerEnd': 40,
        'conquestTimerDec': 0.6,
    },
}


RELICS = [
    {
        'id': 'berserker',
        'name': 'Corazón del Berserker',
        'icon': '\U0001fa78',
        'desc': '+25% daño en todas las torres, pero -15% alcance.',
        'apply': lambda g: [
            setattr(t, 'damage', t.damage * 1.25) or
            setattr(t, 'range', t.range * 0.85)
            for t in g.towers
        ],
    },
    {
        'id': 'merchant',
        'name': 'Corona del Mercader',
        'icon': '\U0001fa99',
        'desc': '+30% de oro por derrota, pero las mejoras cuestan +25%.',
        'goldMult': 1.3,
        'upCostMult': 1.25,
    },
    {
        'id': 'glacier',
        'name': 'Fragmento Glacial',
        'icon': '\u2744\ufe0f',
        'desc': 'Los enemigos comienzan ralentizados.',
        'apply': lambda g: setattr(g, 'startSlow', 0.8),
    },
    {
        'id': 'archery',
        'name': 'Manual del Arquero',
        'icon': '\U0001f3f9',
        'desc': '+30% daño físico.',
        'apply': lambda g: [
            setattr(t, 'damage', t.damage * 1.3)
            for t in g.towers
            if t.element == 'physical'
        ],
    },
    {
        'id': 'pyromancer',
        'name': 'Grimorio Ígneo',
        'icon': '\U0001f525',
        'desc': '+30% daño de fuego y quema más fuerte.',
        'apply': lambda g: [
            setattr(t, 'damage', t.damage * 1.3) or
            (t.poison and t.poison.update({'dps': t.poison['dps'] * 1.3}))
            for t in g.towers
            if t.element == 'fire'
        ],
    },
    {
        'id': 'iceheart',
        'name': 'Corazón de Escarcha',
        'icon': '\u2744\ufe0f',
        'desc': '+30% daño de hielo y ralentización extra.',
        'apply': lambda g: [
            setattr(t, 'damage', t.damage * 1.3)
            for t in g.towers
            if t.element == 'ice'
        ],
    },
    {
        'id': 'necromancy',
        'name': 'Grimorio Prohibido',
        'icon': '\U0001f4d6',
        'desc': '+40% daño de veneno.',
        'apply': lambda g: [
            setattr(t, 'damage', t.damage * 1.4) or
            (t.poison and t.poison.update({'dps': t.poison['dps'] * 1.3}))
            for t in g.towers
            if t.element == 'nature'
        ],
    },
    {
        'id': 'voidshard',
        'name': 'Fragmento del Vacío',
        'icon': '\U0001f300',
        'desc': 'El vacío maldice un 40% más fuerte.',
        'apply': lambda g: [
            (t.hex and t.hex.update({'mult': t.hex['mult'] * 1.4}))
            for t in g.towers
            if t.element == 'void'
        ],
    },
    {
        'id': 'divinefavor',
        'name': 'Favor Divino',
        'icon': '\u2728',
        'desc': 'La purificación cura las torres un 40% más.',
        'apply': lambda g: [
            setattr(t, 'purge', int(t.purge * 1.4))
            for t in g.towers
            if hasattr(t, 'purge') and t.purge
        ],
    },
    {
        'id': 'bannersoul',
        'name': 'Alma del Estandarte',
        'icon': '\U0001f6a9',
        'desc': 'Los estandartes inspiran un 35% más.',
        'apply': lambda g: [
            setattr(t, 'aura', t.aura + 0.08)
            for t in g.towers
            if t.element == 'holy'
        ],
    },
]
