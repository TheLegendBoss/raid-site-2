# RAID SITE 2: project notes for Claude

Real-time top-down looter shooter. Phaser 4 + TypeScript (strict) + Vite. A cloned super soldier delves into a continuous, expanding network of derelict sites. This is its own game, not a continuation of the earlier tactics prototype: do not import its card, AP, chassis or vault-decision assumptions.

## Pillars

1. **Setting**: sealed derelict sites; each one tells part of what happened.
2. **Looter shooter**: gear is the main progression; rarities and affixes make runs differ.
3. **Expanding exploration**: continuous map. Clearing a site claims it and opens routes; gates need gear or keys from elsewhere.

## Rules

- This is Phaser 4, not 3. Verify APIs against `node_modules/phaser/skills/<topic>/SKILL.md` before using them. Read only the topic you need.
- `src/sim/` is pure TypeScript with no `phaser` import. Put rules and rolls there.
- Tunable numbers live in `src/data/`, never inline in logic.
- Vector line art only: Graphics, Shapes, text, and textures baked from vector drawing in `src/fx/textures.ts`. No sprites or image assets. Palette in `src/data/palette.ts`.
- Draw static art once. Redraw a Graphics only when state changes (see the hit-flash toggle in `FeelTest`). RenderTexture draw calls are buffered: call `render()` after stamping.
- HUD is its own scene (`Hud`) so game camera shake and zoom never move it. Game to HUD communication goes through `src/game/runState.ts`.
- Feel is the product. Hit-stop, shake, light flashes, shatter debris and layered sound live in `src/fx/` and `FeelTest`; keep their numbers in `tuning.ts`.
- Before finishing a change: `npm run typecheck`, `npm run build`, and actually run it in a browser. Type checks do not catch feel, layout or input bugs.

## Terminology

- **Carried**: loot held in the run; lost on death.
- **Stash**: banked loot; survives death. Reached by extracting.
- **Clone**: the player's body. Death regrows it; the stash and claimed map persist.
