import '../src/Styles/Game.css';
import { Game } from './Core/Game';

window.addEventListener('DOMContentLoaded', () => {
    new Game('renderCanvas');
});