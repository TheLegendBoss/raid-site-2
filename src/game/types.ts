import type Phaser from 'phaser';
import type { MobDef, MobKind } from '../data/mobs';
import type { Item } from '../sim/loot';

export type KeyName =
  | 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'SHIFT' | 'SPACE' | 'F' | 'X' | 'R' | 'K' | 'M' | 'T' | 'H' | 'ONE' | 'TWO' | 'TAB' | 'B' | 'ESC';
export type KeyMap = Record<KeyName, Phaser.Input.Keyboard.Key>;

export type { MobKind };
export type Phase = 'move' | 'telegraph' | 'burst' | 'windup' | 'charge' | 'recover';
export type Source = 'gun' | 'sword';

export interface Mob {
  kind: MobKind;
  def: MobDef;
  gfx: Phaser.GameObjects.Graphics;
  bar?: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  facing: number;
  attackCd: number;
  flash: number;
  flashing: boolean;
  stagger: number;
  stagMeter: number; // gun stagger build-up (robots)
  stagImmune: number;
  wobble: number;
  dead: boolean;
  // robots
  phase: Phase;
  phaseTime: number;
  shotsLeft: number;
  shotTimer: number;
  shotCd: number;
  aimAngle: number;
  strafe: number;
  /** Enemy damage scale for this bunker. */
  dmgMul: number;
  // The Warden
  bossStage: number;
  bossAtk: string;
  bossCd: number;
  bossSpin: number;
  hitDone: boolean; // this charge or leap already connected
}

export interface Bullet {
  img: Phaser.GameObjects.Image;
  active: boolean;
  friendly: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  pierce: number; // extra enemies the round can pass through
  hit: Set<Mob>; // enemies already hit by this round
  ap: number; // armour penetration
  stagger: number; // stagger force
  impact: number; // hit feedback scale
  shot: number; // which trigger pull fired it (one hit-stop per shot, not per pellet)
}

export interface Drop {
  item?: Item; // gear
  scrap?: number; // loose scrap amount
  gfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  beam?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  phase: number;
  baseAlpha: number;
}

export interface Glow {
  img: Phaser.GameObjects.Image;
  active: boolean;
  t: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
}

export interface Spawn {
  kind: MobKind;
  x: number;
  y: number;
  t: number;
}

export interface SwordState {
  state: 'idle' | 'windup' | 'swing' | 'recover';
  t: number;
  angle: number;
  dir: 1 | -1;
  hit: Set<Mob>;
}

export type NumClass = 'gun' | 'blade' | 'hurt' | 'shield' | 'refund' | 'resist';

export interface DmgNum {
  txt: Phaser.GameObjects.Text;
  cls: NumClass;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}
