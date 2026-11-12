import Phaser from 'phaser';
import { TUNING as T } from '../data/tuning';

// Pixel UI kit: Waste No Space 9-slice panels and buttons (CC0), Mystery Attic icons (CC0), KabGames
// crosshair parts (CC0) and the Poco font (CC BY 4.0). Credits are in src/assets/ui/CREDITS.md.
// Everything is nearest-filtered and drawn at an integer scale so it stays crisp.

const PARTS = import.meta.glob('../assets/ui/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const uiKey = (name: string): string => `ui_${name}`;

/** Queue every UI part. Call from a scene's preload. */
export function loadUiParts(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(PARTS)) {
    const m = /\/([a-z0-9_]+)\.png$/.exec(path);
    if (m) scene.load.image(uiKey(m[1]), url);
  }
}

/** Nearest filtering for every UI texture. Call once the loader has finished. */
export function finishUiParts(scene: Phaser.Scene): void {
  for (const path of Object.keys(PARTS)) {
    const m = /\/([a-z0-9_]+)\.png$/.exec(path);
    if (m) scene.textures.get(uiKey(m[1])).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** 9-slice kinds, each a 5x5 (tabs 5x5 / 6x5) region of the Waste No Space atlas with 2 px borders. */
export type PanelKind = 'panel' | 'panel_light' | 'btn' | 'btn_hover' | 'btn_press' | 'btn_dis' | 'field' | 'sel' | 'tab_sel' | 'tab_un' | 'tip';

const BORDER = 2;

/**
 * A resizable panel. Created at the UI pixel scale, so a 2 px art border is `T.ui.px * 2` screen px.
 * Position is the top-left corner and the size is in screen px.
 */
export function uiPanel(scene: Phaser.Scene, kind: PanelKind, x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
  const k = T.ui.px;
  const n = scene.add.nineslice(x, y, uiKey(`wns_${kind}`), undefined, Math.max(2 * BORDER, Math.round(w / k)), Math.max(2 * BORDER, Math.round(h / k)), BORDER, BORDER, BORDER, BORDER);
  return n.setOrigin(0, 0).setScale(k);
}

/** Resize an existing panel in screen px. */
export function sizePanel(n: Phaser.GameObjects.NineSlice, x: number, y: number, w: number, h: number): void {
  const k = T.ui.px;
  n.setPosition(x, y);
  n.setSize(Math.max(2 * BORDER, Math.round(w / k)), Math.max(2 * BORDER, Math.round(h / k)));
}

/** An 11x11 icon at the UI icon scale, top-left origin. */
export function uiIcon(scene: Phaser.Scene, name: string, x: number, y: number, scale: number = T.ui.iconPx): Phaser.GameObjects.Image {
  return scene.add.image(x, y, uiKey(`icon_${name}`)).setOrigin(0, 0).setScale(scale);
}

/** The nearest size Poco renders crisply at. */
export function snapFont(size: number): number {
  let best: number = T.ui.fontSizes[0];
  for (const s of T.ui.fontSizes) {
    const d = Math.abs(s - size);
    const bd = Math.abs(best - size);
    if (d < bd || (d === bd && s > best)) best = s; // a tie rounds up
  }
  return best;
}

/** Put a text object's top-left corner on a whole pixel, whatever its origin, so Poco stays sharp. */
export function snapText(t: Phaser.GameObjects.Text): void {
  const w = t.width * t.scaleX;
  const h = t.height * t.scaleY;
  const lx = t.x - t.originX * w;
  const ly = t.y - t.originY * h;
  t.x += Math.round(lx) - lx;
  t.y += Math.round(ly) - ly;
}
