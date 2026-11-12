import Phaser from 'phaser';
import { PALETTE } from './data/palette';
import { profile } from './game/profile';
import { runState } from './game/runState';
import { Boot } from './scenes/Boot';
import { FeelTest } from './scenes/FeelTest';
import { Hud } from './scenes/Hud';
import { Tree } from './scenes/Tree';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: PALETTE.bg,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  render: { antialias: true },
  scene: [Boot, FeelTest, Hud, Tree],
});

// Dev-only handle so smoke tests and the console can inspect live state.
if (import.meta.env.DEV) {
  (window as unknown as { __raid: unknown }).__raid = { game, runState, profile };
}
