# Pixel gun parts (our own)

The PIXWEP set (CC0) is the base kit; these are our additions, drawn in PIXWEP's exact palette and on its 64x32
canvas so they stack with it and recolour through the same finish ramps.

- `px.py`: palette codes and the `Canvas` helpers (shaded boxes, ascii rows, lines, auto outline).
- `parts.py`: the parts, grouped by slot (barrel, stock, scope, under, mag). Right-facing; anatomy notes at the top.
- `build.py`: `python3 art/pixparts/build.py` exports them to `src/assets/pix/<slot>/<name>.png` (needs Pillow).

Parts are mirrored to PIXWEP's left-facing format on export, except magazines (trimmed, right-facing).
To add a part: write the function, add it to `PARTS`, run `build.py`, add a display name to `PART_NAMES` and use it
in a kit in `src/data/gunKits.ts`. Use only the palette codes, or the recolour will not touch the part.
