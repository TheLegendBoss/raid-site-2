# Weapon outline sheet

Parametric side-view outlines for the starter weapons, built on one shared anatomy spec (`anatomy.py`, millimetres).
Run `python3 sheet.py` in this folder to regenerate `starters.svg`.

Rules enforced in code: grip width must exceed the cartridge length plus 6 mm; trigger sits 25 mm ahead of the
front strap inside a guard anchored to the frame; ejection ports are sized to the round they pass; rounds lie
nose-forward in magazines (double stacks overlap at half a case diameter, curved magazines rotate each round
along the arc); ejected cases are empty; ammo is always drawn at the gun's own scale (magazine insets are
magnified and labelled).

Reference models used for proportion checks only (not copied, not in the repo): senko_otter weapon models v.9.
