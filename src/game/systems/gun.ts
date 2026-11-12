import { TUNING as T } from '../../data/tuning';
import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { X0, X1, Y0, Y1, PILLARS } from '../../data/arena';
import { runState } from '../runState';
import { rollDamage } from '../../sim/damage';
import { DEG, clamp, segmentHitsCircle, segmentIntersectsRect } from '../../sim/math';
import type { Ctx } from '../ctx';

/** SMG: firing, reload and bullet flight. */
export class GunSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  updateGun(dt: number): void {
    const G = T.gun;
    const ptr = this.g.scene.input.activePointer;
    const s = runState;
    this.w.fireCd -= dt;
    this.w.bloom = Math.max(0, this.w.bloom - 14 * dt);
    s.reserve = Math.min(s.maxReserve, s.reserve + G.reserveRegenPerSec * dt);

    if (Phaser.Input.Keyboard.JustDown(this.g.keys.R)) this.startReload();
    if (this.w.reloadT >= 0) this.tickReload(dt);

    const firing = ptr.isDown && ptr.leftButtonDown();
    if (!firing || this.w.fireCd > 0 || this.w.sw.state !== 'idle' || this.w.reloadT >= 0) return;
    if (s.mag < 1) {
      // Trigger on an empty mag: reload if there is anything to load, else dry click.
      if (s.reserve >= 1) {
        this.startReload();
      } else {
        this.w.fireCd = 0.2;
        s.dryFlash = 1;
        this.g.sfx.empty();
      }
      return;
    }

    s.mag -= 1;
    s.shotSeq += 1;
    this.w.fireCd = G.fireDelay;
    const cone = (G.spread + this.w.bloom) * DEG;
    // The gun is held straight out on the clone's right, so it fires from the muzzle and converges on the cursor.
    const ca = Math.cos(this.w.aim);
    const sa = Math.sin(this.w.aim);
    const mx = this.w.px + ca * G.muzzleOffset - sa * G.muzzleSide;
    const my = this.w.py + sa * G.muzzleOffset + ca * G.muzzleSide;
    const toCursor = Math.hypot(this.w.mouseX - mx, this.w.mouseY - my) > 90
      ? Math.atan2(this.w.mouseY - my, this.w.mouseX - mx)
      : this.w.aim;
    const a = toCursor + (Math.random() - 0.5) * 2 * cone;
    const dmg = rollDamage(this.g.rng, G.damage, G.damageVariance);
    this.fireBullet(mx, my, a, G.bulletSpeed, dmg, true, G.bulletLife, 0xe9fff6, 28, 2.6);
    this.w.bloom = Math.min(5.5, this.w.bloom + 0.9);
    if (s.mag < 1 && s.reserve >= 1) this.startReload();

    // Juice: flash, light, casing, recoil, kick, noise.
    this.g.particles.emit({
      x: mx, y: my, vx: 0, vy: 0, life: 0.045, w: 40, h: 6, rot: toCursor,
      color: PALETTE.muzzle, add: true,
    });
    this.g.glows.at(mx, my, PALETTE.muzzle, 1.5, 0.8, 0.075, 0.85);
    this.g.glows.at(this.w.px, this.w.py, PALETTE.muzzle, 4.2, 3.2, 0.09, 0.14);
    const eject = this.w.aim + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.g.particles.emit({
      x: this.w.px + ca * 26 - sa * (G.muzzleSide + 2), y: this.w.py + sa * 26 + ca * (G.muzzleSide + 2),
      vx: Math.cos(eject) * (140 + Math.random() * 90), vy: Math.sin(eject) * (140 + Math.random() * 90),
      life: 0.7, w: 6, h: 3, color: 0xffd36b, drag: 3.2, spin: 16, alpha: 0.9,
    });
    this.w.pvx -= Math.cos(this.w.aim) * G.recoilImpulse;
    this.w.pvy -= Math.sin(this.w.aim) * G.recoilImpulse;
    this.w.kickX -= Math.cos(this.w.aim) * G.cameraKick;
    this.w.kickY -= Math.sin(this.w.aim) * G.cameraKick;
    this.w.trauma = Math.min(1, this.w.trauma + G.shotTrauma);
    this.g.rig.kick();
    this.g.sfx.shoot();
  }

  startReload(): void {
    const G = T.gun;
    const s = runState;
    if (this.w.reloadT >= 0 || s.mag >= s.magSize || s.reserve < 1) return;
    this.w.reloadWasEmpty = s.mag < 1;
    this.w.reloadTime = this.w.reloadWasEmpty ? G.reloadTimeEmpty : G.reloadTime;
    this.w.reloadT = 0;
    this.w.reloadMagIn = false;
    s.reload = 0;
    s.reloadEmpty = this.w.reloadWasEmpty;
    this.g.sfx.magOut();
    // The spent magazine drops to the floor beside the clone.
    const side = this.w.aim + Math.PI / 2;
    this.g.particles.emit({
      x: this.w.px + Math.cos(this.w.aim) * 10, y: this.w.py + Math.sin(this.w.aim) * 10,
      vx: Math.cos(side) * 70 + this.w.pvx * 0.3, vy: Math.sin(side) * 70 + this.w.pvy * 0.3,
      life: 0.9, w: 11, h: 5, rot: this.w.aim, color: 0x3a4a47, drag: 3.2, spin: 4,
      decal: { color: 0x1a2422, alpha: 0.7, scale: 0.28 },
    });
    this.w.kickX -= Math.cos(this.w.aim) * 2;
    this.w.kickY -= Math.sin(this.w.aim) * 2;
  }

  tickReload(dt: number): void {
    const s = runState;
    this.w.reloadT += dt;
    const p = clamp(this.w.reloadT / this.w.reloadTime, 0, 1);
    s.reload = p;
    if (!this.w.reloadMagIn && p >= T.gun.magInAt) {
      this.w.reloadMagIn = true;
      this.g.sfx.magIn();
      this.w.trauma = Math.min(1, this.w.trauma + 0.03);
    }
    if (p >= 1) this.finishReload();
  }

  finishReload(): void {
    const s = runState;
    const take = Math.min(s.magSize - s.mag, Math.floor(s.reserve));
    s.mag += take;
    s.reserve -= take;
    this.w.reloadT = -1;
    s.reload = -1;
    this.g.sfx.rack(this.w.reloadWasEmpty);
    this.g.glows.at(this.w.px, this.w.py, PALETTE.ammo, 1.6, 0.8, 0.12, 0.22);
    this.w.trauma = Math.min(1, this.w.trauma + 0.04);
  }

  fireBullet(
    x: number, y: number, angle: number, speed: number, dmg: number,
    friendly: boolean, life: number, color: number, w: number, h: number,
  ): void {
    const b = this.w.bullets.find((o) => !o.active);
    if (!b) return;
    b.active = true;
    b.friendly = friendly;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = life;
    b.dmg = dmg;
    b.img.setVisible(true).setTint(color).setPosition(x, y).setRotation(angle).setScale(w / 4, h / 4);
  }

  updateBullets(dt: number): void {
    for (const b of this.w.bullets) {
      if (!b.active) continue;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      b.life -= dt;
      let spent = b.life <= 0 || nx < X0 || nx > X1 || ny < Y0 || ny > Y1;

      if (!spent) {
        for (const r of PILLARS) {
          if (segmentIntersectsRect(b.x, b.y, nx, ny, r)) {
            spent = true;
            break;
          }
        }
        if (spent) this.wallSpark(nx, ny, Math.atan2(b.vy, b.vx), b.friendly ? PALETTE.spark : PALETTE.robot);
      }

      if (!spent && b.friendly) {
        const ang = Math.atan2(b.vy, b.vx);
        for (const m of this.w.mobs) {
          if (m.dead) continue;
          if (segmentHitsCircle(b.x, b.y, nx, ny, m.x, m.y, m.radius + 3)) {
            this.g.combat.damageMob(m, b.dmg, ang, 'gun', nx, ny);
            spent = true;
            break;
          }
        }
      } else if (!spent) {
        if (this.w.dashT <= 0 && segmentHitsCircle(b.x, b.y, nx, ny, this.w.px, this.w.py, T.player.radius + 3)) {
          this.g.playerSys.hurtPlayer(b.dmg, Math.atan2(b.vy, b.vx) + Math.PI);
          spent = true;
        }
      }

      if (spent) {
        b.active = false;
        b.img.setVisible(false);
      } else {
        b.x = nx;
        b.y = ny;
        b.img.setPosition(nx, ny);
      }
    }
  }

  wallSpark(x: number, y: number, ang: number, color: number): void {
    this.g.particles.burst(x, y, ang + Math.PI, 1.5, 5, 120, 380, {
      life: 0.22, w: 9, h: 1.6, color, add: true, drag: 3, align: true,
    });
    this.g.glows.at(x, y, color, 0.7, 0.2, 0.06, 0.5);
  }
}
