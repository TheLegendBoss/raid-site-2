import Phaser from 'phaser';
import { generateTextures } from '../fx/textures';
import { loadProfile } from '../game/profile';
import { CLONE_PARTS } from '../fx/playerRig';
import bodyUrl from '../assets/art/clone_body.png?url';
import headUrl from '../assets/art/clone_head.png?url';
import armsUrl from '../assets/art/clone_arms.png?url';
import bootUrl from '../assets/art/clone_boot.png?url';
import swordUrl from '../assets/art/clone_sword.png?url';

const CLONE_URLS: Record<(typeof CLONE_PARTS)[number], string> = {
  clone_body: bodyUrl,
  clone_head: headUrl,
  clone_arms: armsUrl,
  clone_boot: bootUrl,
  clone_sword: swordUrl,
};

// Loads the vex-built character parts, bakes the small effect textures from vector drawing, then
// starts the game scene with the HUD running on top as its own scene.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const key of CLONE_PARTS) this.load.image(key, CLONE_URLS[key]);
  }

  create(): void {
    generateTextures(this);
    for (const key of CLONE_PARTS) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Load the save (a file on desktop, localStorage in a browser) before the room starts.
    void loadProfile().then(() => {
      this.scene.start('FeelTest');
      this.scene.launch('Hud');
    });
  }
}
