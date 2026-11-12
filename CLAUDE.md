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
- Vector art, plus the pixel exceptions listed below (PIXWEP weapons, the UI packs). Vector comes in two forms: Graphics/Shapes/text and textures baked in `src/fx/textures.ts` for effects and HUD, and character art authored as vex source (`art/*.vx.js`, a vector DSL) exported to PNG parts in `src/assets/art/` (exported at 4x, drawn at `TUNING.art.scale`). No hand-painted or third-party raster assets. Palette in `src/data/palette.ts`. Baked character lighting must be symmetric, because the sprites rotate with the aim.
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
- Extraction only works on a pad (`EXTRACTS` in `src/data/arena.ts`, rules in `src/game/systems/extract.ts`). In a bunker room the entry pad is a lift (extracts) only in the first room of a floor, and the exit pad opens when the room's waves are beaten: it descends to the next room, or on the Warden's room it extracts with the run complete. In the dev room the entry is always open and the exit opens after `TUNING.extract.exitAfterWave` waves. The player spawns on the entry pad (`SPAWN`).
- Flow: `Boot` -> `Title` -> `Base` (hub menu: Perks, Research, Quartermaster, Armory, Deploy; `mode: 'hub'`, or `'overlay'` over the paused room in dev) -> Deploy (swap gear, pick a bunker) -> a run of `FeelTest` rooms with `Hud` -> back to `Base` with a `MissionResult` (`src/game/mission.ts`). `Dev Test` enters `FeelTest` in `mode: 'dev'` (free play, every debug key, one endless room). Menus must work with the mouse as well as the keyboard, and any scene with a visible pointer calls `showCursor(scene, true)` because the room hides the OS cursor. One shared audio context: `getSfx()`.
- Weapon stats (Helldivers 2 / Intravenous 2 inspired): each `WeaponDef` carries `ap` (armour penetration vs `TUNING.armour`, table of damage share), `stagger` (robots build `stagMeter`; full = stumble), `bloomPerShot/bloomMax/bloomRecovery`, `moveSpread` (extra spread at full run speed), `mobility` (move-speed multiplier), `heft` (muzzle flash, light, zoom thump and shockwave ring scale; SMG 0.7, shotgun/magnum 1.9) and `impact` (hit sparks, knockback, hit-stop, kill shake; scaled via `TUNING.impact`). `step` says what each rarity above Common improves for that family (rate, spread, reload, AP, pellets, pierce, burst...). `src/sim/weapon.ts` (`resolveWeapon`, `armourFactor`) resolves a def at a rarity and is used by both `stats.ts` and `describe.ts`. Armour-turned rounds show a grey 'resist' number and ricochet sparks. Sounds per weapon are in `Sfx.shoot(kind)`; heavy guns layer a sub thump and long tail, the SMG is deliberately thin.
- Gear lives in `src/data/items.ts` (base items) and `src/data/loot.ts` (rarity, drops, prices); rolls are in `src/sim/loot.ts`, tooltip stat lines in `src/sim/describe.ts`. Equipped gear feeds `EffectiveStats` (weapon and blade variants included).
- Weapon HUD art is pixel art: a subset of PIXWEP (Zintoki, CC0) lives in `src/assets/pix/` (credit in its `CREDITS.md`). `src/data/gunKits.ts` maps each `GunShape` to parts (receiver, barrel, optic, stock, underbarrel), a finish ramp and a separate magazine sprite (it drops out on reload); `src/fx/pixGun.ts` composes, recolours and bakes one right-facing texture per shape at boot (barrel shifted 1 px, muzzle found from alpha). Our own pixel parts are authored in `art/pixparts/` (`parts.py`, palette codes only so they recolour; see its README), never by hand-editing the PNGs. Only `APPROVED` parts are exported into the game: the owner reviews each new accessory (barrel, stock, optic, underbarrel) as a design board first, and none is approved yet. Magazines are approved: raked ones (SMG, pistol, magnum, burst) lean rearward and drop and insert along that lean, shotgun and marksman use block magazines. The Hud weapon panel (`drawGun`) and the Base detail schematic use those textures with NEAREST filtering. The character is still vector and the Hud and Base are pixel UI (see below); The Ultimate Weapons Pack (Jestan, CC0) is still not in the repo. Do not mix styles ad hoc.
- Pixel UI (owner decision, Nov 2026): the Hud, Base, Title, Pause and Tree use Waste No Space 9-slice panels, buttons, fields and tabs (Flatus, CC0), the Poco font (CC BY 4.0, fontenddev.com/fonts/poco, credited on the title screen), Mystery Attic icons and KabGames crosshair parts (both CC0). Parts live in `src/assets/ui/` (credits in its `CREDITS.md`; `icon_blade.png` is ours, from `art/uiicons.py`), are loaded by `loadUiParts` and set to NEAREST by `finishUiParts` in Boot, and are used through `src/ui/pixelUi.ts`: `uiPanel` (a NineSlice at `TUNING.ui.px` screen px per art px), `uiIcon`, `snapFont` (Poco is only crisp at `TUNING.ui.fontSizes`; ties round up) and `snapText` (puts a text's top-left on a whole pixel). UI text: resolution 1, no bold, hard shadows only, ASCII (Poco has no arrows, check marks or box glyphs). Hud panels are static NineSlices rebuilt on resize, bars and cooldown fills are Graphics, the crosshair is four arm sprites plus a ring moved out by aim spread. Base boxes are NineSlices at depth 0.5 under its Graphics (depth 1). The Title, Pause and Tree screens use the same panels (menu buttons in `src/ui/menu.ts` are `btn` / `btn_hover` / `btn_dis` NineSlices; tree node cards are NineSlices tinted by branch colour). The tree node icons (`src/fx/treeIcons.ts`) and the title/room backdrops are still vector: the packs have no matching icons. Not used: Cardinal Zebra Pixel UI Kit (too saturated for the palette), Kast fonts. Willosuna's Sci-Fi HUD Kit is NOT CC0 (its LICENSE.txt forbids redistributing the files): do not use it. denizlabs' Starship Hull UI forbids re-uploading the pack and has not been cleared. Ask the owner before adding any further pack.
- The Neo Zero tileset is not in the repo: its licence forbids redistribution and use in anything where the assets can be extracted (a public repo or any release build, including the .exe, would qualify). Do not commit it without the owner's decision.

## Runs and enemies

- A bunker (`BUNKERS` in `src/data/missions.ts`) is a run: N floors, a few rooms each, the last room a Warden. `src/sim/run.ts` (`generateRun`) turns one into `RoomPlan`s (layout, pre-composed waves, lift/final flags); `src/game/run.ts` holds the run in progress (`beginRun`, `advanceRun`, `endRun`). Each room is a fresh `FeelTest` scene start; hull, ammo and carried loot carry over through `runState`, a lift ride restores some (`TUNING.run`). Death or abort ends the run and loses what was carried; extracting banks it. Killing the Warden then extracting claims the bunker (`profile.claimed`) and pays its clear bonus.
- Room layouts (pillars, pipes, pads, boss spawn) are `LAYOUTS` in `src/data/arena.ts`. `PILLARS`, `PIPES`, `EXTRACTS` and `SPAWN` there are live singletons: `applyLayout(id)` rewrites them in place, so call it in `init()` before anything draws or builds systems.
- Enemies: stats, armour class, loot and behaviour numbers are `MOBS` / `MOB_AI` in `src/data/mobs.ts`; brains are `src/game/systems/mobAI.ts`; art is `src/fx/mobArt.ts`; the spawner is `mobs.ts`. To add one: a `MobKind`, a `MobDef` (cost, weight, `minDepth` feed the wave composer in `src/sim/waves.ts`), a brain branch, a `drawMob` case. Roster: Scavenger (swarm), Bloater (walks up and blasts), Stalker (telegraphed lunge), Spitter (fan of slow blobs), Brute (armoured, telegraphed charge), Sentry and Marksman (robots, laser telegraph), the Warden (boss, three stages).
- The stash has no cap. Bump `SAVE_VERSION` and migrate when the profile shape changes (v3 added `claimed`).

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
