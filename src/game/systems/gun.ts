import { TUNING as T } from '../../data/tuning';
import { profile } from '../profile';
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

  private shotId = 0;

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  updateGun(dt: number): void {
    const G = T.gun;
    const wp = profile.stats.weapon;
    const ptr = this.g.scene.input.activePointer;
    const s = runState;
    this.w.fireCd -= dt;
    this.w.bloom = Math.max(0, this.w.bloom - wp.bloomRecovery * dt);
    s.reserve = Math.min(s.maxReserve, s.reserve + G.reserveRegenPerSec * dt);

    if (Phaser.Input.Keyboard.JustDown(this.g.keys.R)) {
      if (this.w.reloadT >= 0) this.activeReloadPress();
      else this.startReload();
    }
    if (this.w.reloadT >= 0) {
      this.w.burstLeft = 0;
      this.tickReload(dt);
    }

    // The rest of a burst fires on its own timer, whatever the trigger does.
    if (this.w.burstLeft > 0) {
      this.w.burstTimer -= dt;
      if (this.w.burstTimer <= 0) {
        if (s.mag >= 1) {
          this.fireRound(wp);
          this.w.burstLeft -= 1;
          this.w.burstTimer = wp.burstGap;
        } else {
          this.w.burstLeft = 0;
        }
      }
      return;
    }

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

    this.fireRound(wp);
    this.w.fireCd = wp.fireDelay;
    if (wp.burstCount > 1) {
      this.w.burstLeft = wp.burstCount - 1;
      this.w.burstTimer = wp.burstGap;
    }
  }

  /** One round (or one shell of pellets) leaves the weapon, with all its juice. */
  private fireRound(wp: typeof profile.stats.weapon): void {
    const s = runState;
    s.mag -= 1;
    s.shotSeq += 1;
    // Accuracy: base spread, plus bloom from recent shots, plus extra while running (Intravenous 2 style).
    const speedFrac = clamp(Math.hypot(this.w.pvx, this.w.pvy) / T.player.maxSpeed, 0, 1);
    const cone = (profile.stats.spread + this.w.bloom + wp.moveSpread * speedFrac) * DEG;
    this.shotId += 1;
    // The weapon is held straight out on the clone's right, so it fires from the muzzle and converges on the cursor.
    const ca = Math.cos(this.w.aim);
    const sa = Math.sin(this.w.aim);
    const mx = this.w.px + ca * wp.muzzleOffset - sa * wp.muzzleSide;
    const my = this.w.py + sa * wp.muzzleOffset + ca * wp.muzzleSide;
    const toCursor = Math.hypot(this.w.mouseX - mx, this.w.mouseY - my) > 90
      ? Math.atan2(this.w.mouseY - my, this.w.mouseX - mx)
      : this.w.aim;
    for (let i = 0; i < wp.pellets; i++) {
      const a = toCursor + (Math.random() - 0.5) * 2 * cone;
      const dmg = Math.round(rollDamage(this.g.rng, profile.stats.gunDamage, wp.damageVariance) * (this.w.hotMag ? 1 + T.gun.activeReload.bonusDamage : 1));
      this.fireBullet(mx, my, a, wp.bulletSpeed, dmg, true, wp.bulletLife, 0xe9fff6, wp.bulletW, wp.bulletH, wp.pierce,
        { ap: wp.ap, stagger: wp.stagger / Math.sqrt(wp.pellets), impact: wp.impact, shot: this.shotId });
    }
    this.w.bloom = Math.min(wp.bloomMax, this.w.bloom + wp.bloomPerShot);
    if (s.mag < 1) {
      this.w.hotMag = false;
      s.hotMag = false;
    }
    if (s.mag < 1 && s.reserve >= 1) this.startReload();

    // Juice: flash, light, casing, recoil, kick, noise. Heavier weapons flash and kick bigger.
    const heft = wp.heft;
    this.g.particles.emit({
      x: mx, y: my, vx: 0, vy: 0, life: 0.045, w: 40 * heft, h: 6 * heft, rot: toCursor,
      color: PALETTE.muzzle, add: true,
    });
    this.g.glows.at(mx, my, PALETTE.muzzle, 1.5 * heft, 0.8, 0.075, 0.85);
    this.g.glows.at(this.w.px, this.w.py, PALETTE.muzzle, 4.2 * heft, 3.2, 0.09, 0.14);
    const eject = this.w.aim + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.g.particles.emit({
      x: this.w.px + ca * 26 - sa * (wp.muzzleSide + 2), y: this.w.py + sa * 26 + ca * (wp.muzzleSide + 2),
      vx: Math.cos(eject) * (140 + Math.random() * 90), vy: Math.sin(eject) * (140 + Math.random() * 90),
      life: 0.7, w: wp.pellets > 1 ? 9 : 6, h: 3, color: wp.pellets > 1 ? 0xc2261d : 0xffd36b, drag: 3.2, spin: 16, alpha: 0.9,
    });
    this.w.pvx -= Math.cos(this.w.aim) * wp.recoilImpulse;
    this.w.pvy -= Math.sin(this.w.aim) * wp.recoilImpulse;
    this.w.kickX -= Math.cos(this.w.aim) * wp.cameraKick;
    this.w.kickY -= Math.sin(this.w.aim) * wp.cameraKick;
    this.w.trauma = Math.min(1, this.w.trauma + wp.shotTrauma);
    this.g.rig.kick();
    this.g.sfx.shoot(wp.sound);
    // Heavy guns punch the view: a camera zoom thump and a brief screen-space shockwave at the muzzle.
    if (heft > 1.2) {
      this.w.zoomPunch = Math.min(0.06, this.w.zoomPunch + (heft - 1.2) * T.juice.heavyShotZoom);
      this.g.ring(mx, my, PALETTE.muzzle, T.juice.heavyShotRing * heft, 3 + heft * 2);
      this.g.particles.burst(mx, my, toCursor, 0.5, Math.round(3 + heft * 3), 140, 520, {
        life: 0.22, w: 10 * heft, h: 1.8, color: PALETTE.muzzle, add: true, drag: 3, align: true,
      });
    }
  }

  startReload(): void {
    const s = runState;
    if (this.w.reloadT >= 0 || s.mag >= s.magSize || s.reserve < 1) return;
    this.w.reloadWasEmpty = s.mag < 1;
    this.w.reloadTime = this.w.reloadWasEmpty ? profile.stats.reloadTimeEmpty : profile.stats.reloadTime;
    this.w.reloadT = 0;
    this.w.reloadMagIn = false;
    this.w.reloadFumbled = false;
    this.w.hotMag = false; // the old magazine and its bonus drop to the floor
    s.hotMag = false;
    s.reload = 0;
    s.reloadEmpty = this.w.reloadWasEmpty;
    const AR = T.gun.activeReload;
    const half = profile.stats.activeWidth / 2;
    s.reloadWin0 = AR.start - half;
    s.reloadWin1 = AR.start + half;
    s.reloadGood0 = s.reloadWin0 - AR.goodPad;
    s.reloadGood1 = s.reloadWin1 + AR.goodPad;
    s.activeResult = '';
    s.activeFlash = 0;
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

  /** Second R press during a reload: inside the window it finishes hot, outside it fumbles once. */
  private activeReloadPress(): void {
    const s = runState;
    const AR = T.gun.activeReload;
    if (this.w.reloadFumbled) return;
    const p = s.reload;
    s.reloadMark = p;
    const perfect = p >= s.reloadWin0 && p <= s.reloadWin1;
    const good = p >= s.reloadGood0 && p <= s.reloadGood1;
    if (perfect || good) {
      if (!this.w.reloadMagIn) {
        this.w.reloadMagIn = true;
        this.g.sfx.magIn();
      }
      this.finishReload(perfect);
      s.activeFlash = 1;
      s.activeResult = perfect ? 'perfect' : 'good';
      this.g.sfx.activeReload(perfect);
      this.g.glows.at(this.w.px, this.w.py, perfect ? PALETTE.white : PALETTE.ammo, perfect ? 2.6 : 1.8, 1.3, 0.16, perfect ? 0.35 : 0.22);
      this.w.trauma = Math.min(1, this.w.trauma + (perfect ? 0.07 : 0.04));
      this.g.rig.kick();
    } else {
      this.w.reloadFumbled = true;
      this.w.reloadT = Math.max(0, this.w.reloadT - AR.fumbleSetback * this.w.reloadTime);
      s.reload = clamp(this.w.reloadT / this.w.reloadTime, 0, 1);
      if (s.reload < T.gun.magInAt) this.w.reloadMagIn = false;
      s.activeFlash = 1;
      s.activeResult = 'fumble';
      this.g.sfx.reloadJam();
      this.w.trauma = Math.min(1, this.w.trauma + 0.05);
    }
  }

  finishReload(hot = false): void {
    const s = runState;
    this.w.hotMag = hot;
    s.hotMag = hot;
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
    friendly: boolean, life: number, color: number, w: number, h: number, pierce = 0,
    extra: { ap: number; stagger: number; impact: number; shot: number } = { ap: 0, stagger: 0, impact: 0, shot: 0 },
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
    b.pierce = pierce;
    b.ap = extra.ap;
    b.stagger = extra.stagger;
    b.impact = extra.impact;
    b.shot = extra.shot;
    b.hit.clear();
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
          if (m.dead || b.hit.has(m)) continue;
          if (segmentHitsCircle(b.x, b.y, nx, ny, m.x, m.y, m.radius + 3)) {
            this.g.combat.damageMob(m, b.dmg, ang, 'gun', nx, ny, ang, b);
            b.hit.add(m);
            if (b.pierce > 0) b.pierce -= 1;
            else spent = true;
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
