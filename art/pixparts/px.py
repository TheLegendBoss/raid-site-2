"""Tiny pixel-part toolkit for RAID SITE 2 gun parts.

Parts are authored RIGHT-FACING on the shared 64x32 gun canvas (stock at the left, muzzle at the right),
with the same palette and alignment as the PIXWEP parts in src/assets/pix/, so they stack with them and
recolour through the same finish ramps (src/fx/pixGun.ts). The exporter mirrors them to PIXWEP's
left-facing format; magazines are the exception: trimmed and kept right-facing.

Palette codes (exact PIXWEP colours):
  k outline        1..5 purple ramp, dark to light (the part's main material; becomes the finish ramp)
  a b c d          navy ramp, dark to light (secondary parts; becomes the dark ramp)
  r red  p pink  g lens green  G lens light
"""
from __future__ import annotations
from PIL import Image

PAL = {
    'k': (0, 0, 0),
    '1': (56, 0, 93), '2': (112, 0, 149), '3': (169, 0, 206), '4': (192, 57, 222), '5': (203, 108, 224),
    'a': (29, 29, 67), 'b': (43, 43, 81), 'c': (49, 49, 86), 'd': (74, 74, 111),
    'r': (217, 16, 54), 'p': (217, 88, 125), 'g': (130, 232, 131), 'G': (168, 255, 168),
}
W, H = 64, 32


class Canvas:
    def __init__(self) -> None:
        self.px: dict[tuple[int, int], str] = {}

    def put(self, x: int, y: int, c: str) -> None:
        if c not in ('.', ' '):
            self.px[(x, y)] = c

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: str) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def shaded(self, x0: int, y0: int, x1: int, y1: int, ramp: str = 'p') -> None:
        """Filled box lit from above: a highlight row on top, the body colour, a shadow row below."""
        cols = '53 2 1'.replace(' ', '') if ramp == 'p' else 'dcba'
        h = y1 - y0 + 1
        for i, y in enumerate(range(y0, y1 + 1)):
            if ramp == 'p':
                c = '5' if i == 0 else '1' if i == h - 1 and h > 2 else '2' if i == h - 2 and h > 3 else '3'
            else:
                c = 'd' if i == 0 else 'a' if i == h - 1 and h > 2 else 'b' if i == h - 2 and h > 3 else 'c'
            self.rect(x0, y, x1, y, c)

    def rows(self, x0: int, y0: int, lines: list[str]) -> None:
        for dy, line in enumerate(lines):
            for dx, c in enumerate(line):
                self.put(x0 + dx, y0 + dy, c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: str) -> None:
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.put(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def outline(self) -> None:
        """Black 4-neighbour outline around everything drawn, like PIXWEP's."""
        add = {}
        for (x, y) in self.px:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p not in self.px:
                    add[p] = 'k'
        self.px.update(add)

    def image(self) -> Image.Image:
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for (x, y), c in self.px.items():
            if 0 <= x < W and 0 <= y < H:
                im.putpixel((x, y), (*PAL[c], 255))
        return im
