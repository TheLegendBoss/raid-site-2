# RAID SITE 2

A cloned super soldier pushes into a network of sealed, derelict sites. Looter shooter, real-time, top-down, keyboard and mouse. Vector art on near-black.

This repo starts as a **feel test**: one arena, one SMG, one power blade, scavenger swarms and rogue robots. The only question it answers is whether being the soldier feels heavy and good for ten minutes. Design docs come after the answer is yes.

## Design

The MVP plan (loop, gear, floors, enemies, order of work) is in [docs/design.md](docs/design.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Click the page once so the browser allows audio.

## Download

Grab `raid-site-2-vX.Y.Z.html` from the [Releases page](https://github.com/TheLegendBoss/raid-site-2/releases) and double-click it. It is one self-contained file with no server or install needed.

To cut a release: bump `version` in `package.json`, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. The `Release` workflow builds `npm run release` and attaches the file. To build it locally, run `npm run release` and open `dist-release/index.html`.

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
src/game/      shared run state the HUD reads
src/scenes/    Boot, FeelTest (the room), Hud (its own scene)
```

Tuning for gun, blade, enemies, camera shake, hit-stop and loot is in `src/data/tuning.ts`. Rarity weights and item names are in `src/data/loot.ts`.

## Dev handle

In dev builds `window.__raid` exposes the game and run state, for smoke tests and console poking.

## Known limits

- Audio is synthesised and has not been tuned by ear yet. Expect to adjust gains and pitches in `src/fx/audio.ts`.
- One arena, one gun, one blade. No inventory UI, gear stats or affixes yet; loot is only rolled and counted.
- Performance has only been checked in software-rendered headless Chrome.
