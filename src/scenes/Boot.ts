import Phaser from 'phaser';
import { generateTextures } from '../fx/textures';

// Bakes the small effect textures from vector drawing, then starts the game
// scene with the HUD running on top as its own scene.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);
    this.scene.start('FeelTest');
    this.scene.launch('Hud');
  }
}
