"""Our own gun parts, drawn with px.py. Right-facing; coordinates are on the 64x32 gun canvas.

Anatomy (matches PIXWEP): the receiver spans x 11..38 and y 8..25; barrels start at x 38 and run to 63
with the bore near y 12; stocks sit at x 1..12; sights and optics sit above the receiver at y 0..9;
underbarrel parts hang from y 16. Magazines are separate small sprites (trimmed, top-left at 0,0).
"""
from __future__ import annotations
from px import Canvas


def _funnel(c: Canvas, x0: int, x1: int, y_mid: int, r0: float, r1: float) -> None:
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, x1 - x0)
        r = r0 + (r1 - r0) * t
        top, bot = round(y_mid - r), round(y_mid + r)
        for y in range(top, bot + 1):
            i, h = y - top, bot - top + 1
            c.put(x, y, '5' if i == 0 else '1' if i == h - 1 else '2' if i == h - 2 else '3')


# ---- barrels ---------------------------------------------------------------------------------------

def barrel_suppressor() -> Canvas:
    c = Canvas()
    c.rect(38, 11, 43, 11, 'd'); c.rect(38, 12, 43, 12, 'c'); c.rect(38, 13, 43, 13, 'b')
    c.shaded(44, 9, 62, 15)
    for x in (48, 52, 56, 60):
        c.rect(x, 10, x, 14, '1')
    c.rect(44, 9, 44, 15, 'b')
    c.rect(62, 9, 62, 15, 'a')
    c.outline(); return c


def barrel_brake() -> Canvas:
    c = Canvas()
    c.shaded(38, 10, 53, 14)
    c.rect(53, 9, 53, 15, 'b')
    c.shaded(54, 8, 62, 16)
    for x in (56, 58, 60):
        c.rect(x, 9, x, 11, '1'); c.rect(x, 13, x, 15, '1')
    c.rect(54, 12, 62, 12, '2')
    c.outline(); return c


def barrel_flared() -> Canvas:
    c = Canvas()
    c.shaded(38, 10, 46, 14)
    c.rect(46, 9, 46, 15, 'b')
    _funnel(c, 47, 62, 12, 2.5, 6.5)
    c.rect(62, 7, 62, 17, '1')
    for x in range(56, 62):                      # the hollow of the bell
        r = 1 + (x - 56) * 0.7
        c.rect(x, round(12 - r), x, round(12 + r), '1')
    c.rect(58, 11, 61, 13, 'a')
    c.outline(); return c


def barrel_twin() -> Canvas:
    c = Canvas()
    c.shaded(38, 8, 61, 11); c.shaded(38, 13, 61, 16)
    for x in (44, 54):
        c.rect(x, 8, x + 1, 16, 'b')
    c.rect(60, 8, 61, 11, 'a'); c.rect(60, 13, 61, 16, 'a')
    c.outline(); return c


# ---- stocks ----------------------------------------------------------------------------------------

def stock_buttplate() -> Canvas:
    c = Canvas()
    c.shaded(2, 8, 4, 22)
    c.rect(2, 8, 2, 22, '4'); c.rect(4, 9, 4, 22, '2')
    c.shaded(5, 10, 11, 19, 'n')
    c.rect(5, 9, 10, 9, 'd'); c.rect(5, 20, 9, 21, 'b')
    c.rect(7, 13, 9, 13, 'a'); c.rect(7, 16, 9, 16, 'a')
    c.outline(); return c


def stock_wire() -> Canvas:
    c = Canvas()
    c.rect(2, 8, 3, 23, '3'); c.rect(2, 8, 2, 23, '5'); c.rect(3, 12, 3, 23, '2')
    c.rect(4, 10, 11, 10, 'd'); c.rect(4, 11, 11, 11, 'b')
    c.line(4, 22, 11, 14, 'c'); c.line(4, 21, 10, 14, 'b')
    c.outline(); return c


def stock_cheek() -> Canvas:
    c = Canvas()
    c.shaded(2, 9, 4, 25)
    c.rect(2, 9, 2, 25, '4'); c.rect(4, 11, 4, 25, '2')
    c.shaded(5, 12, 11, 21, 'n')
    c.shaded(5, 4, 17, 8, 'n')                   # cheek riser running forward over the receiver
    c.rect(5, 4, 5, 11, 'b'); c.rect(5, 9, 11, 11, 'c')
    c.rect(7, 16, 10, 16, 'a'); c.rect(8, 6, 15, 6, 'b')
    c.outline(); return c


def stock_ring() -> Canvas:
    c = Canvas()
    c.shaded(8, 9, 11, 14)
    c.rows(2, 8, ['.ddd.', 'd...c', 'd...c', 'd...c', '.bbb.'])
    c.rect(7, 11, 7, 12, 'c')
    c.outline(); return c


# ---- optics and sights -----------------------------------------------------------------------------

def scope_iron() -> Canvas:
    c = Canvas()
    for x, y in ((14, 5), (16, 5), (14, 6), (16, 6)):
        c.put(x, y, 'c')
    c.rect(14, 7, 16, 9, 'b'); c.put(15, 8, 'a')
    c.rect(35, 5, 35, 9, 'c'); c.rect(34, 9, 36, 9, 'b')
    c.outline(); return c


def scope_prism() -> Canvas:
    c = Canvas()
    c.shaded(20, 4, 31, 8, 'n')
    c.rect(19, 4, 19, 8, 'b'); c.rect(18, 5, 18, 7, 'g')
    c.rect(32, 4, 32, 8, 'b'); c.rect(33, 5, 33, 7, 'G')
    c.rect(24, 2, 26, 3, 'c'); c.rect(21, 9, 30, 9, 'a')
    c.outline(); return c


def scope_long() -> Canvas:
    c = Canvas()
    c.shaded(8, 3, 34, 7, 'n')
    c.shaded(5, 2, 8, 8, 'n'); c.rect(5, 2, 5, 8, 'b')
    c.shaded(31, 1, 36, 9, 'n'); c.rect(31, 1, 31, 9, 'b')
    c.rect(37, 3, 37, 7, 'g')
    c.rect(18, 0, 20, 2, 'c'); c.rect(12, 8, 14, 9, 'a'); c.rect(26, 8, 28, 9, 'a')
    c.outline(); return c


def scope_reflex() -> Canvas:
    c = Canvas()
    c.rect(21, 8, 30, 9, 'b')
    c.rect(21, 4, 22, 8, 'c'); c.rect(29, 4, 30, 8, 'c')
    c.rect(21, 3, 30, 4, 'd')
    c.rect(23, 5, 28, 7, 'a'); c.put(26, 6, 'r')
    c.outline(); return c


# ---- underbarrel -----------------------------------------------------------------------------------

def under_grip() -> Canvas:
    c = Canvas()
    c.shaded(43, 16, 49, 17, 'n')
    c.shaded(44, 18, 48, 28, 'n')
    for y in (21, 24):
        c.rect(44, y, 48, y, 'a')
    for p in ((44, 28), (48, 28)):
        c.px.pop(p, None)
    c.outline(); return c


def under_launcher() -> Canvas:
    c = Canvas()
    c.shaded(40, 17, 57, 23, 'n')
    c.rect(56, 16, 58, 24, 'b'); c.rect(58, 17, 58, 23, 'a')
    c.shaded(36, 18, 40, 22)
    c.rect(48, 15, 49, 16, 'c')
    c.outline(); return c


def under_bayonet() -> Canvas:
    c = Canvas()
    c.shaded(44, 17, 48, 19, 'n')
    c.rect(49, 17, 61, 17, '4'); c.rect(49, 18, 60, 18, '3'); c.rect(49, 19, 56, 19, '2')
    c.put(62, 17, '5')
    c.outline(); return c


def under_light() -> Canvas:
    c = Canvas()
    c.shaded(44, 16, 52, 21, 'n')
    c.rect(46, 16, 49, 16, 'a')
    c.rect(53, 16, 54, 21, 'b'); c.rect(54, 17, 54, 20, 'G')
    c.outline(); return c


# ---- magazines (right-facing, trimmed) --------------------------------------------------------------

def mag_stick() -> Canvas:
    c = Canvas()
    c.shaded(1, 1, 4, 11, 'n')
    c.rect(1, 1, 1, 11, 'd'); c.rect(1, 11, 4, 11, 'a'); c.rect(2, 4, 4, 4, 'b')
    c.outline(); return c


def mag_curved() -> Canvas:
    c = Canvas()
    for i in range(12):
        x0 = 1 + i // 4
        for x in range(x0, x0 + 4):
            c.put(x, 1 + i, 'd' if x == x0 else 'a' if i == 11 else 'c' if x < x0 + 3 else 'b')
    c.outline(); return c


def mag_extended() -> Canvas:
    c = Canvas()
    c.shaded(1, 1, 4, 17, 'n')
    c.rect(1, 1, 1, 17, 'd'); c.rect(1, 17, 4, 17, 'a')
    for y in (4, 7, 10, 13):
        c.rect(2, y, 4, y, 'b')
    c.outline(); return c


def mag_drum() -> Canvas:
    c = Canvas()
    c.shaded(4, 0, 8, 4, 'n')
    cx, cy, r = 6.0, 9.0, 6.2
    for y in range(3, 16):
        for x in range(0, 13):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r:
                c.put(x, y, 'd' if y - cy < -3 else 'a' if y - cy > 3 else 'c' if d > 3 else 'b')
    for x, y in ((6, 8), (6, 9), (6, 10), (5, 9), (7, 9)):
        c.put(x, y, 'a')
    c.outline(); return c


# slot -> name -> constructor
PARTS = {
    'barrel': {f.__name__: f for f in (barrel_suppressor, barrel_brake, barrel_flared, barrel_twin)},
    'stock': {f.__name__: f for f in (stock_buttplate, stock_wire, stock_cheek, stock_ring)},
    'scope': {f.__name__: f for f in (scope_iron, scope_prism, scope_long, scope_reflex)},
    'under': {f.__name__: f for f in (under_grip, under_launcher, under_bayonet, under_light)},
    'mag': {f.__name__: f for f in (mag_stick, mag_curved, mag_extended, mag_drum)},
}
