// Pixel weapon kits: which PIXWEP parts make up each gun, and the finishes they are recoloured to.
// Plain data. Parts live in src/assets/pix/<slot>/<name>.png (CC0, Zintoki); see CREDITS.md there.

export type Rgb = readonly [number, number, number];

export interface GunKit {
  body: string;
  barrel: string;
  stock?: string;
  scope?: string;
  /** Underbarrel accessory (no approved parts yet). */
  under?: string;
  finish: keyof typeof FINISHES;
  /**
   * The magazine is its own sprite so it can drop out on reload: part name and its top-left in the 64x32 gun sprite.
   * Raked magazines lean rearward and drop and insert along that lean (`TUNING.pixGun.magRake`); blocks drop straight.
   */
  mag: { part: string; x: number; y: number; raked: boolean };
}

/** Four-stop ramps, dark to light. Parts are authored in purple and remapped onto these. */
export const FINISHES = {
  gunmetal: [[38, 42, 41], [78, 84, 80], [132, 138, 128], [190, 192, 180]],
  bronze: [[52, 34, 14], [112, 76, 26], [184, 140, 58], [238, 206, 120]],
  bone: [[60, 54, 42], [120, 110, 84], [190, 178, 140], [236, 226, 190]],
  rust: [[46, 22, 14], [98, 44, 24], [150, 76, 38], [206, 120, 64]],
} as const satisfies Record<string, readonly Rgb[]>;

/** Navy secondary parts (grips, handguards) are remapped onto this. */
export const FINISH_DARK: readonly Rgb[] = [[10, 12, 12], [24, 27, 27], [42, 46, 46], [70, 76, 74]];

/** Keyed by GunShape in items.ts. */
export const GUN_KITS: Record<string, GunKit> = {
  smg: { body: 'body_projectile_01', barrel: 'barrel_assault', stock: 'stock_05', scope: 'scope_01', finish: 'gunmetal', mag: { part: 'mag_curved', x: 20, y: 16, raked: true } },
  pistol: { body: 'body_projectile_02', barrel: 'barrel_short', scope: 'laser_pointer', finish: 'gunmetal', mag: { part: 'mag_stick', x: 11, y: 16, raked: true } },
  magnum: { body: 'body_projectile_03', barrel: 'barrel_heavy_short', finish: 'bronze', mag: { part: 'mag_stick', x: 11, y: 16, raked: true } },
  shotgun: { body: 'body_projectile_03', barrel: 'barrel_heavy', stock: 'stock_03', finish: 'rust', mag: { part: 'mag_block', x: 25, y: 21, raked: false } },
  marksman: { body: 'body_projectile_03', barrel: 'barrel_rifle', stock: 'stock_07', scope: 'scope_04', finish: 'gunmetal', mag: { part: 'mag_box', x: 26, y: 17, raked: false } },
  burst: { body: 'body_projectile_02', barrel: 'barrel_rifle', stock: 'stock_04', scope: 'scope_02', finish: 'gunmetal', mag: { part: 'mag_curved', x: 22, y: 16, raked: true } },
};

/** Parts are shifted this many sprite px along the barrel so the seam with the body closes. */
export const KIT_BARREL_SHIFT = 1;

/** The mod slots a gun is built from, in display order. The magazine is listed separately (it is not composited). */
export const KIT_SLOTS = [
  { key: 'body', label: 'RECEIVER' },
  { key: 'barrel', label: 'BARREL' },
  { key: 'scope', label: 'OPTIC' },
  { key: 'stock', label: 'STOCK' },
  { key: 'under', label: 'UNDER' },
] as const;

/** Display names for the parts. */
export const PART_NAMES: Record<string, string> = {
  body_projectile_01: 'Light Receiver',
  body_projectile_02: 'Standard Receiver',
  body_projectile_03: 'Heavy Receiver',
  barrel_assault: 'Shrouded Barrel',
  barrel_heavy: 'Heavy Barrel',
  barrel_heavy_short: 'Short Heavy Barrel',
  barrel_rifle: 'Rifle Barrel',
  barrel_short: 'Short Barrel',
  barrel_shorter: 'Stub Barrel',
  stock_03: 'Slab Stock',
  stock_04: 'Skeleton Stock',
  stock_05: 'Folding Stock',
  stock_07: 'Marksman Stock',
  laser_pointer: 'Laser Sight',
  scope_01: 'Red Dot',
  scope_02: 'Holo Sight',
  scope_04: 'Long Scope',
  // Our own parts (art/pixparts). Add a name here when a part is approved and exported.
  mag_stick: 'Stick Magazine',
  mag_curved: 'Curved Magazine',
  mag_block: 'Block Magazine',
  mag_box: 'Box Magazine',
};
