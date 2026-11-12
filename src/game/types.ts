import type Phaser from 'phaser';
import type { Item } from '../sim/loot';

export type KeyName =
  | 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'SHIFT' | 'SPACE' | 'F' | 'X' | 'R' | 'K' | 'M' | 'T' | 'H' | 'ONE' | 'TWO' | 'TAB';
export type KeyMap = Record<KeyName, Phaser.Input.Keyboard.Key>;

export type MobKind = 'scav' | 'robot';
export type Phase = 'move' | 'telegraph' | 'burst';
export type Source = 'gun' | 'sword';

export interface Mob {
  kind: MobKind;
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
}

export interface Drop {
  item: Item;
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

export type NumClass = 'gun' | 'blade' | 'hurt' | 'shield' | 'refund';

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
