import '../src/Styles/Game.css';
import { GameScene } from './Scenes/GameScene.js';
import { MainMenu }  from './UI/MainMenu.js';
import { PauseMenu } from './UI/PauseMenu.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');

    game._init().then(() => {
        // Instanciation des menus — le LightingManager sera injecté après
        const mainMenu = new MainMenu(
            () => { game.engine.enterPointerlock(); },
            game.player,
            game.lightingManager,   // peut être null si init pas finie, voir setLightingManager ci-dessous
        );

        const pauseMenu = new PauseMenu(
            () => { game.isPaused = false; game.engine.enterPointerlock(); },
            () => { location.reload(); },
            game.player,
            game.lightingManager,
        );

        // Si le LightingManager est initialisé après (cas async), on l'injecte rétrospectivement
        if (!game.lightingManager) {
            const inject = setInterval(() => {
                if (game.lightingManager) {
                    mainMenu.setLightingManager(game.lightingManager);
                    pauseMenu.setLightingManager(game.lightingManager);
                    clearInterval(inject);
                }
            }, 200);
        }

        // Touche Entrée → Pause / Reprise
        document.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                game.isPaused = !game.isPaused;
                if (game.isPaused) {
                    document.exitPointerLock();
                    pauseMenu.show();
                } else {
                    pauseMenu.hide();
                    game.engine.enterPointerlock();
                }
            }
        });
    });
});