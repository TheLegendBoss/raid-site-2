"""Export the APPROVED parts in parts.py to PNGs in src/assets/pix/<slot>/<name>.png.

    python3 art/pixparts/build.py              # approved parts only, into src/assets/pix
    python3 art/pixparts/build.py --all DIR    # every part, for design review

Composited parts are mirrored to PIXWEP's left-facing 64x32 format (src/fx/pixGun.ts mirrors the finished gun).
Magazines are trimmed to their bounding box and stay right-facing. Needs Pillow.
"""
from __future__ import annotations
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from parts import APPROVED, PARTS  # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'src', 'assets', 'pix')


def export(out: str = OUT, only_approved: bool = True) -> int:
    n = 0
    for slot, parts in PARTS.items():
        os.makedirs(os.path.join(out, slot), exist_ok=True)
        for name, fn in parts.items():
            if only_approved and name not in APPROVED:
                continue
            im = fn().image()
            if slot == 'mag':
                im = im.crop(im.getbbox())
            else:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            im.save(os.path.join(out, slot, name + '.png'))
            n += 1
    return n


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--all':      # proposals too, into a scratch dir for review boards
        print(f'exported {export(sys.argv[2], False)} parts (incl. proposals) to {sys.argv[2]}')
    else:
        print(f'exported {export()} approved parts to {os.path.normpath(OUT)}')
