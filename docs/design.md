# RAID SITE 2: design (living doc)

Short on purpose. It records only the decisions that are expensive to change later. Feel, art and balance stay iterative and live in code and `src/data/`. Anything marked **(OPEN)** needs a call from the owner. Numbers are starting points, not promises.

## 1. Goal of the MVP

A full loop, small but complete: **stash, descend, fight through rooms, loot, extract or die, sell and buy, equip, go deeper.** Three floors, each 5 to 10 rooms, one boss at the bottom of each. If the loop is fun for an hour, we expand. If not, we know which part to fix.

Questions the MVP must answer:
1. Does moving room to room feel better than waves in one arena? (the "chore" question)
2. Does swapping gear change how a fight plays, not just the numbers?
3. Is the extract-or-push-on decision tense without being cruel?

Pillars (from `CLAUDE.md`): sealed derelict sites that tell what happened; looter shooter where gear is the progression; expanding exploration where clearing claims and gates need things from elsewhere.

## 2. The run loop

```
HUB (stash, quartermaster, loadout)
  -> pick a site (floors unlock in order)
     -> ENTRY room -> rooms ... -> KEY room -> GATE -> BOSS room -> EXTRACT
  -> extract (bank carried loot to stash) or die (lose carried, keep stash)
  -> HUB: sell, buy, equip
```

- **Extract points:** one at the site entrance and one after the boss. Reaching either banks everything carried. Floors are short, so mid-floor extraction is out of scope.
- **Death:** the clone regrows at the hub. **Carried** loot is lost. **Stash** and **equipped** gear survive. **(OPEN: do equipped items survive death? Recommended default: yes. Losing your loadout every death is brutal for a first MVP.)**
- **Claiming:** clearing a site's boss marks it **claimed**. A claimed site is cheaper to re-enter (the gate stays open, the entry shortcut to the boss room is unlocked) and unlocks the next floor.
- **Gates:** each floor's gate needs a **key** found on that floor, and floor 2 and 3 entry needs the previous floor claimed. Later (post-MVP) keys can come from other sites, which is how the map starts to interlock.
- **Carry limit:** 10 carried slots. Full means you choose what to drop, which is the pressure that makes extracting a decision.

## 3. Player kit

| Input | What | Notes |
|---|---|---|
| Mouse + LMB | Primary weapon | Starts as the SMG: 30 round magazine, reserve ammo, tactical vs empty reload |
| RMB / F | Arc blade | Windup, lunge, cleave; cooldown; kills refund reserve ammo and shield |
| Shift / Space | Dash | Brief invulnerability; cooldown |
| R | Reload | |
| X | Extract (at an extract point only) | |

The three verbs (shoot, cut, dash) do not change in the MVP. Gear changes how well and how differently they work.

## 4. Gear

### 4.1 Slots

| Slot | Role |
|---|---|
| Primary | The gun. Defines fire pattern, ammo, reload |
| Blade | The melee. Defines reach, arc, speed, special |
| Armour | Shield and hull totals, regen, move speed |
| Pack | Ammo reserve, carry slots, dash and blade cooldown tradeoffs |

A fifth **Module** slot (grenade, shield pulse, drone) is post-MVP.

### 4.2 Base items first, affixes later

Rarity sets a **stat tier**, not random rolls. A few higher-rarity items carry one fixed **signature trait** (a single named effect, for example "kills refund 2 magazine rounds"). Random affixes are a post-MVP system, added once the base items are fun.

| Rarity | Tier multiplier (all base stats) | Signature trait |
|---|---|---|
| Common | 1.00 | no |
| Uncommon | 1.08 | no |
| Rare | 1.18 | no |
| Very Rare | 1.30 | sometimes |
| Epic | 1.45 | yes |
| Legendary | 1.65 | yes |
| Aercho | 1.90 | yes, unique |

(Rarity names match `src/data/loot.ts`. Multipliers live in `src/data/`.)

### 4.3 Starting item list

Enough variety that choosing matters. About 14 base items.

- **Primary:** SMG (fast, low damage), Shotgun (spread, short range, slow reload), Marksman rifle (slow, high damage, pierces), Autopistol (light, quick reload), Burst carbine (3 round bursts, tight)
- **Blade:** Arc blade (balanced), Great cleaver (slow, wide, staggers), Stiletto (fast, narrow, long lunge)
- **Armour:** Scrap plate (cheap, balanced), Assault plate (heavy: big hull, slow), Runner rig (light: fast dash, thin)
- **Pack:** Standard rig (balanced), Ammo hauler (big reserve, slow dash), Light harness (fast cooldowns, small reserve)

### 4.4 Technical model

- Item base stats and tier multipliers are data in `src/data/items.ts`.
- `src/sim/stats.ts` (pure TypeScript) resolves equipped items into one `EffectiveStats` object. Combat code reads that object and never reads `TUNING.gun` directly, so every existing tuning number becomes the "base" a gear stat modifies.
- Weapons carry a `fire` definition (pellets, spread, burst, pierce) rather than hard-coded behaviour.

## 5. Economy and hub

- **Scrap** is the only currency. It drops from enemies and containers, and every item sells for scrap by rarity.
- **Quartermaster** sells common and uncommon gear at fair prices, and a few rare items at steep prices. The stock refreshes after each run. Epic and above are **never** sold. They come from floors and bosses, so drops stay exciting.
- **Stash:** 60 slots, saved locally between sessions (versioned save).
- **Costs:** respawn is free. The sink for scrap is buying gear and expanding stash slots.
- **Selling** from the hub only. No selling in the field.

**(OPEN: should the quartermaster also reroll or upgrade items? Recommended: not in the MVP.)**

## 6. Sites, floors and rooms

### 6.1 Structure

A floor is a graph of **5 to 10 rooms**, each built from a template, connected by doors:

```
ENTRY -> [rooms] -> KEY room -> [rooms] -> GATE -> BOSS -> EXTRACT
             \-> side rooms (loot, optional elites) -/
```

- A **door** is closed until the room's enemies are dead (arena rooms) or opens freely (corridors).
- Rooms have **spawn groups** drawn from the floor's enemy pool, scaled by depth in the floor.
- Side rooms hold extra loot and sometimes a tougher group. Skipping them is the "extract early" trade.

### 6.2 Room templates (about 12)

Arena (open), pillar arena (cover), corridor, long corridor (marksman lane), junction (3 doors), ambush closet, loot vault, key room, gate room, boss room, entry hall, extract hall. Authored as small data (rects, doors, spawn points, prop slots) in `src/data/rooms.ts`. A generator in `src/sim/` chains them with a seeded RNG so floors are reproducible.

### 6.3 Floors

| Floor | Working name | Scav gang | Hazard | Boss |
|---|---|---|---|---|
| 1 | Undercroft | Pit Crew: runners, gunners | Dark rooms, steam vents | Warlord's lieutenant |
| 2 | Relay Station | Wirejacks: gunners, shields, marksmen | Arcing conduits | The Warlord |
| 3 | Foundry | Slagborn: shields, bombers, elites | Molten floor lanes | Warlord's champion + retinue |

**(OPEN: the setting. Each floor should tell part of what happened to the site. Names, gangs and bosses above are placeholders until you decide the story.)** The `Floor` data entry holds room count, enemy pool, hazards, boss, palette and the props/story fragments in each room.

## 7. Enemies: humans only, all scavengers

No robots or swarm creatures. Every enemy is a scav human, distinguished by gear and role. The telegraphed laser stays, as the marksman's sight.

| Enemy | Role | Behaviour | Counter |
|---|---|---|---|
| Runner | Rusher | Closes fast with a shiv, low health, dies to one blade swing | Blade, dash |
| Gunner | Skirmisher | Strafes and shoots in bursts, keeps distance | Close the gap, cover |
| Shield | Brute | Riot shield blocks the front, advances slowly | Flank, blade stagger, dash behind |
| Marksman | Sniper | Laser sight telegraphs a heavy shot | Break line of sight, dash |
| Bomber | Zoner | Throws fire bombs that deny areas | Move, shoot first |
| Elite | Mini-boss | Any of the above with extra health and one new move | |
| Warlord (boss) | Boss | Three phases, calls reinforcements, one signature attack per phase | |

All enemies share one rig style (blocky plate, scrap armour, one gang colour per floor) so the art is a palette and gear swap on the same base, built in vex (`art/`).

## 8. Feel rules (carry over)

Every hit has hit-stop, shake, light flash, damage number and layered sound. Humans bleed (blood decals, no spark showers). Blade kills on lighter enemies cut them in two. New enemies get audio and hit reactions before they ship. All of it is tuned in `src/data/tuning.ts`.

## 9. Technical plan and order of work

1. **Split `FeelTest`** (about 1,700 lines) into player, enemies, projectiles, loot, waves and the scene shell. Behaviour must not change. Check against today's build.
2. **Stats and items:** `items.ts`, `stats.ts`, equip panel, stash saves.
3. **Hub:** stash screen and quartermaster.
4. **Rooms and floors:** templates, generator, doors, key and gate, extract points.
5. **Humans:** redraw and implement the roster above, floor by floor.
6. **Floors 2 and 3, bosses:** data and the new enemies they need.
7. **Playtest and tune.**

Rule for every step: `npm run typecheck`, `npm run build`, run it in a browser. Pure rules stay in `src/sim/` (no `phaser` import). Tunable numbers stay in `src/data/`.

## 10. Out of scope for the MVP

Random affixes, crafting and upgrades, a Module slot, weapon swapping mid-run, co-op, a world map beyond the three-site list, multiple characters, story cutscenes, music.

## 11. Open questions

1. Do equipped items survive death? (Section 2. Recommended: yes.)
2. Does the quartermaster do anything besides sell and buy? (Section 5. Recommended: no.)
3. What happened at these sites? Floor names, gangs and the boss story (Section 6.3).
4. Do the three floors count as one descent, or three separate sites on a tiny map? (Recommended for the MVP: pick from a list at the hub.)
5. Keep the Neo Zero tileset out of the repo permanently, or decide later? (Currently out.)
