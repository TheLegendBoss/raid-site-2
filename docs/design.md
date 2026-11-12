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
- Every weapon has a `family` (smg, shotgun, marksman, pistol, burst, and the blade types). Mods have a slot type and either a family or `universal`.

### 5.5 Finding weapons, researching mods, building parts (decided)

**Weapons are found, not unlocked.** They drop from enemies, containers, Wardens and vault rewards. The quartermaster keeps selling only baseline common and uncommon weapons, so there is always something to research. Rarity stays the stat tier and signature trait (5.2).

**Mods are researched and built.**
- Each weapon family has a node in the **Armoury tree**, with mod chips beneath it (barrel, magazine, grip or optic: 2 to 3 slots per weapon, so builds stay readable).
- **Universal techs** unlock a part type for every family at once. Example: *Extended Magazine* researched once lets every weapon take an extended mag. They sit on their own trunk of the Armoury tree and are the broad, cheaper upgrades; family chips are the specific, stronger ones.
- **Intel researches** a mod (unlocks its blueprint). **Scrap builds** copies at the base. Built parts are stash items, fitted into slots and swappable between weapons the part fits. Fitted parts survive death like other equipped gear.
- A family node appears in the Armoury, as a silhouette, the first time you find a weapon of that family. It becomes researchable once you have analysed one.

**Dismantling.** Any weapon can always be dismantled, at any rarity, never gated. The weapon is consumed. Its **Intel payout and analysis progress count only once it is back at the base**: you carry it out and dismantle it there. A weapon lost on a run gave you nothing, so extraction stays the tension point.
- Each dismantled weapon adds **analysis progress** to its family, which lowers the Intel cost of that family's mod chips (cap about 40%, to tune in `src/data/`). Duplicates therefore stay useful, and a good drop is still worth keeping rather than stripping.
- Reading assumed here: dismantling happens at the base on extracted items. Dismantling in the field is out of scope unless we decide otherwise.

**Currencies.** Intel = knowledge (research, mod blueprints, perks). Scrap = manufacturing (building parts, buying baseline gear, stash space).

## 6. Economy and base

- **Scrap** is the manufacturing currency (build parts, buy baseline gear, stash space). It drops from enemies and containers, and items sell for scrap by rarity. **Intel** is the knowledge currency (6b). Weapons can also be dismantled for Intel (5.5).
- **Quartermaster** buys and sells only. It sells common and uncommon gear at fair prices, and a few rare items at steep prices, with stock that refreshes after each run. Epic and above are **never** sold. They come from silos, Wardens and vaults, so drops stay exciting. (Decided: no rerolls or upgrades in the MVP.)
- **Stash:** 60 slots, saved to a real file on desktop (`%APPDATA%\\RAID SITE 2\\save.json`, previous copy kept as `save.bak`), versioned.
- **Costs:** respawn is free. The sinks for scrap are building mods, buying baseline gear and expanding stash slots.
- **Selling** at the base only. No selling in the field.
- **Base growth** (post-MVP): population from claimed vaults unlocks new facilities.

## 6b. Trees: research, perks and the armoury

Modelled on the aircraft tree in a flight-combat game: one big pannable graph per tree. **Main nodes** (a box with a glyph, a name, a cost) sit on a grid and are joined by trunk lines to the node they need. Small **chip nodes** hang under a main node as cheap add-ons. A node shows one of four states: owned (check mark), ready (white border), too expensive (cost in red), or locked (dimmed until its parent is owned). Owned branches light up in the branch colour.

| Tree | Spends | What it is | Status |
|---|---|---|---|
| **Research** | Intel | The programme: carry racks, ammo looms, Intel yield, shield cells and regen. Later also base facilities (stash size, quartermaster stock, research lab, clone vat) | **Live** |
| **Perks** | Intel | Aug training. **Placeholder**: today's flat bonuses (hull, dash, gun, blade) stand in until the perk design discussion; the intent is build-defining perks (section 12) | Live, to be redesigned |
| **Armoury** | Intel to research, Scrap to build | One main node per weapon family (appears once you find one), mod chips beneath, plus a universal-tech trunk whose parts fit every family. The main node shows how many of that weapon you own (the "x1" on a flight-tree aircraft). Details in 5.5 | Next, with items and the base |

- **Intel** is earned by clearing waves in the feel-test room (10 + 5 per wave, scaled by the Intel Gained stat). In silos it comes from clearing rooms, terminals and Wardens. **Scrap** stays the gear currency (section 6).
- A node does one or two plain things (flat or percent changes to a stat). No hidden mechanics, so a tree can be read at a glance.
- Data lives in `src/data/tree.ts`; unlock rules in `src/sim/tree.ts`; resolved numbers in `src/sim/stats.ts` (`EffectiveStats`); the screen is `src/scenes/Tree.ts`. Tab opens it from the room. In the base it becomes a facility.
- Research is the **programme's** knowledge and perks are the **Augs'** training. Both persist when an Aug dies, which matches the setting: the Augs are disposable, the programme is not.
- Perks are being redesigned as **build-defining** (decided); until that discussion, do not build on the current perk nodes.

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

0. **Ship as a Windows .exe** (done): Electron shell, portable build from CI, real save file. Development stays in a browser.
1. **Split `FeelTest`** (done): the scene is now a 240-line loop; state lives in `src/game/world.ts`, rules in `src/game/systems/` (player, gun, blade, combat, mobs, loot, camera), effects in `src/fx/`, arena data in `src/data/arena.ts`.
2. **Stats, trees and saves** (stats, saves, Research and Perks done): `stats.ts`, `profile.ts`, `tree.ts`. Still to do: `items.ts`, equip panel, Armoury tree.
3. **Base:** stash screen and quartermaster.
4. **Silo generator:** templates, seeded graph, doors, key and gate, extract points, a debug view of the graph.
5. **Humans:** redraw and implement the roster above.
6. **Themes and Wardens:** the three themes and their bosses.
7. **Playtest and tune** on silos until the loop holds.
8. **Introductory vault**, then **three connected vaults** (lockdown points, persistence, population, base growth).

Rule for every step: `npm run typecheck`, `npm run build`, run it in a browser. Pure rules stay in `src/sim/` (no `phaser` import). Tunable numbers stay in `src/data/`.

## 11. Out of scope for the MVP

Vaults, lockdown points, population and base growth, the finite Aug pool, cloning, base-facility research, the background Augs, random affixes, crafting and upgrades, a Module slot, weapon swapping mid-run, co-op, a world map, multiple characters, story cutscenes, music.

## 12. Open questions

1. How many Augs in the pool, and are they individual (names, traits, a rank like XCOM soldiers) or interchangeable? Do perks belong to the Aug or to the programme? (Assumed: unlocks are shared.)
2. Who are the scavengers? (Proposed in section 1: sleepers and survivors of fallen vaults.)
3. What went wrong and woke you early? Who or what sabotaged the schedule? (Needs a shape before the introductory vault.)
4. How many floors does the introductory vault have, and what happened to the first three connected vaults?
5. Terminology: "Aug" is the player's character, and "clone" returns later as a research unlock. Should the in-game "CLONE LOST" banner and the docs move to "Aug"?
6. Keep the Neo Zero tileset out of the repo permanently, or decide later? (Currently out.)

7. **Perk design (larger discussion, later).** Decided: builds are build-defining, and perks belong to each Aug, so a dead Aug takes its build with it. A research tech lets the programme **recover a share of perk points**, so a new Aug is never back at level 1. Respec is **costly**. Leaning: a **doctrine** you pick, with **prestige classes** above it, but it needs its own discussion (how doctrines are chosen, how many build slots, whether perks change what weapons and the blade do, how the Aug pool feeds in). Do not build on the current perk nodes.
8. Armoury numbers to tune: mod slots per weapon (2 or 3), analysis-progress cap (about 40%), Intel payout per rarity, universal-tech list.

*Resolved:* vaults are generated once per save with authored story rooms placed in them (confirmed). The rest of the team is background only.
