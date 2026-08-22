import traceback as _traceback
import os as _os
_LOG = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'crash.log')
def _crash_log(msg):
    with open(_LOG, 'a', encoding='utf-8') as _f:
        _f.write(msg + '\n')
try:
    import pygame
    import sys
    import math
    import time
    import os
    from config import CONFIG, TOWERS, TOWER_TYPES, ENEMIES, DIFFICULTY
    _crash_log('config OK')
    from game import Game
    _crash_log('game OK')
    from maps import MAPS, MAPS_BY_ID
    _crash_log('maps OK')
    from weather import WEATHER
    _crash_log('weather OK')
    from progress import progressLoad, progressGainXp, progressCompleteMap, progressReset, progressAddMaxWave, PROGRESS, ACHIEVEMENTS, isAchievementUnlocked, achievementCount
    _crash_log('progress OK')
    from relics import RELICS, CONQUEST
    _crash_log('relics OK')
    from director import DIRECTOR
    _crash_log('director OK')
    from waves import WAVE
    _crash_log('waves OK')
    from audio import AUDIO, play_sound
    _crash_log('audio OK')

    pygame.init()
    _crash_log('pygame.init OK')
except Exception as _e:
    _crash_log(f'IMPORT ERROR: {_e}')
    _crash_log(_traceback.format_exc())
    raise

W, H = CONFIG['WIDTH'], CONFIG['HEIGHT']
CELL = CONFIG['CELL']
COLS, ROWS = CONFIG['COLS'], CONFIG['ROWS']

screen = pygame.display.set_mode((W, H))
pygame.display.set_caption('VAELDRYN — Tower Defense')
clock = pygame.time.Clock()

try:
    FONT_SM = pygame.font.SysFont('Segoe UI', 13)
    FONT_MD = pygame.font.SysFont('Segoe UI', 16)
    FONT_LG = pygame.font.SysFont('Segoe UI', 22, bold=True)
    FONT_XL = pygame.font.SysFont('Segoe UI', 32, bold=True)
    FONT_TITLE = pygame.font.SysFont('Segoe UI', 48, bold=True)
except Exception:
    FONT_SM = pygame.font.Font(None, 18)
    FONT_MD = pygame.font.Font(None, 22)
    FONT_LG = pygame.font.Font(None, 28)
    FONT_XL = pygame.font.Font(None, 40)
    FONT_TITLE = pygame.font.Font(None, 56)

COL_BG = (30, 24, 18)
COL_PANEL = (40, 34, 28)
COL_BTN = (70, 58, 42)
COL_BTN_HOVER = (90, 74, 52)
COL_BTN_SEL = (60, 120, 80)
COL_BTN_DIS = (50, 44, 38)
COL_GOLD = (255, 214, 74)
COL_LIFE = (220, 60, 60)
COL_TEXT = (230, 220, 200)
COL_TEXT_DIM = (150, 140, 120)
COL_WHITE = (255, 255, 255)

game = None
state = 'menu'
selected_map = None
selected_difficulty = 0
toasts = []
last_ts = time.time()
conquest_relics = []

directorLevelName = ['Relajado', 'Agresivo', 'Pesadilla']
directorLevelCol = [(100,200,100), (220,160,50), (220,60,60)]

class Toast:
    def __init__(self, msg, dur=2500):
        self.msg = msg
        self.dur = dur
        self.age = 0
        self.alive = True
    def update(self, dt):
        self.age += dt * 1000
        if self.age > self.dur:
            self.alive = False
    def draw(self, surface, y):
        alpha = min(1.0, 1.0 - max(0, (self.age - self.dur + 300) / 300))
        if alpha <= 0:
            return
        txt = FONT_MD.render(self.msg, True, COL_WHITE)
        tw = txt.get_width()
        pad = 16
        bw = tw + pad * 2
        bh = 30
        bx = W // 2 - bw // 2
        bg = pygame.Surface((bw, bh), pygame.SRCALPHA)
        bg.fill((30, 24, 18, int(200 * alpha)))
        pygame.draw.rect(bg, (*COL_GOLD[:3], int(60 * alpha)), (0, 0, bw, bh), 1, border_radius=4)
        glow = pygame.Surface((bw, bh), pygame.SRCALPHA)
        for gy in range(bh):
            a = int(4 * (1.0 - gy / bh) * alpha)
            pygame.draw.line(glow, (255, 214, 74, a), (0, gy), (bw, gy))
        bg.blit(glow, (0, 0))
        surface.blit(bg, (bx, y))
        txt.set_alpha(int(255 * alpha))
        surface.blit(txt, (W // 2 - tw // 2, y + 5))

def toast(msg, dur=2500):
    toasts.append(Toast(msg, dur))

def draw_text(surface, text, x, y, font=None, color=COL_TEXT, center=False, right=False):
    if font is None:
        font = FONT_SM
    txt = font.render(str(text), True, color)
    if center:
        surface.blit(txt, (x - txt.get_width()//2, y))
    elif right:
        surface.blit(txt, (x - txt.get_width(), y))
    else:
        surface.blit(txt, (x, y))

def draw_rounded_rect(surface, color, rect, radius=6):
    r = pygame.Rect(rect)
    pygame.draw.rect(surface, color, r, border_radius=radius)

def draw_button(surface, x, y, w, h, text, color=COL_BTN, text_color=COL_TEXT, enabled=True, hover=False, selected=False, font=None):
    if font is None:
        font = FONT_SM
    if not enabled:
        c = COL_BTN_DIS
    elif selected:
        c = COL_BTN_SEL
    elif hover:
        c = COL_BTN_HOVER
    else:
        c = color
    draw_rounded_rect(surface, c, (x, y, w, h), 5)
    hi = shade_tuple(c, 25)
    lo = shade_tuple(c, -18)
    s2 = pygame.Surface((w, 4), pygame.SRCALPHA)
    pygame.draw.rect(s2, hi + (60,), (0, 0, w, 2), border_radius=2)
    surface.blit(s2, (x, y + 1))
    s3 = pygame.Surface((w, 4), pygame.SRCALPHA)
    pygame.draw.rect(s3, lo + (40,), (0, 0, w, 2), border_radius=2)
    surface.blit(s3, (x, y + h - 3))
    pygame.draw.rect(surface, shade_tuple(c, 15), (x, y, w, h), 1, border_radius=5)
    txt = font.render(text, True, text_color if enabled else COL_TEXT_DIM)
    tx = x + w//2 - txt.get_width()//2
    ty = y + h//2 - txt.get_height()//2
    if enabled:
        shd = font.render(text, True, (0, 0, 0))
        surface.blit(shd, (tx + 1, ty + 1))
    surface.blit(txt, (tx, ty))
    return pygame.Rect(x, y, w, h)

def shade_tuple(c, amt):
    return tuple(max(0, min(255, v + amt)) for v in c[:3])

class ShopButton:
    def __init__(self, type_name, idx):
        self.type = type_name
        self.def_ = TOWERS[type_name]
        self.idx = idx

def build_shop_buttons():
    btns = []
    for i, t in enumerate(TOWER_TYPES):
        btns.append(ShopButton(t, i))
    return btns

shop_buttons = []
btn_wave = pygame.Rect(10, H - 55, 160, 30)
btn_speed = pygame.Rect(180, H - 55, 60, 30)
btn_pause = pygame.Rect(250, H - 55, 80, 30)
btn_auto = pygame.Rect(340, H - 55, 80, 30)
btn_upgrade = pygame.Rect(W - 200, H - 180, 190, 28)
btn_sell = pygame.Rect(W - 200, H - 150, 190, 28)
btn_ability = pygame.Rect(W - 200, H - 120, 190, 28)
btn_audio_toggle = pygame.Rect(W - 42, 4, 38, 22)
btn_repair = pygame.Rect(W - 200, H - 90, 190, 28)
btn_restart = pygame.Rect(W//2 - 70, H//2 + 30, 140, 32)

def _draw_ornament(surface, x, y, w, color, alpha=80):
    """Draw a horizontal medieval ornament line with diamond center and end caps."""
    col = (*color[:3], alpha)
    col_hi = (*color[:3], min(255, alpha + 30))
    s = pygame.Surface((w, 8), pygame.SRCALPHA)
    mid = w // 2
    pygame.draw.line(s, col, (4, 4), (mid - 16, 4), 1)
    pygame.draw.line(s, col, (mid + 16, 4), (w - 4, 4), 1)
    pygame.draw.line(s, col_hi, (4, 3), (mid - 16, 3), 1)
    pygame.draw.line(s, col_hi, (mid + 16, 3), (w - 4, 3), 1)
    pts = [(mid, 0), (mid + 7, 4), (mid, 8), (mid - 7, 4)]
    pygame.draw.polygon(s, col, pts)
    pygame.draw.polygon(s, col_hi, [(mid, 1), (mid + 5, 4), (mid, 7), (mid - 5, 4)], 1)
    for ex in [8, w - 10]:
        pygame.draw.circle(s, col, (ex, 4), 2)
        pygame.draw.circle(s, col_hi, (ex, 3), 1)
    surface.blit(s, (x, y))

def _draw_border(surface, rect, color, alpha=60, r=6):
    """Draw a decorative triple border with corner jewels."""
    x, y, w, h = rect
    c = (*color[:3], alpha)
    c_hi = (*color[:3], min(255, alpha + 25))
    c_lo = (0, 0, 0, min(255, alpha // 2))
    pygame.draw.rect(surface, c_lo, (x - 3, y - 3, w + 6, h + 6), 1, border_radius=r + 3)
    pygame.draw.rect(surface, c, (x - 1, y - 1, w + 2, h + 2), 1, border_radius=r + 1)
    pygame.draw.rect(surface, c_hi, (x, y, w, h), 1, border_radius=r)
    for cx, cy in [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]:
        pygame.draw.circle(surface, c_lo, (int(cx), int(cy)), 4)
        pygame.draw.circle(surface, c, (int(cx), int(cy)), 3)
        pygame.draw.circle(surface, c_hi, (int(cx - 1), int(cy - 1)), 1)

def _draw_panel(surface, rect, border_color=COL_GOLD, r=8, bg=(25, 20, 14), border_alpha=60, fill_alpha=220):
    x, y, w, h = rect
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    s.fill((*bg, fill_alpha))
    surface.blit(s, (x, y))
    grad = pygame.Surface((w, h), pygame.SRCALPHA)
    for gy in range(min(h, 40)):
        a = max(0, int(12 * (1.0 - gy / 40)))
        pygame.draw.line(grad, (255, 255, 255, a), (0, gy), (w, gy))
    surface.blit(grad, (x, y))
    grad2 = pygame.Surface((w, h), pygame.SRCALPHA)
    for gy in range(min(h, 20)):
        a = max(0, int(15 * (1.0 - (h - gy) / 20)))
        pygame.draw.line(grad2, (0, 0, 0, a), (0, h - 1 - gy), (w, h - 1 - gy))
    surface.blit(grad2, (x, y))
    _draw_border(surface, rect, border_color, alpha=border_alpha, r=r)

def _draw_bar(surface, x, y, w, h, pct, fg, bg=(40, 35, 28), border_col=None, radius=3):
    pct = max(0.0, min(1.0, pct))
    pygame.draw.rect(surface, bg, (x, y, w, h), border_radius=radius)
    if pct > 0:
        fw = max(2, int(w * pct))
        s = pygame.Surface((fw, h), pygame.SRCALPHA)
        for gy in range(h):
            a = int(60 * (1.0 - gy / h))
            pygame.draw.line(s, (*fg[:3], min(255, fg[3] if len(fg) > 3 else 255)), (0, gy), (fw, gy))
        pygame.draw.rect(s, fg, (0, 0, fw, h), border_radius=radius)
        hi = shade_tuple(fg, 40)
        pygame.draw.line(s, hi, (1, 1), (fw - 1, 1))
        surface.blit(s, (x, y))
    bc = border_col or shade_tuple(bg, -20)
    pygame.draw.rect(surface, bc, (x, y, w, h), 1, border_radius=radius)

def _draw_element_badge(surface, x, y, element):
    el_colors = {
        'physical': (180, 170, 150), 'fire': (255, 100, 40), 'ice': (100, 180, 230),
        'earth': (180, 160, 80), 'nature': (60, 180, 60), 'holy': (240, 210, 80),
        'lightning': (80, 160, 255), 'void': (170, 90, 240),
    }
    el_icons = {
        'physical': '\u2694', 'fire': '\u2605', 'ice': '\u2744',
        'earth': '\u2302', 'nature': '\u2618', 'holy': '\u2720',
        'lightning': '\u26A1', 'void': '\u2609',
    }
    col = el_colors.get(element, COL_TEXT)
    icon = el_icons.get(element, '\u25CF')
    bg = pygame.Surface((18, 18), pygame.SRCALPHA)
    pygame.draw.rect(bg, (*col, 60), (0, 0, 18, 18), border_radius=3)
    pygame.draw.rect(bg, (*col, 140), (0, 0, 18, 18), 1, border_radius=3)
    surface.blit(bg, (x, y))
    draw_text(surface, icon, x + 9, y + 1, FONT_SM, col, center=True)

def _draw_tower_icon(surface, x, y, tower_type, size=28):
    """Draw a small iconic representation of a tower with gradient and depth."""
    s = pygame.Surface((size, size), pygame.SRCALPHA)
    cx, cy = size // 2, size // 2
    colors = {
        'archer': ('#8a7a5a', '#6a5a3a', '#a09070'),
        'fire': ('#d04020', '#901808', '#ff6040'),
        'ice': ('#80c0e0', '#4090b8', '#b0e0ff'),
        'crossbow': ('#7a6a4a', '#5a4a2a', '#9a8a6a'),
        'venom': ('#4a8a2a', '#2a6a0a', '#70c050'),
        'dwarf': ('#c0a060', '#907030', '#e0c880'),
        'druid': ('#2a8a4a', '#0a6a2a', '#50b870'),
        'tesla': ('#4080d0', '#2060b0', '#70b0ff'),
        'knight': ('#a0a0b0', '#607080', '#c0c0d0'),
        'sniper': ('#5a5a6a', '#3a3a4a', '#7a7a8a'),
        'holy': ('#f0d870', '#c0a840', '#fff0a0'),
        'banner': ('#d0a040', '#a07020', '#f0c060'),
        'warlock': ('#6a2a8a', '#4a1a6a', '#9a50c0'),
        'barracks': ('#6a5a3a', '#4a3a1a', '#8a7a5a'),
    }
    col, dark, light = colors.get(tower_type, ('#888', '#555', '#aaa'))
    base = pygame.Surface((size, size), pygame.SRCALPHA)
    bh = int(size * 0.35)
    pygame.draw.rect(base, dark, (cx - 4, cy + 1, 8, bh), border_radius=2)
    pygame.draw.rect(base, col, (cx - 3, cy + 1, 6, bh - 1), border_radius=1)
    bw = int(size * 0.55)
    body_rect = (cx - bw // 2, cy - int(size * 0.35), bw, int(size * 0.4))
    pygame.draw.rect(base, dark, body_rect, border_radius=3)
    inner = (cx - bw // 2 + 1, cy - int(size * 0.35) + 1, bw - 2, int(size * 0.38))
    pygame.draw.rect(base, col, inner, border_radius=2)
    highlight = pygame.Surface((bw - 2, int(size * 0.18)), pygame.SRCALPHA)
    lr, lg, lb = int(light[1:3], 16), int(light[3:5], 16), int(light[5:7], 16)
    pygame.draw.rect(highlight, (lr, lg, lb, 50), (0, 0, bw - 2, int(size * 0.18)), border_radius=2)
    base.blit(highlight, (cx - bw // 2 + 1, cy - int(size * 0.35) + 1))
    tp = int(size * 0.18)
    pygame.draw.polygon(base, dark, [
        (cx - bw // 2 - 2, cy - int(size * 0.35)),
        (cx, cy - int(size * 0.35) - tp),
        (cx + bw // 2 + 2, cy - int(size * 0.35)),
    ])
    pygame.draw.polygon(base, col, [
        (cx - bw // 2, cy - int(size * 0.35)),
        (cx, cy - int(size * 0.35) - tp + 1),
        (cx + bw // 2, cy - int(size * 0.35)),
    ])
    eg = pygame.Surface((size, size), pygame.SRCALPHA)
    pygame.draw.circle(eg, (255, 255, 255, 80), (cx, cy - int(size * 0.2)), 3)
    pygame.draw.circle(eg, (255, 255, 255, 160), (cx, cy - int(size * 0.2)), 1.5)
    base.blit(eg, (0, 0))
    s.blit(base, (0, 0))
    surface.blit(s, (x, y))

def draw_menu(surface):
    surface.fill(COL_BG)

    for y in range(0, H, 4):
        v = int(3 + 2 * ((y * 0.03) % 1))
        pygame.draw.line(surface, (50, 40, 30, v), (0, y), (W, y))

    for bx in range(0, W, 80):
        for by in range(0, H, 80):
            h1 = (bx * 137 + by * 241) % 1000
            if h1 < 8:
                c = 35 + (h1 % 5)
                pygame.draw.circle(surface, (c, c - 5, c - 10), (bx, by), 1)

    vig = pygame.Surface((W, H), pygame.SRCALPHA)
    for i in range(60):
        a = int(120 * (1.0 - i / 60))
        pygame.draw.rect(vig, (0, 0, 0, a), (i, i, W - i * 2, H - i * 2), 1, border_radius=max(0, 8 - i // 10))
    surface.blit(vig, (0, 0))

    _draw_border(surface, (10, 10, W - 20, H - 20), COL_GOLD, alpha=35, r=8)
    _draw_border(surface, (14, 14, W - 28, H - 28), COL_GOLD, alpha=18, r=6)

    _draw_ornament(surface, W // 2 - 160, 18, 320, COL_GOLD, alpha=60)

    title_s = FONT_TITLE.render('VAELDRYN', True, COL_GOLD)
    tw = title_s.get_width()
    for dx, dy in [(-2, 2), (2, 2), (0, 3), (-1, -1)]:
        shd = FONT_TITLE.render('VAELDRYN', True, (20, 15, 8))
        surface.blit(shd, (W // 2 - tw // 2 + dx, 26 + dy))
    glow = pygame.Surface((tw + 20, 50), pygame.SRCALPHA)
    pygame.draw.ellipse(glow, (255, 214, 74, 12), (0, 0, tw + 20, 50))
    surface.blit(glow, (W // 2 - tw // 2 - 10, 20))
    surface.blit(title_s, (W // 2 - tw // 2, 26))

    sub = FONT_SM.render('Tower Defense', True, COL_TEXT_DIM)
    surface.blit(sub, (W // 2 - sub.get_width() // 2, 62))

    _draw_ornament(surface, W // 2 - 160, 78, 320, COL_GOLD, alpha=60)

    p = PROGRESS
    stats_x = 30
    stats_y = 92
    _draw_panel(surface, (stats_x, stats_y, 200, 74), COL_GOLD, border_alpha=30, fill_alpha=180)

    draw_text(surface, f'\u2606 Nivel {p.get("level", 0)}', stats_x + 10, stats_y + 6, FONT_MD, COL_GOLD)
    xp = p.get('xp', 0)
    lvl = p.get('level', 0)
    from progress import _XP_TABLE
    next_xp = _XP_TABLE[min(lvl + 1, len(_XP_TABLE) - 1)] if lvl < len(_XP_TABLE) - 1 else xp
    cur_xp = _XP_TABLE[lvl] if lvl < len(_XP_TABLE) else 0
    pct = min(1.0, (xp - cur_xp) / max(1, next_xp - cur_xp)) if next_xp > cur_xp else 1.0
    bar_w = 170
    _draw_bar(surface, stats_x + 15, stats_y + 28, bar_w, 8, pct, COL_GOLD)
    draw_text(surface, f'{xp}/{next_xp}', stats_x + 15 + bar_w + 4, stats_y + 25, FONT_SM, COL_TEXT_DIM)

    draw_text(surface, f'Max Oleada: {p.get("maxWaveBeaten", 0)}', stats_x + 10, stats_y + 42, FONT_SM, COL_TEXT_DIM)
    towers_unlocked = sum(1 for v in p.get('towers', {}).values() if v)
    draw_text(surface, f'Torres: {towers_unlocked}/{len(TOWER_TYPES)}', stats_x + 10, stats_y + 56, FONT_SM, COL_TEXT_DIM)

    diff_y = stats_y + 80
    diff_label_x = stats_x + 10
    draw_text(surface, 'Dificultad:', diff_label_x, diff_y, FONT_SM, COL_TEXT)
    diff_btns = []
    diff_colors = {0: (100, 180, 100), 1: (80, 160, 220), 2: (220, 140, 50), 3: (200, 60, 60)}
    for di in range(4):
        dname = DIFFICULTY.get(di, {}).get('name', '?')
        bx = diff_label_x + 80 + di * 78
        by = diff_y - 2
        bw = 72
        bh = 20
        rect = pygame.Rect(bx, by, bw, bh)
        diff_btns.append((rect, di))
        if di == selected_difficulty:
            pygame.draw.rect(surface, diff_colors.get(di, COL_GOLD), rect, border_radius=4)
            draw_text(surface, dname, bx + bw // 2, by + 3, FONT_SM, COL_BG, center=True)
        else:
            pygame.draw.rect(surface, (50, 45, 35), rect, border_radius=4)
            pygame.draw.rect(surface, diff_colors.get(di, COL_TEXT_DIM), rect, 1, border_radius=4)
            draw_text(surface, dname, bx + bw // 2, by + 3, FONT_SM, COL_TEXT_DIM, center=True)

    diff_info_y = diff_y + 22
    dd = DIFFICULTY.get(selected_difficulty, DIFFICULTY[0])
    info_parts = []
    if dd.get('hpMult', 1) != 1:
        info_parts.append(f'HP x{dd["hpMult"]}')
    if dd.get('goldMult', 1) != 1:
        info_parts.append(f'Oro x{dd["goldMult"]}')
    if dd.get('livesMod', 0) > 0:
        info_parts.append(f'+{dd["livesMod"]} vida')
    elif dd.get('livesMod', 0) < 0:
        info_parts.append(f'{dd["livesMod"]} vida')
    if dd.get('eliteChance', 0) > 0:
        info_parts.append(f'{int(dd["eliteChance"]*100)}% elites')
    if dd.get('speedMult', 1) > 1:
        info_parts.append(f'Enemigos x{dd["speedMult"]}')
    elif dd.get('speedMult', 1) < 1:
        info_parts.append(f'Enemigos x{dd["speedMult"]}')
    if info_parts:
        draw_text(surface, ' | '.join(info_parts), diff_label_x + 80, diff_info_y, FONT_SM, COL_TEXT_DIM)

    grid_x = 30
    grid_y = diff_info_y + 24
    card_w = 170
    card_h = 165
    gap = 14
    map_colors = {'plains': (100, 180, 80), 'desert': (200, 160, 60), 'forest': (40, 140, 40), 'frozen': (80, 160, 220), 'void': (140, 80, 200)}
    map_terrain_cols = {'plains': (80, 140, 60), 'desert': (180, 140, 50), 'forest': (30, 100, 30), 'frozen': (60, 120, 180), 'void': (80, 50, 120)}

    for i, m in enumerate(MAPS):
        mx = grid_x + i * (card_w + gap)
        my = grid_y
        mid = m['id']
        unlocked = mid in p.get('unlocked', ['plains'])
        hover = pygame.Rect(mx, my, card_w, card_h).collidepoint(pygame.mouse.get_pos())

        _draw_panel(surface, (mx, my, card_w, card_h),
                    COL_GOLD if (unlocked and hover) else (COL_TEXT_DIM if unlocked else (60, 50, 40)),
                    r=6, border_alpha=50 if unlocked else 25, fill_alpha=200 if unlocked else 140)

        tc = map_terrain_cols.get(mid, (60, 50, 40))
        terrain_s = pygame.Surface((card_w, 30), pygame.SRCALPHA)
        for ty in range(30):
            v = 0.4 + 0.6 * (ty / 30)
            c = tuple(int(v * c) for c in tc)
            pygame.draw.line(terrain_s, (*c, 200), (0, ty), (card_w, ty))
        pygame.draw.rect(terrain_s, (0, 0, 0, 40), (0, 0, card_w, 30))
        surface.blit(terrain_s, (mx, my + 4))

        mc = map_colors.get(mid, COL_TEXT)
        draw_text(surface, m.get('name', mid), mx + card_w // 2, my + 8, FONT_MD, mc if unlocked else COL_TEXT_DIM, center=True)

        _draw_ornament(surface, mx + 15, my + 32, card_w - 30, COL_TEXT_DIM if unlocked else (60, 50, 40), alpha=40)

        desc = m.get('desc', '')
        lines = []
        words = desc.split()
        line = ''
        for w in words:
            test = line + ' ' + w if line else w
            if FONT_SM.size(test)[0] < card_w - 20:
                line = test
            else:
                lines.append(line)
                line = w
        if line:
            lines.append(line)
        for li, ln in enumerate(lines[:3]):
            draw_text(surface, ln, mx + 10, my + 42 + li * 14, FONT_SM, COL_TEXT_DIM if unlocked else (80, 70, 60))

        diff = m.get('difficulty', 1)
        stars_x = mx + card_w // 2 - 24
        for si in range(3):
            col = COL_GOLD if si < diff else (50, 45, 35)
            draw_text(surface, '\u2605', stars_x + si * 16, my + 100, FONT_SM, col)

        diff_names = {1: 'Normal', 2: 'Dificil', 3: 'Extremo'}
        draw_text(surface, diff_names.get(diff, ''), mx + card_w // 2, my + 118, FONT_SM, mc if unlocked else (80, 70, 60), center=True)

        if unlocked:
            btn_rect = pygame.Rect(mx + 20, my + card_h - 32, card_w - 40, 24)
            if hover:
                pygame.draw.rect(surface, COL_GOLD, btn_rect, border_radius=4)
                draw_text(surface, 'Iniciar', mx + card_w // 2, my + card_h - 28, FONT_SM, COL_BG, center=True)
            else:
                pygame.draw.rect(surface, (60, 50, 38), btn_rect, border_radius=4)
                pygame.draw.rect(surface, COL_GOLD, btn_rect, 1, border_radius=4)
                draw_text(surface, 'Iniciar', mx + card_w // 2, my + card_h - 28, FONT_SM, COL_GOLD, center=True)
        else:
            draw_text(surface, '\U0001f512', mx + card_w // 2, my + card_h - 38, FONT_LG, (120, 50, 50), center=True)
            draw_text(surface, 'BLOQUEADO', mx + card_w // 2, my + card_h - 14, FONT_SM, COL_LIFE, center=True)

    btn_conquest = None
    conquest_y = grid_y + card_h + 16
    if p.get('conquestUnlocked'):
        _draw_ornament(surface, W // 2 - 160, conquest_y, 320, COL_GOLD, alpha=45)
        btn_conquest = draw_button(surface, W // 2 - 110, conquest_y + 10, 220, 34, '\u2694  Modo Conquista  \u2694', COL_GOLD)
        draw_text(surface, 'Reliquias y desafios', W // 2, conquest_y + 50, FONT_SM, COL_TEXT_DIM, center=True)

    btn_r = draw_button(surface, W // 2 - 80, H - 52, 160, 28, 'Borrar Progreso', COL_LIFE)
    ach_count = achievementCount()
    btn_ach = draw_button(surface, W // 2 - 110, H - 52, 120, 28, f'\U0001f3c6 Logros {ach_count}/{len(ACHIEVEMENTS)}', COL_GOLD)
    return btn_r, btn_conquest, diff_btns, btn_ach

def draw_hud(surface, g):
    hud_h = 28
    bar = pygame.Surface((W, hud_h), pygame.SRCALPHA)
    bar.fill((18, 14, 10, 210))
    surface.blit(bar, (0, 0))

    grad_h = pygame.Surface((W, hud_h), pygame.SRCALPHA)
    for gy in range(hud_h):
        a = int(8 * (1.0 - gy / hud_h))
        pygame.draw.line(grad_h, (255, 214, 74, a), (0, gy), (W, gy))
    surface.blit(grad_h, (0, 0))

    pygame.draw.rect(surface, (80, 65, 40, 140), (0, hud_h - 1, W, 1))
    pygame.draw.rect(surface, (50, 40, 28, 100), (0, 0, W, 1))

    x = 12
    draw_text(surface, '\u2699', x, 4, FONT_MD, COL_GOLD)
    draw_text(surface, str(g.gold), x + 16, 5, FONT_MD, COL_GOLD)
    x += 80

    lives_pct = g.lives / g.map['startLives']
    lives_col = (220, 60, 60) if lives_pct <= 0.3 else (220, 160, 60) if lives_pct <= 0.6 else COL_GOLD
    draw_text(surface, '\u2665', x, 4, FONT_MD, lives_col)
    draw_text(surface, f'{g.lives}', x + 16, 5, FONT_MD, lives_col)
    draw_text(surface, f'/{g.map["startLives"]}', x + 38, 5, FONT_SM, COL_TEXT_DIM)
    x += 80

    draw_text(surface, '\u25C9', x, 4, FONT_MD, COL_TEXT)
    draw_text(surface, f'Oleada {g.wave}', x + 16, 5, FONT_MD, COL_TEXT)
    x += 100

    level = PROGRESS.get('level', 0)
    draw_text(surface, f'Nv.{level}', x, 5, FONT_SM, COL_TEXT_DIM)
    x += 50

    weather_name = 'Despejado'
    weather_icon = '\u2600'
    if WEATHER.current != 'clear' and hasattr(WEATHER, 'type'):
        weather_name = WEATHER.type.get('name', 'Despejado')
        weather_icon = WEATHER.type.get('icon', '\u2600')
    draw_text(surface, f'{weather_icon} {weather_name}', x, 5, FONT_SM, COL_TEXT_DIM)

    cor_pct = min(100, int(g.corruptTotal / 300 * 100)) if hasattr(g, 'corruptTotal') else 0
    if cor_pct > 0:
        cor_col = COL_LIFE if cor_pct > 60 else COL_GOLD
        draw_text(surface, f'Corrup: {cor_pct}%', 490, 5, FONT_SM, cor_col)

    if g.waveState == 'idle':
        btn_text = f'\u25B6 Oleada {g.wave + 1}'
        enabled = True
    else:
        btn_text = '\u25C9 Oleada en curso...'
        enabled = False
    draw_button(surface, btn_wave.x, btn_wave.y, btn_wave.w, btn_wave.h, btn_text, enabled=enabled, font=FONT_SM)

    draw_button(surface, btn_speed.x, btn_speed.y, btn_speed.w, btn_speed.h, f'{g.speed}x', font=FONT_SM)
    draw_button(surface, btn_pause.x, btn_pause.y, btn_pause.w, btn_pause.h, 'Pausa' if not g.paused else 'Reanudar', font=FONT_SM)
    auto_text = 'Auto' if not g.autoWave else f'Auto {int(g.autoTimer)+1}s'
    draw_button(surface, btn_auto.x, btn_auto.y, btn_auto.w, btn_auto.h, auto_text, selected=g.autoWave, font=FONT_SM)

    audio_icon = '\u266b' if AUDIO.enabled else '\u2716'
    audio_col = COL_GOLD if AUDIO.enabled else COL_LIFE
    draw_button(surface, btn_audio_toggle.x, btn_audio_toggle.y, btn_audio_toggle.w, btn_audio_toggle.h,
                audio_icon, color=COL_PANEL, text_color=audio_col, font=FONT_SM)

def draw_shop(surface, g, mouse_pos):
    shop_x = 10
    shop_y = 30
    btn_w = 58
    btn_h = 58
    cols = min(13, len(TOWER_TYPES))

    el_colors = {
        'physical': (180, 170, 150), 'fire': (255, 100, 40), 'ice': (100, 180, 230),
        'earth': (180, 160, 80), 'nature': (60, 180, 60), 'holy': (240, 210, 80),
        'lightning': (80, 160, 255), 'void': (170, 90, 240),
    }

    for i, sb in enumerate(shop_buttons):
        col = i % cols
        row = i // cols
        bx = shop_x + col * (btn_w + 4)
        by = shop_y + row * (btn_h + 4)
        cost = int(sb.def_['cost'] * g.upCostMult)
        unlock_wave = sb.def_.get('unlock', {}).get('wave', 0) if sb.def_.get('unlock') else 0
        locked = unlock_wave > 0 and g.wave < unlock_wave
        can_buy = g.gold >= cost and not locked
        selected = g.placing == sb.type
        hover = pygame.Rect(bx, by, btn_w, btn_h).collidepoint(mouse_pos)

        base_c = COL_BTN_DIS if not can_buy else COL_BTN_SEL if selected else COL_BTN_HOVER if hover else COL_BTN
        draw_rounded_rect(surface, base_c, (bx, by, btn_w, btn_h), 4)

        el = sb.def_.get('element', 'physical')
        el_col = el_colors.get(el, COL_TEXT_DIM)
        top_bar = pygame.Surface((btn_w, 3), pygame.SRCALPHA)
        pygame.draw.rect(top_bar, (*el_col, 180), (0, 0, btn_w, 3), border_radius=2)
        surface.blit(top_bar, (bx, by + 1))

        _draw_tower_icon(surface, bx + btn_w // 2 - 14, by + 5, sb.type, size=28)
        draw_text(surface, sb.def_['name'][:7], bx + btn_w // 2, by + 34, FONT_SM, COL_TEXT, center=True)
        draw_text(surface, str(cost), bx + btn_w // 2, by + 47, FONT_SM, COL_GOLD, center=True)

        if locked:
            lock_s = pygame.Surface((btn_w, btn_h), pygame.SRCALPHA)
            lock_s.fill((0, 0, 0, 120))
            surface.blit(lock_s, (bx, by))
            draw_text(surface, '\U0001f512', bx + btn_w // 2, by + 12, FONT_SM, COL_LIFE, center=True)

    return [(shop_x + (i % cols) * (btn_w + 4), shop_y + (i // cols) * (btn_h + 4), btn_w, btn_h, sb.type) for i, sb in enumerate(shop_buttons)]

def draw_tower_panel(surface, g):
    if not g.selected:
        return
    t = g.selected
    px = W - 210
    py = 30
    pw = 200
    ph = 270

    _draw_panel(surface, (px, py, pw, ph), COL_GOLD, border_alpha=45, fill_alpha=220)

    el_colors = {'physical': (180, 170, 150), 'fire': (255, 100, 40), 'ice': (100, 180, 230),
                 'earth': (180, 160, 80), 'nature': (60, 180, 60), 'holy': (240, 210, 80),
                 'lightning': (80, 160, 255), 'void': (170, 90, 240)}
    el_names = {'physical':'Fisico','fire':'Fuego','ice':'Hielo','earth':'Tierra',
                'nature':'Naturaleza','holy':'Sagrado','lightning':'Rayo','void':'Vacio'}
    el_col = el_colors.get(t.element, COL_TEXT)

    header_s = pygame.Surface((pw, 28), pygame.SRCALPHA)
    for gy in range(28):
        a = int(40 + 20 * (1.0 - gy / 28))
        pygame.draw.line(header_s, (*el_col, a), (0, gy), (pw, gy))
    pygame.draw.rect(header_s, (*el_col, 100), (0, 0, pw, 1))
    surface.blit(header_s, (px, py))

    _draw_tower_icon(surface, px + 8, py + 3, t.type, size=22)
    draw_text(surface, t.name, px + 34, py + 5, FONT_MD, COL_GOLD)
    draw_text(surface, f'Nv.{t.level + 1}', px + pw - 10, py + 6, FONT_SM, COL_TEXT_DIM, right=True)

    _draw_element_badge(surface, px + 10, py + 32, t.element)
    draw_text(surface, el_names.get(t.element, t.element), px + 32, py + 33, FONT_SM, el_col)

    stat_y = py + 56
    stat_x1 = px + 10
    stat_x2 = px + pw // 2 + 5

    draw_text(surface, 'Dano:', stat_x1, stat_y, FONT_SM, COL_TEXT_DIM)
    dmg_str = str(t.damage) if t.type != 'druid' else '\u2014'
    draw_text(surface, dmg_str, stat_x2, stat_y, FONT_SM, COL_TEXT)

    draw_text(surface, 'Rango:', stat_x1, stat_y + 16, FONT_SM, COL_TEXT_DIM)
    draw_text(surface, str(int(t.range)), stat_x2, stat_y + 16, FONT_SM, COL_TEXT)

    rate_str = f'{1.0/t.rate:.1f}/s' if t.rate and t.type != 'druid' else '\u2014'
    draw_text(surface, 'Ritmo:', stat_x1, stat_y + 32, FONT_SM, COL_TEXT_DIM)
    draw_text(surface, rate_str, stat_x2, stat_y + 32, FONT_SM, COL_TEXT)

    hp_pct = (t.hp / t.hpMax) if t.hpMax > 0 else 0
    hp_col = COL_LIFE if hp_pct < 0.3 else COL_GOLD if hp_pct < 0.7 else (80, 200, 80)
    draw_text(surface, 'HP:', stat_x1, stat_y + 48, FONT_SM, COL_TEXT_DIM)
    _draw_bar(surface, stat_x2, stat_y + 50, 80, 8, hp_pct, hp_col)
    draw_text(surface, f'{int(hp_pct*100)}%', stat_x2 + 84, stat_y + 47, FONT_SM, hp_col)

    draw_text(surface, f'Kills: {t.kills}', stat_x1, stat_y + 66, FONT_SM, COL_TEXT_DIM)

    _draw_ornament(surface, px + 10, stat_y + 82, pw - 20, COL_TEXT_DIM, alpha=35)

    desc = t.def_.get('desc', '')
    if desc:
        words = desc.split()
        lines = []
        line = ''
        for w in words:
            test = line + ' ' + w if line else w
            if FONT_SM.size(test)[0] < pw - 16:
                line = test
            else:
                lines.append(line)
                line = w
        if line:
            lines.append(line)
        for i, ln in enumerate(lines[:3]):
            draw_text(surface, ln, px + 8, stat_y + 88 + i * 13, FONT_SM, COL_TEXT_DIM)

    u = t.upgrade
    if u:
        draw_button(surface, btn_upgrade.x, btn_upgrade.y, btn_upgrade.w, btn_upgrade.h,
                     f'Mejorar {int(u["cost"] * g.upCostMult)}', enabled=g.gold >= int(u["cost"] * g.upCostMult))
    else:
        draw_button(surface, btn_upgrade.x, btn_upgrade.y, btn_upgrade.w, btn_upgrade.h, 'MAX', enabled=False)

    draw_button(surface, btn_sell.x, btn_sell.y, btn_sell.w, btn_sell.h,
                 f'Vender {int(t.sellValue())}')

    if hasattr(t, 'useAbility') and t.def_.get('ability'):
        ab = t.def_['ability']
        cd_ready = t.abilityCd <= 0 if hasattr(t, 'abilityCd') else True
        cd_text = f'{ab["name"]} {int(t.abilityCd)}s' if not cd_ready else f'{ab["name"]} (E)'
        draw_button(surface, btn_ability.x, btn_ability.y, btn_ability.w, btn_ability.h,
                     cd_text, enabled=cd_ready)
    if hasattr(t, 'repairCost'):
        rc = t.repairCost()
        draw_button(surface, btn_repair.x, btn_repair.y, btn_repair.w, btn_repair.h,
                     f'Reparar {rc}', enabled=rc > 0 and g.gold >= rc and t.hp < t.hpMax)

def draw_wave_info(surface, g):
    if g.waveState == 'idle':
        try:
            next_wave = WAVE.build_for(g.wave + 1, g.mapId) if hasattr(WAVE, 'build_for') else WAVE.build(g.wave + 1)
        except Exception:
            next_wave = []
        counts = {}
        boss_type = None
        for entry in next_wave:
            t = entry['type']
            if ENEMIES.get(t, {}).get('boss'):
                boss_type = t
            counts[t] = counts.get(t, 0) + 1
        lines_count = 1 + len(counts)
        panel_h = max(36, lines_count * 14 + 18)
        panel_y = H - 30 - panel_h

        _draw_panel(surface, (0, panel_y, 195, panel_h), COL_GOLD, border_alpha=25, fill_alpha=180)

        y = panel_y + 6
        if boss_type:
            draw_text(surface, f'\u2694 Jefe: {ENEMIES[boss_type]["name"]}', 10, y, FONT_SM, COL_GOLD)
            y += 16
        sorted_types = sorted(counts.keys())
        for t in sorted_types:
            en = ENEMIES.get(t, {})
            e_col = (200, 100, 80) if en.get('boss') else COL_TEXT_DIM
            draw_text(surface, f'{en.get("name",t)} x{counts[t]}', 10, y, FONT_SM, e_col)
            y += 14
    else:
        remaining = len(g.enemies)
        draw_text(surface, f'\u2694 Enemigos: {remaining}', 10, H - 42, FONT_SM, COL_TEXT_DIM)
        if remaining > 0:
            _draw_bar(surface, 130, H - 38, 80, 6, remaining / 20.0, COL_LIFE)


def draw_director_info(surface, g):
    lvl = DIRECTOR.level
    lvl_name = directorLevelName[lvl] if lvl < len(directorLevelName) else 'Relajado'
    lvl_col = directorLevelCol[lvl] if lvl < len(directorLevelCol) else COL_TEXT
    dom = DIRECTOR.dominantElement()
    dom_txt = f"{dom['element']} {int(dom['pct']*100)}%" if dom else '\u2014'
    y = H - 22

    panel_s = pygame.Surface((500, 18), pygame.SRCALPHA)
    panel_s.fill((18, 14, 10, 140))
    surface.blit(panel_s, (0, y - 2))

    draw_text(surface, lvl_name, 10, y, FONT_SM, lvl_col)
    draw_text(surface, f'\u2022 Estrategia: {dom_txt}', 90, y, FONT_SM, COL_TEXT_DIM)
    draw_text(surface, f'\u2022 Kills: {g.kills}', 250, y, FONT_SM, COL_TEXT_DIM)
    draw_text(surface, f'\u2022 Fugas: {g.leaked}', 360, y, FONT_SM, COL_TEXT_DIM)

def draw_overlay(surface, g):
    if not (g.over or g.won):
        return

    overlay = pygame.Surface((W, H), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 200))
    surface.blit(overlay, (0, 0))

    panel_w, panel_h = 380, 260
    px, py = W // 2 - panel_w // 2, H // 2 - panel_h // 2

    _draw_panel(surface, (px, py, panel_w, panel_h),
                COL_GOLD if g.won else COL_LIFE, r=10, border_alpha=80, fill_alpha=230)

    if g.won:
        glow_s = pygame.Surface((panel_w, 60), pygame.SRCALPHA)
        for gy in range(60):
            a = int(25 * (1.0 - gy / 60))
            pygame.draw.line(glow_s, (255, 214, 74, a), (0, gy), (panel_w, gy))
        surface.blit(glow_s, (px, py + 2))

    _draw_ornament(surface, px + 50, py + 36, panel_w - 100, COL_GOLD if g.won else COL_LIFE, alpha=70)

    title = '\u00a1Victoria!' if g.won else 'Derrota'
    col = COL_GOLD if g.won else COL_LIFE
    title_s = FONT_XL.render(title, True, col)
    tw = title_s.get_width()
    for dx, dy in [(-2, 2), (2, 2), (0, 3)]:
        shd = FONT_XL.render(title, True, (0, 0, 0))
        surface.blit(shd, (W // 2 - tw // 2 + dx, py + 12 + dy))
    glow_t = pygame.Surface((tw + 20, 40), pygame.SRCALPHA)
    glow_c = (255, 214, 74) if g.won else (220, 60, 60)
    pygame.draw.ellipse(glow_t, (*glow_c, 15), (0, 0, tw + 20, 40))
    surface.blit(glow_t, (W // 2 - tw // 2 - 10, py + 8))
    surface.blit(title_s, (W // 2 - tw // 2, py + 12))

    _draw_ornament(surface, px + 50, py + 56, panel_w - 100, COL_GOLD if g.won else COL_LIFE, alpha=50)

    sy = py + 70
    stats = [
        (f'Oleada alcanzada: {g.wave}', COL_TEXT),
        (f'Enemigos eliminados: {g.kills}', COL_TEXT_DIM),
        (f'Fugas: {g.leaked}', COL_LIFE if g.leaked > 0 else COL_TEXT_DIM),
    ]
    for i, (txt, sc) in enumerate(stats):
        draw_text(surface, txt, W // 2, sy + i * 20, FONT_SM, sc, center=True)

    if g.won:
        xp_gained = 10 + g.wave * 2
        draw_text(surface, f'+{xp_gained} XP', W // 2, sy + 64, FONT_MD, COL_GOLD, center=True)

    _draw_ornament(surface, px + 50, py + panel_h - 64, panel_w - 100, COL_GOLD if g.won else COL_LIFE, alpha=40)

    draw_button(surface, W // 2 - 80, py + panel_h - 48, 160, 34, 'Menu Principal')

def draw_paused(surface):
    overlay = pygame.Surface((W, H), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 160))
    surface.blit(overlay, (0, 0))

    pw, ph = 260, 100
    px, py = W // 2 - pw // 2, H // 2 - ph // 2
    _draw_panel(surface, (px, py, pw, ph), COL_GOLD, r=8, border_alpha=65, fill_alpha=220)

    _draw_ornament(surface, px + 30, py + 35, pw - 60, COL_GOLD, alpha=55)

    title_s = FONT_LG.render('PAUSA', True, COL_GOLD)
    tw = title_s.get_width()
    for dx, dy in [(-1, 1), (1, 1), (0, 2)]:
        shd = FONT_LG.render('PAUSA', True, (0, 0, 0))
        surface.blit(shd, (W // 2 - tw // 2 + dx, py + 10 + dy))
    surface.blit(title_s, (W // 2 - tw // 2, py + 10))

    draw_text(surface, 'Presiona P para reanudar', W // 2, py + 68, FONT_SM, COL_TEXT_DIM, center=True)

def draw_toasts(surface):
    y = H - 50
    for t in toasts[-4:]:
        t.draw(surface, y)
        y -= 36

def draw_placing_ghost(surface, g, mouse_pos):
    if not g.placing:
        return
    mc = mouse_pos[0] // CELL
    mr = mouse_pos[1] // CELL
    if 0 <= mc < COLS and 0 <= mr < ROWS:
        can = g.canPlace(mc, mr)
        ghost_surf = pygame.Surface((CELL, CELL), pygame.SRCALPHA)
        if can:
            ghost_surf.fill((80, 200, 80, 70))
            pygame.draw.rect(ghost_surf, (80, 200, 80, 160), (0, 0, CELL, CELL), 2, border_radius=3)
        else:
            ghost_surf.fill((200, 60, 60, 60))
            pygame.draw.rect(ghost_surf, (200, 60, 60, 140), (0, 0, CELL, CELL), 2, border_radius=3)
        surface.blit(ghost_surf, (mc * CELL, mr * CELL))

        tdef = TOWERS.get(g.placing, {})
        if tdef:
            rng = tdef.get('range', 100)
            rng_surf = pygame.Surface((rng*2, rng*2), pygame.SRCALPHA)
            pygame.draw.circle(rng_surf, (200, 200, 200, 25), (rng, rng), rng)
            pygame.draw.circle(rng_surf, (200, 200, 200, 60), (rng, rng), rng, 1)
            dash_r = rng
            for angle_i in range(12):
                a = angle_i * math.pi / 6
                x1 = int(rng + dash_r * 0.95 * math.cos(a))
                y1 = int(rng + dash_r * 0.95 * math.sin(a))
                x2 = int(rng + dash_r * 1.0 * math.cos(a))
                y2 = int(rng + dash_r * 1.0 * math.sin(a))
                pygame.draw.line(rng_surf, (200, 200, 200, 80), (x1, y1), (x2, y2), 1)
            surface.blit(rng_surf, (mc*CELL + CELL//2 - rng, mr*CELL + CELL//2 - rng))

def draw_selected_range(surface, g):
    if not g.selected:
        return
    t = g.selected
    tx = t.col * CELL + CELL // 2
    ty = t.row * CELL + CELL // 2
    rng = int(t.range)
    rng_surf = pygame.Surface((rng*2, rng*2), pygame.SRCALPHA)
    pygame.draw.circle(rng_surf, (200, 200, 200, 20), (rng, rng), rng)
    el_colors = {'physical': (180, 170, 150), 'fire': (255, 100, 40), 'ice': (100, 180, 230),
                 'earth': (180, 160, 80), 'nature': (60, 180, 60), 'holy': (240, 210, 80),
                 'lightning': (80, 160, 255), 'void': (170, 90, 240)}
    rng_col = el_colors.get(t.element, (200, 200, 200))
    pygame.draw.circle(rng_surf, (*rng_col, 50), (rng, rng), rng, 2)
    for angle_i in range(12):
        a = angle_i * math.pi / 6
        x1 = int(rng + rng * 0.95 * math.cos(a))
        y1 = int(rng + rng * 0.95 * math.sin(a))
        x2 = int(rng + rng * 1.0 * math.cos(a))
        y2 = int(rng + rng * 1.0 * math.sin(a))
        pygame.draw.line(rng_surf, (*rng_col, 80), (x1, y1), (x2, y2), 1)
    surface.blit(rng_surf, (tx - rng, ty - rng))
    sel_s = pygame.Surface((CELL, CELL), pygame.SRCALPHA)
    sel_s.fill((255, 214, 74, 40))
    pygame.draw.rect(sel_s, COL_GOLD, (0, 0, CELL, CELL), 2, border_radius=2)
    surface.blit(sel_s, (t.col * CELL, t.row * CELL))

def get_map_card_rects():
    rects = []
    card_w = 170
    card_h = 165
    gap = 14
    grid_x = 30
    grid_y = 218
    for i, m in enumerate(MAPS):
        mx = grid_x + i * (card_w + gap)
        my = grid_y
        rects.append((pygame.Rect(mx, my, card_w, card_h), m['id']))
    return rects

def screen_to_cell(mx, my):
    c = mx // CELL
    r = my // CELL
    return int(c), int(r)

def main():
    global game, state, last_ts, toasts, shop_buttons, selected_difficulty, selected_map

    progressLoad()
    shop_buttons = build_shop_buttons()
    diff_btns = []
    running = True
    mouse_pos = (0, 0)

    while running:
        now = time.time()
        dt = min(0.05, now - last_ts)
        last_ts = now

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                break
            elif event.type == pygame.KEYDOWN:
                if state == 'playing' and game and game.selected:
                    if event.key == pygame.K_e:
                        if hasattr(game.selected, 'useAbility'):
                            game.selected.useAbility(game)
                    elif event.key == pygame.K_ESCAPE:
                        game.placing = None
                        game.selected = None
            elif event.type == pygame.MOUSEMOTION:
                mouse_pos = event.pos
                if game and state == 'playing':
                    c, r = screen_to_cell(*mouse_pos)
                    game.mouse['c'] = c
                    game.mouse['r'] = r
                    game.mouse['inside'] = 0 <= c < COLS and 0 <= r < ROWS
                    if game.mouse['inside']:
                        game.hovered = game.towerAt(c, r)
                    else:
                        game.hovered = None
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 3:
                    if game:
                        game.placing = None
                        game.selected = None
                    continue
                if event.button != 1:
                    continue

                mx, my = event.pos
                play_sound('ui_click', 0.3)

                if state == 'menu':
                    del_rect = pygame.Rect(W//2 - 80, H - 52, 160, 28)
                    if del_rect.collidepoint(mx, my):
                        progressReset()
                        shop_buttons = build_shop_buttons()
                        toast('Progreso borrado', 2000)
                        continue
                    if btn_conquest_menu and btn_conquest_menu.collidepoint(mx, my):
                        conquest_relics = CONQUEST.get('SELECTED', [])
                        state = 'conquest_select'
                        continue
                    if btn_ach_menu and btn_ach_menu.collidepoint(mx, my):
                        state = 'achievements'
                        continue
                    for drect, dval in diff_btns:
                        if drect.collidepoint(mx, my):
                            selected_difficulty = dval
                            break
                    card_rects = get_map_card_rects()
                    for rect, map_id in card_rects:
                        unlocked = map_id in PROGRESS.get('unlocked', ['plains'])
                        if rect.collidepoint(mx, my) and unlocked:
                            selected_map = map_id
                            try:
                                game = Game(map_id, difficulty=selected_difficulty)
                                state = 'playing'
                                shop_buttons = build_shop_buttons()
                                toast(f'Bienvenido a {game.map.get("name", map_id)}!', 3000)
                            except Exception as e:
                                game = None
                                toast(f'Error: {e}', 5000)
                            break

                elif state == 'playing' and game:
                    if game.over or game.won:
                        if btn_restart.collidepoint(mx, my):
                            CONQUEST['enabled'] = False
                            game = None
                            state = 'menu'
                            continue
                    else:
                        if game.waveState == 'relic_choice' and game.conquestRelics:
                            for ri, relic in enumerate(game.conquestRelics):
                                rx = W // 2 - 200 + ri * 260
                                ry = H // 2 - 80
                                if pygame.Rect(rx, ry, 220, 160).collidepoint(mx, my):
                                    game.applyConquestRelic(relic)
                                    game.waveState = 'idle'
                                    toast(f'Reliquia: {relic["name"]}!', 2000)
                                    break
                        elif game.paused:
                            pass

                        if btn_audio_toggle.collidepoint(mx, my):
                            AUDIO.toggle()
                        elif btn_wave.collidepoint(mx, my):
                            game.startWave()
                        elif btn_speed.collidepoint(mx, my):
                            game.speed = 1 if game.speed >= 3 else game.speed + 1
                        elif btn_pause.collidepoint(mx, my):
                            game.paused = not game.paused
                        elif btn_auto.collidepoint(mx, my):
                            game.autoWave = not game.autoWave
                            game.autoTimer = 2
                            if game.autoWave:
                                toast('Auto activado', 1500)
                            else:
                                toast('Auto desactivado', 1500)

                        panel_click = False
                        if game.selected:
                            if btn_upgrade.collidepoint(mx, my):
                                game.upgradeTower(game.selected)
                                panel_click = True
                            elif btn_sell.collidepoint(mx, my):
                                game.sellTower(game.selected)
                                panel_click = True
                            elif btn_ability.collidepoint(mx, my):
                                if hasattr(game.selected, 'useAbility'):
                                    game.selected.useAbility(game)
                                panel_click = True
                            elif btn_repair.collidepoint(mx, my):
                                if hasattr(game.selected, 'repair'):
                                    game.selected.repair()
                                    play_sound('tower_repair', 0.4)
                                panel_click = True

                        shop_click = False
                        shop_x = 10
                        shop_y = 30
                        btn_w = 58
                        btn_h = 55
                        cols = min(13, len(TOWER_TYPES))
                        for i, sb in enumerate(shop_buttons):
                            col = i % cols
                            row = i // cols
                            bx = shop_x + col * (btn_w + 4)
                            by = shop_y + row * (btn_h + 4)
                            if pygame.Rect(bx, by, btn_w, btn_h).collidepoint(mx, my):
                                shop_click = True
                                unlock_wave = sb.def_.get('unlock', {}).get('wave', 0) if sb.def_.get('unlock') else 0
                                if unlock_wave > 0 and game.wave < unlock_wave:
                                    toast(f'{sb.def_["name"]} se desbloquea en la oleada {unlock_wave}', 2000)
                                else:
                                    if game.placing == sb.type:
                                        game.placing = None
                                    else:
                                        game.placing = sb.type
                                        game.selected = None
                                break

                        if not shop_click and not panel_click:
                            c, r = screen_to_cell(mx, my)
                            if 0 <= c < COLS and 0 <= r < ROWS:
                                if game.placing:
                                    cost = int(TOWERS[game.placing]['cost'] * game.upCostMult)
                                    if game.buildTower(c, r, game.placing):
                                        toast(f'{TOWERS[game.placing]["name"]} construida!', 1200)
                                    elif game.gold >= cost:
                                        toast('No puedes construir ahi', 1200)
                                else:
                                    game.selected = game.towerAt(c, r)

                elif state == 'conquest_select':
                    back_rect = pygame.Rect(W//2 - 80, H - 52, 160, 32)
                    if back_rect.collidepoint(mx, my):
                        state = 'menu'
                        continue
                    for ri, relic in enumerate(conquest_relics):
                        rx = W//2 - 200 + ri * 260
                        ry = H//2 - 80
                        if pygame.Rect(rx, ry, 220, 160).collidepoint(mx, my):
                            try:
                                game = Game(selected_map or 'plains', difficulty=selected_difficulty)
                                CONQUEST['enabled'] = True
                                relic.get('apply', lambda g: None)(game)
                                if 'goldMult' in relic:
                                    game.goldMult *= relic['goldMult']
                                if 'upCostMult' in relic:
                                    game.upCostMult *= relic['upCostMult']
                                state = 'playing'
                                shop_buttons = build_shop_buttons()
                                toast(f'Conquista: {relic["name"]}!', 3000)
                            except Exception as e:
                                game = None
                                state = 'menu'
                                toast(f'Error: {e}', 5000)
                            break

                elif state == 'achievements':
                    back_rect = pygame.Rect(W//2 - 80, H - 44, 160, 28)
                    if back_rect.collidepoint(mx, my):
                        state = 'menu'

        if state == 'playing' and game and not game.paused and not game.over and not game.won:
            for _ in range(game.speed):
                game.update(dt)

        if state == 'menu' or state == 'conquest_select' or state == 'achievements':
            AUDIO.stop_music()
            AUDIO.stop_ambient()
        elif state == 'playing' and game:
            if game.over or game.won:
                pass
            elif game.wave % 5 == 0 and game.waveState != 'idle':
                AUDIO.play_music('boss')
            elif len(game.enemies) > 15:
                AUDIO.play_music('intense')
            else:
                AUDIO.play_music('normal')
            if not AUDIO._current_amb_key:
                AUDIO.play_ambient('normal', game.map.get('theme', 'plains'))

        for t in toasts:
            t.update(dt)
        toasts = [t for t in toasts if t.alive]

        screen.fill(COL_BG)

        if state == 'menu':
            btn_restart_menu, btn_conquest_menu, diff_btns, btn_ach_menu = draw_menu(screen)
        elif state == 'conquest_select':
            screen.fill(COL_BG)

            vig = pygame.Surface((W, H), pygame.SRCALPHA)
            for i in range(40):
                a = int(80 * (1.0 - i / 40))
                pygame.draw.rect(vig, (0, 0, 0, a), (i, i, W - i * 2, H - i * 2), 1, border_radius=max(0, 6 - i // 10))
            screen.blit(vig, (0, 0))

            _draw_ornament(screen, W // 2 - 160, 24, 320, COL_GOLD, alpha=55)
            draw_text(screen, 'Modo Conquista', W//2, 38, FONT_XL, COL_GOLD, center=True)
            draw_text(screen, 'Elige una reliquia para comenzar', W//2, 72, FONT_SM, COL_TEXT_DIM, center=True)
            _draw_ornament(screen, W // 2 - 160, 88, 320, COL_GOLD, alpha=45)
            for ri, relic in enumerate(conquest_relics):
                rx = W//2 - 200 + ri * 260
                ry = H//2 - 80
                hover = pygame.Rect(rx, ry, 220, 160).collidepoint(mouse_pos)
                _draw_panel(screen, (rx, ry, 220, 160), COL_GOLD if hover else COL_TEXT_DIM,
                           r=8, border_alpha=60 if hover else 30, fill_alpha=210)
                draw_text(screen, relic.get('icon', '?'), rx + 110, ry + 16, FONT_LG, COL_WHITE, center=True)
                draw_text(screen, relic['name'], rx + 110, ry + 52, FONT_MD, COL_GOLD, center=True)
                _draw_ornament(screen, rx + 30, ry + 70, 160, COL_GOLD if hover else COL_TEXT_DIM, alpha=40)
                desc_lines = relic['desc'].split('.')
                for li, line in enumerate(desc_lines):
                    if line.strip():
                        draw_text(screen, line.strip() + ('.' if not line.strip().endswith('.') else ''), rx + 15, ry + 82 + li * 18, FONT_SM, COL_TEXT)
            draw_button(screen, W//2 - 80, H - 52, 160, 32, 'Volver')
        elif state == 'achievements':
            screen.fill(COL_BG)
            _draw_ornament(screen, W // 2 - 200, 18, 400, COL_GOLD, alpha=55)
            draw_text(screen, '\U0001f3c6  Logros', W//2, 32, FONT_XL, COL_GOLD, center=True)
            ach_count = achievementCount()
            draw_text(screen, f'{ach_count}/{len(ACHIEVEMENTS)} completados', W//2, 58, FONT_SM, COL_TEXT_DIM, center=True)
            _draw_ornament(screen, W // 2 - 200, 72, 400, COL_GOLD, alpha=40)
            cols = 2
            card_w = 420
            card_h = 42
            gap_x = 16
            gap_y = 8
            start_x = W // 2 - (cols * (card_w + gap_x) - gap_x) // 2
            start_y = 88
            for ai, ach in enumerate(ACHIEVEMENTS):
                col = ai % cols
                row = ai // cols
                ax = start_x + col * (card_w + gap_x)
                ay = start_y + row * (card_h + gap_y)
                unlocked = isAchievementUnlocked(ach['id'])
                _draw_panel(screen, (ax, ay, card_w, card_h), COL_GOLD if unlocked else (60, 55, 45), r=6, border_alpha=40 if unlocked else 20, fill_alpha=200 if unlocked else 150)
                draw_text(screen, ach['icon'], ax + 16, ay + 10, FONT_LG, COL_WHITE if unlocked else (80, 75, 65))
                draw_text(screen, ach['name'], ax + 44, ay + 6, FONT_MD, COL_GOLD if unlocked else (120, 110, 90))
                draw_text(screen, ach['desc'], ax + 44, ay + 24, FONT_SM, COL_TEXT if unlocked else (90, 85, 75))
            btn_back_ach = draw_button(screen, W//2 - 80, H - 44, 160, 28, 'Volver')
        elif state == 'playing' and game:
            game.render(screen)
            draw_placing_ghost(screen, game, mouse_pos)
            draw_selected_range(screen, game)
            draw_hud(screen, game)
            draw_shop(screen, game, mouse_pos)
            draw_tower_panel(screen, game)
            draw_wave_info(screen, game)
            draw_director_info(screen, game)
            if game.paused:
                draw_paused(screen)
            draw_overlay(screen, game)
            if game.waveState == 'relic_choice' and game.conquestRelics:
                overlay = pygame.Surface((W, H), pygame.SRCALPHA)
                overlay.fill((0, 0, 0, 160))
                screen.blit(overlay, (0, 0))
                _draw_ornament(screen, W // 2 - 200, 24, 400, COL_GOLD, alpha=55)
                draw_text(screen, '\u2694  Elige una Reliquia  \u2694', W // 2, 38, FONT_XL, COL_GOLD, center=True)
                draw_text(screen, 'Oleada %d completada' % game.wave, W // 2, 62, FONT_SM, COL_TEXT_DIM, center=True)
                for ri, relic in enumerate(game.conquestRelics):
                    rx = W // 2 - 200 + ri * 260
                    ry = H // 2 - 80
                    hover = pygame.Rect(rx, ry, 220, 160).collidepoint(mouse_pos)
                    _draw_panel(screen, (rx, ry, 220, 160), COL_GOLD if hover else COL_TEXT_DIM,
                                r=8, border_alpha=60 if hover else 30, fill_alpha=210)
                    draw_text(screen, relic.get('icon', '?'), rx + 110, ry + 16, FONT_LG, COL_WHITE, center=True)
                    draw_text(screen, relic['name'], rx + 110, ry + 52, FONT_MD, COL_GOLD, center=True)
                    _draw_ornament(screen, rx + 30, ry + 70, 160, COL_GOLD if hover else COL_TEXT_DIM, alpha=40)
                    desc = relic.get('desc', '')
                    for li, ln in enumerate(desc.split('.')):
                        if ln.strip():
                            draw_text(screen, ln.strip() + ('.' if not ln.strip().endswith('.') else ''), rx + 15, ry + 82 + li * 18, FONT_SM, COL_TEXT)
        draw_toasts(screen)

        pygame.display.flip()
        clock.tick(60)

    pygame.quit()
    sys.exit()

if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback
        _log_path = os.path.join(os.path.dirname(__file__), 'crash.log')
        with open(_log_path, 'w', encoding='utf-8') as _f:
            _f.write(traceback.format_exc())
        raise