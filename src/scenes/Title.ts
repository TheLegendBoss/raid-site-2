// The start screen: START goes to the base, DEV TEST goes straight into the feel-test room.
import Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../data/palette';
import { getSfx } from '../fx/audio';
import { Menu } from '../ui/menu';
import { showCursor } from '../ui/cursor';

export class Title extends Phaser.Scene {
  private menu!: Menu;
  private grid!: Phaser.GameObjects.Graphics;
  private scan!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private tag!: Phaser.GameObjects.Text;
  private foot!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private t = 0;
  private leaving = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.leaving = false;
    showCursor(this, true);
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.cameras.main.fadeIn(350, 2, 6, 8);
    const sfx = getSfx();
    const unlock = (): void => sfx.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard!.on('keydown', unlock);

    this.grid = this.add.graphics().setDepth(0);
    this.scan = this.add.rectangle(0, 0, 10, 2, PALETTE.structure, 0.12).setOrigin(0, 0).setDepth(1);
    this.title = this.add
      .text(0, 0, 'RAID SITE 2', { fontFamily: FONT, fontSize: '84px', color: '#ffffff' })
      .setOrigin(0.5, 0.5).setResolution(2).setDepth(5);
    this.title.setShadow(0, 0, hex(PALETTE.structure), 22, false, true);
    this.tag = this.add
      .text(0, 0, 'RECLAIM THE DERELICT WORLD', { fontFamily: FONT, fontSize: '16px', color: hex(PALETTE.textDim) })
      .setOrigin(0.5, 0.5).setResolution(2).setDepth(5);
    this.foot = this.add
      .text(0, 0, '↑ ↓ select   ENTER confirm   or use the mouse', { fontFamily: FONT, fontSize: '13px', color: hex(PALETTE.textDim) })
      .setOrigin(0.5, 1).setResolution(2).setDepth(5);

    this.menu = new Menu(
      this,
      [
        { label: 'START', sub: 'Go to the base', run: () => this.go('Base', { mode: 'hub' }) },
        { label: 'DEV TEST', sub: 'The feel-test room: every key, every system', run: () => this.go('FeelTest', { mode: 'dev' }) },
      ],
      360, 58, 14, () => sfx.step(), () => sfx.empty(),
    );
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,W,S,ENTER,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('gameout', () => this.menu.pointerOut());
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.input.off('pointerdown', unlock);
      this.input.keyboard!.off('keydown', unlock);
      this.menu.destroy();
    });
    this.layout();
  }

  private go(scene: string, data: object): void {
    if (this.leaving) return;
    this.leaving = true;
    getSfx().pickup(3);
    this.cameras.main.fadeOut(220, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.title.setPosition(w / 2, h * 0.27).setFontSize(Math.min(84, Math.max(40, w / 12)));
    this.tag.setPosition(w / 2, h * 0.27 + Math.min(84, Math.max(40, w / 12)) * 0.75);
    this.menu.layout(w / 2, h * 0.5);
    this.foot.setPosition(w / 2, h - 22);
    this.scan.setSize(w, 2);
    this.grid.clear();
    this.grid.lineStyle(1, PALETTE.structureDim, 0.22);
    for (let x = 0; x < w; x += 64) this.grid.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 64) this.grid.lineBetween(0, y, w, y);
  }

  update(_t: number, delta: number): void {
    this.t += delta / 1000;
    this.scan.y = (this.t * 70) % this.scale.height;
    const K = Phaser.Input.Keyboard;
    if (K.JustDown(this.keys.UP) || K.JustDown(this.keys.W)) this.menu.move(-1);
    if (K.JustDown(this.keys.DOWN) || K.JustDown(this.keys.S)) this.menu.move(1);
    if (K.JustDown(this.keys.ENTER) || K.JustDown(this.keys.SPACE)) this.menu.activate();
  }
}
