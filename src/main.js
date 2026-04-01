import '../src/Styles/Game.css';
import { GameScene } from './Scenes/GameScene.js';
import { MainMenu } from './UI/MainMenu.js';
import { PauseMenu } from './UI/PauseMenu.js'; 

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');
    
    game._init().then(() => {
        // Le menu principal
        const mainMenu = new MainMenu(() => {
            game.engine.enterPointerlock();
        }, game.player);

        // Le menu pause
        const pauseMenu = new PauseMenu(
            () => {
                game.isPaused = false;
                game.engine.enterPointerlock();
            },
            () => {
                location.reload(); 
            }, 
            game.player
        );

        // Détection de la touche Échap via le Pointer Lock du navigateur
        document.addEventListener('keydown', (evt) => {
            if(evt.key === 'Enter') {
                game.isPaused = !game.isPaused;
                console.log("pause : ", game.isPaused);
                if (game.isPaused) {
                    document.exitPointerLock();
                    pauseMenu.show();
                }else{
                    pauseMenu.hide();
                    game.engine.enterPointerlock();
                }
            }
        });
    });
});