import type Phaser from 'phaser';

/** The room hides the OS cursor (it draws its own crosshair); every menu wants it back. */
export function showCursor(scene: Phaser.Scene, visible: boolean): void {
  scene.input.setDefaultCursor(visible ? 'default' : 'none');
}

/** Pointing hand over something clickable. Call with the hovered state each pointer move. */
export function hand(scene: Phaser.Scene, over: boolean): void {
  scene.input.setDefaultCursor(over ? 'pointer' : 'default');
}
