import pygame
import random
import math
from audio import AUDIO

WIDTH, HEIGHT = 960, 560

TYPES = {
    'clear':   {'name': 'Despejado', 'fx': {}, 'color': (255, 255, 255, 0)},
    'rain':    {'name': 'Lluvia',    'fx': {'fireMult': 0.75, 'natureMult': 1.2}, 'color': (90, 120, 180, 30)},
    'snow':    {'name': 'Nieve',     'fx': {'enemySpeed': 0.85, 'iceMult': 1.2}, 'color': (230, 240, 255, 38)},
    'storm':   {'name': 'Tormenta',  'fx': {'fireMult': 0.6, 'iceMult': 1.3, 'enemySpeed': 0.9, 'lightning': True}, 'color': (40, 50, 90, 50)},
    'fog':     {'name': 'Niebla',    'fx': {'rangeMult': 0.85}, 'color': (210, 210, 210, 45)},
    'drought': {'name': 'Sequía',    'fx': {'fireMult': 1.35, 'iceMult': 0.75}, 'color': (255, 190, 90, 25)},
}


class Weather:
    def __init__(self):
        self.types = TYPES
        self.current = 'clear'
        self.type_def = TYPES['clear']
        self.color = self.type_def['color']
        self.fx = self.type_def['fx']
        self.next = 0
        self.flash_t = 0.0
        self.drops = []
        self.flakes = []
        self.fog_patches = []
        self.init()

    @property
    def type(self):
        return self.type_def

    @type.setter
    def type(self, value):
        self.type_def = value

    def init(self):
        self.drops.clear()
        self.flakes.clear()
        self.fog_patches.clear()
        for _ in range(120):
            self.drops.append({
                'x': random.random() * WIDTH,
                'y': random.random() * HEIGHT,
                'length': 8 + random.random() * 10,
                'speed': 700 + random.random() * 400,
            })
        for _ in range(70):
            self.flakes.append({
                'x': random.random() * WIDTH,
                'y': random.random() * HEIGHT,
                'r': 1.5 + random.random() * 2.5,
                'speed': 25 + random.random() * 35,
                'drift': (random.random() - 0.5) * 20,
            })
        for _ in range(8):
            g = {
                'x': random.random() * WIDTH,
                'y': random.random() * HEIGHT,
                'r': 90 + random.random() * 140,
                'speed': 8 + random.random() * 10,
                'dir': 1 if random.random() > 0.5 else -1,
            }
            g['sprite'] = self._make_fog_sprite(int(g['r']))
            self.fog_patches.append(g)

    def _make_fog_sprite(self, radius):
        d = radius * 2
        s = pygame.Surface((d, d), pygame.SRCALPHA)
        rings = 8
        for i in range(rings, 0, -1):
            ratio = i / rings
            r = int(radius * ratio)
            if r < 1:
                continue
            alpha = int(112 * (1.0 - ratio))
            pygame.draw.circle(s, (230, 235, 240, alpha), (radius, radius), r)
        return s

    def set(self, wtype):
        self.current = wtype
        self.flash_t = 0.0
        self.type_def = TYPES[wtype]
        self.color = self.type_def['color']
        self.fx = self.type_def['fx']
        if wtype == 'storm':
            AUDIO.play_sfx(AUDIO.sfx.weather_thunder(), 0.5)
        elif wtype in ('rain', 'snow'):
            AUDIO.play_sfx(AUDIO.sfx.weather_wind_gust(), 0.3)
        AUDIO.change_weather_sounds(wtype)

    def tick(self, dt):
        self.next -= dt
        if self.next <= 0:
            r = random.random()
            pick = 'clear'
            if r < 0.22:
                pick = 'rain'
            elif r < 0.38:
                pick = 'snow'
            elif r < 0.52:
                pick = 'storm'
            elif r < 0.66:
                pick = 'fog'
            elif r < 0.78:
                pick = 'drought'
            self.set(pick)
            self.next = 25 + random.random() * 20

        for d in self.drops:
            d['y'] += d['speed'] * dt
            d['x'] += d['length'] * 0.3 * dt
            if d['y'] > HEIGHT:
                d['y'] = -12
                d['x'] = random.random() * WIDTH

        for f in self.flakes:
            f['y'] += f['speed'] * dt
            f['x'] += f['drift'] * dt
            if f['y'] > HEIGHT:
                f['y'] = -6
                f['x'] = random.random() * WIDTH

        for g in self.fog_patches:
            g['x'] += g['speed'] * g['dir'] * dt
            if g['x'] < -g['r']:
                g['x'] = WIDTH + g['r']
            if g['x'] > WIDTH + g['r']:
                g['x'] = -g['r']

    def draw_overlay(self, surface):
        if self.current == 'clear':
            return

        if self.current in ('rain', 'storm'):
            self._draw_rain(surface)

            if self.current == 'storm':
                self._draw_storm(surface)

        elif self.current == 'snow':
            self._draw_snow(surface)

        elif self.current == 'fog':
            self._draw_fog(surface)

    def _draw_rain(self, surface):
        for pass_idx in range(2):
            if pass_idx == 0:
                color = (120, 150, 190, 40)
                width = 1
            else:
                color = (175, 205, 235, 128)
                width = 1

            for d in self.drops:
                sl = d['length'] * (0.7 if pass_idx == 0 else 1.0)
                start = (int(d['x']), int(d['y']))
                end = (int(d['x'] + sl * 0.3), int(d['y'] + sl))
                pygame.draw.line(surface, color, start, end, width)

        for _ in range(5):
            spx = int(random.random() * WIDTH)
            color = (150, 180, 220, 64)
            start = (spx - 3, HEIGHT - 8)
            end = (spx + 3, HEIGHT - 8)
            pygame.draw.line(surface, color, start, end, 1)

    def _draw_storm(self, surface):
        if self.flash_t > 0:
            flash_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            alpha = int(min(self.flash_t * 0.3, 1.0) * 255)
            flash_surf.fill((230, 240, 255, alpha))
            surface.blit(flash_surf, (0, 0))
            self.flash_t -= 0.035

        if random.random() < 0.04:
            self.flash_t = 0.14
            AUDIO.play_sfx(AUDIO.sfx.weather_thunder(), 0.4)
            x = int(random.random() * WIDTH)
            offset = int((random.random() - 0.5) * 40)
            pygame.draw.line(surface, (255, 255, 255, 230), (x, 0), (x + offset, HEIGHT), 2)
            for _ in range(3):
                sx = x + int((random.random() - 0.5) * 30)
                sx_off = int((random.random() - 0.5) * 30)
                pygame.draw.line(surface, (150, 220, 255, 153), (sx, 0), (sx + sx_off, HEIGHT), 1)

    def _draw_snow(self, surface):
        for f in self.flakes:
            if f['r'] > 2.4:
                color = (255, 255, 255, 230)
            else:
                color = (255, 255, 255, 128)
            pos = (int(f['x']), int(f['y']))
            radius = max(1, int(f['r']))
            pygame.draw.circle(surface, color, pos, radius)

    def _draw_fog(self, surface):
        for g in self.fog_patches:
            sp = g.get('sprite')
            if sp is None:
                sp = self._make_fog_sprite(int(g['r']))
                g['sprite'] = sp
            surface.blit(sp, (int(g['x'] - sp.get_width() / 2), int(g['y'] - sp.get_height() / 2)))


WEATHER = Weather()
