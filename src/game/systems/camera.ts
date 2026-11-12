import { TUNING as T } from '../../data/tuning';
import { W, H } from '../../data/arena';
import { clamp } from '../../sim/math';
import type { Ctx } from '../ctx';

/** Follow, shake, kick and zoom punch. */
export class CameraSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  applyCamera(dt: number, frozen: boolean): void {
    const C = T.camera;
    const cam = this.g.scene.cameras.main;
    const tx = this.w.px + (this.w.mouseX - this.w.px) * C.lookAhead;
    const ty = this.w.py + (this.w.mouseY - this.w.py) * C.lookAhead;
    if (!frozen) {
      const k = 1 - Math.exp(-C.followLerp * dt);
      this.w.camX += (tx - this.w.camX) * k;
      this.w.camY += (ty - this.w.camY) * k;
    }
    const z = C.zoom * (1 + this.w.zoomPunch);
    cam.setZoom(z);
    const vw = cam.width / z;
    const vh = cam.height / z;
    const cx = vw >= W ? W / 2 : clamp(this.w.camX, vw / 2, W - vw / 2);
    const cy = vh >= H ? H / 2 : clamp(this.w.camY, vh / 2, H - vh / 2);
    const shake = this.w.trauma * this.w.trauma * C.shakeMaxOffset;
    cam.centerOn(
      cx + (Math.random() * 2 - 1) * shake + this.w.kickX,
      cy + (Math.random() * 2 - 1) * shake + this.w.kickY,
    );
    if (!frozen) {
      this.w.trauma = Math.max(0, this.w.trauma - C.traumaDecay * dt);
      const kd = Math.exp(-C.kickDecay * dt);
      this.w.kickX *= kd;
      this.w.kickY *= kd;
      this.w.zoomPunch *= Math.exp(-C.zoomPunchDecay * dt);
    }
  }
}
