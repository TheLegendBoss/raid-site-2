// Pause menu over the room. In a mission, leaving aborts it (the haul is lost, like dying
// without the death); in the dev test it just goes back to the title.
import Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../data/palette';
import { getSfx } from '../fx/audio';
import { Menu } from '../ui/menu';
import { showCursor } from '../ui/cursor';
import { sizePanel, uiPanel } from '../ui/pixelUi';

export interface PauseData {
  mission: boolean;
  onLeave: () => void;
}

export class Pause extends Phaser.Scene {
  private data0!: PauseData;
  private menu!: Menu;
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.NineSlice;
  private head!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private armed = false;

  constructor() {
    super('Pause');
  }

  init(data: PauseData): void {
    this.data0 = data;
  }

  create(): void {
    const sfx = getSfx();
    showCursor(this, true);
    this.armed = false;
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.66).setOrigin(0, 0).setDepth(0);
    this.card = uiPanel(this, 'panel', 0, 0, 10, 10).setDepth(1).setAlpha(0.96);
    this.head = this.add
      .text(0, 0, 'PAUSED', { fontFamily: FONT, fontSize: '48px', color: '#ffffff' })
      .setOrigin(0.5).setResolution(1).setDepth(5);
    this.note = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: hex(PALETTE.textDim), align: 'center' })
      .setOrigin(0.5, 0).setResolution(1).setDepth(5);
    const mission = this.data0.mission;
    this.menu = new Menu(
      this,
      [
        { label: 'RESUME', run: () => this.resume() },
        { label: sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', sub: 'Toggle all audio', run: () => this.toggleSound() },
        {
          label: mission ? 'ABORT MISSION' : 'EXIT TO TITLE',
          sub: mission ? 'Back to base. The haul is lost.' : undefined,
          run: () => this.leave(),
        },
      ],
      340, 54, 12, () => sfx.step(), () => sfx.empty(),
    );
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,W,S,ENTER,SPACE,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('gameout', () => this.menu.pointerOut());
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.menu.destroy();
    });
    this.layout();
    // The ESC that opened this menu is still held; ignore it until it is released.
    this.time.delayedCall(120, () => (this.armed = true));
  }

  private toggleSound(): void {
    const sfx = getSfx();
    sfx.setMuted(!sfx.muted);
    // Rebuilding keeps the label honest; the menu is three buttons.
    this.menu.destroy();
    this.scene.restart(this.data0);
  }

  private resume(): void {
    showCursor(this, false);
    this.scene.resume('FeelTest');
    this.scene.stop();
  }

  private leave(): void {
    this.scene.stop();
    this.data0.onLeave();
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.dim.setSize(w, h);
    const top = h * 0.5 - 150;
    this.head.setPosition(w / 2, top);
    this.menu.layout(w / 2, top + 50);
    this.note.setPosition(w / 2, top + 50 + this.menu.height + 20).setText('ESC to resume');
    // A panel behind the title, the buttons and the note.
    const pw = 420;
    const ph = 50 + this.menu.height + 20 + 28 + 56;
    sizePanel(this.card, Math.round(w / 2 - pw / 2), Math.round(top - 56), pw, ph);
  }

  update(): void {
    const K = Phaser.Input.Keyboard;
    if (!this.armed) return;
    if (K.JustDown(this.keys.ESC)) return this.resume();
    if (K.JustDown(this.keys.UP) || K.JustDown(this.keys.W)) this.menu.move(-1);
    if (K.JustDown(this.keys.DOWN) || K.JustDown(this.keys.S)) this.menu.move(1);
    if (K.JustDown(this.keys.ENTER) || K.JustDown(this.keys.SPACE)) this.menu.activate();
  }
}
