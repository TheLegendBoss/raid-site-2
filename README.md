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

## Flow

Title screen: **Start** goes to the base, **Dev Test** goes straight into the feel-test room with every debug key. At the base, everything works with the mouse and the keyboard: **Outfit** (equip from the stash, buy baseline gear from the quartermaster, sell or dismantle stashed items), **Missions** (Silo is deployable, Vault is sealed), **Research** and **Perks** (the trees). Outfit before you deploy: there is no outfitting in a mission. A mission ends when you extract at a pad (X, banks what you carry), die (carried loot is lost) or abort from the pause menu; either way you return to the base with a results strip.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left mouse | SMG: 30-round magazine plus reserve. Empty trigger pull auto-reloads |
| R | Reload (tactical reload is quicker than reloading from empty). Active reload, Gears style: a bar appears above the weapon with a grey ACTIVE zone and a small white PERFECT zone; press R again as the tick crosses them. Perfect loads the magazine at once and every round in it hits 25% harder; active loads it at once; a miss jams the action (the bar turns red) and sets the reload back |
| Right mouse or F | Arc blade: wind-up, lunging cleave, bisects scavengers. 0.8s cooldown; kills refund reserve ammo and shield |
| Shift or Space | Dash (brief invulnerability, 0.9s cooldown) |
| X | Extract, only while standing on a pad: the ENTRY pad where you arrive, or the EXIT pad, which stays sealed until the floor is beaten (for now: 3 waves cleared). Banks carried loot and ends the mission |
| Esc | Pause menu (resume, sound, abort mission or exit to title) |
| Tab | Dev test only: open the Research and Perk trees (at the base they are on the RESEARCH and PERKS tabs) |
| B | Dev test only: open the outfit screen over the room |
| 1 / 2 | Dev test only: spawn a scavenger swarm / a robot |
| K | Dev test only: clear all hostiles |
| T | Dev test only: reset the room |
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
src/scenes/    Boot, Title, Base (hub: outfit and missions), FeelTest (the room: dev test and missions), Hud (its own scene), Tree (research and perks), Pause
src/ui/        small shared UI helpers (menu buttons, cursor)
electron/      desktop shell: serves dist/, writes the save file
src/game/      run state the HUD reads, profile and save, world state, systems/ (player, gun, blade, combat, mobs, loot, camera)
```

Tuning for gun, blade, enemies, camera shake, hit-stop and loot is in `src/data/tuning.ts`. Rarity weights and item names are in `src/data/loot.ts`.

## Dev handle

In dev builds `window.__raid` exposes the game and run state, for smoke tests and console poking.

## Known limits

- Audio is synthesised and has not been tuned by ear yet. Expect to adjust gains and pitches in `src/fx/audio.ts`.
- One arena stands in for the Silo mission until the silo generator lands. Gear has base items and rarity tiers but no affixes or signature traits yet. The Vault is a sealed placeholder.
- Performance has only been checked in software-rendered headless Chrome.
