// Shared context handed to every gameplay system: the scene, the world state,
// the effect services and the other systems. FeelTest fills it in create().
import Phaser from 'phaser';
import type { DamageNumbers } from '../fx/damageNumbers';
import type { Glows } from '../fx/glows';
import type { Particles } from '../fx/particles';
import type { PlayerRig } from '../fx/playerRig';
import type { Sfx } from '../fx/audio';
import type { Rng } from '../sim/math';
import type { KeyMap } from './types';
import type { World } from './world';
import type { BladeSystem } from './systems/blade';
import type { CameraSystem } from './systems/camera';
import type { CombatSystem } from './systems/combat';
import type { GunSystem } from './systems/gun';
import type { LootSystem } from './systems/loot';
import type { MobSystem } from './systems/mobs';
import type { PlayerSystem } from './systems/player';

export class Ctx {
  constructor(
    readonly scene: Phaser.Scene,
    readonly w: World,
    readonly sfx: Sfx,
    readonly rng: Rng,
  ) {}

  keys!: KeyMap;
  particles!: Particles;
  rig!: PlayerRig;
  glows!: Glows;
  nums!: DamageNumbers;
  floor!: Phaser.GameObjects.RenderTexture;
  shieldGfx!: Phaser.GameObjects.Graphics;
  bladeGfx!: Phaser.GameObjects.Graphics;
  bladeGlow!: Phaser.GameObjects.Image;
  fxGfx!: Phaser.GameObjects.Graphics;

  playerSys!: PlayerSystem;
  gunSys!: GunSystem;
  bladeSys!: BladeSystem;
  combat!: CombatSystem;
  mobSys!: MobSystem;
  lootSys!: LootSystem;
  cam!: CameraSystem;

  /** Expanding ring flourish. */
  ring(x: number, y: number, color: number, life: number, to = 5): void {
    const c = this.scene.add.circle(x, y, 14).setStrokeStyle(3, color, 1).setFillStyle(color, 0).setDepth(22);
    c.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: c, scale: to, alpha: 0, duration: life * 1000, ease: 'Cubic.easeOut',
      onComplete: () => c.destroy(),
    });
  }
}
