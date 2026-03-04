import '../src/Styles/Game.css';
import { GameScene } from './Scenes/GameScene';

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');
    game.init();
});