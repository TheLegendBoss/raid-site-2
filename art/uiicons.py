"""Our own 11x11 UI icons in the Mystery Attic style (white 9x9 tile, black glyph), for glyphs the pack lacks.
Run: python3 art/uiicons.py  (writes src/assets/ui/icon_<name>.png). Needs Pillow."""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'ui')
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)

def tile(glyph):
    im = Image.new('RGBA', (11, 11), (0, 0, 0, 0))
    for y in range(1, 10):
        for x in range(1, 10):
            im.putpixel((x, y), WHITE)
    for x, y in glyph:
        im.putpixel((x, y), BLACK)
    return im

ICONS = {
    # Blade: a diagonal edge, a cross guard and a short hilt.
    'blade': [(8, 2), (7, 3), (6, 4), (5, 5), (4, 6), (3, 5), (5, 7), (3, 7), (2, 8), (7, 2), (8, 3)],
}

if __name__ == '__main__':
    for name, glyph in ICONS.items():
        tile(glyph).save(os.path.join(OUT, f'icon_{name}.png'))
        print('wrote', name)
