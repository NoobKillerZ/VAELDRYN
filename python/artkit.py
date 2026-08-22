import pygame
import pygame.gfxdraw
import math
import copy

TWO_PI = 6.283185307
_ALPHA_LAYERS = {}


def _get_alpha_layer(w, h):
    key = (w, h)
    s = _ALPHA_LAYERS.get(key)
    if s is None:
        if len(_ALPHA_LAYERS) > 256:
            _ALPHA_LAYERS.clear()
        s = pygame.Surface((w, h), pygame.SRCALPHA)
        _ALPHA_LAYERS[key] = s
    else:
        s.fill((0, 0, 0, 0))
    return s


def _clip_bbox(pts, surface, pad):
    minx = miny = 1e18
    maxx = maxy = -1e18
    for px, py in pts:
        if px < minx:
            minx = px
        if px > maxx:
            maxx = px
        if py < miny:
            miny = py
        if py > maxy:
            maxy = py
    x0 = int(minx) - pad
    y0 = int(miny) - pad
    x1 = int(maxx) + pad + 1
    y1 = int(maxy) + pad + 1
    if x1 <= 0 or y1 <= 0:
        return None
    sw, sh = surface.get_size()
    if x0 < 0:
        x0 = 0
    if y0 < 0:
        y0 = 0
    if x1 > sw:
        x1 = sw
    if y1 > sh:
        y1 = sh
    if x1 <= x0 or y1 <= y0:
        return None
    return (x0, y0, x1 - x0, y1 - y0)


def _blend_poly(surface, pts, col):
    if len(pts) < 3:
        return
    bbox = _clip_bbox(pts, surface, 2)
    if not bbox:
        return
    s = _get_alpha_layer(bbox[2], bbox[3])
    ipts = [(int(px) - bbox[0], int(py) - bbox[1]) for px, py in pts]
    if len(col) == 3:
        col = (col[0], col[1], col[2], 255)
    try:
        pygame.gfxdraw.filled_polygon(s, ipts, col)
        pygame.gfxdraw.aapolygon(s, ipts, col)
    except Exception:
        return
    surface.blit(s, (bbox[0], bbox[1]))


def _blend_ellipse(surface, cx, cy, rx, ry, col, width=0):
    rx = int(rx)
    ry = int(ry)
    if rx < 1 or ry < 1:
        return
    bbox = _clip_bbox([(cx - rx, cy - ry), (cx + rx, cy + ry)], surface, 2)
    if not bbox:
        return
    s = _get_alpha_layer(bbox[2], bbox[3])
    lcx = int(cx) - bbox[0]
    lcy = int(cy) - bbox[1]
    if len(col) == 3:
        col = (col[0], col[1], col[2], 255)
    try:
        if width <= 0:
            pygame.gfxdraw.filled_ellipse(s, lcx, lcy, rx, ry, col)
            pygame.gfxdraw.aaellipse(s, lcx, lcy, rx, ry, col)
        else:
            pygame.draw.ellipse(s, col, pygame.Rect(lcx - rx, lcy - ry, rx * 2, ry * 2), int(width))
    except Exception:
        return
    surface.blit(s, (bbox[0], bbox[1]))


def _blend_line(surface, p1, p2, col, w):
    bbox = _clip_bbox([p1, p2], surface, int(w) + 2)
    if not bbox:
        return
    s = _get_alpha_layer(bbox[2], bbox[3])
    if len(col) == 3:
        col = (col[0], col[1], col[2], 255)
    try:
        pygame.draw.line(s, col,
                         (int(p1[0]) - bbox[0], int(p1[1]) - bbox[1]),
                         (int(p2[0]) - bbox[0], int(p2[1]) - bbox[1]), int(w))
    except Exception:
        return
    surface.blit(s, (bbox[0], bbox[1]))

_HEX_CACHE = {}


def hex2rgb(h):
    if isinstance(h, (tuple, list)):
        return tuple(int(v) for v in h[:3])
    cached = _HEX_CACHE.get(h)
    if cached is not None:
        return cached
    s = str(h)
    if s.startswith('rgb'):
        import re
        m = re.findall(r'[\d.]+', s)
        out = (int(float(m[0])), int(float(m[1])), int(float(m[2])))
    else:
        s = s.replace('#', '')
        if len(s) == 3:
            s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2]
        out = (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    if len(_HEX_CACHE) > 1024:
        _HEX_CACHE.clear()
    _HEX_CACHE[h] = out
    return out

def shade(hex_color, amt):
    if isinstance(hex_color, (tuple, list)):
        r, g, b = hex2rgb(hex_color)
        return (max(0, min(255, r+amt)), max(0, min(255, g+amt)), max(0, min(255, b+amt)))
    if hex_color.startswith('rgb'):
        return hex_color
    r, g, b = hex2rgb(hex_color)
    return (max(0, min(255, r+amt)), max(0, min(255, g+amt)), max(0, min(255, b+amt)))

def rgba(hex_color, a):
    if isinstance(hex_color, (tuple, list)):
        r, g, b = hex2rgb(hex_color)
        return (r, g, b, int(max(0, min(1, a)) * 255))
    if hex_color.startswith('rgb'):
        return hex_color
    r, g, b = hex2rgb(hex_color)
    return (r, g, b, int(a*255))

def mix(a, b, t):
    ca, cb = hex2rgb(a), hex2rgb(b)
    return (int(ca[0]+(cb[0]-ca[0])*t), int(ca[1]+(cb[1]-ca[1])*t), int(ca[2]+(cb[2]-ca[2])*t))

def _parse_color(c):
    if isinstance(c, tuple):
        return c
    return hex2rgb(c)

def _parse_color_a(c):
    if isinstance(c, tuple):
        return c
    return hex2rgb(c) + (255,)

def _quad_bezier(p0, p1, p2, steps=8):
    pts = []
    for i in range(steps+1):
        t = i / steps
        u = 1 - t
        x = u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0]
        y = u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]
        pts.append((x, y))
    return pts

def _arc_points(cx, cy, rx, ry, start_angle, end_angle, steps=16):
    pts = []
    for i in range(steps+1):
        a = start_angle + (end_angle - start_angle) * i / steps
        pts.append((cx + rx*math.cos(a), cy + ry*math.sin(a)))
    return pts

class Ctx:
    def __init__(self, surface):
        self.surface = surface
        self._path = []
        self._fill_color = (0,0,0)
        self._stroke_color = (0,0,0)
        self._line_width = 1
        self._line_cap = 'butt'
        self._line_join = 'miter'
        self._alpha = 1.0
        self._transforms = []
        self._tx = 0
        self._ty = 0
        self._angle = 0
        self._ca = 1.0
        self._sa = 0.0
        self._sx = 1
        self._sy = 1

    def save(self):
        self._transforms.append((self._tx, self._ty, self._angle, self._ca, self._sa, self._sx, self._sy, self._alpha))

    def restore(self):
        if self._transforms:
            self._tx, self._ty, self._angle, self._ca, self._sa, self._sx, self._sy, self._alpha = self._transforms.pop()

    def translate(self, x, y):
        self._tx += x
        self._ty += y

    def rotate(self, a):
        self._angle += a
        self._ca = math.cos(self._angle)
        self._sa = math.sin(self._angle)

    def scale(self, sx, sy=None):
        if sy is None:
            sy = sx
        self._sx *= sx
        self._sy *= sy

    def _apply(self, x, y):
        if self._angle == 0.0:
            if self._sx == 1.0 and self._sy == 1.0:
                return (x + self._tx, y + self._ty)
            return (x * self._sx + self._tx, y * self._sy + self._ty)
        ca, sa = self._ca, self._sa
        cx, cy = x * self._sx, y * self._sy
        rx = cx*ca - cy*sa
        ry = cx*sa + cy*ca
        return (rx + self._tx, ry + self._ty)

    @property
    def globalAlpha(self):
        return self._alpha
    @globalAlpha.setter
    def globalAlpha(self, v):
        self._alpha = max(0, min(1, v))

    def _col_a(self, c):
        if isinstance(c, (_Gradient, _RadialGradient)):
            if c.stops:
                return c.stops[0][1]
            return (128, 128, 128)
        col = _parse_color(c)
        if len(col) == 4:
            a = col[3] / 255.0 * self._alpha
            return (col[0], col[1], col[2], int(a*255))
        else:
            if self._alpha < 1.0:
                return (col[0], col[1], col[2], int(self._alpha*255))
            return col

    def _stroke_col_a(self, c):
        col = _parse_color(c)
        if len(col) == 4:
            a = col[3] / 255.0 * self._alpha
            return (col[0], col[1], col[2], int(a*255))
        else:
            if self._alpha < 1.0:
                return (col[0], col[1], col[2], int(self._alpha*255))
            return col

    def beginPath(self):
        self._path = []

    def moveTo(self, x, y):
        self._path.append(('M', self._apply(x, y)))

    def lineTo(self, x, y):
        self._path.append(('L', self._apply(x, y)))

    def closePath(self):
        self._path.append(('Z',))

    def quadraticCurveTo(self, cpx, cpy, x, y):
        if not self._path:
            return
        start = self._last_point()
        cp = self._apply(cpx, cpy)
        end = self._apply(x, y)
        pts = _quad_bezier(start, cp, end, 8)
        for p in pts[1:]:
            self._path.append(('L', p))

    def _single_full_arc(self):
        if len(self._path) != 1 or self._path[0][0] != 'A':
            return None
        cmd = self._path[0]
        start, end = cmd[4], cmd[5]
        if (end - start) < TWO_PI - 0.001:
            return None
        return cmd

    def fill(self):
        fc = self._fill_color
        if isinstance(fc, (_Gradient, _RadialGradient)):
            _fill_gradient(self, fc)
            return
        arc_cmd = self._single_full_arc()
        if arc_cmd is not None:
            col = self._col_a(fc)
            if len(col) == 3 or col[3] >= 255:
                try:
                    pygame.gfxdraw.filled_ellipse(self.surface, int(arc_cmd[1][0]), int(arc_cmd[1][1]),
                                                   max(1, int(arc_cmd[2])), max(1, int(arc_cmd[3])), (col[0], col[1], col[2]))
                    pygame.gfxdraw.aaellipse(self.surface, int(arc_cmd[1][0]), int(arc_cmd[1][1]),
                                             max(1, int(arc_cmd[2])), max(1, int(arc_cmd[3])), (col[0], col[1], col[2]))
                except Exception:
                    pass
                return
            if len(col) == 4:
                _blend_ellipse(self.surface, arc_cmd[1][0], arc_cmd[1][1], arc_cmd[2], arc_cmd[3], col)
                return
        pts = self._get_polygon()
        if len(pts) < 3:
            return
        col = self._col_a(fc)
        try:
            if len(col) == 4 and col[3] < 255:
                _blend_poly(self.surface, pts, col)
            else:
                ipts = [(int(px), int(py)) for px, py in pts]
                c3 = (col[0], col[1], col[2])
                pygame.gfxdraw.filled_polygon(self.surface, ipts, c3)
                pygame.gfxdraw.aapolygon(self.surface, ipts, c3)
        except (ValueError, OverflowError):
            pass

    def stroke(self):
        arc_cmd = self._single_full_arc()
        if arc_cmd is not None:
            col = self._stroke_col_a(self._stroke_color)
            w = max(1, int(self._line_width))
            if len(col) == 4 and col[3] < 255:
                _blend_ellipse(self.surface, arc_cmd[1][0], arc_cmd[1][1], arc_cmd[2], arc_cmd[3], col, w)
            else:
                try:
                    rect = pygame.Rect(int(arc_cmd[1][0] - arc_cmd[2]), int(arc_cmd[1][1] - arc_cmd[3]),
                                       int(arc_cmd[2] * 2), int(arc_cmd[3] * 2))
                    pygame.draw.ellipse(self.surface, col[:3], rect, w)
                except Exception:
                    pass
            return
        pts = self._get_polygon()
        if len(pts) < 2:
            return
        col = self._stroke_col_a(self._stroke_color)
        w = max(1, int(self._line_width))
        if len(pts) >= 3 and self._path and self._path[-1][0] == 'Z':
            pts_closed = pts + [pts[0]]
        else:
            pts_closed = pts
        try:
            if len(col) == 4 and col[3] < 255:
                bbox = _clip_bbox(pts_closed, self.surface, w + 2)
                if not bbox:
                    return
                s = _get_alpha_layer(bbox[2], bbox[3])
                for i in range(len(pts_closed) - 1):
                    pygame.draw.line(s, col,
                                     (int(pts_closed[i][0]) - bbox[0], int(pts_closed[i][1]) - bbox[1]),
                                     (int(pts_closed[i + 1][0]) - bbox[0], int(pts_closed[i + 1][1]) - bbox[1]), w)
                self.surface.blit(s, (bbox[0], bbox[1]))
            else:
                for i in range(len(pts_closed) - 1):
                    pygame.draw.line(self.surface, col[:3], _int(pts_closed[i]), _int(pts_closed[i + 1]), w)
        except (ValueError, OverflowError):
            pass

    def arc(self, cx, cy, r, start, end):
        p = self._apply(cx, cy)
        self._path.append(('A', p, r * self._sx, r * self._sy, start, end))

    def ellipse(self, cx, cy, rx, ry, rotation=0, start=0, end=TWO_PI):
        p = self._apply(cx, cy)
        if abs(rotation) < 0.001 and abs(start) < 0.001 and abs(end - TWO_PI) < 0.001:
            fc = self._fill_color
            if isinstance(fc, (_Gradient, _RadialGradient)):
                _fill_gradient(self, fc)
                return
            col = self._col_a(fc)
            try:
                if len(col) == 4 and col[3] < 255:
                    _blend_ellipse(self.surface, p[0], p[1], rx * self._sx, ry * self._sy, col)
                else:
                    irx = max(1, int(rx * self._sx))
                    iry = max(1, int(ry * self._sy))
                    icx = int(p[0])
                    icy = int(p[1])
                    c3 = (col[0], col[1], col[2])
                    pygame.gfxdraw.filled_ellipse(self.surface, icx, icy, irx, iry, c3)
                    pygame.gfxdraw.aaellipse(self.surface, icx, icy, irx, iry, c3)
            except (ValueError, OverflowError):
                pass
        else:
            pts = []
            steps = 20
            for i in range(steps+1):
                a = start + (end - start) * i / steps
                x = rx * math.cos(a)
                y = ry * math.sin(a)
                if abs(rotation) > 0.001:
                    ca, sa = math.cos(rotation), math.sin(rotation)
                    x2 = x*ca - y*sa
                    y2 = x*sa + y*ca
                    x, y = x2, y2
                pts.append((x + p[0], y + p[1]))
            self._path.extend([('M', pts[0])] + [('L', p2) for p2 in pts[1:]])

    def fillRect(self, x, y, w, h):
        p = self._apply(x, y)
        fc = self._fill_color
        if isinstance(fc, (_Gradient, _RadialGradient)):
            _fill_gradient(self, fc)
            return
        col = self._col_a(fc)
        rect = pygame.Rect(int(p[0]), int(p[1]), int(w * self._sx), int(h * self._sy))
        rect = rect.clip(self.surface.get_rect())
        if rect.width <= 0 or rect.height <= 0:
            return
        try:
            if len(col) == 4 and col[3] < 255:
                s = _get_alpha_layer(rect.width, rect.height)
                pygame.draw.rect(s, col, pygame.Rect(0, 0, rect.width, rect.height))
                self.surface.blit(s, (rect.x, rect.y))
            else:
                pygame.draw.rect(self.surface, col[:3], rect)
        except (ValueError, OverflowError):
            pass

    def strokeRect(self, x, y, w, h):
        p = self._apply(x, y)
        col = self._stroke_col_a(self._stroke_color)
        rect = pygame.Rect(p[0], p[1], w*self._sx, h*self._sy)
        try:
            pygame.draw.rect(self.surface, col[:3], rect, max(1, int(self._line_width)))
        except (ValueError, OverflowError):
            pass

    def createLinearGradient(self, x0, y0, x1, y1):
        return _Gradient(x0, y0, x1, y1)

    def createRadialGradient(self, x0, y0, r0, x1, y1, r1):
        return _RadialGradient(x0, y0, r0, x1, y1, r1)

    def _get_polygon(self):
        pts = []
        for cmd in self._path:
            if cmd[0] in ('M', 'L'):
                pts.append(cmd[1])
            elif cmd[0] == 'A':
                pts.extend(_arc_points(cmd[1][0], cmd[1][1], cmd[2], cmd[3], cmd[4], cmd[5], 16))
        return pts

    def _last_point(self):
        for cmd in reversed(self._path):
            if cmd[0] in ('M', 'L'):
                return cmd[1]
            if cmd[0] == 'A':
                return (cmd[1][0] + cmd[2] * math.cos(cmd[5]),
                        cmd[1][1] + cmd[3] * math.sin(cmd[5]))
        return (0, 0)

    @property
    def fillStyle(self):
        return self._fill_color

    @fillStyle.setter
    def fillStyle(self, val):
        if isinstance(val, str):
            self._fill_color = hex2rgb(val)
        else:
            self._fill_color = val

    @property
    def strokeStyle(self):
        return self._stroke_color

    @strokeStyle.setter
    def strokeStyle(self, val):
        if isinstance(val, str):
            self._stroke_color = hex2rgb(val)
        else:
            self._stroke_color = val

    @property
    def lineWidth(self):
        return self._line_width

    @lineWidth.setter
    def lineWidth(self, val):
        self._line_width = val

    @property
    def lineCap(self):
        return self._line_cap

    @lineCap.setter
    def lineCap(self, val):
        self._line_cap = val

    @property
    def lineJoin(self):
        return self._line_join

    @lineJoin.setter
    def lineJoin(self, val):
        self._line_join = val

def _int(p):
    return (int(p[0]), int(p[1]))

class _Gradient:
    def __init__(self, x0, y0, x1, y1):
        self.stops = []
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
    def addColorStop(self, offset, color):
        self.stops.append((offset, _parse_color(color)))

class _RadialGradient:
    def __init__(self, x0, y0, r0, x1, y1, r1):
        self.stops = []
        self.cx, self.cy, self.r0, self.r1 = x0, y0, r0, r1
    def addColorStop(self, offset, color):
        self.stops.append((offset, _parse_color(color)))


def _to_rgba(c):
    col = _parse_color(c)
    if len(col) == 3:
        return (col[0], col[1], col[2], 255)
    return (col[0], col[1], col[2], col[3])


def _grad_stop_color(g, t):
    stops = g.stops
    if not stops:
        return (128, 128, 128, 255)
    if t <= stops[0][0]:
        return _to_rgba(stops[0][1])
    if t >= stops[-1][0]:
        return _to_rgba(stops[-1][1])
    for j in range(len(stops) - 1):
        if stops[j][0] <= t <= stops[j + 1][0]:
            span = stops[j + 1][0] - stops[j][0]
            lt = 0.0 if span <= 0 else (t - stops[j][0]) / span
            c0 = _to_rgba(stops[j][1])
            c1 = _to_rgba(stops[j + 1][1])
            return (int(c0[0] + (c1[0] - c0[0]) * lt),
                    int(c0[1] + (c1[1] - c0[1]) * lt),
                    int(c0[2] + (c1[2] - c0[2]) * lt),
                    int(c0[3] + (c1[3] - c0[3]) * lt))
    return _to_rgba(stops[-1][1])


def _fill_gradient(ctx, g):
    if isinstance(g, _RadialGradient):
        p = ctx._apply(g.cx, g.cy)
        steps = 12
        max_r = int(g.r1)
        if max_r < 1:
            return
        for i in range(steps, 0, -1):
            t = i / steps
            r = max(1, int(max_r * t))
            col = _grad_stop_color(g, t)
            if col[3] <= 0:
                continue
            _blend_ellipse(ctx.surface, p[0], p[1], r, r, col)
    elif isinstance(g, _Gradient):
        col = _to_rgba(g.stops[-1][1]) if g.stops else (128, 128, 128, 255)
        p = ctx._apply(g.x0, g.y0)
        w = abs(g.x1 - g.x0) * ctx._sx
        h = abs(g.y1 - g.y0) * ctx._sy
        if w < 1:
            w = 1
        if h < 1:
            h = 1
        rect = pygame.Rect(int(p[0]), int(p[1]), int(w), int(h)).clip(ctx.surface.get_rect())
        if rect.width <= 0 or rect.height <= 0:
            return
        s = _get_alpha_layer(rect.width, rect.height)
        try:
            pygame.draw.rect(s, col, pygame.Rect(0, 0, rect.width, rect.height))
        except Exception:
            return
        ctx.surface.blit(s, (rect.x, rect.y))


def _ellipse_on_ctx(ctx, cx, cy, rx, ry, rot, start, end):
    p = ctx._apply(cx, cy)
    pts = []
    steps = 20
    for i in range(steps+1):
        a = start + (end - start) * i / steps
        x = rx * math.cos(a)
        y = ry * math.sin(a)
        if abs(rot) > 0.001:
            ca2, sa2 = math.cos(rot), math.sin(rot)
            x2 = x*ca2 - y*sa2
            y2 = x*sa2 + y*ca2
            x, y = x2, y2
        pts.append((x + p[0], y + p[1]))
    return pts

def _fill_ellipse_direct(ctx, cx, cy, rx, ry, color, alpha=1.0, rotation=0, start_angle=0, end_angle=TWO_PI):
    col = _parse_color(color)
    if len(col) == 4:
        a = col[3] / 255.0 * alpha
        col = (col[0], col[1], col[2], int(max(0, min(1, a)) * 255))
    elif alpha < 1.0:
        col = (col[0], col[1], col[2], int(alpha * 255))
    try:
        if len(col) == 4 and col[3] < 255:
            _blend_ellipse(ctx.surface, cx, cy, rx, ry, col)
        else:
            irx = max(1, int(rx))
            iry = max(1, int(ry))
            c3 = (col[0], col[1], col[2])
            pygame.gfxdraw.filled_ellipse(ctx.surface, int(cx), int(cy), irx, iry, c3)
            pygame.gfxdraw.aaellipse(ctx.surface, int(cx), int(cy), irx, iry, c3)
    except Exception:
        pass

def _stroke_ellipse_direct(ctx, cx, cy, rx, ry, color, width=1, alpha=1.0):
    col = _parse_color(color)
    try:
        if len(col) == 4:
            a = col[3]/255.0 * alpha
            col = (col[0], col[1], col[2], int(a*255))
        elif alpha < 1.0:
            col = (col[0], col[1], col[2], int(alpha*255))
        if isinstance(col, tuple) and len(col) == 4 and col[3] < 255:
            _blend_ellipse(ctx.surface, cx, cy, rx, ry, col, width)
        else:
            rect = pygame.Rect(int(cx-rx), int(cy-ry), int(rx*2), int(ry*2))
            pygame.draw.ellipse(ctx.surface, col[:3] if isinstance(col, tuple) else col, rect, width)
    except Exception:
        pass


def figure(ctx, spec, st):
    r = st['r']
    ctx.save()
    if 'ghost' in st and st['ghost']:
        ctx.globalAlpha = st['ghost']

    if not st.get('flying'):
        ctx.fillStyle = (0,0,0, int(0.18*255))
        ctx.beginPath()
        ctx.ellipse(0, r*1.22, r*0.55, r*0.14, 0, 0, TWO_PI)
        ctx.fill()
        ctx.fillStyle = (0,0,0, int(0.08*255))
        ctx.beginPath()
        ctx.ellipse(0, r*1.28, r*0.45, r*0.08, 0, 0, TWO_PI)
        ctx.fill()

    skin = spec['skin']
    skinDark = shade(skin, -30)
    skinHi = shade(skin, 18)
    tunic = spec.get('tunic', '#5a4a2a')
    tunicDark = shade(tunic, -34)
    pant = spec.get('pant', '#3a2f22')
    boot = spec.get('boot', '#241d12')
    armor = spec.get('armor')
    armorDark = shade(armor, -40) if armor else None
    trim = spec.get('trim', '#c9a54a')
    headR = spec.get('headR', 0.52)

    walk = st.get('walk', 0)
    atk = st.get('atk', 0) or 0
    sw = math.sin(walk)
    freeze_mult = 0.2 if st.get('freeze') else 1.0
    bob = abs(sw) * -r * 0.12 * freeze_mult
    breath = math.sin(st.get('anim', 0) * 1.35) * r * 0.025
    attackLean = math.sin(min(1, atk) * math.pi) * r * 0.035 if atk > 0.05 else 0
    hipY = r * 0.62 + bob + breath
    shoulderY = r * 0.62 - spec['torso'] * r + bob + breath
    ground = r * 1.25
    lean = sw * 0.04

    ctx.rotate(lean + attackLean)
    ctx.translate(0, bob)

    if spec.get('wings'):
        wc = spec.get('wingCol', '#4a4a52')
        wd = shade(wc, -35)
        flap = st.get('flap', math.sin(walk))
        wing(ctx, -r*0.3, shoulderY, -1, r*1.35, flap, wc, wd)
        wing(ctx, r*0.3, shoulderY, 1, r*1.35, flap, wc, wd)

    legL = ground - hipY
    legShade = shade(pant, -30)
    for side in range(2):
        ph = walk + (math.pi if side else 0)
        sp = math.sin(ph)
        lift_v = max(0, math.cos(ph)) * r * 0.22
        fx = (1 if side else -1) * r * 0.3 + sp * r * 0.14
        fy = ground - lift_v
        kx = fx * 0.45 + sp * r * 0.18
        ky = hipY + legL * 0.52 - lift_v * 0.5
        hipX = (1 if side else -1) * r * 0.26
        taper(ctx, hipX, hipY + r*0.06, kx, ky, r*0.34, r*0.2, pant, legShade)
        taper(ctx, kx, ky, fx, fy - r*0.08, r*0.2, r*0.1, pant, legShade)
        sh = sp * 0.18
        p1 = ctx._apply(fx + sp*r*0.1, fy - r*0.04)
        rect1 = pygame.Rect(p1[0]-r*0.28, p1[1]-r*0.14, r*0.56, r*0.28)
        ctx.fillStyle = boot
        try:
            pygame.draw.ellipse(ctx.surface, _parse_color(boot), rect1)
        except:
            pass
        p2 = ctx._apply(fx + sp*r*0.1, fy - r*0.08)
        rect2 = pygame.Rect(p2[0]-r*0.13, p2[1]-r*0.06, r*0.26, r*0.12)
        try:
            pygame.draw.ellipse(ctx.surface, _parse_color(shade(boot, 22)), rect2)
        except:
            pass

    bodyW = spec.get('bodyW', 0.85)
    if spec.get('body') == 'robe':
        pts = []
        pts.append(ctx._apply(-r*0.55, shoulderY - r*0.1))
        pts.append(ctx._apply(r*0.55, shoulderY - r*0.1))
        pts.extend(_quad_bezier(ctx._apply(r*0.55, shoulderY-r*0.1), ctx._apply(r*0.75, hipY), ctx._apply(r*0.85, ground), 6))
        pts.extend(_quad_bezier(ctx._apply(r*0.85, ground), ctx._apply(0, ground+r*0.12), ctx._apply(-r*0.85, ground), 6))
        pts.extend(_quad_bezier(ctx._apply(-r*0.85, ground), ctx._apply(-r*0.75, hipY), ctx._apply(-r*0.55, shoulderY-r*0.1), 6))
        try:
            pygame.draw.polygon(ctx.surface, _parse_color(tunic), [(int(x),int(y)) for x,y in pts])
        except:
            pass
        try:
            pygame.draw.polygon(ctx.surface, (18,12,18), [(int(x),int(y)) for x,y in pts], max(1, int(r*0.055)))
        except:
            pass
        robe_fold_col = _parse_color(tunicDark)
        for fi in range(3):
            fx_f = -r*0.35 + fi * r*0.35
            p0 = ctx._apply(fx_f, shoulderY+r*0.1)
            p1 = ctx._apply(fx_f + r*0.05, ground - r*0.15)
            try:
                pygame.draw.line(ctx.surface, (robe_fold_col[0],robe_fold_col[1],robe_fold_col[2],int(0.2*255)), _int(p0), _int(p1), 1)
            except: pass
    else:
        pts = []
        pts.append(ctx._apply(-r*0.6, shoulderY - r*0.06))
        pts.extend(_quad_bezier(ctx._apply(-r*0.6, shoulderY-r*0.06), ctx._apply(-r*0.64, shoulderY+r*0.2), ctx._apply(-r*bodyW*0.42, hipY), 5))
        pts.append(ctx._apply(r*bodyW*0.42, hipY))
        pts.extend(_quad_bezier(ctx._apply(r*bodyW*0.42, hipY), ctx._apply(r*0.64, shoulderY+r*0.2), ctx._apply(r*0.6, shoulderY-r*0.06), 5))
        pts.extend(_quad_bezier(ctx._apply(r*0.6, shoulderY-r*0.06), ctx._apply(r*0.38, shoulderY-r*0.24), ctx._apply(0, shoulderY-r*0.22), 4))
        pts.extend(_quad_bezier(ctx._apply(0, shoulderY-r*0.22), ctx._apply(-r*0.38, shoulderY-r*0.24), ctx._apply(-r*0.6, shoulderY-r*0.06), 4))
        try:
            pygame.draw.polygon(ctx.surface, _parse_color(tunic), [(int(x),int(y)) for x,y in pts])
        except:
            pass
        try:
            pygame.draw.polygon(ctx.surface, (18,12,12), [(int(x),int(y)) for x,y in pts], max(1, int(r*0.055)))
        except:
            pass
        p = ctx._apply(-r*0.52, shoulderY+r*0.04)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(tunic, 10)), (int(p[0]),int(p[1])), int(r*0.2))
        except: pass
        p = ctx._apply(r*0.52, shoulderY+r*0.04)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(tunic, 10)), (int(p[0]),int(p[1])), int(r*0.2))
        except: pass

        belt = spec.get('belt', '#2e2010')
        belt_pts = []
        belt_pts.append(ctx._apply(-r*bodyW*0.42, hipY - r*0.12))
        belt_pts.extend(_quad_bezier(ctx._apply(-r*bodyW*0.42, hipY-r*0.12), ctx._apply(0, hipY-r*0.19), ctx._apply(r*bodyW*0.42, hipY-r*0.12), 4))
        belt_pts.append(ctx._apply(r*bodyW*0.4, hipY + r*0.07))
        belt_pts.extend(_quad_bezier(ctx._apply(r*bodyW*0.4, hipY+r*0.07), ctx._apply(0, hipY+r*0.13), ctx._apply(-r*bodyW*0.4, hipY+r*0.07), 4))
        try:
            pygame.draw.polygon(ctx.surface, _parse_color(belt), [(int(x),int(y)) for x,y in belt_pts])
        except:
            pass

        if spec.get('skirt'):
            sp_pts = [ctx._apply(-r*0.42, hipY), ctx._apply(r*0.42, hipY), ctx._apply(r*0.32, ground), ctx._apply(-r*0.32, ground)]
            try:
                pygame.draw.polygon(ctx.surface, _parse_color(spec['skirt']), [(int(x),int(y)) for x,y in sp_pts])
            except:
                pass

    if spec.get('armor') and armor:
        ag = _parse_color(armor)
        ag_pts = []
        ag_pts.append(ctx._apply(-r*0.5, shoulderY-r*0.02))
        ag_pts.extend(_quad_bezier(ctx._apply(-r*0.5, shoulderY-r*0.02), ctx._apply(-r*0.55, shoulderY+r*0.35), ctx._apply(-r*0.34, hipY-r*0.06), 5))
        ag_pts.append(ctx._apply(r*0.34, hipY-r*0.06))
        ag_pts.extend(_quad_bezier(ctx._apply(r*0.34, hipY-r*0.06), ctx._apply(r*0.55, shoulderY+r*0.35), ctx._apply(r*0.5, shoulderY-r*0.02), 5))
        try:
            pygame.draw.polygon(ctx.surface, ag, [(int(x),int(y)) for x,y in ag_pts])
        except:
            pass
        try:
            pygame.draw.polygon(ctx.surface, (12,12,18), [(int(x),int(y)) for x,y in ag_pts], max(1, int(r*0.05)))
        except:
            pass

        for rv in [-1, 1]:
            p = ctx._apply(rv*r*0.36, shoulderY+r*0.3)
            try: pygame.draw.circle(ctx.surface, _parse_color(trim), (int(p[0]),int(p[1])), 2)
            except: pass

        p = ctx._apply(-r*0.52, shoulderY)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armor, -16)), (int(p[0]),int(p[1])), int(r*0.22))
        except: pass
        p = ctx._apply(r*0.52, shoulderY)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armor, -16)), (int(p[0]),int(p[1])), int(r*0.22))
        except: pass
        p = ctx._apply(-r*0.52, shoulderY)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armor, 26)), (int(p[0]),int(p[1])), int(r*0.12))
        except: pass
        p = ctx._apply(r*0.52, shoulderY)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armor, 26)), (int(p[0]),int(p[1])), int(r*0.12))
        except: pass

    armCol = spec.get('sleeve', skin)
    for a in range(2):
        aph = walk + (math.pi if a else 0)
        asp = math.sin(aph)
        ax = (1 if a else -1) * r * 0.52
        attackReach = math.sin(min(1, atk) * math.pi) if (a == 1 and atk > 0.05) else 0
        handY = shoulderY + r*0.58 + asp*r*0.18 - attackReach*r*0.12
        handX = ax + asp*r*0.14 + attackReach*r*0.18
        elbowX = ax*0.82 + asp*r*0.08 + attackReach*r*0.08
        elbowY = shoulderY + r*0.26 - attackReach*r*0.06
        taper(ctx, ax, shoulderY, elbowX, elbowY, r*0.26, r*0.18, armCol, shade(armCol, -26))
        taper(ctx, elbowX, elbowY, handX, handY, r*0.18, r*0.11, armCol, shade(armCol, -34))
        p = ctx._apply(handX, handY)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armCol, 18)), (int(p[0]),int(p[1])), int(r*0.13))
        except: pass
        p2 = ctx._apply(handX - r*0.02, handY - r*0.02)
        try: pygame.draw.circle(ctx.surface, _parse_color(shade(armCol, 30)), (int(p2[0]),int(p2[1])), int(r*0.05))
        except: pass

    headY = shoulderY - r*0.35 - headR*r*0.6 - (r*0.025 if atk > 0.35 else 0)
    drawHead(ctx, spec, headY, headR, skin, skinDark, st)

    p = ctx._apply(0, headY)
    try:
        pygame.draw.arc(ctx.surface, (255,246,220,40), pygame.Rect(p[0]-headR*r*0.85, p[1]-headR*r*0.85, headR*r*1.7, headR*r*1.7), math.pi*1.02, math.pi*1.55, max(1,int(r*0.05)))
    except:
        pass

    if spec.get('cape'):
        cape_pts = []
        cape_pts.append(ctx._apply(-r*0.42, shoulderY-r*0.02))
        cape_pts.extend(_quad_bezier(ctx._apply(-r*0.42, shoulderY-r*0.02), ctx._apply(-r*0.72, shoulderY+r*0.5), ctx._apply(-r*0.6, ground), 5))
        cape_pts.append(ctx._apply(-r*0.3, ground+r*0.05))
        cape_pts.extend(_quad_bezier(ctx._apply(-r*0.3, ground+r*0.05), ctx._apply(-r*0.35, shoulderY+r*0.4), ctx._apply(-r*0.3, shoulderY), 5))
        try:
            pygame.draw.polygon(ctx.surface, _parse_color(spec['cape']), [(int(x),int(y)) for x,y in cape_pts])
        except:
            pass
        cape_col = _parse_color(spec['cape'])
        cape_dark = _parse_color(shade(spec['cape'], -30))
        for cf in range(2):
            cx = -r*0.4 - cf * r*0.12
            cp0 = ctx._apply(cx, shoulderY + r*0.1)
            cp1 = ctx._apply(cx - r*0.08, ground - r*0.1)
            try:
                pygame.draw.line(ctx.surface, (cape_dark[0],cape_dark[1],cape_dark[2],int(0.15*255)), _int(cp0), _int(cp1), 1)
            except: pass

    if spec.get('weapon'):
        drawWeapon(ctx, spec, r, shoulderY, walk, atk, st)

    ctx.restore()


def drawHead(ctx, spec, headY, headR, skin, skinDark, st):
    r = st['r']
    head = spec.get('head', 'human')
    hy = headY
    anim = st.get('anim', 0)

    if head in ('skull', 'rot'):
        s = headR * r
        pts = []
        pts.append(ctx._apply(-s*0.8, hy))
        pts.extend(_quad_bezier(ctx._apply(-s*0.8, hy), ctx._apply(-s*0.9, hy-s*0.95), ctx._apply(0, hy-s), 5))
        pts.extend(_quad_bezier(ctx._apply(0, hy-s), ctx._apply(s*0.9, hy-s*0.95), ctx._apply(s*0.8, hy), 5))
        pts.append(ctx._apply(s*0.55, hy+s*0.75))
        pts.append(ctx._apply(-s*0.55, hy+s*0.75))
        try: pygame.draw.polygon(ctx.surface, _parse_color(skin), [(int(x),int(y)) for x,y in pts])
        except: pass
        try: pygame.draw.polygon(ctx.surface, (20,16,14), [(int(x),int(y)) for x,y in pts], max(1, int(r*0.05)))
        except: pass

        rect = pygame.Rect(-s*0.55, hy+s*0.4, s*1.1, s*0.38)
        rect2 = ctx._apply(-s*0.55, hy+s*0.4)
        rect2 = pygame.Rect(rect2[0], rect2[1], s*1.1, s*0.38)
        try: pygame.draw.rect(ctx.surface, _parse_color(shade(skin, -18)), rect2)
        except: pass

        for ex, ey_off in [(-0.32, -0.2), (0.32, -0.2)]:
            p = ctx._apply(ex*s, hy + ey_off*s)
            rect = pygame.Rect(p[0]-s*0.2, p[1]-s*0.24, s*0.4, s*0.48)
            try: pygame.draw.ellipse(ctx.surface, (26,20,16), rect)
            except: pass

        if st.get('enraged') or spec.get('eyeGlow'):
            ecol = spec.get('eyeCol', '#e83838')
            for ex, ey_off in [(-0.32, -0.2), (0.32, -0.2)]:
                p = ctx._apply(ex*s, hy + ey_off*s)
                try: pygame.draw.circle(ctx.surface, _parse_color(ecol), (int(p[0]),int(p[1])), int(s*0.09))
                except: pass

    elif head == 'orc':
        s = headR * r
        skinHi = shade(skin, 16)
        skinLo = shade(skin, -26)

        for side in [-1, 1]:
            ear_pts = [ctx._apply(side*s*0.78, hy-s*0.22), ctx._apply(side*s*1.44, hy-s*0.64), ctx._apply(side*s*0.76, hy-s*0.56)]
            try: pygame.draw.polygon(ctx.surface, _parse_color(skinLo), [(int(x),int(y)) for x,y in ear_pts])
            except: pass
            ear_pts2 = [ctx._apply(side*s*0.78, hy-s*0.26), ctx._apply(side*s*1.3, hy-s*0.58), ctx._apply(side*s*0.76, hy-s*0.5)]
            try: pygame.draw.polygon(ctx.surface, _parse_color(skin), [(int(x),int(y)) for x,y in ear_pts2])
            except: pass

        head_pts = []
        head_pts.append(ctx._apply(-s*0.76, hy-s*0.32))
        head_pts.extend(_quad_bezier(ctx._apply(-s*0.76, hy-s*0.32), ctx._apply(-s*0.82, hy-s*0.95), ctx._apply(0, hy-s), 6))
        head_pts.extend(_quad_bezier(ctx._apply(0, hy-s), ctx._apply(s*0.82, hy-s*0.95), ctx._apply(s*0.76, hy-s*0.32), 6))
        head_pts.extend(_quad_bezier(ctx._apply(s*0.76, hy-s*0.32), ctx._apply(s*0.94, hy+s*0.02), ctx._apply(s*0.68, hy+s*0.3), 5))
        head_pts.append(ctx._apply(s*0.62, hy+s*0.72))
        head_pts.extend(_quad_bezier(ctx._apply(s*0.62, hy+s*0.72), ctx._apply(s*0.32, hy+s*0.94), ctx._apply(0, hy+s*0.94), 5))
        head_pts.extend(_quad_bezier(ctx._apply(0, hy+s*0.94), ctx._apply(-s*0.32, hy+s*0.94), ctx._apply(-s*0.62, hy+s*0.72), 5))
        head_pts.append(ctx._apply(-s*0.68, hy+s*0.3))
        head_pts.extend(_quad_bezier(ctx._apply(-s*0.68, hy+s*0.3), ctx._apply(-s*0.94, hy+s*0.02), ctx._apply(-s*0.76, hy-s*0.32), 5))
        try: pygame.draw.polygon(ctx.surface, _parse_color(skin), [(int(x),int(y)) for x,y in head_pts])
        except: pass
        try: pygame.draw.polygon(ctx.surface, (20,12,8), [(int(x),int(y)) for x,y in head_pts], max(1, int(r*0.05)))
        except: pass

        brow_pts = []
        brow_pts.append(ctx._apply(-s*0.72, hy-s*0.52))
        brow_pts.extend(_quad_bezier(ctx._apply(-s*0.72, hy-s*0.52), ctx._apply(-s*0.3, hy-s*0.66), ctx._apply(0, hy-s*0.58), 4))
        brow_pts.extend(_quad_bezier(ctx._apply(0, hy-s*0.58), ctx._apply(s*0.3, hy-s*0.66), ctx._apply(s*0.72, hy-s*0.52), 4))
        brow_pts.append(ctx._apply(s*0.66, hy-s*0.36))
        brow_pts.extend(_quad_bezier(ctx._apply(s*0.66, hy-s*0.36), ctx._apply(s*0.3, hy-s*0.46), ctx._apply(0, hy-s*0.4), 4))
        brow_pts.extend(_quad_bezier(ctx._apply(0, hy-s*0.4), ctx._apply(-s*0.3, hy-s*0.46), ctx._apply(-s*0.66, hy-s*0.36), 4))
        try: pygame.draw.polygon(ctx.surface, _parse_color(shade(skin, -30)), [(int(x),int(y)) for x,y in brow_pts])
        except: pass

        eye_col = '#ff3a2a' if st.get('enraged') else spec.get('eyeCol', '#e8d42a')
        for ex_off in [-0.3, 0.3]:
            p = ctx._apply(ex_off*s, hy-s*0.31)
            try: pygame.draw.ellipse(ctx.surface, _parse_color(eye_col), pygame.Rect(p[0]-s*0.09, p[1]-s*0.055, s*0.18, s*0.11))
            except: pass
            p2 = ctx._apply(ex_off*s + 0.01*s, hy-s*0.31)
            try: pygame.draw.circle(ctx.surface, (22,10,4), (int(p2[0]),int(p2[1])), int(s*0.028))
            except: pass

        nose_pts = []
        nose_pts.append(ctx._apply(-s*0.18, hy-s*0.12))
        nose_pts.extend(_quad_bezier(ctx._apply(-s*0.18, hy-s*0.12), ctx._apply(0, hy-s*0.02), ctx._apply(s*0.18, hy-s*0.12), 4))
        nose_pts.extend(_quad_bezier(ctx._apply(s*0.18, hy-s*0.12), ctx._apply(s*0.26, hy+s*0.16), ctx._apply(0, hy+s*0.2), 4))
        nose_pts.extend(_quad_bezier(ctx._apply(0, hy+s*0.2), ctx._apply(-s*0.26, hy+s*0.16), ctx._apply(-s*0.18, hy-s*0.12), 4))
        try: pygame.draw.polygon(ctx.surface, _parse_color(shade(skin, -14)), [(int(x),int(y)) for x,y in nose_pts])
        except: pass

        for side2 in [-1, 1]:
            tusk_pts = [ctx._apply(side2*s*0.33, hy+s*0.58), ctx._apply(side2*s*0.25, hy+s*0.22), ctx._apply(side2*s*0.14, hy+s*0.58)]
            try: pygame.draw.polygon(ctx.surface, _parse_color('#efe8ce'), [(int(x),int(y)) for x,y in tusk_pts])
            except: pass

        mouth_line_pts = []
        mouth_line_pts.append(ctx._apply(-s*0.4, hy+s*0.42))
        mouth_line_pts.extend(_quad_bezier(ctx._apply(-s*0.4, hy+s*0.42), ctx._apply(0, hy+s*0.5), ctx._apply(s*0.4, hy+s*0.42), 4))
        for i in range(len(mouth_line_pts)-1):
            try:
                pygame.draw.line(ctx.surface, (24,10,6), _int(mouth_line_pts[i]), _int(mouth_line_pts[i+1]), max(1, int(s*0.05)))
            except: pass

    elif head == 'demon':
        s = headR * r
        d_pts = []
        d_pts.append(ctx._apply(-s*0.8, hy-s*0.1))
        d_pts.extend(_quad_bezier(ctx._apply(-s*0.8, hy-s*0.1), ctx._apply(-s*0.7, hy-s*1.0), ctx._apply(0, hy-s*0.95), 5))
        d_pts.extend(_quad_bezier(ctx._apply(0, hy-s*0.95), ctx._apply(s*0.7, hy-s*1.0), ctx._apply(s*0.8, hy-s*0.1), 5))
        d_pts.extend(_quad_bezier(ctx._apply(s*0.8, hy-s*0.1), ctx._apply(s*0.6, hy+s*0.85), ctx._apply(0, hy+s*0.8), 5))
        d_pts.extend(_quad_bezier(ctx._apply(0, hy+s*0.8), ctx._apply(-s*0.6, hy+s*0.85), ctx._apply(-s*0.8, hy-s*0.1), 5))
        try: pygame.draw.polygon(ctx.surface, _parse_color(skin), [(int(x),int(y)) for x,y in d_pts])
        except: pass
        try: pygame.draw.polygon(ctx.surface, (20,12,8), [(int(x),int(y)) for x,y in d_pts], max(1, int(r*0.05)))
        except: pass

        for side3 in [-1, 1]:
            horn_pts = [ctx._apply(side3*s*0.55, hy-s*0.7), ctx._apply(side3*s*0.8, hy-s*1.7), ctx._apply(side3*s*0.3, hy-s*1.5)]
            horn_pts.extend(_quad_bezier(ctx._apply(side3*s*0.3, hy-s*1.5), ctx._apply(side3*s*0.35, hy-s*1.0), ctx._apply(side3*s*0.4, hy-s*0.7), 4))
            try: pygame.draw.polygon(ctx.surface, _parse_color('#d8cba8'), [(int(x),int(y)) for x,y in horn_pts])
            except: pass

        ecol = '#ff5a2a' if st.get('enraged') else '#ffd24a'
        for ex_off2 in [-0.3, 0.3]:
            p = ctx._apply(ex_off2*s, hy-s*0.25)
            try: pygame.draw.ellipse(ctx.surface, _parse_color(ecol), pygame.Rect(p[0]-s*0.16, p[1]-s*0.1, s*0.32, s*0.2))
            except: pass

        for side4 in [-1, 1]:
            tusk = [ctx._apply(side4*s*0.3, hy+s*0.35), ctx._apply(side4*s*0.18, hy+s*0.6), ctx._apply(side4*s*0.06, hy+s*0.35)]
            try: pygame.draw.polygon(ctx.surface, _parse_color('#f4f0e0'), [(int(x),int(y)) for x,y in tusk])
            except: pass

    elif head == 'hood':
        s = headR * r
        hood_pts = []
        hood_pts.append(ctx._apply(-s*0.9, hy-s*0.1))
        hood_pts.extend(_quad_bezier(ctx._apply(-s*0.9, hy-s*0.1), ctx._apply(-s*0.85, hy-s*1.15), ctx._apply(0, hy-s*1.2), 6))
        hood_pts.extend(_quad_bezier(ctx._apply(0, hy-s*1.2), ctx._apply(s*0.85, hy-s*1.15), ctx._apply(s*0.9, hy-s*0.1), 6))
        hood_pts.extend(_quad_bezier(ctx._apply(s*0.9, hy-s*0.1), ctx._apply(s*0.7, hy+s*0.7), ctx._apply(0, hy+s*0.75), 5))
        hood_pts.extend(_quad_bezier(ctx._apply(0, hy+s*0.75), ctx._apply(-s*0.7, hy+s*0.7), ctx._apply(-s*0.9, hy-s*0.1), 5))
        try: pygame.draw.polygon(ctx.surface, _parse_color(spec.get('hoodCol', '#241a30')), [(int(x),int(y)) for x,y in hood_pts])
        except: pass
        try: pygame.draw.polygon(ctx.surface, (10,6,18), [(int(x),int(y)) for x,y in hood_pts], max(1, int(r*0.05)))
        except: pass

        p = ctx._apply(0, hy-s*0.1)
        try: pygame.draw.ellipse(ctx.surface, (10,6,18), pygame.Rect(p[0]-s*0.5, p[1]-s*0.62, s*1.0, s*1.24))
        except: pass

        ecol2 = spec.get('eyeCol', '#c890ff')
        for ex_off3 in [-0.2, 0.2]:
            p = ctx._apply(ex_off3*s, hy-s*0.15)
            try: pygame.draw.circle(ctx.surface, _parse_color(ecol2), (int(p[0]),int(p[1])), int(s*0.08))
            except: pass
            try: pygame.draw.circle(ctx.surface, rgba(ecol2, 0.4), (int(p[0]),int(p[1])), int(s*0.18))
            except: pass

    else:
        s = headR * r
        face_pts = []
        face_pts.append(ctx._apply(-s*0.82, hy-s*0.12))
        face_pts.extend(_quad_bezier(ctx._apply(-s*0.82, hy-s*0.12), ctx._apply(-s*0.92, hy-s*1.02), ctx._apply(0, hy-s*1.08), 6))
        face_pts.extend(_quad_bezier(ctx._apply(0, hy-s*1.08), ctx._apply(s*0.92, hy-s*1.02), ctx._apply(s*0.82, hy-s*0.12), 6))
        face_pts.extend(_quad_bezier(ctx._apply(s*0.82, hy-s*0.12), ctx._apply(s*0.74, hy+s*0.42), ctx._apply(s*0.44, hy+s*0.68), 5))
        face_pts.extend(_quad_bezier(ctx._apply(s*0.44, hy+s*0.68), ctx._apply(0, hy+s*0.82), ctx._apply(-s*0.44, hy+s*0.68), 5))
        face_pts.extend(_quad_bezier(ctx._apply(-s*0.44, hy+s*0.68), ctx._apply(-s*0.74, hy+s*0.42), ctx._apply(-s*0.82, hy-s*0.12), 5))
        try: pygame.draw.polygon(ctx.surface, _parse_color(skin), [(int(x),int(y)) for x,y in face_pts])
        except: pass
        try: pygame.draw.polygon(ctx.surface, (16,12,12), [(int(x),int(y)) for x,y in face_pts], max(1, int(r*0.05)))
        except: pass

        eyeOpen = 0.16 if st.get('blink') else 1.0
        for ex_off4 in [-0.3, 0.3]:
            p = ctx._apply(ex_off4*s, hy-s*0.22)
            try: pygame.draw.ellipse(ctx.surface, (248,248,244), pygame.Rect(p[0]-s*0.16, p[1]-s*0.13*eyeOpen, s*0.32, s*0.26*eyeOpen))
            except: pass
            ecol3 = spec.get('eyeCol', '#2a2018')
            p2 = ctx._apply(ex_off4*s, hy-s*0.2)
            try: pygame.draw.ellipse(ctx.surface, _parse_color(ecol3), pygame.Rect(p2[0]-s*0.08, p2[1]-s*0.08*eyeOpen, s*0.16, s*0.16*eyeOpen))
            except: pass

        if spec.get('smile'):
            p = ctx._apply(0, hy+s*0.42)
            try: pygame.draw.ellipse(ctx.surface, (42,10,8), pygame.Rect(p[0]-s*0.3, p[1]-s*0.13, s*0.6, s*0.26))
            except: pass

    ctx.restore()


def wing(ctx, x, y, d, length, flap, col, dark):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(d, 1)
    lift = flap * length * 0.26

    ex = length * 0.44
    ey = -length * 0.46 - lift
    t1x = length * 1.05
    t1y = -length * 0.92 - lift * 1.5
    t2x = length * 1.0
    t2y = -length * 0.34 - lift * 0.9
    t3x = length * 0.82
    t3y = length * 0.16 - lift * 0.35
    bx = length * 0.1
    by = length * 0.34

    pts = []
    pts.append(ctx._apply(0, -length*0.04))
    pts.append(ctx._apply(ex, ey))
    pts.append(ctx._apply(t1x, t1y))
    pts.extend(_quad_bezier(ctx._apply(t1x, t1y), ctx._apply(length*0.82, -length*0.44-lift*1.05), ctx._apply(t2x, t2y), 6))
    pts.extend(_quad_bezier(ctx._apply(t2x, t2y), ctx._apply(length*0.74, -length*0.06-lift*0.5), ctx._apply(t3x, t3y), 6))
    pts.extend(_quad_bezier(ctx._apply(t3x, t3y), ctx._apply(length*0.44, length*0.34), ctx._apply(bx, by), 6))
    try:
        pygame.draw.polygon(ctx.surface, _parse_color(col), [(int(px),int(py)) for px,py in pts])
    except: pass
    try:
        pygame.draw.polygon(ctx.surface, _parse_color(dark), [(int(px),int(py)) for px,py in pts], max(1, int(length*0.032)))
    except: pass

    bone_pts = [
        ctx._apply(0, -length*0.04), ctx._apply(ex, ey),
    ]
    for i in range(len(bone_pts)-1):
        try:
            pygame.draw.line(ctx.surface, _parse_color(dark), _int(bone_pts[i]), _int(bone_pts[i+1]), max(1, int(length*0.062)))
        except: pass

    finger_pts = [
        (ctx._apply(ex, ey), ctx._apply(t1x, t1y)),
        (ctx._apply(ex, ey), ctx._apply(t2x, t2y)),
        (ctx._apply(ex, ey), ctx._apply(t3x, t3y)),
    ]
    for fp0, fp1 in finger_pts:
        try:
            pygame.draw.line(ctx.surface, _parse_color(dark), _int(fp0), _int(fp1), max(1, int(length*0.045)))
        except: pass

    p = ctx._apply(ex, ey)
    try: pygame.draw.circle(ctx.surface, _parse_color(shade(dark, 14)), (int(p[0]),int(p[1])), max(2, int(length*0.055)))
    except: pass

    claw_pts = [ctx._apply(ex+length*0.01, ey-length*0.02), ctx._apply(ex+length*0.1, ey-length*0.12), ctx._apply(ex+length*0.04, ey+length*0.03)]
    try: pygame.draw.polygon(ctx.surface, _parse_color(shade(dark, 30)), [(int(px),int(py)) for px,py in claw_pts])
    except: pass

    ctx.restore()


def dragonHead(ctx, r, col, dark, glowCol, jaw):
    ctx.save()
    open_v = max(0, min(1, jaw)) * 0.52

    horn = shade(dark, -12)
    hornHi = shade(dark, 22)

    horn_pts1 = []
    horn_pts1.append(ctx._apply(-r*0.42, -r*0.62))
    horn_pts1.extend(_quad_bezier(ctx._apply(-r*0.42, -r*0.62), ctx._apply(-r*0.85, -r*1.12), ctx._apply(-r*1.42, -r*1.34), 6))
    horn_pts1.extend(_quad_bezier(ctx._apply(-r*1.42, -r*1.34), ctx._apply(-r*0.95, -r*0.98), ctx._apply(-r*0.52, -r*0.42), 6))
    try: pygame.draw.polygon(ctx.surface, _parse_color(horn), [(int(x),int(y)) for x,y in horn_pts1])
    except: pass

    horn_pts2 = []
    horn_pts2.append(ctx._apply(-r*0.02, -r*0.74))
    horn_pts2.extend(_quad_bezier(ctx._apply(-r*0.02, -r*0.74), ctx._apply(-r*0.32, -r*1.18), ctx._apply(-r*0.72, -r*1.38), 6))
    horn_pts2.extend(_quad_bezier(ctx._apply(-r*0.72, -r*1.38), ctx._apply(-r*0.34, -r*1.0), ctx._apply(-r*0.12, -r*0.62), 6))
    try: pygame.draw.polygon(ctx.surface, _parse_color(horn), [(int(x),int(y)) for x,y in horn_pts2])
    except: pass

    for ring_pts in [
        [(-r*0.62, -r*0.86), (-r*0.55, -r*0.78), (-r*0.46, -r*0.7)],
        [(-r*0.82, -r*1.04), (-r*0.74, -r*0.94), (-r*0.63, -r*0.85)],
    ]:
        rp = [ctx._apply(px, py) for px, py in ring_pts]
        for i in range(len(rp)-1):
            try:
                pygame.draw.line(ctx.surface, rgba(hornHi, 0.55), _int(rp[i]), _int(rp[i+1]), max(1, int(r*0.045)))
            except: pass

    cheek_pts = [ctx._apply(-r*0.62, -r*0.1), ctx._apply(-r*1.06, -r*0.34), ctx._apply(-r*0.58, -r*0.3)]
    try: pygame.draw.polygon(ctx.surface, _parse_color(horn), [(int(x),int(y)) for x,y in cheek_pts])
    except: pass
    nasal_pts = [ctx._apply(r*0.98, -r*0.4), ctx._apply(r*1.12, -r*0.62), ctx._apply(r*1.1, -r*0.36)]
    try: pygame.draw.polygon(ctx.surface, _parse_color(horn), [(int(x),int(y)) for x,y in nasal_pts])
    except: pass

    ctx.save()
    ctx.translate(-r*0.05, r*0.16)
    ctx.rotate(open_v)

    jaw_pts = []
    jaw_pts.append(ctx._apply(-r*0.28, r*0.02))
    jaw_pts.extend(_quad_bezier(ctx._apply(-r*0.28, r*0.02), ctx._apply(r*0.35, r*0.22), ctx._apply(r*1.06, r*0.08), 5))
    jaw_pts.extend(_quad_bezier(ctx._apply(r*1.06, r*0.08), ctx._apply(r*1.2, r*0.16), ctx._apply(r*1.05, r*0.26), 5))
    jaw_pts.extend(_quad_bezier(ctx._apply(r*1.05, r*0.26), ctx._apply(r*0.4, r*0.44), ctx._apply(-r*0.2, r*0.34), 5))
    jaw_pts.extend(_quad_bezier(ctx._apply(-r*0.2, r*0.34), ctx._apply(-r*0.34, r*0.18), ctx._apply(-r*0.28, r*0.02), 5))
    try: pygame.draw.polygon(ctx.surface, _parse_color(shade(col, 6)), [(int(x),int(y)) for x,y in jaw_pts])
    except: pass

    for lt in range(3):
        lx = r * (0.4 + lt * 0.28)
        tusk = [ctx._apply(lx-r*0.05, r*0.12), ctx._apply(lx, -r*0.02-(r*0.06 if lt==1 else 0)), ctx._apply(lx+r*0.06, r*0.12)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#f2ecd8'), [(int(x),int(y)) for x,y in tusk])
        except: pass
    ctx.restore()

    skull_pts = []
    skull_pts.append(ctx._apply(-r*0.78, r*0.12))
    skull_pts.extend(_quad_bezier(ctx._apply(-r*0.78, r*0.12), ctx._apply(-r*0.86, -r*0.42), ctx._apply(-r*0.5, -r*0.66), 6))
    skull_pts.extend(_quad_bezier(ctx._apply(-r*0.5, -r*0.66), ctx._apply(-r*0.2, -r*0.84), ctx._apply(r*0.1, -r*0.74), 6))
    skull_pts.extend(_quad_bezier(ctx._apply(r*0.1, -r*0.74), ctx._apply(r*0.22, -r*0.72), ctx._apply(r*0.3, -r*0.62), 4))
    skull_pts.extend(_quad_bezier(ctx._apply(r*0.3, -r*0.62), ctx._apply(r*0.72, -r*0.52), ctx._apply(r*1.08, -r*0.34), 5))
    skull_pts.extend(_quad_bezier(ctx._apply(r*1.08, -r*0.34), ctx._apply(r*1.32, -r*0.24), ctx._apply(r*1.34, -r*0.1), 5))
    skull_pts.extend(_quad_bezier(ctx._apply(r*1.34, -r*0.1), ctx._apply(r*1.3, r*0.02), ctx._apply(r*1.12, r*0.04), 4))
    skull_pts.append(ctx._apply(r*0.28, r*0.1))
    skull_pts.extend(_quad_bezier(ctx._apply(r*0.28, r*0.1), ctx._apply(-r*0.1, r*0.16), ctx._apply(-r*0.3, r*0.34), 4))
    skull_pts.extend(_quad_bezier(ctx._apply(-r*0.3, r*0.34), ctx._apply(-r*0.6, r*0.3), ctx._apply(-r*0.78, r*0.12), 4))
    try: pygame.draw.polygon(ctx.surface, _parse_color(col), [(int(x),int(y)) for x,y in skull_pts])
    except: pass
    try: pygame.draw.polygon(ctx.surface, rgba(dark, 0.55), [(int(x),int(y)) for x,y in skull_pts], max(1, int(r*0.045)))
    except: pass

    for ns in range(3):
        cx_a = r * (0.52 + ns * 0.26)
        cy_a = -r * (0.44 - ns * 0.05)
        p = ctx._apply(cx_a, cy_a)
        try:
            arc_rect = pygame.Rect(p[0]-r*0.12, p[1]-r*0.12, r*0.24, r*0.24)
            pygame.draw.arc(ctx.surface, rgba(dark, 0.3), arc_rect, 3.4, 5.9, max(1, int(r*0.03)))
        except: pass

    if jaw > 0.15:
        mouth_pts = [ctx._apply(r*0.24, r*0.08), ctx._apply(r*1.14, r*0.0), ctx._apply(r*1.05, r*0.1+open_v*r*0.7), ctx._apply(r*0.2, r*0.18+open_v*r*0.5)]
        try: pygame.draw.polygon(ctx.surface, (58,14,8), [(int(x),int(y)) for x,y in mouth_pts])
        except: pass

    for ut in [(0.42, 0.1), (0.66, 0.13), (0.92, 0.2)]:
        ux = r * ut[0]
        ulen = r * ut[1]
        tusk = [ctx._apply(ux-r*0.05, r*0.07), ctx._apply(ux, r*0.07+ulen), ctx._apply(ux+r*0.06, r*0.07)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#f2ecd8'), [(int(x),int(y)) for x,y in tusk])
        except: pass

    glow_c = _parse_color(glowCol if glowCol else '#ffd24a')
    for ex_off in [0.12]:
        p = ctx._apply(ex_off*r, -r*0.34)
        try: pygame.draw.ellipse(ctx.surface, (glow_c[0],glow_c[1],glow_c[2],int(0.35*255)), pygame.Rect(p[0]-r*0.2, p[1]-r*0.13, r*0.4, r*0.26))
        except: pass
        try: pygame.draw.ellipse(ctx.surface, glow_c, pygame.Rect(p[0]-r*0.13, p[1]-r*0.085, r*0.26, r*0.17))
        except: pass
        p2 = ctx._apply(r*0.14, -r*0.34)
        try: pygame.draw.ellipse(ctx.surface, (22,10,4), pygame.Rect(p2[0]-r*0.028, p2[1]-r*0.08, r*0.056, r*0.16))
        except: pass

    p = ctx._apply(r*0.09, -r*0.37)
    try: pygame.draw.circle(ctx.surface, (255,255,255,216), (int(p[0]),int(p[1])), int(r*0.02))
    except: pass

    ctx.restore()


def _draw_eyes(ctx, x1, y1, x2, y2, col, glow):
    c = _parse_color(col)
    try: pygame.draw.circle(ctx.surface, c, (int(x1),int(y1)), 2)
    except: pass
    try: pygame.draw.circle(ctx.surface, c, (int(x2),int(y2)), 2)
    except: pass
    if glow:
        gc = (c[0], c[1], c[2], int(0.4*255))
        try: pygame.draw.circle(ctx.surface, gc, (int(x1),int(y1)), 3)
        except: pass
        try: pygame.draw.circle(ctx.surface, gc, (int(x2),int(y2)), 3)
        except: pass


def drawWeapon(ctx, spec, r, shoulderY, walk, atk, st):
    w = spec['weapon']
    anim = st.get('anim', 0)
    swing = math.sin(walk) * 0.2
    atkSwing = 0
    if atk > 0.05:
        if atk < 0.35: atkSwing = -0.2 + atk/0.35 * -0.8
        elif atk < 0.55: atkSwing = -1.0 + (atk-0.35)/0.2 * 2.2
        elif atk < 0.8: atkSwing = 1.2 - (atk-0.55)/0.25 * 0.6
        else: atkSwing = 0.6 - (atk-0.8)*0.4

    handX = r * 0.45
    handY = shoulderY + r * 0.55 + swing * r * 0.1

    ctx.save()
    p = ctx._apply(handX, handY)
    ctx.translate(p[0], p[1])
    ctx.rotate(0.5 + atkSwing)

    if w == 'club':
        rod(ctx, 0, 0, r*0.5, -r*1.0, r*0.16, '#5a3a1c', '#2e1808')
        try: pygame.draw.circle(ctx.surface, _parse_color('#4a2a14'), _int(ctx._apply(r*0.62, -r*1.15)), int(r*0.24))
        except: pass
        try: pygame.draw.circle(ctx.surface, _parse_color('#6a4624'), _int(ctx._apply(r*0.55, -r*1.2)), int(r*0.12))
        except: pass

    elif w == 'axe':
        rod(ctx, 0, 0, r*0.5, -r*1.0, r*0.17, '#4a2e14', '#241206')
        axe_pts = []
        axe_pts.append(ctx._apply(r*0.55, -r*0.95))
        axe_pts.extend(_quad_bezier(ctx._apply(r*0.55, -r*0.95), ctx._apply(r*0.95, -r*1.05), ctx._apply(r*0.95, -r*0.7), 5))
        axe_pts.extend(_quad_bezier(ctx._apply(r*0.95, -r*0.7), ctx._apply(r*0.8, -r*0.75), ctx._apply(r*0.6, -r*0.62), 5))
        axe_pts.extend(_quad_bezier(ctx._apply(r*0.6, -r*0.62), ctx._apply(r*0.5, -r*0.8), ctx._apply(r*0.55, -r*0.95), 5))
        try: pygame.draw.polygon(ctx.surface, _parse_color('#9a9aa4'), [(int(x),int(y)) for x,y in axe_pts])
        except: pass

    elif w == 'sword':
        rod(ctx, 0, 0, r*0.1, -r*0.5, r*0.12, '#4a2e14', '#241206')
        blade_pts = [ctx._apply(r*0.16, -r*0.55), ctx._apply(r*0.22, -r*1.3), ctx._apply(r*0.1, -r*0.55)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#c9c9d4'), [(int(x),int(y)) for x,y in blade_pts])
        except: pass
        try: pygame.draw.rect(ctx.surface, _parse_color('#ffd24a'), pygame.Rect(ctx._apply(r*0.06, -r*0.6)[0], ctx._apply(r*0.06, -r*0.6)[1], r*0.18, r*0.1))
        except: pass

    elif w == 'dagger':
        blade_pts = [ctx._apply(0, 0), ctx._apply(r*0.5, r*0.05), ctx._apply(r*0.1, -r*0.45)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#8a8a96'), [(int(x),int(y)) for x,y in blade_pts])
        except: pass

    elif w == 'staff':
        rod(ctx, 0, 0, r*0.3, -r*1.5, r*0.16, '#4a3018', '#241206')
        orb_y = -r*1.55 + math.sin(anim*2)*r*0.05
        orb(ctx, r*0.32, orb_y, r*0.26, spec.get('glowCol', '#c890ff'))

    elif w == 'hammer':
        rod(ctx, 0, 0, r*0.5, -r*1.1, r*0.2, '#4a3018', '#241206')
        hammer_pts = [ctx._apply(r*0.55, -r*1.15), ctx._apply(r*1.0, -r*0.95), ctx._apply(r*0.95, -r*0.6), ctx._apply(r*0.5, -r*0.8)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#7a7a86'), [(int(x),int(y)) for x,y in hammer_pts])
        except: pass
        try: pygame.draw.circle(ctx.surface, _parse_color('#9a9aa6'), _int(ctx._apply(r*0.75, -r*0.85)), int(r*0.18))
        except: pass

    elif w == 'torch':
        rod(ctx, 0, 0, r*0.3, -r*1.1, r*0.14, '#5a3a1c', '#2e1808')
        fl = 0.6 + 0.4 * math.sin(anim*8)
        fire_pts = []
        fire_pts.append(ctx._apply(r*0.3, -r*1.2))
        fire_pts.extend(_quad_bezier(ctx._apply(r*0.3, -r*1.2), ctx._apply(r*0.5, -r*1.5), ctx._apply(r*0.3, -r*1.7), 5))
        fire_pts.extend(_quad_bezier(ctx._apply(r*0.3, -r*1.7), ctx._apply(r*0.12, -r*1.5), ctx._apply(r*0.3, -r*1.2), 5))
        try: pygame.draw.polygon(ctx.surface, (255, 160, 40, int((0.5+fl*0.5)*255)), [(int(x),int(y)) for x,y in fire_pts])
        except: pass

    ctx.restore()


def orb(ctx, x, y, r, col, glowCol=None):
    p = ctx._apply(x, y)
    gc = _parse_color(glowCol if glowCol else col)
    max_r = int(r)
    if max_r < 1:
        max_r = 1
    bbox = _clip_bbox([(p[0] - max_r, p[1] - max_r), (p[0] + max_r, p[1] + max_r)], ctx.surface, 2)
    if not bbox:
        return
    s = _get_alpha_layer(bbox[2], bbox[3])
    cx = int(p[0]) - bbox[0]
    cy = int(p[1]) - bbox[1]
    try:
        for i in range(max_r, 0, -1):
            t = i / max_r
            if t > 0.35:
                alpha = int((1 - (t - 0.35) / 0.65) * 200)
                col_i = (gc[0], gc[1], gc[2], alpha)
            else:
                col_i = (255, 255, 255, 255)
            pygame.draw.circle(s, col_i, (cx, cy), i)
    except Exception:
        return
    ctx.surface.blit(s, (bbox[0], bbox[1]))


def _orb_simple(ctx, x, y, r, col, glowCol=None):
    orb(ctx, x, y, r, col, glowCol)


def rod(ctx, x1, y1, x2, y2, w, col, dark):
    p1 = ctx._apply(x1, y1)
    p2 = ctx._apply(x2, y2)
    try:
        pygame.draw.line(ctx.surface, _parse_color(dark), _int(p1), _int(p2), int(w+1.2))
        pygame.draw.line(ctx.surface, _parse_color(col), _int(p1), _int(p2), int(w))
    except: pass


def limb(ctx, x1, y1, x2, y2, x3, y3, w, col, dark):
    p1 = ctx._apply(x1, y1)
    p2 = ctx._apply(x2, y2)
    p3 = ctx._apply(x3, y3)
    try:
        pygame.draw.line(ctx.surface, _parse_color(dark), _int(p1), _int(p2), int(w+1.4))
        pygame.draw.line(ctx.surface, _parse_color(dark), _int(p2), _int(p3), int(w+1.4))
        pygame.draw.line(ctx.surface, _parse_color(col), _int(p1), _int(p2), int(w))
        pygame.draw.line(ctx.surface, _parse_color(col), _int(p2), _int(p3), int(w))
        pygame.draw.circle(ctx.surface, _parse_color(shade(col, 18)), _int(p2), int(w*0.62))
    except: pass


def taper(ctx, x1, y1, x2, y2, w1, w2, col, dark):
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy) or 1
    nx = -dy / length
    ny = dx / length
    h1 = w1 * 0.5
    h2 = w2 * 0.5

    dark_pts = [
        ctx._apply(x1+nx*h1, y1+ny*h1),
        ctx._apply(x2+nx*h2, y2+ny*h2),
        ctx._apply(x2-nx*h2, y2-ny*h2),
        ctx._apply(x1-nx*h1, y1-ny*h1),
    ]
    try:
        pygame.draw.polygon(ctx.surface, _parse_color(dark), [(int(x),int(y)) for x,y in dark_pts])
    except: pass

    col_pts = [
        ctx._apply(x1+nx*(h1-1), y1+ny*(h1-1)),
        ctx._apply(x2+nx*(h2-1), y2+ny*(h2-1)),
        ctx._apply(x2-nx*(h2-1), y2-ny*(h2-1)),
        ctx._apply(x1-nx*(h1-1), y1-ny*(h1-1)),
    ]
    try:
        pygame.draw.polygon(ctx.surface, _parse_color(col), [(int(x),int(y)) for x,y in col_pts])
    except: pass

    shadow_pts = [
        ctx._apply(x1-nx*(h1*0.35), y1-ny*(h1*0.35)),
        ctx._apply(x2-nx*(h2*0.35), y2-ny*(h2*0.35)),
        ctx._apply(x2-nx*(h2-1), y2-ny*(h2-1)),
        ctx._apply(x1-nx*(h1-1), y1-ny*(h1-1)),
    ]
    sc = rgba(dark, 0.5)
    try:
        if isinstance(sc, tuple) and len(sc) == 4:
            _blend_poly(ctx.surface, shadow_pts, sc)
    except Exception:
        pass

    p = ctx._apply(x1+nx*(h1*0.2), y1+ny*(h1*0.2))
    try: pygame.draw.circle(ctx.surface, _parse_color(shade(col, 22)), (int(p[0]),int(p[1])), max(2, int(h1*0.5)))
    except: pass


def bat_draw(ctx, r, st):
    anim = st.get('anim', 0)
    flap = math.sin(anim*3)*0.5

    ctx.save()
    ctx.translate(0, math.sin(anim*3)*r*0.15)

    p0 = ctx._apply(0, 0)
    try: _blend_ellipse(ctx.surface, p0[0], p0[1], r*0.8, r*0.5, _parse_color('#2a1a38'))
    except Exception: pass
    try: _blend_ellipse(ctx.surface, p0[0], p0[1], r*0.5, r*0.3, _parse_color('#3a2850'))
    except Exception: pass

    for side in [-1, 1]:
        wing_pts = []
        wing_pts.append(ctx._apply(side*r*0.6, -r*0.1))
        wing_pts.extend(_quad_bezier(ctx._apply(side*r*0.6, -r*0.1), ctx._apply(side*r*1.6, -r*0.9-flap*r*0.8), ctx._apply(side*r*2.0, -r*0.2-flap*r*0.9), 6))
        wing_pts.append(ctx._apply(side*r*1.15, -r*0.35-flap*r*0.4))
        wing_pts.extend(_quad_bezier(ctx._apply(side*r*1.15, -r*0.35-flap*r*0.4), ctx._apply(side*r*0.9, -r*0.05), ctx._apply(side*r*0.55, r*0.2), 6))
        try: _blend_poly(ctx.surface, wing_pts, (36, 18, 40, 234))
        except Exception: pass

        for wf in range(2):
            wf_off = 0.4 + wf * 0.3
            wfp0 = ctx._apply(side*r*0.6, -r*0.1)
            wfp1 = ctx._apply(side*r*wf_off*2.0, -r*0.2-flap*r*0.9)
            try:
                pygame.draw.line(ctx.surface, _parse_color('#1a0e20'),
                    _int(wfp0), _int(wfp1), max(1, int(r*0.05)))
            except: pass

    for side2 in [-1, 1]:
        ear_pts = [ctx._apply(side2*r*0.3, -r*0.4), ctx._apply(side2*r*0.5, -r*0.9), ctx._apply(side2*r*0.05, -r*0.5)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#2a1a38'), [(int(x),int(y)) for x,y in ear_pts])
        except: pass
        ear_in = [ctx._apply(side2*r*0.28, -r*0.45), ctx._apply(side2*r*0.42, -r*0.8), ctx._apply(side2*r*0.12, -r*0.5)]
        try: pygame.draw.polygon(ctx.surface, _parse_color('#4a2858'), [(int(x),int(y)) for x,y in ear_in])
        except: pass

    for ex in [-0.25, 0.25]:
        p = ctx._apply(ex*r, -r*0.2)
        try: pygame.draw.circle(ctx.surface, _parse_color('#e83838'), (int(p[0]),int(p[1])), int(r*0.12))
        except: pass
        p2 = ctx._apply(ex*r, -r*0.2)
        try: pygame.draw.circle(ctx.surface, _parse_color('#1a0a0a'), (int(p2[0]),int(p2[1])), int(r*0.05))
        except: pass

    ctx.restore()


def wisp_draw(ctx, r, st):
    anim = st.get('anim', 0)
    pulse = 0.5 + 0.5*math.sin(anim*4)

    ctx.save()
    ctx.translate(0, math.sin(anim*2.4)*r*0.3)

    p = ctx._apply(0, 0)
    max_r = int(r*1.4)
    if max_r >= 1:
        bbox = _clip_bbox([(p[0]-max_r, p[1]-max_r), (p[0]+max_r, p[1]+max_r)], ctx.surface, 2)
        if bbox:
            s = _get_alpha_layer(bbox[2], bbox[3])
            cx = int(p[0]) - bbox[0]
            cy = int(p[1]) - bbox[1]
            try:
                for i in range(max_r, 0, -1):
                    t = i / max_r
                    if t < 0.4:
                        alpha = int(0.9*255)
                    else:
                        alpha = int((0.5 + pulse*0.3) * (1-(t-0.4)/0.6) * 255)
                    pygame.draw.circle(s, (170, 255, 170, alpha), (cx, cy), i)
            except Exception:
                pass
            ctx.surface.blit(s, (bbox[0], bbox[1]))

    orb(ctx, 0, 0, r*0.55, '#8ad47f', 'rgba(200,255,210,0.8)')

    ctx.restore()


def spider_draw(ctx, r, st):
    walk = st.get('walk', 0)
    sc = st['r']

    p0 = ctx._apply(0, 0)
    try: _blend_ellipse(ctx.surface, p0[0], p0[1], sc*0.8, sc*0.6, _parse_color('#2a2028'))
    except Exception: pass
    try: _blend_ellipse(ctx.surface, p0[0], p0[1] - sc*0.35, sc*0.55, sc*0.42, _parse_color('#3a3040'))
    except Exception: pass
    try: _blend_ellipse(ctx.surface, p0[0], p0[1] - sc*0.15, sc*0.5, sc*0.35, _parse_color('#342a38'))
    except Exception: pass

    for i in range(4):
        ph = walk + i*1.1
        sw = math.sin(ph)*sc*0.35
        for side in [-1, 1]:
            pts = [ctx._apply(side*sc*0.4, -sc*0.15+i*sc*0.14)]
            pts.extend(_quad_bezier(ctx._apply(side*sc*0.4, -sc*0.15+i*sc*0.14), ctx._apply(side*sc*1.0, -sc*0.3+sw), ctx._apply(side*sc*1.35, -sc*0.1-sw+i*sc*0.12), 6))
            for j in range(len(pts)-1):
                try:
                    pygame.draw.line(ctx.surface, _parse_color('#241a26'), _int(pts[j]), _int(pts[j+1]), max(1, int(sc*0.12)))
                except: pass
            if i < 2:
                knee = ctx._apply(side*sc*1.0, -sc*0.3+sw)
                try:
                    pygame.draw.circle(ctx.surface, _parse_color('#2e2230'), _int(knee), max(1, int(sc*0.06)))
                except: pass

    for e_idx in range(4):
        ex = -sc*0.3 + (e_idx%2)*sc*0.6
        ey = -sc*0.55 + (e_idx//2)*sc*0.22
        p = ctx._apply(ex, ey)
        try: pygame.draw.circle(ctx.surface, _parse_color('#e83838'), (int(p[0]),int(p[1])), int(sc*0.09))
        except: pass
        p2 = ctx._apply(ex + 0.01*sc, ey - 0.01*sc)
        try: pygame.draw.circle(ctx.surface, _parse_color('#ff6040'), (int(p2[0]),int(p2[1])), int(sc*0.035))
        except: pass

    ctx.restore()


def stoneGolem_draw(ctx, r, st):
    walk = st.get('walk', 0)
    anim = st.get('anim', 0)

    ctx.save()
    try:
        p0 = ctx._apply(0, 0)
        _blend_ellipse(ctx.surface, p0[0] + r*0.6, p0[1] + r*1.24, r*0.6, r*0.14, (0, 0, 0, 50))
    except Exception:
        pass

    bob = abs(math.sin(walk))*-r*0.08
    sw = math.sin(walk)

    for side in [-1, 1]:
        ax = side*r*0.95 + sw*r*0.12*side
        try: pygame.draw.ellipse(ctx.surface, _parse_color('#6a6660'), pygame.Rect(ax-r*0.2, -r*0.12-r*0.58, r*0.4, r*1.16))
        except: pass
        try: pygame.draw.circle(ctx.surface, _parse_color('#54504b'), _int(ctx._apply(ax, r*0.46)), int(r*0.24))
        except: pass

    for side2 in [-1, 1]:
        taper(ctx, side2*r*0.32, r*0.46+bob, side2*r*0.4, r*1.1+bob, r*0.4, r*0.26, '#6a6660', '#3f3c38')

    for side3 in [-1, 1]:
        p = ctx._apply(side3*r*0.44, r*1.16+bob)
        try: pygame.draw.ellipse(ctx.surface, _parse_color('#4a4743'), pygame.Rect(p[0]-r*0.3, p[1]-r*0.16, r*0.6, r*0.32))
        except: pass

    torso_pts = []
    torso_pts.append(ctx._apply(-r*0.55, r*0.5+bob))
    torso_pts.extend(_quad_bezier(ctx._apply(-r*0.55, r*0.5+bob), ctx._apply(-r*0.78, -r*0.3), ctx._apply(-r*0.52, -r*0.72), 6))
    torso_pts.extend(_quad_bezier(ctx._apply(-r*0.52, -r*0.72), ctx._apply(0, -r*0.85), ctx._apply(r*0.52, -r*0.72), 6))
    torso_pts.extend(_quad_bezier(ctx._apply(r*0.52, -r*0.72), ctx._apply(r*0.78, -r*0.3), ctx._apply(r*0.55, r*0.5+bob), 6))
    try: pygame.draw.polygon(ctx.surface, _parse_color('#8a827a'), [(int(x),int(y)) for x,y in torso_pts])
    except: pass

    for side4 in [-1, 1]:
        p = ctx._apply(side4*r*0.58, -r*0.5+bob)
        try: pygame.draw.circle(ctx.surface, _parse_color('#7a746e'), (int(p[0]),int(p[1])), int(r*0.3))
        except: pass
        try: pygame.draw.circle(ctx.surface, _parse_color('#6a645e'), (int(p[0]),int(p[1]-r*0.1)), int(r*0.16))
        except: pass

    head_pts = []
    head_pts.append(ctx._apply(-r*0.42, -r*0.68))
    head_pts.extend(_quad_bezier(ctx._apply(-r*0.42, -r*0.68), ctx._apply(-r*0.36, -r*1.38), ctx._apply(0, -r*1.38), 5))
    head_pts.extend(_quad_bezier(ctx._apply(0, -r*1.38), ctx._apply(r*0.36, -r*1.38), ctx._apply(r*0.42, -r*0.68), 5))
    head_pts.extend(_quad_bezier(ctx._apply(r*0.42, -r*0.68), ctx._apply(r*0.2, -r*0.6), ctx._apply(-r*0.2, -r*0.6), 4))
    try: pygame.draw.polygon(ctx.surface, _parse_color('#847c74'), [(int(x),int(y)) for x,y in head_pts])
    except: pass

    for crack in [
        [(-r*0.25, -r*0.55), (-r*0.15, -r*0.1)],
        [(r*0.2, -r*0.6), (r*0.1, -r*0.15)],
        [(-r*0.1, r*0.0), (-r*0.2, r*0.35)],
    ]:
        p1 = ctx._apply(crack[0][0], crack[0][1])
        p2 = ctx._apply(crack[1][0], crack[1][1])
        try:
            pygame.draw.line(ctx.surface, (50, 45, 40, 100), _int(p1), _int(p2), max(1, int(r*0.06)))
        except: pass

    oGlow = 0.5 + 0.5*math.sin(anim*4)
    for ex_off in [-0.24, 0.24]:
        p = ctx._apply(ex_off*r, -r*1.02)
        try: _blend_ellipse(ctx.surface, p[0], p[1], r*0.13, r*0.07, (255, 150, 40, 230))
        except Exception: pass

    ctx.restore()


def fireGolem_draw(ctx, r, st):
    stoneGolem_draw(ctx, r, st)
    anim = st.get('anim', 0)
    pulse = 0.5 + 0.5*math.sin(anim*3)

    ctx.save()
    for crack in [
        [(-r*0.3, -r*0.5), (-r*0.1, r*0.1)],
        [(-r*0.1, r*0.1), (-r*0.3, r*0.4)],
        [(r*0.35, -r*0.6), (r*0.15, -r*0.1)],
        [(r*0.1, -r*0.1), (r*0.25, r*0.3)],
    ]:
        p1 = ctx._apply(crack[0][0], crack[0][1])
        p2 = ctx._apply(crack[1][0], crack[1][1])
        try:
            _blend_line(ctx.surface, p1, p2, (255, 140, 40, int((0.5 + pulse*0.5) * 255)), max(1, int(r*0.14)))
        except Exception:
            pass

    for ci in range(3):
        ca = anim * 2 + ci * 2.09
        cx_f = math.cos(ca) * r * 0.3
        cy_f = -r * 0.3 + math.sin(ca) * r * 0.2 - ci * r * 0.15
        try:
            p_f = ctx._apply(cx_f, cy_f)
            _blend_ellipse(ctx.surface, p_f[0], p_f[1],
                          r*0.15, r*0.1, (255, 100, 20, int(pulse * 120)))
        except Exception:
            pass

    orb(ctx, 0, -r*0.35, r*0.3, '#ff9a3a', 'rgba(255,120,20,0.6)')
    ctx.restore()
