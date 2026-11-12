import Phaser from 'phaser';
import { generateTextures } from '../fx/textures';
import { loadProfile } from '../game/profile';
import { CLONE_PARTS } from '../fx/playerRig';
import bodyUrl from '../assets/art/clone_body.png?url';
import headUrl from '../assets/art/clone_head.png?url';
import armsUrl from '../assets/art/clone_arms.png?url';
import bootUrl from '../assets/art/clone_boot.png?url';
import swordUrl from '../assets/art/clone_sword.png?url';
import armsPistolUrl from '../assets/art/clone_arms_pistol.png?url';
import armsShotgunUrl from '../assets/art/clone_arms_shotgun.png?url';
import armsMarksmanUrl from '../assets/art/clone_arms_marksman.png?url';
import armsMagnumUrl from '../assets/art/clone_arms_magnum.png?url';
import armsBurstUrl from '../assets/art/clone_arms_burst.png?url';
import cleaverUrl from '../assets/art/clone_cleaver.png?url';
import stilettoUrl from '../assets/art/clone_stiletto.png?url';

const CLONE_URLS: Record<(typeof CLONE_PARTS)[number], string> = {
  clone_body: bodyUrl,
  clone_head: headUrl,
  clone_arms: armsUrl,
  clone_boot: bootUrl,
  clone_sword: swordUrl,
  clone_arms_pistol: armsPistolUrl,
  clone_arms_shotgun: armsShotgunUrl,
  clone_arms_marksman: armsMarksmanUrl,
  clone_arms_magnum: armsMagnumUrl,
  clone_arms_burst: armsBurstUrl,
  clone_cleaver: cleaverUrl,
  clone_stiletto: stilettoUrl,
};

// Loads the vex-built character parts, bakes the small effect textures from vector drawing, loads
// the save, then hands over to the title screen.
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
      this.scene.start('Title');
    });
  }
}
