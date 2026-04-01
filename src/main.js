import '../src/Styles/Game.css';
import { GameScene } from './Scenes/GameScene.js';
import { MainMenu } from './UI/MainMenu.js';
import { PauseMenu } from './UI/PauseMenu.js'; 

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');
    
    let isGameRunning = false;
    let isPaused = false;
    
    game._init().then(() => {
        // Le menu principal
        const mainMenu = new MainMenu(() => {
            isGameRunning = true;
            game.engine.enterPointerlock();
        }, game.player);

        // Le menu pause
        const pauseMenu = new PauseMenu(
            () => {
                game.engine.enterPointerlock();
            }, 
            () => {
                location.reload(); 
            }, 
            game.player
        );

        // Détection de la touche Échap via le Pointer Lock du navigateur
        /*document.addEventListener('pointerlockchange', () => {
            if (!isGameRunning) return; 

            if (document.pointerLockElement) {
                isPaused = false;
                pauseMenu.hide();
            } else {
                isPaused = true;
                pauseMenu.show();
            }
        });*/

        // La boucle de rendu modifiée pour gérer la pause
        game.engine.runRenderLoop(() => {
            if (!isPaused) {
                game.scene.render();
                if (game.player && game.player.hud) {
                    game.player.hud.updateFps(game.engine);
                }
            }
        });
    });
});