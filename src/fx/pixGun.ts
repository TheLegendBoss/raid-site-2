import Phaser from 'phaser';
import { FINISHES, FINISH_DARK, GUN_KITS, KIT_BARREL_SHIFT, type Rgb } from '../data/gunKits';

// Composes PIXWEP parts (stock, body, barrel, scope) into one gun sprite per weapon shape, remaps the
// authored purple ramp onto the kit's finish, flips it to face right, and registers it as a texture.
// Pixel art, so these textures use NEAREST filtering.

const PARTS = import.meta.glob('../assets/pix/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const W = 64;
const H = 32;
// Back to front. The magazine is not in here: it is baked on its own.
const ORDER = ['stock', 'body', 'barrel', 'under', 'scope'] as const;

/** Where the bore ends in each baked sprite (sprite px, right-facing), found from the alpha at bake time. */
export const pixMuzzle: Record<string, { x: number; y: number }> = {};

export const pixGunKey = (shape: string): string => `pixgun_${shape}`;
/** The magazine is its own texture so the HUD can drop it out of the well on reload. */
export const pixMagKey = (shape: string): string => `pixmag_${shape}`;
export const pixPartKey = (slot: string, name: string): string => `pix_${slot}_${name}`;

/** Queue every part for loading. Call from a scene's preload. */
export function loadPixParts(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(PARTS)) {
    const m = /pix\/([a-z]+)\/([a-z0-9_]+)\.png$/.exec(path);
    if (m) scene.load.image(pixPartKey(m[1], m[2]), url);
  }
}

function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(stops: readonly Rgb[], t: number): Rgb {
  const c = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(c * n));
  return lerp(stops[i], stops[i + 1], c * n - i);
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

/** Remap the purple body ramp and the navy secondary parts onto a finish. */
function recolour(img: ImageData, stops: readonly Rgb[]): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [h, s, v] = rgbToHsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    let c: Rgb | null = null;
    if (h >= 0.72 && h <= 0.95 && s > 0.45 && v > 0.3) c = ramp(stops, (v - 0.35) / 0.62);
    else if (h >= 0.55 && h < 0.72 && v < 0.6 && v > 0.12) c = ramp(FINISH_DARK, (v - 0.12) / 0.45);
    if (c) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    }
  }
}

/** Bake one texture per kit. Call after the parts have loaded. */
export function bakePixGuns(scene: Phaser.Scene): void {
  for (const [shape, kit] of Object.entries(GUN_KITS)) {
    const key = pixGunKey(shape);
    if (scene.textures.exists(key)) continue;
    const work = document.createElement('canvas');
    work.width = W;
    work.height = H;
    const ctx = work.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    for (const slot of ORDER) {
      const name = kit[slot];
      if (!name) continue;
      const src = scene.textures.get(pixPartKey(slot, name)).getSourceImage() as CanvasImageSource;
      ctx.drawImage(src, slot === 'barrel' ? KIT_BARREL_SHIFT : 0, 0);
    }
    const img = ctx.getImageData(0, 0, W, H);
    recolour(img, FINISHES[kit.finish]);
    ctx.putImageData(img, 0, 0);
    // Muzzle: guns are authored facing left, so the leftmost opaque column is the barrel tip. Once
    // mirrored it sits at W - column. The bore row is the mean of that column's opaque pixels.
    {
      const opaque = (x: number, y: number): boolean => img.data[(y * W + x) * 4 + 3] > 0;
      let col = 0;
      while (col < W - 1 && !Array.from({ length: H }, (_, y) => opaque(col, y)).some(Boolean)) col++;
      let sum = 0;
      let n = 0;
      for (let y = 0; y < H; y++) {
        if (opaque(col, y)) {
          sum += y;
          n++;
        }
      }
      pixMuzzle[shape] = { x: W - col, y: n ? sum / n + 0.5 : H / 2 };
    }

    // Guns are authored facing left; mirror so they face right like the rest of the HUD.
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const octx = out.getContext('2d');
    if (!octx) continue;
    octx.translate(W, 0);
    octx.scale(-1, 1);
    octx.drawImage(work, 0, 0);
    scene.textures.addCanvas(key, out)?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // The magazine: a small right-facing sprite, recoloured with the same finish.
    const mkey = pixMagKey(shape);
    if (!scene.textures.exists(mkey)) {
      const msrc = scene.textures.get(pixPartKey('mag', kit.mag.part)).getSourceImage() as HTMLImageElement;
      const mc = document.createElement('canvas');
      mc.width = msrc.width;
      mc.height = msrc.height;
      const mctx = mc.getContext('2d', { willReadFrequently: true });
      if (!mctx) continue;
      mctx.drawImage(msrc, 0, 0);
      const mimg = mctx.getImageData(0, 0, mc.width, mc.height);
      recolour(mimg, FINISHES[kit.finish]);
      mctx.putImageData(mimg, 0, 0);
      scene.textures.addCanvas(mkey, mc)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
