import Phaser from 'phaser';
import './ui/fonts.css';
import { PALETTE } from './data/palette';
import * as profileApi from './game/profile';
import { profile } from './game/profile';
import { makeItem } from './sim/loot';
import { runState } from './game/runState';
import { Base } from './scenes/Base';
import { Boot } from './scenes/Boot';
import { FeelTest } from './scenes/FeelTest';
import { Hud } from './scenes/Hud';
import { Pause } from './scenes/Pause';
import { Title } from './scenes/Title';
import { Tree } from './scenes/Tree';

function start(): void {
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
    scene: [Boot, Title, Base, FeelTest, Hud, Tree, Pause],
  });

  // Dev-only handle so smoke tests and the console can inspect live state.
  if (import.meta.env.DEV) {
    (window as unknown as { __raid: unknown }).__raid = { game, runState, profile, profileApi, makeItem };
}
}

// Poco has to be loaded before the first Text is drawn, or the canvas falls back to the default font.
void document.fonts
  .load('16px "Poco"')
  .catch(() => undefined)
  .then(start);
