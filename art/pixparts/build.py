"""Export the parts in parts.py to PNGs in src/assets/pix/<slot>/<name>.png.

    python3 art/pixparts/build.py

Composited parts are mirrored to PIXWEP's left-facing 64x32 format (src/fx/pixGun.ts mirrors the finished gun).
Magazines are trimmed to their bounding box and stay right-facing. Needs Pillow.
"""
from __future__ import annotations
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from parts import PARTS  # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'src', 'assets', 'pix')


def export() -> int:
    n = 0
    for slot, parts in PARTS.items():
        os.makedirs(os.path.join(OUT, slot), exist_ok=True)
        for name, fn in parts.items():
            im = fn().image()
            if slot == 'mag':
                im = im.crop(im.getbbox())
            else:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            im.save(os.path.join(OUT, slot, name + '.png'))
            n += 1
    return n


if __name__ == '__main__':
    print(f'exported {export()} parts to {os.path.normpath(OUT)}')
