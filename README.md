# RAID SITE 2

A cloned super soldier pushes into a network of sealed, derelict sites. Looter shooter, real-time, top-down, keyboard and mouse. Vector art on near-black.

This repo starts as a **feel test**: one arena, one SMG, one power blade, scavenger swarms and rogue robots. The only question it answers is whether being the soldier feels heavy and good for ten minutes. Design docs come after the answer is yes.

## Design

The MVP plan (loop, gear, floors, enemies, order of work) is in [docs/design.md](docs/design.md).

## Run

```bash
npm install
npm run dev        # browser, http://localhost:5173 (saves go to localStorage)
npm run desktop    # builds the game and opens it in the Electron shell
npm run build      # typecheck + web build into dist/
```

Click the page once so the browser allows audio.

## Download (Windows .exe)

The game ships as a **portable Windows .exe**: one file, no installer. Grab `raid-site-2-X.Y.Z-portable.exe` from the [Releases page](https://github.com/TheLegendBoss/raid-site-2/releases) and double-click it. It is unsigned, so Windows SmartScreen may warn: choose *More info*, then *Run anyway*. F11 toggles fullscreen.

Saves (Intel, unlocked tree nodes, stash) are a real file: `%APPDATA%\RAID SITE 2\save.json`, with the previous save kept as `save.bak`.

To cut a release: bump `version` in `package.json`, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. The `Release` workflow builds the .exe on a Windows runner and attaches it. **Actions > Release > Run workflow** builds one without a release and keeps it as a downloadable artifact. To build locally on Windows, run `npm run dist:win` (output in `release/`).

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left mouse | SMG: 30-round magazine plus reserve. Empty trigger pull auto-reloads |
| R | Reload (tactical reload is quicker than reloading from empty) |
| Right mouse or F | Arc blade: wind-up, lunging cleave, bisects scavengers. 0.8s cooldown; kills refund reserve ammo and shield |
| Shift or Space | Dash (brief invulnerability, 0.9s cooldown) |
| X | Extract: bank carried loot into the stash |
| Tab | Open the Research and Perk trees (spend Intel earned by clearing waves) |
| B | Open the Base: equipped gear, carried items, stash, quartermaster (E equip, M move, S sell, D dismantle; sell and dismantle work on stashed items only) |
| 1 / 2 | Spawn a scavenger swarm / a robot |
| K | Clear all hostiles |
| T | Reset the room |
| H | Hide or show the help text |
| M | Mute |

Blade kills refund ammo and shield, so wading in is rewarded over kiting. Dying loses everything you carry; the stash is safe.

## What to judge

- Does the SMG have weight (recoil, kick, muzzle light, casings)?
- Does the blade feel committed and powerful (wind-up, lunge, hit-stop, bisect)?
- Are robots readable (red-violet laser telegraph, then a three-round burst)? Blade cuts their shots out of the air.
- Do the sounds sell material: wet for scavengers, metal for robots, a booming robot death?
- Does a 5 minute session stay interesting, or is it a chore?

## Layout

```
src/data/      palette and tuning: every tunable number lives here
src/sim/       pure TypeScript (maths, loot rolls), no engine imports
src/fx/        procedural WebAudio, pooled particles, baked textures
src/scenes/    Boot, FeelTest (loop and wiring), Hud (its own scene), Tree (research and perks)
electron/      desktop shell: serves dist/, writes the save file
src/game/      run state the HUD reads, profile and save, world state, systems/ (player, gun, blade, combat, mobs, loot, camera)
```

Tuning for gun, blade, enemies, camera shake, hit-stop and loot is in `src/data/tuning.ts`. Rarity weights and item names are in `src/data/loot.ts`.

## Dev handle

In dev builds `window.__raid` exposes the game and run state, for smoke tests and console poking.

## Known limits

- Audio is synthesised and has not been tuned by ear yet. Expect to adjust gains and pitches in `src/fx/audio.ts`.
- One arena, one gun, one blade. No inventory UI, gear stats or affixes yet; loot is only rolled and counted.
- Performance has only been checked in software-rendered headless Chrome.
