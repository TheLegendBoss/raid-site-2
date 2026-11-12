# RAID SITE 2: design (living doc)

Short on purpose. It records only the decisions that are expensive to change later. Feel, art and balance stay iterative and live in code and `src/data/`. Anything marked **(OPEN)** needs a call from the owner. Numbers are starting points, not promises.

## 1. Setting and structure

**Premise.** The world is vague and covered in sealed shelters. Inside the **vaults** and **silos**, whole populations sleep in cryosleep. They were put there to be woken once machines had terraformed the planet. You are an **Aug** (short for Augmented), one of a limited number built to reclaim the world on their behalf. Something went wrong and you were woken **before the terraforming even began**. Many vaults have fallen. Tone: grimdark, with the dread of Fallout's vaults and the sealed, layered society of *Silo*, and the base-growing meta of XCOM. These are inspirations only, so names and lore stay our own.

**The long goal.** Each vault you reclaim wakes more people and grows your base. The ultimate goal is to **restart the terraforming machines** so the world can be fixed and made to live again. It is a "plant trees for shade you will never sit in" story: you will not see the world it makes.

**Hope and horror in every site.** Each site tells two stories at once. The idealistic layer is what the builders meant (seed vaults, nurseries, murals, banners for "those who come after"). The grimdark layer is what became of it (the fallen, the failed, the barricaded). Props and logs should carry both, because the contrast is the tone.

**Augs.** There are only a set number of Augs available, like the soldiers in XCOM. You play one. When it dies, you play the next one. **Research and perks you unlock persist and improve the current Aug and every future one.** Cloning arrives later as a research unlock, so death is cheap late and costly early. The rest of the Augs work in the background (XCOM's NPC soldiers), pressing outward and feeding the base. **Post-MVP, and not played.**

**Two kinds of site:**

| | Silo | Vault |
|---|---|---|
| Generation | Random, every run | Generated once per save, then fixed (from the v0.8 rule "the dungeon remembers"); authored story rooms placed in it |
| Connection | Not connected to the network | Connected: part of the network you are reclaiming |
| Lifespan | Disposable. Done when its ending is cleared | Permanent. Claiming one expands the base |
| Ending | Clear and finite: a final chamber with a Warden (boss) | Deeper, with lockdown points (below) and a story |
| Role | Test bed, loot, and the keys and gear that open vault gates | The mega dungeon: the main story and the reason to expand |

**Build order follows this table.** The MVP is the **silo**, because randomly generated dungeons with clear endings are the fastest way to test the loop and the procedural generator. After the generator works, we build the **introductory vault** (the starter vault), then **three connected vaults** that form the first mega dungeon.

**Lockdown points (vaults only, from v0.8).** A checkpoint inside a vault. Reaching one secures the floors up to it and expands the base into them. If you die before the next lockdown point, the floors you reached since the last one repopulate with enemies.

**Home base and population (XCOM-style).** A claimed vault adds cryo pods to your **population**. Population is the meta score of the reclaim and funds base growth (new facilities such as a bigger stash, a better quartermaster, a research lab, later a clone vat). Research and perks are bought at the base.

**Who are the scavengers?** **(OPEN, proposed:)** Humans from fallen vaults: sleepers woken early when their systems failed, and what survived on their own after. That makes every fight against them part of the horror layer, and they were never the enemy by choice.

## 2. Goal of the MVP

A full loop on silos, small but complete: **stash, descend a silo, fight through rooms, loot, extract or die, sell and buy, equip, run another silo.** Each silo is up to three floors of 5 to 10 rooms, with a Warden at the end. If the loop is fun for an hour, we build the introductory vault. If not, we know which part to fix.

Questions the MVP must answer:
1. Does moving room to room feel better than waves in one arena? (the "chore" question)
2. Does swapping gear change how a fight plays, not just the numbers?
3. Is the extract-or-push-on decision tense without being cruel?
4. Does the procedural generator make silos that feel different enough to run twenty of?

Pillars (from `CLAUDE.md`): sealed derelict sites that tell what happened; looter shooter where gear is the progression; expanding exploration where clearing claims and gates need things from elsewhere.

## 3. The run loop

```
BASE (stash, quartermaster, loadout)
  -> pick a silo (seeded; shows its theme and depth)
     -> ENTRY -> rooms ... -> KEY room -> GATE -> WARDEN room -> EXTRACT
  -> extract (bank carried loot to stash) or die (lose carried, keep stash and equipped)
  -> BASE: sell, buy, equip
```

- **Extract points:** one at the silo entrance and one after the Warden. Reaching either banks everything carried. Mid-floor extraction is out of scope.
- **Death:** **Carried** loot is lost. The **stash** and **equipped gear** survive. (Decided.) In the MVP the Aug simply regrows at the base. Post-MVP the Aug is lost and you play the next one from a finite pool, until research unlocks cloning.
- **Clearing a silo:** defeating the Warden ends that silo. It pays a **completion reward** (a guaranteed item roll and a vault key or access card).
- **Keys and gates:** each silo's gate needs a key found on that silo. Vault gates (later) need keys or gear dropped by silos, which is how the sites interlock.
- **Carry limit:** 10 carried slots. Full means you choose what to drop, which is the pressure that makes extracting a decision.

## 4. Player kit

| Input | What | Notes |
|---|---|---|
| Mouse + LMB | Primary weapon | Starts as the SMG: 30 round magazine, reserve ammo, tactical vs empty reload |
| RMB / F | Arc blade | Windup, lunge, cleave; cooldown; kills refund reserve ammo and shield |
| Shift / Space | Dash | Brief invulnerability; cooldown |
| R | Reload | |
| X | Extract (at an extract point only) | |

The three verbs (shoot, cut, dash) do not change in the MVP. Gear changes how well and how differently they work.

## 5. Gear

### 5.1 Slots

| Slot | Role |
|---|---|
| Primary | The gun. Defines fire pattern, ammo, reload |
| Blade | The melee. Defines reach, arc, speed, special |
| Armour | Shield and hull totals, regen, move speed |
| Pack | Ammo reserve, carry slots, dash and blade cooldown tradeoffs |

A fifth **Module** slot (grenade, shield pulse, drone) is post-MVP.

### 5.2 Base items first, affixes later

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

### 5.3 Starting item list

Enough variety that choosing matters. About 14 base items.

- **Primary:** SMG (fast, low damage), Shotgun (spread, short range, slow reload), Marksman rifle (slow, high damage, pierces), Autopistol (light, quick reload), Burst carbine (3 round bursts, tight)
- **Blade:** Arc blade (balanced), Great cleaver (slow, wide, staggers), Stiletto (fast, narrow, long lunge)
- **Armour:** Scrap plate (cheap, balanced), Assault plate (heavy: big hull, slow), Runner rig (light: fast dash, thin)
- **Pack:** Standard rig (balanced), Ammo hauler (big reserve, slow dash), Light harness (fast cooldowns, small reserve)

### 5.4 Technical model

- Item base stats and tier multipliers are data in `src/data/items.ts`.
- `src/sim/stats.ts` (pure TypeScript) resolves equipped items into one `EffectiveStats` object. Combat code reads that object and never reads `TUNING.gun` directly, so every existing tuning number becomes the "base" a gear stat modifies.
- Weapons carry a `fire` definition (pellets, spread, burst, pierce) rather than hard-coded behaviour.

## 6. Economy and base

- **Scrap** is the only currency. It drops from enemies and containers, and every item sells for scrap by rarity.
- **Quartermaster** buys and sells only. It sells common and uncommon gear at fair prices, and a few rare items at steep prices, with stock that refreshes after each run. Epic and above are **never** sold. They come from silos, Wardens and vaults, so drops stay exciting. (Decided: no rerolls or upgrades in the MVP.)
- **Stash:** 60 slots, saved locally between sessions (versioned save).
- **Costs:** respawn is free. The sinks for scrap are buying gear and expanding stash slots.
- **Selling** at the base only. No selling in the field.
- **Base growth** (post-MVP): population from claimed vaults unlocks new facilities.

## 7. Silos: floors and rooms

### 7.1 Structure

A silo is a seeded graph of up to **three floors**, each **5 to 10 rooms**, built from templates and connected by doors:

```
ENTRY -> [rooms] -> KEY room -> [rooms] -> GATE -> WARDEN -> EXTRACT
             \-> side rooms (loot, optional elites) -/
```

- A **door** is closed until the room's enemies are dead (arena rooms) or opens freely (corridors).
- Rooms have **spawn groups** drawn from the silo's enemy pool, scaled by depth.
- Side rooms hold extra loot and sometimes a tougher group. Skipping them is the "extract early" trade.
- The same seed always produces the same silo, so a good one can be replayed and a bug can be reproduced.

### 7.2 Room templates (about 12)

Arena (open), pillar arena (cover), corridor, long corridor (marksman lane), junction (3 doors), ambush closet, loot vault, key room, gate room, Warden room, entry hall, extract hall. Authored as small data (rects, doors, spawn points, prop slots) in `src/data/rooms.ts`. A generator in `src/sim/` chains them from the seed.

### 7.3 Silo themes

Each silo rolls one **theme**: a gang, a hazard, a palette and a Warden. This is what makes twenty runs feel different without twenty authored levels.

| Theme | Scav gang | Hazard | Warden |
|---|---|---|---|
| Undercroft | Pit Crew: runners, gunners | Dark rooms, steam vents | The Pit Boss |
| Relay | Wirejacks: gunners, shields, marksmen | Arcing conduits | The Lineman |
| Foundry | Slagborn: shields, bombers, elites | Molten floor lanes | The Slagmaster |

Names are placeholders. Each silo also places a few **story props** (a frozen pod bay, a sealed log, a barricaded door) that hint at what happened there.

## 8. Enemies: humans only, all scavengers

No robots or swarm creatures. Every enemy is a scav human, distinguished by gear and role. The telegraphed laser stays, as the marksman's sight.

| Enemy | Role | Behaviour | Counter |
|---|---|---|---|
| Runner | Rusher | Closes fast with a shiv, low health, dies to one blade swing | Blade, dash |
| Gunner | Skirmisher | Strafes and shoots in bursts, keeps distance | Close the gap, cover |
| Shield | Brute | Riot shield blocks the front, advances slowly | Flank, blade stagger, dash behind |
| Marksman | Sniper | Laser sight telegraphs a heavy shot | Break line of sight, dash |
| Bomber | Zoner | Throws fire bombs that deny areas | Move, shoot first |
| Elite | Mini-boss | Any of the above with extra health and one new move | |
| Warden (boss) | Boss | Three phases, calls reinforcements, one signature attack per phase | |

All enemies share one rig style (blocky plate, scrap armour, one gang colour per theme) so the art is a palette and gear swap on the same base, built in vex (`art/`).

## 9. Feel rules (carry over)

Every hit has hit-stop, shake, light flash, damage number and layered sound. Humans bleed (blood decals, no spark showers). Blade kills on lighter enemies cut them in two. New enemies get audio and hit reactions before they ship. All of it is tuned in `src/data/tuning.ts`.

## 10. Technical plan and order of work

1. **Split `FeelTest`** (done): the scene is now a 240-line loop; state lives in `src/game/world.ts`, rules in `src/game/systems/` (player, gun, blade, combat, mobs, loot, camera), effects in `src/fx/`, arena data in `src/data/arena.ts`.
2. **Stats and items:** `items.ts`, `stats.ts`, equip panel, stash saves.
3. **Base:** stash screen and quartermaster.
4. **Silo generator:** templates, seeded graph, doors, key and gate, extract points, a debug view of the graph.
5. **Humans:** redraw and implement the roster above.
6. **Themes and Wardens:** the three themes and their bosses.
7. **Playtest and tune** on silos until the loop holds.
8. **Introductory vault**, then **three connected vaults** (lockdown points, persistence, population, base growth).

Rule for every step: `npm run typecheck`, `npm run build`, run it in a browser. Pure rules stay in `src/sim/` (no `phaser` import). Tunable numbers stay in `src/data/`.

## 11. Out of scope for the MVP

Vaults, lockdown points, population and base growth, the finite Aug pool, research, perks and cloning, the background Augs, random affixes, crafting and upgrades, a Module slot, weapon swapping mid-run, co-op, a world map, multiple characters, story cutscenes, music.

## 12. Open questions

1. How many Augs in the pool, and are they individual (names, traits, a rank like XCOM soldiers) or interchangeable? Do perks belong to the Aug or to the programme? (Assumed: unlocks are shared.)
2. Who are the scavengers? (Proposed in section 1: sleepers and survivors of fallen vaults.)
3. What went wrong and woke you early? Who or what sabotaged the schedule? (Needs a shape before the introductory vault.)
4. How many floors does the introductory vault have, and what happened to the first three connected vaults?
5. Terminology: "Aug" is the player's character, and "clone" returns later as a research unlock. Should the in-game "CLONE LOST" banner and the docs move to "Aug"?
6. Keep the Neo Zero tileset out of the repo permanently, or decide later? (Currently out.)

*Resolved:* vaults are generated once per save with authored story rooms placed in them (confirmed). The rest of the team is background only.
