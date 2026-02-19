import '../src/Styles/Game.css';
import { GameScene } from './Scenes/GameScene';

window.addEventListener('DOMContentLoaded', () => {
    new GameScene('renderCanvas');
});