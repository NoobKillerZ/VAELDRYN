"""
Motor de audio procedural para VAELDRYN Tower Defense.
Genera todos los efectos de sonido y musica sin archivos externos.
"""
import math
import random
import struct
import array
import pygame

# ---------------------------------------------------------------------------
#  Configuracion
# ---------------------------------------------------------------------------
SAMPLE_RATE = 22050
MAX_CHANNELS = 32
MUSIC_CHANNELS = 4
SFX_CHANNELS = MAX_CHANNELS - MUSIC_CHANNELS

_audio_ok = False
try:
    pygame.mixer.pre_init(SAMPLE_RATE, -16, 1, 512)
    pygame.mixer.init()
    pygame.mixer.set_num_channels(MAX_CHANNELS)
    _audio_ok = pygame.mixer.get_init() is not None
except Exception:
    _audio_ok = False

# ---------------------------------------------------------------------------
#  Utilidades de generacion de audio
# ---------------------------------------------------------------------------

def _make_sound(samples, volume=0.5):
    """Convierte una lista de floats [-1..1] en pygame.Sound."""
    if not _audio_ok:
        return None
    n = len(samples)
    buf = array.array('h', (max(-32768, min(32767, int(s * volume * 32767))) for s in samples))
    try:
        return pygame.mixer.Sound(buffer=buf)
    except Exception:
        return None


def _sine(freq, dur, sr=SAMPLE_RATE):
    n = int(sr * dur)
    return [math.sin(2 * math.pi * freq * i / sr) for i in range(n)]


def _square(freq, dur, sr=SAMPLE_RATE):
    n = int(sr * dur)
    return [1.0 if math.sin(2 * math.pi * freq * i / sr) > 0 else -1.0 for i in range(n)]


def _saw(freq, dur, sr=SAMPLE_RATE):
    n = int(sr * dur)
    return [2.0 * (freq * i / sr % 1.0) - 1.0 for i in range(n)]


def _noise(dur, sr=SAMPLE_RATE):
    n = int(sr * dur)
    return [random.uniform(-1, 1) for _ in range(n)]


def _envelope(samples, attack=0.01, decay=0.05, sustain=0.7, release=0.1, sr=SAMPLE_RATE):
    """Aplica envolvente ADSR a una lista de samples."""
    n = len(samples)
    out = []
    a_n = int(sr * attack)
    d_n = int(sr * decay)
    r_n = int(sr * release)
    s_n = max(0, n - a_n - d_n - r_n)
    for i in range(n):
        if i < a_n:
            env = i / max(1, a_n)
        elif i < a_n + d_n:
            t = (i - a_n) / max(1, d_n)
            env = 1.0 - (1.0 - sustain) * t
        elif i < a_n + d_n + s_n:
            env = sustain
        else:
            t = (i - a_n - d_n - s_n) / max(1, r_n)
            env = sustain * (1.0 - t)
        out.append(samples[i] * env)
    return out


def _sweep(freq_start, freq_end, dur, sr=SAMPLE_RATE):
    n = int(sr * dur)
    out = []
    for i in range(n):
        t = i / n
        freq = freq_start + (freq_end - freq_start) * t
        phase = 2 * math.pi * freq * i / sr
        out.append(math.sin(phase))
    return out


def _mix_layers(layers, volumes=None):
    """Mezcla multiples capas de audio."""
    if not layers:
        return []
    if volumes is None:
        volumes = [1.0] * len(layers)
    max_len = max(len(l) for l in layers)
    out = [0.0] * max_len
    for layer, vol in zip(layers, volumes):
        for i in range(len(layer)):
            out[i] += layer[i] * vol
    peak = max(abs(s) for s in out) if out else 1.0
    if peak > 1.0:
        out = [s / peak for s in out]
    return out


def _lowpass(samples, cutoff=1000, sr=SAMPLE_RATE):
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / sr
    alpha = dt / (rc + dt)
    out = [0.0] * len(samples)
    out[0] = samples[0]
    for i in range(1, len(samples)):
        out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1])
    return out


# ---------------------------------------------------------------------------
#  Biblioteca de efectos de sonido (generados una vez)
# ---------------------------------------------------------------------------

class _SFXLibrary:
    """Genera y cachea todos los efectos de sonido del juego."""

    def __init__(self):
        self._cache = {}

    def _get(self, key, generator):
        if key not in self._cache:
            self._cache[key] = generator()
        return self._cache[key]

    # -- UI --
    def ui_click(self):
        return self._get('ui_click', lambda: _make_sound(
            _envelope(_mix_layers([_sine(800, 0.06), _noise(0.06)]), 0.002, 0.02, 0.3, 0.03), 0.3))

    def ui_hover(self):
        return self._get('ui_hover', lambda: _make_sound(
            _envelope(_sine(600, 0.03), 0.002, 0.01, 0.2, 0.01), 0.15))

    def ui_open(self):
        return self._get('ui_open', lambda: _make_sound(
            _envelope(_sweep(300, 600, 0.12), 0.005, 0.03, 0.5, 0.06), 0.3))

    # -- Torres: construir, vender, mejorar --
    def tower_build(self):
        return self._get('tower_build', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 500, 0.15), _sine(400, 0.2)],
                        [0.6, 0.4]), 0.005, 0.05, 0.5, 0.1), 0.4))

    def tower_sell(self):
        return self._get('tower_sell', lambda: _make_sound(_envelope(
            _sweep(500, 180, 0.2), 0.005, 0.05, 0.3, 0.12), 0.3))

    def tower_upgrade(self):
        return self._get('tower_upgrade', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(400, 800, 0.15),
                _sweep(600, 1200, 0.15),
                _sine(800, 0.25),
            ], [0.4, 0.3, 0.3]), 0.005, 0.04, 0.6, 0.15), 0.35))

    def tower_destroy(self):
        return self._get('tower_destroy', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.3), _sweep(300, 80, 0.3)],
                        [0.7, 0.5]), 0.002, 0.08, 0.3, 0.15), 0.4))

    def tower_repair(self):
        return self._get('tower_repair', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(500, 900, 0.12), _sine(700, 0.18)],
                        [0.5, 0.5]), 0.003, 0.03, 0.5, 0.1), 0.3))

    # -- Torres: ataques por tipo --
    def tower_attack_archer(self):
        return self._get('atk_archer', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(2000, 600, 0.08), _noise(0.04)],
                        [0.7, 0.5]), 0.001, 0.015, 0.2, 0.03), 0.25))

    def tower_attack_fire(self):
        return self._get('atk_fire', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([_noise(0.2), _sweep(200, 100, 0.2), _sine(150, 0.2)],
                                 [0.6, 0.5, 0.3]), 2000), 0.005, 0.04, 0.4, 0.12), 0.35))

    def tower_attack_ice(self):
        return self._get('atk_ice', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(1800, 2400, 0.1), _sine(1200, 0.15)],
                        [0.6, 0.4]), 0.002, 0.02, 0.3, 0.06), 0.3))

    def tower_attack_dwarf(self):
        return self._get('atk_dwarf', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.15), _sweep(400, 100, 0.15), _sine(100, 0.25)],
                        [0.5, 0.6, 0.4]), 0.001, 0.03, 0.3, 0.12), 0.4))

    def tower_attack_crossbow(self):
        return self._get('atk_crossbow', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(1800, 800, 0.06), _noise(0.04)],
                        [0.7, 0.4]), 0.001, 0.01, 0.15, 0.03), 0.25))

    def tower_attack_venom(self):
        return self._get('atk_venom', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(600, 300, 0.12), _noise(0.1)],
                        [0.5, 0.5]), 0.003, 0.03, 0.3, 0.06), 0.25))

    def tower_attack_tesla(self):
        return self._get('atk_tesla', lambda: _make_sound(_envelope(
            _mix_layers([
                _square(120, 0.12),
                _sweep(3000, 200, 0.1),
                _noise(0.06),
            ], [0.4, 0.5, 0.3]), 0.001, 0.02, 0.3, 0.06), 0.35))

    def tower_attack_knight(self):
        return self._get('atk_knight', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.08), _sweep(800, 200, 0.08), _sine(150, 0.1)],
                        [0.6, 0.5, 0.4]), 0.001, 0.02, 0.2, 0.04), 0.35))

    def tower_attack_sniper(self):
        return self._get('atk_sniper', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(2500, 1200, 0.1), _noise(0.05)],
                        [0.7, 0.3]), 0.001, 0.02, 0.15, 0.04), 0.3))

    def tower_attack_holy(self):
        return self._get('atk_holy', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(800, 1400, 0.15),
                _sine(1000, 0.2),
                _sine(1500, 0.15),
            ], [0.4, 0.4, 0.2]), 0.003, 0.03, 0.5, 0.1), 0.3))

    def tower_attack_warlock(self):
        return self._get('atk_warlock', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 600, 0.15), _square(80, 0.15), _noise(0.08)],
                        [0.4, 0.3, 0.3]), 0.003, 0.04, 0.4, 0.08), 0.3))

    def tower_attack_druid(self):
        return self._get('atk_druid', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(400, 800, 0.2), _sine(600, 0.25)],
                        [0.5, 0.5]), 0.005, 0.05, 0.5, 0.12), 0.25))

    def tower_attack_banner(self):
        return self._get('atk_banner', lambda: _make_sound(_envelope(
            _sine(300, 0.3), 0.01, 0.05, 0.4, 0.15), 0.2))

    # -- Habilidades especiales --
    def ability_generic(self):
        return self._get('abi_generic', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(400, 1200, 0.2),
                _sweep(600, 1800, 0.2),
                _sine(1000, 0.3),
            ], [0.3, 0.3, 0.4]), 0.005, 0.05, 0.5, 0.2), 0.4))

    def ability_meteor(self):
        return self._get('abi_meteor', lambda: _make_sound(_envelope(
            _mix_layers([
                _noise(0.4),
                _sweep(100, 40, 0.4),
                _sine(60, 0.5),
            ], [0.5, 0.5, 0.3]), 0.002, 0.1, 0.5, 0.25), 0.45))

    def ability_frost_nova(self):
        return self._get('abi_frost_nova', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(2000, 4000, 0.3),
                _sweep(1500, 3000, 0.25),
                _sine(2000, 0.4),
            ], [0.3, 0.3, 0.4]), 0.003, 0.05, 0.4, 0.25), 0.35))

    def ability_arrow_rain(self):
        return self._get('abi_arrow_rain', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(2000, 800, 0.25), _noise(0.15)],
                        [0.6, 0.5]), 0.002, 0.04, 0.4, 0.12), 0.35))

    def ability_bombardment(self):
        return self._get('abi_bombardment', lambda: _make_sound(_envelope(
            _mix_layers([
                _noise(0.5),
                _sweep(200, 50, 0.5),
                _sine(80, 0.6),
            ], [0.5, 0.5, 0.3]), 0.001, 0.08, 0.5, 0.3), 0.45))

    def ability_chain_lightning(self):
        return self._get('abi_chain_lightning', lambda: _make_sound(_envelope(
            _mix_layers([
                _square(150, 0.2),
                _sweep(4000, 500, 0.15),
                _noise(0.08),
            ], [0.4, 0.5, 0.3]), 0.001, 0.03, 0.4, 0.1), 0.4))

    def ability_shield_bash(self):
        return self._get('abi_shield_bash', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.12), _sweep(600, 150, 0.12), _sine(200, 0.15)],
                        [0.6, 0.5, 0.4]), 0.001, 0.03, 0.3, 0.06), 0.4))

    def ability_purification(self):
        return self._get('abi_purification', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(600, 1200, 0.3),
                _sine(900, 0.35),
                _sine(1350, 0.3),
            ], [0.3, 0.4, 0.3]), 0.005, 0.05, 0.6, 0.2), 0.35))

    def ability_war_cry(self):
        return self._get('abi_war_cry', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 500, 0.2), _sine(350, 0.3)],
                        [0.6, 0.4]), 0.003, 0.05, 0.5, 0.15), 0.35))

    def ability_lethal_shot(self):
        return self._get('abi_lethal', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(3000, 1500, 0.12), _noise(0.06), _sine(800, 0.15)],
                        [0.5, 0.3, 0.3]), 0.001, 0.02, 0.2, 0.05), 0.4))

    def ability_devastation(self):
        return self._get('abi_devastation', lambda: _make_sound(_envelope(
            _mix_layers([
                _noise(0.5),
                _sweep(100, 30, 0.5),
                _square(60, 0.3),
                _sine(200, 0.4),
            ], [0.4, 0.4, 0.2, 0.2]), 0.001, 0.08, 0.5, 0.3), 0.45))

    def ability_toxic_cloud(self):
        return self._get('abi_toxic', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(300, 200, 0.3), _noise(0.2)],
                        [0.5, 0.5]), 0.005, 0.05, 0.4, 0.15), 0.3))

    # -- Impacto de proyectiles --
    def projectile_hit(self):
        return self._get('proj_hit', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.06), _sweep(800, 300, 0.05)],
                        [0.6, 0.5]), 0.001, 0.01, 0.15, 0.02), 0.2))

    def projectile_explosion(self):
        return self._get('proj_explosion', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([
                _noise(0.35),
                _sweep(150, 40, 0.35),
                _sine(80, 0.4),
            ], [0.5, 0.5, 0.3]), 3000), 0.001, 0.06, 0.4, 0.2), 0.45))

    def projectile_frost(self):
        return self._get('proj_frost', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(1500, 2500, 0.08), _sine(1800, 0.1)],
                        [0.6, 0.4]), 0.002, 0.02, 0.3, 0.04), 0.25))

    # -- Enemigos --
    def enemy_spawn(self):
        return self._get('enemy_spawn', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(150, 300, 0.1), _noise(0.06)],
                        [0.5, 0.3]), 0.003, 0.03, 0.3, 0.04), 0.2))

    def enemy_hurt(self):
        return self._get('enemy_hurt', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.06), _sweep(600, 300, 0.05)],
                        [0.6, 0.5]), 0.001, 0.01, 0.15, 0.02), 0.2))

    def enemy_death(self):
        return self._get('enemy_death', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(400, 100, 0.2), _noise(0.12)],
                        [0.5, 0.5]), 0.001, 0.04, 0.3, 0.1), 0.3))

    def enemy_death_boss(self):
        return self._get('enemy_death_boss', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([
                _noise(0.6),
                _sweep(200, 30, 0.6),
                _sine(60, 0.8),
                _sweep(100, 20, 0.5),
            ], [0.4, 0.4, 0.3, 0.3]), 2000), 0.001, 0.1, 0.6, 0.3), 0.5))

    def enemy_revive(self):
        return self._get('enemy_revive', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 600, 0.2), _sine(400, 0.25)],
                        [0.5, 0.5]), 0.005, 0.04, 0.4, 0.1), 0.3))

    def enemy_explode(self):
        return self._get('enemy_explode', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.25), _sweep(500, 80, 0.25)],
                        [0.6, 0.5]), 0.001, 0.04, 0.3, 0.12), 0.35))

    def enemy_leak(self):
        return self._get('enemy_leak', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(300, 150, 0.15), _noise(0.08)],
                        [0.5, 0.4]), 0.003, 0.03, 0.3, 0.08), 0.3))

    # -- Enemigos: sonidos por tipo --
    def enemy_type_goblin(self):
        return self._get('type_goblin', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(800, 1200, 0.06), _noise(0.04)],
                        [0.5, 0.4]), 0.001, 0.01, 0.2, 0.02), 0.15))

    def enemy_type_orc(self):
        return self._get('type_orc', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 100, 0.1), _noise(0.08)],
                        [0.5, 0.5]), 0.002, 0.02, 0.2, 0.04), 0.2))

    def enemy_type_undead(self):
        return self._get('type_undead', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(150, 100, 0.15), _sine(120, 0.2)],
                        [0.5, 0.4]), 0.003, 0.04, 0.3, 0.08), 0.2))

    def enemy_type_bat(self):
        return self._get('type_bat', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(2000, 4000, 0.04), _sweep(1800, 3500, 0.04)],
                        [0.5, 0.5]), 0.001, 0.01, 0.1, 0.02), 0.15))

    def enemy_type_troll(self):
        return self._get('type_troll', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(120, 80, 0.15), _noise(0.1)],
                        [0.5, 0.4]), 0.002, 0.03, 0.3, 0.06), 0.25))

    def enemy_type_skeleton(self):
        return self._get('type_skeleton', lambda: _make_sound(_envelope(
            _mix_layers([_sine(400, 0.08), _noise(0.05)],
                        [0.5, 0.5]), 0.001, 0.01, 0.15, 0.03), 0.15))

    # -- Enemigos que atacan torres --
    def enemy_attack_tower(self):
        return self._get('enemy_atk_tower', lambda: _make_sound(_envelope(
            _mix_layers([_noise(0.1), _sweep(400, 200, 0.1)],
                        [0.6, 0.5]), 0.001, 0.02, 0.2, 0.04), 0.25))

    # -- Jefes --
    def boss_appear(self):
        return self._get('boss_appear', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([
                _sweep(60, 200, 0.8),
                _sweep(80, 250, 0.7),
                _sine(100, 1.0),
                _noise(0.4),
            ], [0.3, 0.3, 0.3, 0.2]), 1500), 0.01, 0.2, 0.6, 0.3), 0.5))

    def boss_attack_dragon_breath(self):
        return self._get('boss_dragon_breath', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([
                _noise(0.4),
                _sweep(100, 60, 0.4),
            ], [0.6, 0.5]), 2000), 0.005, 0.05, 0.5, 0.2), 0.45))

    def boss_attack_frost_nova(self):
        return self._get('boss_frost_nova', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(2000, 3500, 0.3),
                _sweep(1500, 3000, 0.25),
                _sine(2200, 0.4),
            ], [0.3, 0.3, 0.4]), 0.003, 0.05, 0.4, 0.2), 0.4))

    def boss_summon(self):
        return self._get('boss_summon', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(150, 400, 0.3),
                _square(100, 0.2),
                _sine(300, 0.35),
            ], [0.4, 0.3, 0.3]), 0.005, 0.05, 0.5, 0.15), 0.4))

    def boss_enrage(self):
        return self._get('boss_enrage', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(200, 800, 0.3),
                _sweep(300, 1000, 0.25),
                _noise(0.15),
            ], [0.4, 0.3, 0.3]), 0.002, 0.05, 0.5, 0.15), 0.4))

    # -- Castillo --
    def castle_hit(self):
        return self._get('castle_hit', lambda: _make_sound(_envelope(
            _mix_layers([_sweep(200, 80, 0.2), _noise(0.15), _sine(100, 0.25)],
                        [0.5, 0.4, 0.3]), 0.001, 0.04, 0.3, 0.1), 0.4))

    def castle_hit_big(self):
        return self._get('castle_hit_big', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(150, 40, 0.3),
                _noise(0.25),
                _sine(60, 0.35),
            ], [0.5, 0.5, 0.3]), 0.001, 0.06, 0.4, 0.15), 0.5))

    def castle_low_hp(self):
        return self._get('castle_low_hp', lambda: _make_sound(_envelope(
            _sine(200, 0.4), 0.005, 0.05, 0.5, 0.2), 0.25))

    # -- Oleadas --
    def wave_start(self):
        return self._get('wave_start', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(300, 600, 0.2),
                _sweep(450, 900, 0.2),
                _sine(600, 0.3),
            ], [0.3, 0.3, 0.4]), 0.005, 0.05, 0.5, 0.15), 0.35))

    def wave_cleared(self):
        return self._get('wave_cleared', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(400, 800, 0.15),
                _sweep(500, 1000, 0.15),
                _sine(700, 0.25),
                _sine(1000, 0.2),
            ], [0.25, 0.25, 0.25, 0.25]), 0.005, 0.04, 0.5, 0.2), 0.35))

    # -- Clima --
    def weather_thunder(self):
        return self._get('weather_thunder', lambda: _make_sound(_envelope(
            _lowpass(_mix_layers([
                _noise(0.6),
                _sweep(100, 30, 0.5),
                _sine(40, 0.7),
            ], [0.5, 0.4, 0.3]), 2000), 0.001, 0.08, 0.6, 0.3), 0.5))

    def weather_lightning_strike(self):
        return self._get('weather_lightning', lambda: _make_sound(_envelope(
            _mix_layers([
                _square(200, 0.1),
                _sweep(3000, 500, 0.08),
                _noise(0.06),
            ], [0.3, 0.5, 0.4]), 0.001, 0.02, 0.3, 0.04), 0.4))

    def weather_wind_gust(self):
        return self._get('weather_wind', lambda: _make_sound(_envelope(
            _lowpass(_noise(0.5), 800), 0.05, 0.1, 0.5, 0.2), 0.15))

    # -- Victoria / Derrota --
    def victory(self):
        return self._get('victory', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(400, 800, 0.3),
                _sweep(500, 1000, 0.3),
                _sweep(600, 1200, 0.3),
                _sine(800, 0.5),
                _sine(1000, 0.4),
            ], [0.2, 0.2, 0.2, 0.2, 0.2]), 0.005, 0.08, 0.6, 0.3), 0.45))

    def defeat(self):
        return self._get('defeat', lambda: _make_sound(_envelope(
            _mix_layers([
                _sweep(400, 150, 0.5),
                _sweep(350, 120, 0.45),
                _sine(200, 0.6),
            ], [0.3, 0.3, 0.4]), 0.005, 0.1, 0.5, 0.3), 0.4))


# ---------------------------------------------------------------------------
#  Sistema de musica procedural
# ---------------------------------------------------------------------------

MUSIC_SR = SAMPLE_RATE


class _MusicGen:
    """Genera loops de musica procedural usando SR bajo para rapidez."""

    def __init__(self):
        self._cache = {}

    def _fast_pad(self, freq, dur, sr=MUSIC_SR):
        """Genera un pad de forma de onda combinada en un solo paso."""
        n = int(sr * dur)
        out = array.array('f', [0.0] * n)
        two_pi = 2.0 * math.pi
        phase1 = 0.0
        phase2 = 0.0
        phase3 = 0.0
        for i in range(n):
            out[i] = (math.sin(phase1) * 0.35 +
                      math.sin(phase2) * 0.25 +
                      math.sin(phase3) * 0.25 +
                      (1.0 if math.sin(phase1) > 0 else -1.0) * 0.15)
            phase1 += two_pi * freq / sr
            phase2 += two_pi * freq * 1.003 / sr
            phase3 += two_pi * freq * 0.498 / sr
        return list(out)

    def _fast_arp(self, notes, note_dur, sr=MUSIC_SR):
        """Arpeggio rapido con envolvente simple."""
        out = []
        att = int(sr * 0.003)
        rel = int(sr * note_dur * 0.3)
        for freq in notes:
            n = int(sr * note_dur)
            for i in range(n):
                if i < att:
                    env = i / att
                elif i > n - rel:
                    env = max(0, (n - i) / rel)
                else:
                    env = 0.7
                out.append(math.sin(2 * math.pi * freq * i / sr) * env)
        return out

    def _make_loop(self, samples):
        """Aplica crossfade y crea Sound."""
        sr = MUSIC_SR
        fade_n = min(len(samples), int(sr * 0.15))
        for i in range(fade_n):
            t = i / fade_n
            samples[i] *= t
            samples[-(i + 1)] *= t
        return _make_sound(samples, 0.3)

    def generate_normal(self):
        if 'normal' not in self._cache:
            chord = self._fast_arp([261, 329, 392, 329] * 3, 0.25)
            pad = self._fast_pad(130, len(chord) / MUSIC_SR)
            mixed = _mix_layers([pad, chord], [0.5, 0.5])
            self._cache['normal'] = self._make_loop(mixed)
        return self._cache['normal']

    def generate_intense(self):
        if 'intense' not in self._cache:
            chord = self._fast_arp([220, 261, 311, 349] * 3, 0.15)
            pad = self._fast_pad(110, len(chord) / MUSIC_SR)
            mixed = _mix_layers([pad, chord], [0.5, 0.5])
            self._cache['intense'] = self._make_loop(mixed)
        return self._cache['intense']

    def generate_boss(self):
        if 'boss' not in self._cache:
            chord = self._fast_arp([196, 233, 277, 311] * 3, 0.12)
            pad = self._fast_pad(98, len(chord) / MUSIC_SR)
            mixed = _mix_layers([pad, chord], [0.5, 0.5])
            self._cache['boss'] = self._make_loop(mixed)
        return self._cache['boss']

    def generate_victory(self):
        if 'victory' not in self._cache:
            notes = [523, 659, 784, 1047, 784, 659, 523, 659] * 2
            arp = self._fast_arp(notes, 0.12)
            pad = self._fast_pad(523, len(arp) / MUSIC_SR)
            mixed = _mix_layers([pad, arp], [0.4, 0.6])
            self._cache['victory'] = self._make_loop(mixed)
        return self._cache['victory']

    def generate_defeat(self):
        if 'defeat' not in self._cache:
            notes = [392, 349, 311, 261, 220, 196, 165, 147] * 2
            arp = self._fast_arp(notes, 0.2)
            pad = self._fast_pad(98, len(arp) / MUSIC_SR)
            mixed = _mix_layers([pad, arp], [0.5, 0.5])
            self._cache['defeat'] = self._make_loop(mixed)
        return self._cache['defeat']

    def generate_ambient_plains(self):
        if 'amb_plains' not in self._cache:
            self._cache['amb_plains'] = _make_sound(
                self._fast_pad(130, 2.0), 0.1)
        return self._cache['amb_plains']

    def generate_ambient_desert(self):
        if 'amb_desert' not in self._cache:
            self._cache['amb_desert'] = _make_sound(
                self._fast_pad(98, 2.0), 0.08)
        return self._cache['amb_desert']

    def generate_ambient_forest(self):
        if 'amb_forest' not in self._cache:
            pad = self._fast_pad(110, 2.0)
            self._cache['amb_forest'] = _make_sound(pad, 0.1)
        return self._cache['amb_forest']

    def generate_ambient_frozen(self):
        if 'amb_frozen' not in self._cache:
            self._cache['amb_frozen'] = _make_sound(
                self._fast_pad(98, 2.0), 0.08)
        return self._cache['amb_frozen']

    def generate_ambient_void(self):
        if 'amb_void' not in self._cache:
            self._cache['amb_void'] = _make_sound(
                self._fast_pad(55, 2.0), 0.1)
        return self._cache['amb_void']


# ---------------------------------------------------------------------------
#  Motor de audio principal
# ---------------------------------------------------------------------------

class AudioEngine:
    def __init__(self):
        self.sfx = _SFXLibrary()
        self.music = _MusicGen()
        self.sfx_volume = 0.7
        self.music_volume = 0.5
        self.master_volume = 0.8
        self.enabled = _audio_ok

        self._sfx_channels = [pygame.mixer.Channel(i) for i in range(SFX_CHANNELS)]
        self._music_channels = [pygame.mixer.Channel(SFX_CHANNELS + i)
                                for i in range(MUSIC_CHANNELS)]
        self._current_music_key = None
        self._current_amb_key = None
        self._current_amb_channel = None

    def _sfx_vol(self):
        return self.sfx_volume * self.master_volume

    def _music_vol(self):
        return self.music_volume * self.master_volume

    # -- Efectos de sonido --

    def play_sfx(self, sound, volume_scale=1.0):
        """Reproduce un efecto de sonido con control de canales."""
        if not self.enabled or sound is None:
            return
        vol = self._sfx_vol() * volume_scale
        vol = max(0.0, min(1.0, vol))
        for ch in self._sfx_channels:
            if not ch.get_busy():
                ch.play(sound, loops=0)
                ch.set_volume(vol, vol)
                return
        ch = random.choice(self._sfx_channels)
        ch.play(sound, loops=0)
        ch.set_volume(vol, vol)

    def play_sfx_pitched(self, sound, pitch_var=0.1, volume_scale=1.0):
        """Reproduce un sonido con variacion aleatoria de pitch."""
        if not self.enabled or sound is None:
            return
        vol = self._sfx_vol() * volume_scale
        vol = max(0.0, min(1.0, vol))
        for ch in self._sfx_channels:
            if not ch.get_busy():
                ch.play(sound, loops=0)
                ch.set_volume(vol, vol)
                return
        ch.play(sound, loops=0)
        ch.set_volume(vol, vol)

    # -- Musica --

    def play_music(self, key):
        """Reproduce musica por clave ('normal','intense','boss','victory','defeat')."""
        if not self.enabled:
            return
        if self._current_music_key == key:
            return
        self._current_music_key = key
        generators = {
            'normal': self.music.generate_normal,
            'intense': self.music.generate_intense,
            'boss': self.music.generate_boss,
            'victory': self.music.generate_victory,
            'defeat': self.music.generate_defeat,
        }
        gen = generators.get(key)
        if gen is None:
            self.stop_music()
            return
        sound = gen()
        if sound is None:
            return
        for i, ch in enumerate(self._music_channels):
            ch.play(sound, loops=-1)
            ch.set_volume(self._music_vol() * (0.7 if i > 0 else 1.0))

    def stop_music(self):
        """Detiene toda la musica."""
        self._current_music_key = None
        for ch in self._music_channels:
            ch.fadeout(500)

    def set_music_volume(self, vol):
        self.music_volume = max(0.0, min(1.0, vol))
        for ch in self._music_channels:
            ch.set_volume(self._music_vol())

    # -- Ambiente --

    def play_ambient(self, key, map_theme='plains'):
        """Reproduce sonido ambiente segun el tema del mapa."""
        if not self.enabled:
            return
        amb_key = f'{key}_{map_theme}'
        if self._current_amb_key == amb_key:
            return
        self._current_amb_key = amb_key
        if self._current_amb_channel and self._current_amb_channel.get_busy():
            self._current_amb_channel.fadeout(1000)
        generators = {
            'plains': self.music.generate_ambient_plains,
            'desert': self.music.generate_ambient_desert,
            'forest': self.music.generate_ambient_forest,
            'frozen': self.music.generate_ambient_frozen,
            'void': self.music.generate_ambient_void,
        }
        gen = generators.get(map_theme, self.music.generate_ambient_plains)
        sound = gen()
        if sound is None:
            return
        for ch in self._music_channels:
            if not ch.get_busy():
                self._current_amb_channel = ch
                ch.play(sound, loops=-1)
                ch.set_volume(self._music_vol() * 0.3)
                return

    def stop_ambient(self):
        if self._current_amb_channel:
            self._current_amb_channel.fadeout(1000)
        self._current_amb_key = None

    def change_weather_sounds(self, weather_type, map_theme='plains'):
        """Cambia los sonidos ambiente segun el clima."""
        if weather_type in ('rain', 'storm'):
            self.play_ambient('rain', map_theme)
        elif weather_type == 'snow':
            self.play_ambient('frozen', map_theme)
        else:
            self.play_ambient('normal', map_theme)

    # -- Volumen general --

    def set_sfx_volume(self, vol):
        self.sfx_volume = max(0.0, min(1.0, vol))

    def set_master_volume(self, vol):
        self.master_volume = max(0.0, min(1.0, vol))
        self.set_music_volume(self.music_volume)

    def toggle(self):
        """Activa/desactiva todo el audio."""
        self.enabled = not self.enabled
        if not self.enabled:
            self.stop_music()
            self.stop_ambient()
            for ch in self._sfx_channels:
                ch.stop()


# ---------------------------------------------------------------------------
#  Instancia global
# ---------------------------------------------------------------------------
AUDIO = AudioEngine()


# ---------------------------------------------------------------------------
#  Funciones de conveniencia (API para principiantes)
# ---------------------------------------------------------------------------

def play_sound(sound_name, volume=1.0):
    """
    Reproduce un efecto de sonido por nombre.

    Ejemplos:
        play_sound('tower_build')
        play_sound('enemy_hurt')
        play_sound('boss_appear')
    """
    s = getattr(AUDIO.sfx, sound_name, None)()
    AUDIO.play_sfx(s, volume)


def play_music(track_name):
    """
    Reproduce musica de fondo por nombre.

    Tracks disponibles: 'normal', 'intense', 'boss', 'victory', 'defeat'
    """
    AUDIO.play_music(track_name)


def stop_music():
    """Detiene la musica de fondo."""
    AUDIO.stop_music()


def change_weather_sounds(weather_type, map_theme='plains'):
    """Cambia sonidos ambiente segun el clima."""
    AUDIO.change_weather_sounds(weather_type, map_theme)


def play_ambient(map_theme):
    """Reproduce sonido ambiente del mapa."""
    AUDIO.play_ambient('normal', map_theme)


def set_sfx_volume(vol):
    """Establece el volumen de efectos de sonido (0.0 a 1.0)."""
    AUDIO.set_sfx_volume(vol)


def set_music_volume(vol):
    """Establece el volumen de musica (0.0 a 1.0)."""
    AUDIO.set_music_volume(vol)


def set_master_volume(vol):
    """Establece el volumen maestro (0.0 a 1.0)."""
    AUDIO.set_master_volume(vol)
