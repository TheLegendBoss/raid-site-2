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
- Draw static art once. Redraw a Graphics only when state changes (see the hit-flash toggle in `src/fx/mobArt.ts`). RenderTexture draw calls are buffered: call `render()` after stamping.
- HUD is its own scene (`Hud`) so game camera shake and zoom never move it. Game to HUD communication goes through `src/game/runState.ts`.
- Feel is the product. Hit-stop, shake, light flashes, shatter debris and layered sound live in `src/fx/` and `src/game/systems/`; keep their numbers in `tuning.ts`.
- The game ships as a Windows .exe (Electron shell in `electron/`, built by `.github/workflows/release.yml`). Development stays in a browser (`npm run dev`). Saves go through `src/game/host.ts`: a file via the Electron bridge on desktop, localStorage in a browser. Never read or write storage directly elsewhere.
- Before finishing a change: `npm run typecheck`, `npm run build`, and actually run it in a browser. Type checks do not catch feel, layout or input bugs.

## Combat model

- The SMG uses a magazine plus reserve (`TUNING.gun`). Reload state, dash/blade cooldown fractions and the shot counter reach the HUD through `runState` (`reload`, `shotSeq`, `dashReady`, `bladeReady`, ping/deny flashes). The HUD animates the bolt, magazine and ejected casings from those fields.
- Damage is rolled in `src/sim/damage.ts` (`rollDamage`) and shown as pooled floating numbers (`TUNING.numbers`).
- Keys: R reload, T reset room, H toggle help, X extract, Esc pause. In the dev test only: Tab trees, B outfit overlay, 1/2/K/T debug spawns.
- Active reload (Gears style): a second R press while the tick is in the small PERFECT zone finishes the reload with a damage bonus, in the wider ACTIVE zone finishes it without, and outside both jams it once (`TUNING.gun.activeReload`; the perfect zone is widened by the `activeWidth` stat). State reaches the HUD through `runState` (`reloadWin0/1` perfect, `reloadGood0/1` active, `reloadMark`, `activeFlash`, `activeResult`, `hotMag`); logic in `src/game/systems/gun.ts`, the bar in `Hud.drawActiveReloadBar`.
- Extraction only works on a pad (`EXTRACTS` in `src/data/arena.ts`, rules in `src/game/systems/extract.ts`): the entry pad is always open, the exit pad opens after `TUNING.extract.exitAfterWave` waves (stand-in for the Warden). The player spawns on the entry pad (`SPAWN`).
- Flow: `Boot` -> `Title` -> `Base` (hub) -> `FeelTest` + `Hud` as a mission -> back to `Base` with a `MissionResult` (`src/game/mission.ts`). `Dev Test` enters `FeelTest` in `mode: 'dev'` (free play, every debug key). The base is `src/scenes/Base.ts` (`mode: 'hub'`, or `'overlay'` over the paused room in dev); missions are defined in `src/data/missions.ts`. Menus must work with the mouse as well as the keyboard, and any scene with a visible pointer calls `showCursor(scene, true)` because the room hides the OS cursor. One shared audio context: `getSfx()`.
- Gear lives in `src/data/items.ts` (base items) and `src/data/loot.ts` (rarity, drops, prices); rolls are in `src/sim/loot.ts`, tooltip stat lines in `src/sim/describe.ts`. Equipped gear feeds `EffectiveStats` (weapon and blade variants included).
- The Neo Zero tileset is not in the repo: its licence forbids redistribution and use in anything where the assets can be extracted (a public repo or any release build, including the .exe, would qualify). Do not commit it without the owner's decision.

## Trees and stats

- Research and Perks are node trees in `src/data/tree.ts` (main nodes on a grid, chip nodes under a parent, bought with Intel, parent first). Unlock rules live in `src/sim/tree.ts`. The tree screen is `src/scenes/Tree.ts` (Tab in the room).
- Combat reads `profile.stats` (`EffectiveStats`, resolved in `src/sim/stats.ts` from base tuning plus unlocked effects), never `TUNING.gun` or `TUNING.player` for anything a node can change. To add a stat: add a `StatKey`, a base value in `stats.ts`, a label in `STAT_LABELS`, then read it from `profile.stats`.
- `src/game/profile.ts` owns the persistent profile (Intel, unlocked ids, stash) and writes a versioned save. Bump `SAVE_VERSION` and migrate when the shape changes.

## Art pipeline (character parts)

- Source of truth: `art/clone.vx.js`. Rebuild with a local clone of github.com/uilianks/vex (MIT, Node >= 22.18): `node <vex>/bin/vex.js build art/clone.vx.js --scales 4`, then copy `out/sprites/clone_*@4x.png` to `src/assets/art/clone_*.png`. vex is not vendored in this repo.
- Parts share a 64x64 canvas centred on (32,32), so they stack at one origin and animate by offsets (`src/fx/playerRig.ts`). The SMG muzzle is at x=70.6 in the 72-wide arms canvas, which `TUNING.gun.muzzleOffset` matches.

## Terminology

- **Carried**: unequipped loot held in the run; lost on death.
- **Stash**: banked loot; survives death. Reached by extracting.
- **Aug** (Augmented): the player's character, one of a finite set built to reclaim the world. Research and perks persist across Augs. Post-MVP death costs an Aug; in the MVP it regrows at the base.
- **Clone**: a late research unlock that makes Aug death cheap. The code and HUD still say "clone" for the MVP's free regrow.
- **Silo**: a randomly generated, disposable site with a clear ending (a Warden). The MVP test bed. Not connected to the network.
- **Vault**: a connected, persistent site (generated once per save, with authored story rooms). Claiming one adds population and grows the base.
- **Population**: sleepers woken from cryosleep in claimed vaults. Funds base growth.
- **Equipped**: the four gear slots in use. Survive death, unlike carried loot.
