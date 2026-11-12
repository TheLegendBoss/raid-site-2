// Pixel weapon kits: which PIXWEP parts make up each gun, and the finishes they are recoloured to.
// Plain data. Parts live in src/assets/pix/<slot>/<name>.png (CC0, Zintoki); see CREDITS.md there.

export type Rgb = readonly [number, number, number];

export interface GunKit {
  body: string;
  barrel: string;
  stock?: string;
  scope?: string;
  finish: keyof typeof FINISHES;
  /** Magazine well in the right-facing 64x32 sprite: x, y of the top, width, height (sprite px). */
  mag: readonly [number, number, number, number];
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
  smg: { body: 'body_projectile_01', barrel: 'barrel_assault', stock: 'stock_05', scope: 'scope_01', finish: 'gunmetal', mag: [25, 16, 5, 13] },
  pistol: { body: 'body_projectile_02', barrel: 'barrel_short', scope: 'laser_pointer', finish: 'gunmetal', mag: [17, 16, 5, 12] },
  magnum: { body: 'body_projectile_03', barrel: 'barrel_heavy_short', finish: 'bronze', mag: [16, 17, 5, 11] },
  shotgun: { body: 'body_projectile_03', barrel: 'barrel_heavy', stock: 'stock_03', finish: 'rust', mag: [17, 17, 5, 10] },
  marksman: { body: 'body_projectile_03', barrel: 'barrel_rifle', stock: 'stock_07', scope: 'scope_04', finish: 'gunmetal', mag: [25, 17, 5, 12] },
  burst: { body: 'body_projectile_02', barrel: 'barrel_rifle', stock: 'stock_04', scope: 'scope_02', finish: 'gunmetal', mag: [26, 17, 5, 12] },
};

/** Parts are shifted this many sprite px along the barrel so the seam with the body closes. */
export const KIT_BARREL_SHIFT = 1;

/** The mod slots a gun is built from, in display order. */
export const KIT_SLOTS = [
  { key: 'body', label: 'RECEIVER' },
  { key: 'barrel', label: 'BARREL' },
  { key: 'scope', label: 'OPTIC' },
  { key: 'stock', label: 'STOCK' },
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
};
