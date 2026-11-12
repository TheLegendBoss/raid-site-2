// The clone as stacked art parts (built in art/clone.vx.js). Facing +x; the container rotates
// with the aim. Boots stride with distance travelled, the SMG and head kick back on a shot.
import Phaser from 'phaser';
import { TUNING } from '../data/tuning';

const A = TUNING.art;

export const CLONE_PARTS = ['clone_body', 'clone_head', 'clone_arms', 'clone_boot', 'clone_sword'] as const;

export class PlayerRig {
  readonly root: Phaser.GameObjects.Container;
  private bootL: Phaser.GameObjects.Image;
  private bootR: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private arms: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private sword: Phaser.GameObjects.Image;
  private parts: Phaser.GameObjects.Image[];
  private phase = 0;
  private recoil = 0;
  private flashing = false;

  constructor(scene: Phaser.Scene, depth: number) {
    const mk = (key: string) => scene.add.image(0, 0, key).setScale(A.scale);
    this.bootL = mk('clone_boot');
    this.bootR = mk('clone_boot');
    this.body = mk('clone_body');
    this.sword = mk('clone_sword').setPosition(A.handX, A.handY).setRotation(A.swordRestRot);
    this.arms = mk('clone_arms').setOrigin(A.armsOriginX, 0.5);
    this.head = mk('clone_head');
    this.parts = [this.bootL, this.bootR, this.body, this.sword, this.arms, this.head];
    this.root = scene.add.container(0, 0, this.parts).setDepth(depth);
    this.layout(0);
  }

  /** Advance the stride by distance moved (px) and relax the recoil. */
  update(dt: number, moved: number, speedFrac: number): void {
    this.phase += moved * A.stridePerPx;
    this.recoil *= Math.exp(-A.recoilRecover * dt);
    this.layout(Math.min(1, speedFrac));
  }

  kick(): void {
    this.recoil = A.recoil;
  }

  setFlash(on: boolean): void {
    if (on === this.flashing) return;
    this.flashing = on;
    for (const p of this.parts) {
      if (on) p.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else p.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** The sprite blade is carried at rest; while the arc blade is out, the swing effect replaces it. */
  setBladeOut(out: boolean): void {
    this.sword.setVisible(!out);
  }

  setDashing(on: boolean): void {
    this.root.setScale(on ? A.dashStretch : 1, on ? 1 / A.dashStretch : 1);
  }

  setPose(x: number, y: number, rot: number): void {
    this.root.setPosition(x, y).setRotation(rot);
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v);
  }

  private layout(speedFrac: number): void {
    const s = Math.sin(this.phase) * A.strideAmp * speedFrac;
    this.bootL.setPosition(s, -A.bootY);
    this.bootR.setPosition(-s, A.bootY);
    this.arms.x = -this.recoil;
    this.head.x = -this.recoil * 0.35;
    this.body.x = -this.recoil * 0.12;
    this.sword.x = A.handX - this.recoil * 0.2;
  }
}
