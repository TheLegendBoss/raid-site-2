// Generates the handful of small textures the effects need, from vector
// drawing at boot. There are no image assets.
import Phaser from 'phaser';

function bake(scene: Phaser.Scene, key: string, size: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, size, size);
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene): void {
  // Soft radial glow: stacked translucent discs.
  bake(scene, 'glow', 128, (g) => {
    g.fillStyle(0xffffff, 0.055);
    for (let i = 26; i >= 1; i--) g.fillCircle(64, 64, (64 * i) / 26);
  });

  // A 4x4 white square. Tinted, scaled and rotated for sparks, blood, shards.
  bake(scene, 'px', 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
  });

  // Soft blob for floor decals.
  bake(scene, 'dot', 32, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(16, 16, 15);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(16, 16, 10);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 5);
  });

  // Vignette: transparent centre, dark edge. Drawn as thin rings.
  bake(scene, 'vignette', 256, (g) => {
    const max = 181;
    for (let r = 0; r <= max; r += 2) {
      const t = Phaser.Math.Clamp((r / max - 0.28) / 0.72, 0, 1);
      const a = 0.94 * t * t * (3 - 2 * t);
      if (a <= 0.003) continue;
      g.lineStyle(2.6, 0x000000, a);
      g.strokeCircle(128, 128, r);
    }
  });
}
