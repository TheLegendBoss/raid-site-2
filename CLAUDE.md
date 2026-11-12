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
- Vector art only, in two forms: Graphics/Shapes/text and textures baked in `src/fx/textures.ts` for effects and HUD, and character art authored as vex source (`art/*.vx.js`, a vector DSL) exported to PNG parts in `src/assets/art/` (exported at 4x, drawn at `TUNING.art.scale`). No hand-painted or third-party raster assets. Palette in `src/data/palette.ts`. Baked character lighting must be symmetric, because the sprites rotate with the aim.
- Draw static art once. Redraw a Graphics only when state changes (see the hit-flash toggle in `FeelTest`). RenderTexture draw calls are buffered: call `render()` after stamping.
- HUD is its own scene (`Hud`) so game camera shake and zoom never move it. Game to HUD communication goes through `src/game/runState.ts`.
- Feel is the product. Hit-stop, shake, light flashes, shatter debris and layered sound live in `src/fx/` and `FeelTest`; keep their numbers in `tuning.ts`.
- Before finishing a change: `npm run typecheck`, `npm run build`, and actually run it in a browser. Type checks do not catch feel, layout or input bugs.

## Combat model

- The SMG uses a magazine plus reserve (`TUNING.gun`). Reload state, dash/blade cooldown fractions and the shot counter reach the HUD through `runState` (`reload`, `shotSeq`, `dashReady`, `bladeReady`, ping/deny flashes). The HUD animates the bolt, magazine and ejected casings from those fields.
- Damage is rolled in `src/sim/damage.ts` (`rollDamage`) and shown as pooled floating numbers (`TUNING.numbers`).
- Keys: R reload, T reset room, H toggle help.
- The Neo Zero tileset is not in the repo: its licence forbids redistribution and use in anything where the assets can be extracted (a public repo or single-file release would qualify). Do not commit it without the owner's decision.

## Art pipeline (character parts)

- Source of truth: `art/clone.vx.js`. Rebuild with a local clone of github.com/uilianks/vex (MIT, Node >= 22.18): `node <vex>/bin/vex.js build art/clone.vx.js --scales 4`, then copy `out/sprites/clone_*@4x.png` to `src/assets/art/clone_*.png`. vex is not vendored in this repo.
- Parts share a 64x64 canvas centred on (32,32), so they stack at one origin and animate by offsets (`src/fx/playerRig.ts`). The SMG muzzle is at x=70.6 in the 72-wide arms canvas, which `TUNING.gun.muzzleOffset` matches.

## Terminology

- **Carried**: unequipped loot held in the run; lost on death.
- **Stash**: banked loot; survives death. Reached by extracting.
- **Clone**: the player's body. Death regrows it; the stash, equipped gear and claimed sites persist.
- **Silo**: a randomly generated, disposable site with a clear ending (a Warden). The MVP test bed. Not connected to the network.
- **Vault**: a connected, persistent site (generated once per save, with authored story rooms). Claiming one adds population and grows the base.
- **Population**: sleepers woken from cryosleep in claimed vaults. Funds base growth.
- **Equipped**: the four gear slots in use. Survive death, unlike carried loot.
