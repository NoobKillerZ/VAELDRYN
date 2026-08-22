import math
import pygame
from artkit import Ctx, _parse_color, _quad_bezier, _arc_points, TWO_PI
from config import CONFIG, TOWER_TYPES, ENEMIES


def hash2(x, y):
    n = int(x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) & 0xFFFFFFFF
    n = (n * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 16)) & 0xFFFFFFFF
    return n / 4294967295.0


MAPS = [
    {
        'id': 'plains', 'name': 'Llanuras de Valdryn', 'icon': '\U0001f3f0',
        'desc': 'Las tierras de tu reino: un camino de adoquines, un lago sereno y el castillo a la vista.',
        'difficulty': 1, 'startGold': 180, 'startLives': 20, 'mult': 1.0,
        'theme': 'plains',
        'path': [[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [18, 3], [18, 11], [24, 11]],
        'portal': [1, 3], 'castle': [20, 8.4], 'featurePos': [2.5, 12.1],
    },
    {
        'id': 'desert', 'name': 'Desierto de Ashar', 'icon': '\U0001f3dc\ufe0f',
        'desc': 'Un laberinto de dunas y oasis ocultos. El sol abrasa y los muertos caminan.',
        'difficulty': 1, 'startGold': 175, 'startLives': 20, 'mult': 1.15,
        'theme': 'desert',
        'path': [[-1, 2], [5, 2], [5, 6], [9, 6], [9, 2], [14, 2], [14, 6], [18, 6], [18, 10], [13, 10], [13, 13], [24, 13]],
        'portal': [1, 2], 'castle': [20, 11], 'featurePos': [7.5, 10.5],
    },
    {
        'id': 'forest', 'name': 'Bosque Sombr\u00edo', 'icon': '\U0001f332',
        'desc': '\u00c1rboles centenarios, niebla y criaturas de la madera. El camino serpentea entre las ra\u00edces.',
        'difficulty': 2, 'startGold': 170, 'startLives': 18, 'mult': 1.3,
        'theme': 'forest',
        'path': [[-1, 6], [3, 6], [3, 2], [9, 2], [9, 8], [5, 8], [5, 11], [13, 11], [13, 7], [20, 7], [20, 13], [24, 13]],
        'portal': [1, 6], 'castle': [21, 11], 'featurePos': [22, 3.2],
    },
    {
        'id': 'frozen', 'name': 'Monta\u00f1as Heladas', 'icon': '\u2744\ufe0f',
        'desc': 'El fr\u00edo eterno. Los glaciares crujen y los espectros de escarcha patrullan la nieve.',
        'difficulty': 2, 'startGold': 165, 'startLives': 18, 'mult': 1.5,
        'theme': 'frozen',
        'path': [[-1, 1], [4, 1], [4, 5], [8, 5], [8, 9], [12, 9], [12, 5], [16, 5], [16, 12], [24, 12]],
        'portal': [1, 1], 'castle': [20, 10], 'featurePos': [20.5, 2.4],
    },
    {
        'id': 'void', 'name': 'Ruinas del Vac\u00edo', 'icon': '\U0001f30c',
        'desc': 'El coraz\u00f3n de la corrupci\u00f3n. Largas serpentinas de ruinas corruptas, la prueba final.',
        'difficulty': 3, 'startGold': 160, 'startLives': 16, 'mult': 1.75,
        'theme': 'void',
        'path': [[-1, 1], [1, 1], [1, 12], [7, 12], [7, 1], [13, 1], [13, 12], [19, 12], [19, 1], [24, 1]],
        'portal': [1, 1], 'castle': [20, 2], 'featurePos': [4, 7],
    },
]

MAPS_BY_ID = {m['id']: m for m in MAPS}


# ============================================================
#  HELPER: round rect as path
# ============================================================

def _round_rect(c, x, y, w, h, r):
    r2 = min(r, w / 2, h / 2)
    c.beginPath()
    c.moveTo(x + r2, y)
    c.lineTo(x + w - r2, y)
    c.arc(x + w - r2, y + r2, r2, -math.pi / 2, 0)
    c.lineTo(x + w, y + h - r2)
    c.arc(x + w - r2, y + h - r2, r2, 0, math.pi / 2)
    c.lineTo(x + r2, y + h)
    c.arc(x + r2, y + h - r2, r2, math.pi / 2, math.pi)
    c.lineTo(x, y + r2)
    c.arc(x + r2, y + r2, r2, math.pi, math.pi * 1.5)
    c.closePath()


# ============================================================
#  DECORACION COMPARTIDA
# ============================================================

def decoTree(c, cx, cy, trunk, leaf, hi):
    c.fillStyle = (0, 0, 0, int(0.2 * 255))
    c.beginPath(); c.ellipse(cx + 1, cy + 10, 10, 3.2, 0, 0, TWO_PI); c.fill()
    c.fillStyle = trunk
    c.beginPath()
    c.moveTo(cx - 2.4, cy + 10)
    c.quadraticCurveTo(cx - 2.8, cy + 4, cx - 1.6, cy - 1)
    c.lineTo(cx + 1.6, cy - 1)
    c.quadraticCurveTo(cx + 2.8, cy + 4, cx + 2.4, cy + 10)
    c.closePath(); c.fill()
    c.strokeStyle = (20, 12, 6, int(0.55 * 255)); c.lineWidth = 1
    c.beginPath(); c.moveTo(cx - 0.6, cy + 9)
    c.quadraticCurveTo(cx - 1, cy + 5, cx - 0.4, cy + 1); c.stroke()
    c.beginPath(); c.moveTo(cx - 2.2, cy + 9.6); c.lineTo(cx - 4.6, cy + 11); c.stroke()
    c.beginPath(); c.moveTo(cx + 2.2, cy + 9.6); c.lineTo(cx + 4.4, cy + 11); c.stroke()
    c.fillStyle = trunk; c.lineWidth = 1.8; c.lineCap = 'round'
    c.beginPath(); c.moveTo(cx, cy + 1); c.lineTo(cx - 4.5, cy - 4); c.stroke()
    c.beginPath(); c.moveTo(cx, cy + 1); c.lineTo(cx + 4.5, cy - 4.5); c.stroke()
    back, mid, front = leaf, leaf, hi
    c.fillStyle = back
    c.beginPath(); c.arc(cx - 5.5, cy - 3, 6.5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx + 5.5, cy - 3, 6.5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx, cy - 8.5, 7.5, 0, TWO_PI); c.fill()
    c.fillStyle = mid
    c.beginPath(); c.arc(cx - 3.5, cy - 5.5, 5.5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx + 3.5, cy - 5.5, 5.5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx, cy - 2, 4.5, 0, TWO_PI); c.fill()
    c.fillStyle = front
    c.beginPath(); c.arc(cx - 2.5, cy - 9, 3, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx - 5, cy - 5, 1.8, 0, TWO_PI); c.fill()
    c.fillStyle = (255, 255, 255, int(0.14 * 255))
    for i in range(4):
        la = i * 1.7 + cx % 3
        c.beginPath()
        c.arc(cx + math.cos(la) * 6.5, cy - 5 + math.sin(la) * 4, 0.8, 0, TWO_PI)
        c.fill()
    c.strokeStyle = (10, 24, 10, int(0.45 * 255)); c.lineWidth = 2
    c.beginPath(); c.arc(cx, cy - 1.5, 8.5, 0.35, math.pi - 0.35); c.stroke()


def decoPine(c, cx, cy, dark, light, snow=False):
    c.fillStyle = (0, 0, 0, int(0.2 * 255))
    c.beginPath(); c.ellipse(cx, cy + 10, 7, 2.6, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#4a3520'
    c.beginPath()
    c.moveTo(cx - 1.5, cy + 2); c.lineTo(cx + 1.5, cy + 2)
    c.lineTo(cx + 1.5, cy + 11); c.lineTo(cx - 1.5, cy + 11)
    c.closePath(); c.fill()
    layers = [
        (cy - 17, 4.2, dark), (cy - 12.5, 5.6, light),
        (cy - 8, 6.8, dark), (cy - 3.5, 7.8, light),
    ]
    for idx in range(len(layers)):
        ty, w, col = layers[idx]
        baseY = cy + 3 - idx * 0.4
        c.fillStyle = col
        c.beginPath()
        c.moveTo(cx, ty)
        c.quadraticCurveTo(cx - w * 0.55, ty + (baseY - ty) * 0.55, cx - w, baseY - 1.5)
        c.quadraticCurveTo(cx - w * 0.5, baseY + 0.5, cx, baseY - 0.5)
        c.quadraticCurveTo(cx + w * 0.5, baseY + 0.5, cx + w, baseY - 1.5)
        c.quadraticCurveTo(cx + w * 0.55, ty + (baseY - ty) * 0.55, cx, ty)
        c.closePath(); c.fill()
        if snow:
            c.strokeStyle = (240, 248, 255, int(0.85 * 255))
            c.lineWidth = 1.6; c.lineCap = 'round'
            c.beginPath()
            c.moveTo(cx - w * 0.62, ty + (baseY - ty) * 0.62)
            c.quadraticCurveTo(cx, ty + (baseY - ty) * 0.4,
                               cx + w * 0.62, ty + (baseY - ty) * 0.62)
            c.stroke()
    c.fillStyle = (255, 255, 255, int(0.22 * 255))
    c.beginPath(); c.arc(cx - 2.6, cy - 12, 1.5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx - 1.8, cy - 6.5, 1.1, 0, TWO_PI); c.fill()


def decoCactus(c, cx, cy):
    c.fillStyle = (0, 0, 0, int(0.2 * 255))
    c.beginPath(); c.ellipse(cx + 1, cy + 9, 8, 2.4, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#2f6e2f'
    for bx, by, bw, bh2, br in [
        (cx - 9, cy - 8, 4.6, 6, 2), (cx - 7.5, cy - 4, 4, 3.4, 1.6),
        (cx + 4.4, cy - 7, 4.6, 5, 2), (cx + 3.6, cy - 3.6, 4, 3.2, 1.6),
    ]:
        _round_rect(c, bx, by, bw, bh2, br); c.fill()
    c.fillStyle = '#4a8a42'
    _round_rect(c, cx - 2.8, cy - 6, 6, 15, 2.6); c.fill()
    c.strokeStyle = (16, 36, 12, int(0.65 * 255)); c.lineWidth = 1
    _round_rect(c, cx - 2.8, cy - 6, 6, 15, 2.6); c.stroke()
    c.strokeStyle = (220, 255, 210, int(0.22 * 255)); c.lineWidth = 0.9
    c.beginPath(); c.moveTo(cx - 1.2, cy - 5); c.lineTo(cx - 1.2, cy + 8); c.stroke()
    c.beginPath(); c.moveTo(cx + 1.4, cy - 5); c.lineTo(cx + 1.4, cy + 8); c.stroke()
    c.strokeStyle = (16, 36, 12, int(0.35 * 255))
    c.beginPath(); c.moveTo(cx + 2.6, cy - 4); c.lineTo(cx + 2.6, cy + 7); c.stroke()
    c.strokeStyle = (240, 240, 220, int(0.6 * 255)); c.lineWidth = 0.7
    for sp in range(3):
        c.beginPath(); c.moveTo(cx - 3, cy - 2 + sp * 4)
        c.lineTo(cx - 4.2, cy - 2.8 + sp * 4); c.stroke()
    c.fillStyle = '#e86a9a'
    c.beginPath(); c.arc(cx, cy - 7.4, 1.6, 0, TWO_PI); c.fill()
    c.fillStyle = '#ffd24a'
    c.beginPath(); c.arc(cx, cy - 7.4, 0.7, 0, TWO_PI); c.fill()
    c.fillStyle = '#8a5a2a'
    c.beginPath(); c.arc(cx + 5, cy + 6, 3, 0, TWO_PI); c.fill()
    c.fillStyle = (255, 255, 255, int(0.15 * 255))
    c.beginPath(); c.arc(cx + 4, cy + 5, 1.2, 0, TWO_PI); c.fill()


def decoRock(c, cx, cy, a, b):
    c.fillStyle = (0, 0, 0, int(0.22 * 255))
    c.beginPath(); c.ellipse(cx + 1, cy + 8.5, 9, 2.6, 0, 0, TWO_PI); c.fill()
    c.fillStyle = a
    c.beginPath()
    c.moveTo(cx - 8, cy + 8); c.lineTo(cx - 8.5, cy + 4)
    c.lineTo(cx - 5, cy + 0.5); c.lineTo(cx - 1, cy - 1)
    c.lineTo(cx + 4, cy + 0.2); c.lineTo(cx + 8, cy + 3.5)
    c.lineTo(cx + 7.5, cy + 8); c.closePath(); c.fill()
    c.strokeStyle = (20, 16, 12, int(0.55 * 255)); c.lineWidth = 1; c.stroke()
    c.fillStyle = b
    c.beginPath()
    c.moveTo(cx - 5, cy + 0.5); c.lineTo(cx - 1, cy - 1)
    c.lineTo(cx + 1.5, cy + 3); c.lineTo(cx - 2, cy + 6)
    c.lineTo(cx - 6, cy + 4.5); c.closePath(); c.fill()
    c.fillStyle = (0, 0, 0, int(0.18 * 255))
    c.beginPath()
    c.moveTo(cx + 4, cy + 0.2); c.lineTo(cx + 8, cy + 3.5)
    c.lineTo(cx + 7.5, cy + 8); c.lineTo(cx + 2.5, cy + 7)
    c.lineTo(cx + 1.5, cy + 3); c.closePath(); c.fill()
    c.strokeStyle = (15, 12, 8, int(0.5 * 255)); c.lineWidth = 0.9
    c.beginPath()
    c.moveTo(cx - 1, cy + 0.2); c.lineTo(cx + 0.5, cy + 3)
    c.lineTo(cx - 0.8, cy + 5.5); c.stroke()
    c.fillStyle = (90, 130, 60, int(0.5 * 255))
    c.beginPath(); c.ellipse(cx - 4.5, cy + 6.5, 2.4, 1, -0.2, 0, TWO_PI); c.fill()
    c.fillStyle = (255, 255, 255, int(0.2 * 255))
    c.beginPath(); c.ellipse(cx - 2.5, cy + 0.8, 2, 1, -0.5, 0, TWO_PI); c.fill()


def decoFlower(c, cx, cy, stem, petals):
    c.fillStyle = stem
    c.beginPath(); c.arc(cx, cy + 6, 3, 0, TWO_PI); c.fill()
    c.fillStyle = petals
    c.beginPath(); c.arc(cx - 3, cy + 3, 2, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx + 3, cy + 3, 2, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx, cy, 2, 0, TWO_PI); c.fill()
    c.fillStyle = '#ffd24a'
    c.beginPath(); c.arc(cx, cy + 3, 1.6, 0, TWO_PI); c.fill()


def decoBush(c, cx, cy, a, b):
    c.fillStyle = (0, 0, 0, int(0.14 * 255))
    c.beginPath(); c.ellipse(cx, cy + 8, 6, 1.8, 0, 0, TWO_PI); c.fill()
    c.fillStyle = a
    c.beginPath(); c.arc(cx, cy + 6, 4, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx - 2.6, cy + 6.5, 2.6, 0, TWO_PI); c.fill()
    c.fillStyle = b
    c.beginPath(); c.arc(cx + 2, cy + 5, 2.5, 0, TWO_PI); c.fill()
    c.fillStyle = (255, 255, 255, int(0.12 * 255))
    c.beginPath(); c.arc(cx - 1.4, cy + 4, 1.4, 0, TWO_PI); c.fill()


def decoMushroom(c, cx, cy, cap, cap2):
    c.fillStyle = '#c8c8cc'
    c.beginPath(); c.ellipse(cx, cy + 7, 3, 1.6, 0, 0, TWO_PI); c.fill()
    c.fillStyle = cap
    c.beginPath(); c.arc(cx, cy + 6, 2.6, math.pi, 0); c.fill()
    c.fillStyle = (255, 255, 255, int(0.6 * 255))
    c.beginPath(); c.arc(cx - 1, cy + 5, 0.7, 0, TWO_PI); c.fill()
    c.fillStyle = '#c8c8cc'
    c.beginPath(); c.ellipse(cx + 5, cy + 6, 2.4, 1.4, 0, 0, TWO_PI); c.fill()
    c.fillStyle = cap2
    c.beginPath(); c.arc(cx + 5, cy + 5.5, 2, math.pi, 0); c.fill()


def decoCrystal(c, cx, cy, col, col2):
    c.fillStyle = col2; c.globalAlpha = 0.35
    c.beginPath(); c.arc(cx, cy - 3, 8, 0, TWO_PI); c.fill()
    c.globalAlpha = 1; c.fillStyle = col
    c.beginPath()
    c.moveTo(cx, cy); c.lineTo(cx - 2, cy - 8); c.lineTo(cx + 2, cy - 8)
    c.closePath(); c.fill()
    c.beginPath()
    c.moveTo(cx - 2, cy + 2); c.lineTo(cx - 5, cy - 6); c.lineTo(cx - 1, cy - 6)
    c.closePath(); c.fill()
    c.beginPath()
    c.moveTo(cx + 2, cy + 1); c.lineTo(cx + 4, cy - 5); c.lineTo(cx + 1, cy - 5)
    c.closePath(); c.fill()
    c.fillStyle = col2
    c.beginPath(); c.arc(cx, cy - 5, 1.2, 0, TWO_PI); c.fill()


def decoBone(c, cx, cy):
    c.strokeStyle = '#d8d4c8'; c.lineWidth = 2; c.lineCap = 'round'
    c.beginPath(); c.moveTo(cx - 3, cy + 2); c.lineTo(cx + 3, cy - 2); c.stroke()
    c.fillStyle = '#d8d4c8'
    c.beginPath(); c.arc(cx - 3, cy + 2, 2, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx + 3, cy - 2, 2, 0, TWO_PI); c.fill()


def decoSkull(c, cx, cy):
    c.fillStyle = '#d8d4c8'
    c.beginPath(); c.arc(cx, cy, 3.4, 0, TWO_PI); c.fill()
    c.fillRect(cx - 1.5, cy + 2.5, 3, 2.5)
    c.fillStyle = '#222222'
    c.beginPath(); c.arc(cx - 1.2, cy - 0.5, 0.9, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(cx + 1.2, cy - 0.5, 0.9, 0, TWO_PI); c.fill()


def decoRuins(c, cx, cy, a, b):
    c.fillStyle = (0, 0, 0, int(0.2 * 255))
    c.beginPath(); c.ellipse(cx, cy + 8.5, 9, 2.4, 0, 0, TWO_PI); c.fill()
    c.fillStyle = a
    _round_rect(c, cx - 6.5, cy - 2, 5, 10.5, 1); c.fill()
    c.save()
    c.translate(cx + 3, cy + 1); c.rotate(0.06)
    _round_rect(c, -2, -6, 4, 13, 1); c.fill()
    c.restore()
    c.fillStyle = b
    _round_rect(c, cx - 6.5, cy - 2, 5, 2, 1); c.fill()
    _round_rect(c, cx + 0.5, cy - 5.5, 4.6, 2, 1); c.fill()
    c.strokeStyle = (0, 0, 0, int(0.25 * 255)); c.lineWidth = 0.8
    c.beginPath(); c.moveTo(cx - 4.8, cy); c.lineTo(cx - 4.8, cy + 7.5); c.stroke()
    c.beginPath(); c.moveTo(cx - 3.2, cy); c.lineTo(cx - 3.2, cy + 7.5); c.stroke()
    c.beginPath(); c.moveTo(cx + 2.6, cy - 3.5); c.lineTo(cx + 2.9, cy + 6.5); c.stroke()
    c.strokeStyle = (0, 0, 0, int(0.4 * 255))
    c.beginPath()
    c.moveTo(cx - 5.6, cy + 1); c.lineTo(cx - 4.4, cy + 4)
    c.lineTo(cx - 5.2, cy + 7); c.stroke()
    c.fillStyle = a
    _round_rect(c, cx - 1, cy + 6, 5, 3.4, 1); c.fill()
    c.fillStyle = (255, 255, 255, int(0.12 * 255))
    _round_rect(c, cx - 1, cy + 6, 5, 1, 1); c.fill()


def decoGrass(c, cx, cy, col):
    c.fillStyle = col
    c.beginPath()
    c.moveTo(cx - 3, cy); c.lineTo(cx, cy - 7); c.lineTo(cx + 3, cy)
    c.closePath(); c.fill()


def decoFern(c, cx, cy, col):
    c.strokeStyle = col; c.lineWidth = 1.4; c.lineCap = 'round'
    c.beginPath(); c.moveTo(cx, cy)
    c.quadraticCurveTo(cx + 4, cy - 5, cx + 8, cy - 6); c.stroke()
    c.beginPath(); c.moveTo(cx, cy)
    c.quadraticCurveTo(cx - 4, cy - 5, cx - 8, cy - 6); c.stroke()


# ============================================================
#  TEMAS
# ============================================================

def _plains_cell(h, shade):
    base = 56 + int(h * 26) + shade
    return (max(20, base - 16), min(200, base + 52), max(18, base - 26), int(0.5 * 255))

def _plains_decor(c, cx, cy, hh):
    fc = [(224,80,80),(232,192,96),(208,96,208),(96,160,232)]
    if hh > 0.955:
        decoTree(c, cx, cy, '#5a3d22', '#2e6e2e', (140, 210, 90, int(0.55 * 255)))
    elif hh > 0.925:
        decoRock(c, cx, cy, '#6a6a74', '#7d7d88')
    elif hh > 0.9:
        decoFlower(c, cx, cy, '#2e7a2e', fc[int(hh * 10) % 4])
    elif hh > 0.88:
        decoBush(c, cx, cy, '#3f8f3f', '#4faf4f')
    elif hh > 0.86:
        decoMushroom(c, cx, cy, '#e05858', '#e08058')
    elif hh > 0.84:
        decoGrass(c, cx, cy, (140, 200, 90, int(0.5 * 255)))

def _plains_detail(c, COLS, ROWS, CELL):
    for i in range(300):
        gx = hash2(i, 11) * COLS * CELL
        gy = hash2(i, 77) * ROWS * CELL
        h = hash2(i, 5)
        c.strokeStyle = (150, 210, 95, int(0.3 * 255)) if h > 0.5 else (80, 140, 55, int(0.3 * 255))
        c.lineWidth = 1
        c.beginPath(); c.moveTo(gx, gy)
        c.quadraticCurveTo(gx + (h - 0.5) * 3, gy - 2.5,
                           gx + (h - 0.5) * 6, gy - 3.5 - h * 2); c.stroke()
    fcl = [(240,220,120,int(0.5*255)),(240,240,240,int(0.45*255)),(230,140,160,int(0.45*255))]
    for f in range(26):
        c.fillStyle = fcl[f % 3]
        c.beginPath(); c.arc(hash2(f, 31) * COLS * CELL, hash2(f, 91) * ROWS * CELL,
                             1.1, 0, TWO_PI); c.fill()


def _desert_cell(h, shade):
    base = 150 + int(h * 34) + shade
    return (min(220, base + 30), min(200, base - 6), min(150, base - 70), int(0.55 * 255))

def _desert_decor(c, cx, cy, hh):
    if hh > 0.955:
        decoCactus(c, cx, cy)
    elif hh > 0.93:
        decoRock(c, cx, cy, '#8a7a58', '#a89a70')
    elif hh > 0.905:
        decoSkull(c, cx, cy)
    elif hh > 0.885:
        decoBush(c, cx, cy, '#6a8f4a', '#7aa05a')
    elif hh > 0.87:
        decoBone(c, cx, cy)
    elif hh > 0.85:
        decoRuins(c, cx, cy, '#9a8a6a', '#b0a080')

def _desert_detail(c, COLS, ROWS, CELL):
    for i in range(46):
        dx = hash2(i, 17) * COLS * CELL
        dy = hash2(i, 43) * ROWS * CELL
        ln = 30 + hash2(i, 7) * 70
        c.strokeStyle = (120, 95, 45, int(0.28 * 255)); c.lineWidth = 1.6
        c.beginPath(); c.moveTo(dx - ln / 2, dy)
        c.quadraticCurveTo(dx, dy - 4 - hash2(i, 3) * 5, dx + ln / 2, dy); c.stroke()
        c.strokeStyle = (230, 205, 140, int(0.3 * 255)); c.lineWidth = 1
        c.beginPath(); c.moveTo(dx - ln / 2, dy - 1.6)
        c.quadraticCurveTo(dx, dy - 5.6 - hash2(i, 3) * 5, dx + ln / 2, dy - 1.6); c.stroke()
    for p in range(60):
        c.fillStyle = (110, 88, 48, int(0.4 * 255)) if hash2(p, 9) > 0.5 else (200, 180, 120, int(0.35 * 255))
        c.beginPath(); c.arc(hash2(p, 23) * COLS * CELL, hash2(p, 59) * ROWS * CELL,
                             0.9 + hash2(p, 13), 0, TWO_PI); c.fill()


def _forest_cell(h, shade):
    base = 40 + int(h * 26) + shade
    return (max(16, base - 16), min(170, base + 44), max(14, base - 22), int(0.55 * 255))

def _forest_decor(c, cx, cy, hh):
    if hh > 0.94:
        decoTree(c, cx, cy, '#3a2a16', '#1e4a1e', (255, 255, 255, int(0.1 * 255)))
    elif hh > 0.915:
        decoPine(c, cx, cy, '#1a3a1a', '#2e5a2e')
    elif hh > 0.89:
        decoFern(c, cx, cy, '#3f7a3f')
    elif hh > 0.87:
        decoMushroom(c, cx, cy, '#6a2a8a', '#8a3a9a')
    elif hh > 0.85:
        decoBush(c, cx, cy, '#2e5a2e', '#3f7a3f')
    elif hh > 0.83:
        decoRock(c, cx, cy, '#5a5a4a', '#6e6e5c')
    elif hh > 0.81:
        decoGrass(c, cx, cy, (110, 170, 80, int(0.4 * 255)))

def _forest_detail(c, COLS, ROWS, CELL):
    for i in range(260):
        gx = hash2(i, 19) * COLS * CELL
        gy = hash2(i, 83) * ROWS * CELL
        h = hash2(i, 5)
        c.strokeStyle = (110, 170, 75, int(0.28 * 255)) if h > 0.5 else (45, 85, 35, int(0.32 * 255))
        c.lineWidth = 1
        c.beginPath(); c.moveTo(gx, gy)
        c.quadraticCurveTo(gx + (h - 0.5) * 3, gy - 2.5,
                           gx + (h - 0.5) * 5, gy - 3 - h * 2); c.stroke()
    lc = [(150,110,50,int(0.35*255)),(120,90,40,int(0.35*255)),(90,120,50,int(0.3*255))]
    for l in range(34):
        c.fillStyle = lc[l % 3]
        c.beginPath(); c.ellipse(hash2(l, 37) * COLS * CELL, hash2(l, 71) * ROWS * CELL,
                                 2.2, 1.1, hash2(l, 3) * 3, 0, TWO_PI); c.fill()
    for t in range(40):
        tx = hash2(t, 29) * COLS * CELL; ty = hash2(t, 67) * ROWS * CELL
        c.fillStyle = (70, 140, 60, int(0.4 * 255))
        c.beginPath(); c.arc(tx, ty, 0.9, 0, TWO_PI); c.fill()
        c.beginPath(); c.arc(tx + 1.4, ty + 0.4, 0.9, 0, TWO_PI); c.fill()
        c.beginPath(); c.arc(tx - 1.2, ty + 0.6, 0.9, 0, TWO_PI); c.fill()


def _frozen_cell(h, shade):
    base = 120 + int(h * 30) + shade
    return (min(220, base + 70), min(230, base + 80), min(235, base + 95), int(0.6 * 255))

def _frozen_decor(c, cx, cy, hh):
    if hh > 0.94:
        decoPine(c, cx, cy, '#2a5a4a', '#3a7a5a', True)
    elif hh > 0.91:
        decoRock(c, cx, cy, '#9aa8b8', '#c8d4e0')
    elif hh > 0.88:
        decoCrystal(c, cx, cy, '#bfe8ff', '#ffffff')
    elif hh > 0.86:
        decoBush(c, cx, cy, '#8ab0a0', '#a0c8b4')
    elif hh > 0.845:
        decoBone(c, cx, cy)
    elif hh > 0.83:
        decoSkull(c, cx, cy)

def _frozen_detail(c, COLS, ROWS, CELL):
    for i in range(150):
        sx = hash2(i, 13) * COLS * CELL
        sy = hash2(i, 47) * ROWS * CELL
        h = hash2(i, 3)
        c.fillStyle = (255, 255, 255, int((0.35 + h * 0.4) * 255))
        if h > 0.82:
            c.fillRect(sx - 1.6, sy - 0.5, 3.2, 1)
            c.fillRect(sx - 0.5, sy - 1.6, 1, 3.2)
        else:
            c.beginPath(); c.arc(sx, sy, 0.7 + h * 0.7, 0, TWO_PI); c.fill()
    for d in range(22):
        c.fillStyle = (90, 130, 170, int(0.16 * 255))
        c.beginPath()
        c.ellipse(hash2(d, 53) * COLS * CELL, hash2(d, 97) * ROWS * CELL,
                  16 + hash2(d, 7) * 22, 3.5 + hash2(d, 11) * 3,
                  hash2(d, 5) * 0.6 - 0.3, 0, TWO_PI); c.fill()


def _void_cell(h, shade):
    base = 22 + int(h * 26) + shade
    return (min(120, base + 40), max(8, base - 10), min(140, base + 58), int(0.6 * 255))

def _void_decor(c, cx, cy, hh):
    if hh > 0.94:
        decoCrystal(c, cx, cy, '#8a4aff', '#c8a0ff')
    elif hh > 0.91:
        decoRuins(c, cx, cy, '#3a2a4a', '#4e3a64')
    elif hh > 0.885:
        decoSkull(c, cx, cy)
    elif hh > 0.865:
        decoBone(c, cx, cy)
    elif hh > 0.845:
        decoBush(c, cx, cy, '#3a2a5a', '#4a3a6a')
    elif hh > 0.83:
        decoRock(c, cx, cy, '#3a3250', '#4c4270')

def _void_detail(c, COLS, ROWS, CELL):
    for i in range(42):
        fx = hash2(i, 21) * COLS * CELL
        fy = hash2(i, 61) * ROWS * CELL
        segs = 3 + int(hash2(i, 9) * 3)
        c.strokeStyle = (150, 80, 230, int((0.12 + hash2(i, 5) * 0.16) * 255))
        c.lineWidth = 1
        c.beginPath(); c.moveTo(fx, fy)
        px2, py2 = fx, fy
        for s in range(segs):
            px2 += (hash2(i * 7 + s, 33) - 0.5) * 18
            py2 += (hash2(i * 7 + s, 55) - 0.5) * 18
            c.lineTo(px2, py2)
        c.stroke()
        c.fillStyle = (190, 130, 255, int(0.35 * 255))
        c.beginPath(); c.arc(fx, fy, 1.1, 0, TWO_PI); c.fill()
    for m in range(36):
        c.fillStyle = (170, 110, 240, int((0.1 + hash2(m, 7) * 0.2) * 255))
        c.beginPath()
        c.arc(hash2(m, 41) * COLS * CELL, hash2(m, 89) * ROWS * CELL,
              0.8 + hash2(m, 3) * 1.2, 0, TWO_PI); c.fill()


THEMES = {
    'plains': {
        'name': 'Pradera',
        'ground': ['#3a4a2a', '#3f5130', '#2e3a24'],
        'cell': _plains_cell,
        'tuft': (120, 190, 90, int(0.35 * 255)),
        'soil': (60, 45, 25, int(0.25 * 255)),
        'paintDecor': _plains_decor,
        'detail': _plains_detail,
        'path': 'cobble',
    },
    'desert': {
        'name': 'Desierto',
        'ground': ['#b59a52', '#c4aa60', '#8a7438'],
        'cell': _desert_cell,
        'tuft': (150, 180, 90, int(0.18 * 255)),
        'soil': (120, 85, 40, int(0.2 * 255)),
        'paintDecor': _desert_decor,
        'detail': _desert_detail,
        'path': 'sand',
    },
    'forest': {
        'name': 'Bosque',
        'ground': ['#2a3a20', '#33522a', '#1e2c18'],
        'cell': _forest_cell,
        'tuft': (90, 150, 60, int(0.3 * 255)),
        'soil': (40, 28, 14, int(0.3 * 255)),
        'paintDecor': _forest_decor,
        'detail': _forest_detail,
        'path': 'dirt',
    },
    'frozen': {
        'name': 'Tundra',
        'ground': ['#8aa0b8', '#a8c0d4', '#5e768e'],
        'cell': _frozen_cell,
        'tuft': (255, 255, 255, int(0.25 * 255)),
        'soil': (120, 150, 180, int(0.25 * 255)),
        'paintDecor': _frozen_decor,
        'detail': _frozen_detail,
        'path': 'ice',
    },
    'void': {
        'name': 'Vac\u00edo',
        'ground': ['#1a1024', '#241632', '#120c1c'],
        'cell': _void_cell,
        'tuft': (160, 90, 220, int(0.14 * 255)),
        'soil': (60, 20, 90, int(0.3 * 255)),
        'paintDecor': _void_decor,
        'detail': _void_detail,
        'path': 'void',
    },
}


# ============================================================
#  DIBUJO DE CAMINOS POR TEMA
# ============================================================

def paintPathCobble(c, cells, CELL):
    for key in cells:
        pc, pr = int(key.split(',')[0]), int(key.split(',')[1])
        x, y = pc * CELL, pr * CELL
        c.fillStyle = '#6a4f2c'
        c.fillRect(x, y, CELL, CELL)
        c.fillStyle = (60, 44, 22, int(0.5 * 255))
        c.fillRect(x, y, CELL, 3)
        c.fillRect(x, y + CELL - 3, CELL, 3)
        for sy in range(3):
            for sx in range(3):
                hh2 = hash2(pc * 6 + sx, pr * 6 + sy)
                w = CELL / 3 - 3 - hh2 * 2.5
                cx2 = x + sx * CELL / 3 + CELL / 6 + (hh2 - 0.5) * 4
                cy2 = y + sy * CELL / 3 + CELL / 6 + (((hh2 * 53) % 1) - 0.5) * 4
                c.fillStyle = (50, 35, 15, int(0.5 * 255))
                _round_rect(c, cx2 - w / 2 + 1.2, cy2 - w / 2 + 1.8, w, w * 0.82, 3)
                c.fill()
                if hh2 > 0.66:
                    c.fillStyle = '#cbb274'
                elif hh2 > 0.33:
                    c.fillStyle = '#bda367'
                else:
                    c.fillStyle = '#a98f55'
                _round_rect(c, cx2 - w / 2, cy2 - w / 2, w, w * 0.82, 3)
                c.fill()
                c.fillStyle = (255, 242, 200, int((0.22 + hh2 * 0.2) * 255))
                _round_rect(c, cx2 - w / 2 + 1, cy2 - w / 2 + 1, w - 2, w * 0.3, 2.4)
                c.fill()
                if hh2 > 0.8:
                    c.strokeStyle = (70, 52, 26, int(0.55 * 255)); c.lineWidth = 0.9
                    c.beginPath(); c.moveTo(cx2 - 3, cy2 - 2); c.lineTo(cx2 + 3, cy2 + 2); c.stroke()
                if hh2 < 0.18:
                    c.fillStyle = (90, 140, 60, int(0.45 * 255))
                    c.beginPath(); c.arc(cx2 + w / 2, cy2 + w / 2, 1.6, 0, TWO_PI); c.fill()


def paintPathSand(c, cells, CELL):
    for key in cells:
        pc, pr = int(key.split(',')[0]), int(key.split(',')[1])
        x, y = pc * CELL, pr * CELL
        c.fillStyle = '#8a6e3c'
        c.fillRect(x, y, CELL, CELL)
        for rp in range(3):
            h3 = hash2(pc * 5 + rp, pr * 9 + rp)
            ry = y + 6 + rp * (CELL - 12) / 2 + (h3 - 0.5) * 4
            c.strokeStyle = (120, 92, 44, int(0.4 * 255)); c.lineWidth = 1.4
            c.beginPath(); c.moveTo(x + 3, ry)
            c.quadraticCurveTo(x + CELL * 0.5, ry - 2.5 - h3 * 2, x + CELL - 3, ry); c.stroke()
            c.strokeStyle = (225, 200, 135, int(0.35 * 255)); c.lineWidth = 1
            c.beginPath(); c.moveTo(x + 3, ry - 1.6)
            c.quadraticCurveTo(x + CELL * 0.5, ry - 4 - h3 * 2, x + CELL - 3, ry - 1.6); c.stroke()
        for s in range(4):
            h2 = hash2(pc * 7 + s, pr * 3 + s)
            c.fillStyle = (110, 84, 40, int(0.4 * 255))
            c.beginPath()
            c.ellipse(x + 4 + h2 * (CELL - 8), y + 4 + ((h2 * 31) % 1) * (CELL - 8),
                      1.6 + h2 * 1.6, 1.1, h2 * 3, 0, TWO_PI); c.fill()
        if hash2(pc, pr) > 0.5:
            c.fillStyle = (90, 66, 30, int(0.35 * 255))
            fpx = x + 8 + hash2(pc, pr + 1) * (CELL - 16)
            fpy = y + 8 + hash2(pc + 1, pr) * (CELL - 16)
            c.beginPath(); c.ellipse(fpx, fpy, 2.6, 1.5, 0.5, 0, TWO_PI); c.fill()
            c.beginPath(); c.ellipse(fpx + 5, fpy + 4, 2.6, 1.5, 0.5, 0, TWO_PI); c.fill()


def paintPathDirt(c, cells, CELL):
    for key in cells:
        pc, pr = int(key.split(',')[0]), int(key.split(',')[1])
        x, y = pc * CELL, pr * CELL
        c.fillStyle = '#5a4428'
        c.fillRect(x, y, CELL, CELL)
        horiz = cells.get(str(pc - 1) + ',' + str(pr)) or cells.get(str(pc + 1) + ',' + str(pr))
        vert = cells.get(str(pc) + ',' + str(pr - 1)) or cells.get(str(pc) + ',' + str(pr + 1))
        c.strokeStyle = (32, 22, 10, int(0.5 * 255))
        c.lineWidth = 2.6; c.lineCap = 'round'
        off = CELL * 0.2
        if horiz and not vert:
            c.beginPath(); c.moveTo(x, y + CELL / 2 - off); c.lineTo(x + CELL, y + CELL / 2 - off); c.stroke()
            c.beginPath(); c.moveTo(x, y + CELL / 2 + off); c.lineTo(x + CELL, y + CELL / 2 + off); c.stroke()
            c.strokeStyle = (120, 95, 55, int(0.35 * 255)); c.lineWidth = 1
            c.beginPath(); c.moveTo(x, y + CELL / 2 - off - 1.6); c.lineTo(x + CELL, y + CELL / 2 - off - 1.6); c.stroke()
            c.beginPath(); c.moveTo(x, y + CELL / 2 + off - 1.6); c.lineTo(x + CELL, y + CELL / 2 + off - 1.6); c.stroke()
        elif vert and not horiz:
            c.beginPath(); c.moveTo(x + CELL / 2 - off, y); c.lineTo(x + CELL / 2 - off, y + CELL); c.stroke()
            c.beginPath(); c.moveTo(x + CELL / 2 + off, y); c.lineTo(x + CELL / 2 + off, y + CELL); c.stroke()
            c.strokeStyle = (120, 95, 55, int(0.35 * 255)); c.lineWidth = 1
            c.beginPath(); c.moveTo(x + CELL / 2 - off - 1.6, y); c.lineTo(x + CELL / 2 - off - 1.6, y + CELL); c.stroke()
            c.beginPath(); c.moveTo(x + CELL / 2 + off - 1.6, y); c.lineTo(x + CELL / 2 + off - 1.6, y + CELL); c.stroke()
        else:
            c.fillStyle = (32, 22, 10, int(0.3 * 255))
            c.beginPath(); c.arc(x + CELL / 2, y + CELL / 2, CELL * 0.3, 0, TWO_PI); c.fill()
        for s in range(3):
            h2 = hash2(pc * 11 + s, pr * 5 + s)
            c.fillStyle = (28, 18, 8, int(0.35 * 255))
            c.beginPath()
            c.ellipse(x + 6 + h2 * (CELL - 12), y + 6 + ((h2 * 17) % 1) * (CELL - 12),
                      2.4, 1.3, h2 * 2, 0, TWO_PI); c.fill()
            c.fillStyle = (150, 125, 80, int(0.3 * 255))
            c.beginPath()
            c.arc(x + 5 + ((h2 * 41) % 1) * (CELL - 10),
                  y + 5 + ((h2 * 23) % 1) * (CELL - 10), 0.9, 0, TWO_PI); c.fill()
        hg2 = hash2(pc + 7, pr + 3)
        if hg2 > 0.55:
            c.strokeStyle = (90, 140, 55, int(0.5 * 255)); c.lineWidth = 1
            ex = x + 4 + hg2 * 20
            ey = y + (3 if hg2 > 0.78 else CELL - 3)
            dy2 = -4 if hg2 > 0.78 else 4
            c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 2, ey + dy2); c.stroke()
            c.beginPath(); c.moveTo(ex + 2, ey); c.lineTo(ex + 4, ey + dy2 * 0.85); c.stroke()


def paintPathIce(c, cells, CELL):
    for key in cells:
        pc, pr = int(key.split(',')[0]), int(key.split(',')[1])
        x, y = pc * CELL, pr * CELL
        c.fillStyle = '#7aa8cc'
        c.fillRect(x, y, CELL, CELL)
        c.fillStyle = (255, 255, 255, int(0.14 * 255))
        c.beginPath()
        c.moveTo(x + CELL * 0.15, y + CELL)
        c.lineTo(x + CELL * 0.55, y)
        c.lineTo(x + CELL * 0.8, y)
        c.lineTo(x + CELL * 0.4, y + CELL)
        c.closePath(); c.fill()
        nc = hash2(pc, pr)
        if nc > 0.35:
            gx = x + 6 + nc * (CELL - 12)
            gy = y + 6 + ((nc * 37) % 1) * (CELL - 12)
            c.strokeStyle = (235, 248, 255, int(0.6 * 255)); c.lineWidth = 1.1
            c.beginPath()
            c.moveTo(gx, gy); c.lineTo(gx + 6, gy + 3)
            c.lineTo(gx + 11, gy + 2); c.stroke()
            c.strokeStyle = (235, 248, 255, int(0.4 * 255)); c.lineWidth = 0.8
            c.beginPath(); c.moveTo(gx + 6, gy + 3); c.lineTo(gx + 8, gy + 8); c.stroke()
            c.strokeStyle = (50, 90, 130, int(0.3 * 255)); c.lineWidth = 1.6
            c.beginPath()
            c.moveTo(gx + 0.8, gy + 0.8)
            c.lineTo(gx + 6.8, gy + 3.8)
            c.lineTo(gx + 11.8, gy + 2.8); c.stroke()
        for s in range(2):
            h2 = hash2(pc * 13 + s, pr * 7 + s)
            c.fillStyle = (255, 255, 255, int((0.4 + h2 * 0.3) * 255))
            c.beginPath()
            c.ellipse(x + 6 + h2 * (CELL - 12),
                      y + (CELL - 4 if s else 4),
                      5 + h2 * 3, 2, 0, 0, TWO_PI); c.fill()


def paintPathVoid(c, cells, CELL):
    for key in cells:
        pc, pr = int(key.split(',')[0]), int(key.split(',')[1])
        x, y = pc * CELL, pr * CELL
        c.fillStyle = '#241634'
        c.fillRect(x, y, CELL, CELL)
        c.strokeStyle = (90, 50, 150, int(0.35 * 255)); c.lineWidth = 1.4
        _round_rect(c, x + 1.5, y + 1.5, CELL - 3, CELL - 3, 3); c.stroke()
        nv = hash2(pc, pr)
        if nv > 0.3:
            c.strokeStyle = (160, 90, 240, int(0.5 * 255)); c.lineWidth = 1.1
            c.beginPath()
            vx = x + (0 if nv > 0.65 else CELL)
            vy = y + ((nv * 53) % 1) * CELL
            c.moveTo(vx, vy)
            c.lineTo(x + CELL * 0.4, y + CELL * (0.3 + ((nv * 29) % 1) * 0.4))
            c.lineTo(x + CELL * 0.7, y + CELL * (0.25 + ((nv * 17) % 1) * 0.5))
            c.lineTo(x + (CELL if nv > 0.65 else 0), y + ((nv * 41) % 1) * CELL)
            c.stroke()
            c.strokeStyle = (220, 180, 255, int(0.35 * 255)); c.lineWidth = 0.6
            c.beginPath()
            c.moveTo(vx, vy)
            c.lineTo(x + CELL * 0.4, y + CELL * (0.3 + ((nv * 29) % 1) * 0.4))
            c.stroke()
        if nv < 0.22:
            c.fillStyle = '#0e0818'
            sx2 = x + 10 + nv * 80; sy2 = y + 10 + ((nv * 91) % 1) * 20
            c.beginPath()
            c.moveTo(sx2, sy2); c.lineTo(sx2 + 3, sy2 - 7); c.lineTo(sx2 + 5.4, sy2)
            c.closePath(); c.fill()
            c.fillStyle = (190, 140, 255, int(0.4 * 255))
            c.beginPath()
            c.moveTo(sx2 + 3, sy2 - 7); c.lineTo(sx2 + 3.8, sy2 - 3)
            c.lineTo(sx2 + 2.6, sy2 - 3); c.closePath(); c.fill()
        c.fillStyle = (160, 100, 255, int(0.35 * 255))
        c.beginPath(); c.arc(x + CELL * 0.5, y + CELL * 0.5, 1.6, 0, TWO_PI); c.fill()


PAINT_PATH = {
    'cobble': paintPathCobble,
    'sand': paintPathSand,
    'dirt': paintPathDirt,
    'ice': paintPathIce,
    'void': paintPathVoid,
}


# ============================================================
#  ELEMENTOS ESPECIALES POR TEMA (lagos, oasis, glaciares...)
# ============================================================

def featureLake(c, CELL):
    lx = CELL * 2.5; ly = CELL * 12.1
    lrx = CELL * 2.5; lry = CELL * 1.45
    c.fillStyle = '#a89f60'
    c.beginPath(); c.ellipse(lx, ly, lrx + 10, lry + 8, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#b8b06e'
    c.beginPath(); c.ellipse(lx, ly + 2, lrx + 5, lry + 4, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#5a9ad8'
    c.beginPath(); c.ellipse(lx, ly, lrx, lry, 0, 0, TWO_PI); c.fill()
    c.fillStyle = (20, 60, 110, int(0.5 * 255))
    c.beginPath(); c.ellipse(lx, ly + 2, lrx * 0.7, lry * 0.65, 0, 0, TWO_PI); c.fill()
    c.strokeStyle = (235, 248, 255, int(0.4 * 255)); c.lineWidth = 1.6
    c.beginPath(); c.ellipse(lx, ly, lrx - 1, lry - 1, 0, 0, TWO_PI); c.stroke()
    c.strokeStyle = (235, 248, 255, int(0.18 * 255)); c.lineWidth = 1
    c.beginPath(); c.ellipse(lx, ly, lrx - 4, lry - 3.5, 0, 0, TWO_PI); c.stroke()
    for sh in range(6):
        sa = sh * 1.05 + 0.3
        c.fillStyle = '#8a8468' if sh % 2 else '#7a7458'
        c.beginPath()
        c.ellipse(lx + math.cos(sa) * (lrx + 8), ly + math.sin(sa) * (lry + 6),
                  2.6, 1.8, sa, 0, TWO_PI); c.fill()
    c.strokeStyle = (255, 255, 255, int(0.25 * 255)); c.lineWidth = 1.2
    for wl in range(3):
        c.beginPath()
        c.ellipse(lx + (wl - 1) * 22, ly - 6 + wl * 8,
                  18 - wl * 3, 4, 0, 0, TWO_PI); c.stroke()
    c.fillStyle = (255, 255, 255, int(0.4 * 255))
    c.beginPath(); c.arc(lx - 30, ly - 8, 2, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(lx + 14, ly - 4, 1.5, 0, TWO_PI); c.fill()
    for lp in range(3):
        la = lp * 2.1 + 0.6
        c.fillStyle = '#3f9f4f'
        c.beginPath()
        c.ellipse(lx + math.cos(la) * lrx * 0.6, ly + math.sin(la) * lry * 0.6,
                  7, 4.5, la * 0.4, 0, TWO_PI); c.fill()
        c.fillStyle = '#5ac060'
        c.beginPath()
        c.arc(lx + math.cos(la) * lrx * 0.6, ly + math.sin(la) * lry * 0.6,
              1.5, 0, TWO_PI); c.fill()
    c.strokeStyle = '#2e7a3a'; c.lineWidth = 1.8; c.lineCap = 'round'
    for rd in range(5):
        rx2 = lx - lrx + 14 + rd * 24 + (hash2(rd, 7) - 0.5) * 12
        ry2 = ly - lry - 14 - hash2(rd, 3) * 8
        c.beginPath(); c.moveTo(rx2, ly - lry - 6)
        c.lineTo(rx2 + (4 if rd % 2 else -3), ry2); c.stroke()
        c.fillStyle = '#4a9a4a'
        c.beginPath()
        c.ellipse(rx2 + (4 if rd % 2 else -3), ry2, 2, 4,
                  0.4 if rd % 2 else -0.4, 0, TWO_PI); c.fill()
    c.strokeStyle = (90, 70, 40, int(0.45 * 255))
    c.lineWidth = 16; c.lineCap = 'round'
    c.beginPath()
    c.moveTo(886, -4); c.quadraticCurveTo(878, 36, 854, 62)
    c.quadraticCurveTo(840, 80, 822, 98); c.stroke()
    c.strokeStyle = '#6aa8e0'; c.lineWidth = 13
    c.beginPath()
    c.moveTo(884, -4); c.quadraticCurveTo(876, 34, 852, 60)
    c.quadraticCurveTo(838, 78, 820, 96); c.stroke()
    c.strokeStyle = (255, 255, 255, int(0.18 * 255)); c.lineWidth = 6
    c.beginPath()
    c.moveTo(884, -4); c.quadraticCurveTo(876, 34, 852, 60)
    c.quadraticCurveTo(838, 78, 820, 96); c.stroke()
    pdx, pdy = 818, 104
    c.fillStyle = (70, 50, 30, int(0.45 * 255))
    c.beginPath(); c.ellipse(pdx + 2, pdy + 2, 46, 18, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#6aa8e0'
    c.beginPath(); c.ellipse(pdx, pdy, 44, 16, 0, 0, TWO_PI); c.fill()
    c.fillStyle = (20, 60, 110, int(0.45 * 255))
    c.beginPath(); c.ellipse(pdx, pdy + 2, 30, 10, 0, 0, TWO_PI); c.fill()
    c.strokeStyle = (255, 255, 255, int(0.25 * 255)); c.lineWidth = 1.2
    c.beginPath(); c.ellipse(pdx, pdy - 3, 22, 6, 0, 0, TWO_PI); c.stroke()
    c.fillStyle = '#3f9f4f'
    c.beginPath(); c.ellipse(pdx - 18, pdy + 2, 6, 4, 0.5, 0, TWO_PI); c.fill()


def featureOasis(c, CELL):
    ox = CELL * 7.5; oy = CELL * 10.5
    orx = CELL * 1.6; ory = CELL * 1.0
    c.fillStyle = '#8a7440'
    c.beginPath(); c.ellipse(ox, oy, orx + 14, ory + 10, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#b0a060'
    c.beginPath(); c.ellipse(ox, oy + 2, orx + 7, ory + 5, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#4ac0d8'
    c.beginPath(); c.ellipse(ox, oy, orx, ory, 0, 0, TWO_PI); c.fill()
    c.fillStyle = (10, 60, 80, int(0.5 * 255))
    c.beginPath(); c.ellipse(ox, oy + 2, orx * 0.65, ory * 0.6, 0, 0, TWO_PI); c.fill()
    c.strokeStyle = (255, 255, 255, int(0.3 * 255)); c.lineWidth = 1.2
    for w in range(3):
        c.beginPath()
        c.ellipse(ox + (w - 1) * 12, oy - 3 + w * 5,
                  10 - w * 2, 3, 0, 0, TWO_PI); c.stroke()
    for p in range(2):
        px = ox + (18 if p else -18); py = oy - 6
        c.strokeStyle = '#5a8f3a'; c.lineWidth = 2.4; c.lineCap = 'round'
        c.beginPath(); c.moveTo(px, py)
        c.quadraticCurveTo(px + (4 if p else -4), py - 12,
                           px + (2 if p else -2), py - 20); c.stroke()
        c.fillStyle = '#3f7a2a'
        c.beginPath()
        c.ellipse(px + (3 if p else -3), py - 22, 6, 3,
                  0.5 if p else -0.5, 0, TWO_PI); c.fill()


def featureForestPool(c, CELL):
    fx = CELL * 22; fy = CELL * 3.2
    frx = CELL * 0.9; fry = CELL * 0.7
    c.fillStyle = (30, 20, 10, int(0.4 * 255))
    c.beginPath(); c.ellipse(fx + 2, fy + 2, frx + 8, fry + 6, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#3a8a5a'
    c.beginPath(); c.ellipse(fx, fy, frx, fry, 0, 0, TWO_PI); c.fill()
    c.fillStyle = (255, 255, 255, int(0.18 * 255))
    c.beginPath(); c.ellipse(fx - 8, fy - 3, 10, 3, 0, 0, TWO_PI); c.stroke()
    for m in range(2):
        sign = 10 if m else -10
        c.fillStyle = '#1e4a2e'
        c.beginPath(); c.arc(fx + sign, fy - 4, 3.4, 0, TWO_PI); c.fill()
        c.fillStyle = '#3a8a5a'
        c.beginPath(); c.arc(fx + sign * 0.94, fy - 5, 1.6, 0, TWO_PI); c.fill()


def featureGlacier(c, CELL):
    gx = CELL * 20.5; gy = CELL * 2.4
    c.fillStyle = (255, 255, 255, int(0.15 * 255))
    for i in range(3):
        c.beginPath(); c.arc(gx - 20 + i * 20, gy + 8, 26, 0, TWO_PI); c.fill()
    c.fillStyle = '#c8e4f4'
    c.beginPath(); c.arc(gx, gy, 22, 0, TWO_PI); c.fill()
    c.fillStyle = '#a8ccf0'
    c.beginPath(); c.arc(gx, gy, 22, 0, TWO_PI); c.fill()
    c.fillStyle = '#dff2ff'
    c.beginPath(); c.arc(gx, gy, 24, 0, TWO_PI); c.fill()
    c.strokeStyle = (255, 255, 255, int(0.6 * 255)); c.lineWidth = 1.5
    c.beginPath(); c.moveTo(gx - 10, gy - 4); c.lineTo(gx - 4, gy + 2); c.stroke()
    c.beginPath(); c.moveTo(gx + 6, gy - 6); c.lineTo(gx + 12, gy); c.stroke()
    c.beginPath(); c.moveTo(gx - 2, gy + 4); c.lineTo(gx + 4, gy + 10); c.stroke()
    c.fillStyle = '#6aa8d0'
    c.beginPath(); c.arc(gx - 12, gy + 4, 5, 0, TWO_PI); c.fill()
    c.beginPath(); c.arc(gx + 10, gy - 8, 4, 0, TWO_PI); c.fill()


def featureVoidPool(c, CELL):
    vx = CELL * 4; vy = CELL * 7
    vrx = CELL * 1.4; vry = CELL * 0.9
    c.fillStyle = (40, 10, 60, int(0.5 * 255))
    c.beginPath(); c.ellipse(vx + 2, vy + 2, vrx + 10, vry + 8, 0, 0, TWO_PI); c.fill()
    c.fillStyle = '#2a1040'
    c.beginPath(); c.ellipse(vx, vy, vrx, vry, 0, 0, TWO_PI); c.fill()
    c.strokeStyle = (150, 90, 230, int(0.5 * 255)); c.lineWidth = 1.5
    c.beginPath(); c.ellipse(vx, vy, vrx, vry, 0, 0, TWO_PI); c.stroke()
    c.strokeStyle = (200, 140, 255, int(0.3 * 255)); c.lineWidth = 1
    c.beginPath(); c.ellipse(vx, vy, vrx * 0.7, vry * 0.6, 0, 0, TWO_PI); c.stroke()
    for s in range(4):
        a = s * 1.57
        c.fillStyle = (180, 120, 255, int(0.5 * 255))
        c.beginPath()
        c.arc(vx + math.cos(a) * vrx * 0.5, vy + math.sin(a) * vry * 0.5,
              1.8, 0, TWO_PI); c.fill()


PAINT_FEATURE = {
    'plains': featureLake,
    'desert': featureOasis,
    'forest': featureForestPool,
    'frozen': featureGlacier,
    'void': featureVoidPool,
}


# ============================================================
#  CONVENIENCE ACCESSORS
# ============================================================

def getThemeBg(theme_name):
    return THEMES.get(theme_name, THEMES['plains'])

def getThemeDetail(theme_name):
    th = THEMES.get(theme_name, THEMES['plains'])
    return th.get('detail')

def getThemePaintDecor(theme_name):
    th = THEMES.get(theme_name, THEMES['plains'])
    return th.get('paintDecor')

def getThemePath(theme_name):
    th = THEMES.get(theme_name, THEMES['plains'])
    return PAINT_PATH.get(th.get('path', 'cobble'))

def getThemeFeature(theme_name):
    return PAINT_FEATURE.get(theme_name, featureLake)
