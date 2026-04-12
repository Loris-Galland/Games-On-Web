import '../src/Styles/Game.css';
import { GameScene }       from './Scenes/GameScene.js';
import { MainMenu }        from './UI/MainMenu.js';
import { PauseMenu }       from './UI/PauseMenu.js';
import { GraphicsMenu }    from './UI/GraphicsMenu.js';
import { KeybindingsMenu } from './UI/KeybindingsMenu.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');

    game._init().then(() => {

        // ── Touche de pause — modifiable via le menu Touches ──────────────────
        let pauseKey = 'enter';
        const onPauseKeyChange = (newKey) => { pauseKey = newKey; };

        // ── Instances PARTAGÉES entre MainMenu et PauseMenu ───────────────────
        // GraphicsMenu a besoin du LightingManager, injecté ci-dessous via setLM()
        const sharedGfxMenu = new GraphicsMenu(game.lightingManager);
        const sharedKbMenu  = new KeybindingsMenu(game.player, onPauseKeyChange);

        // ── Menus ─────────────────────────────────────────────────────────────
        const mainMenu = new MainMenu(
            () => { game.engine.enterPointerlock(); },
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
        );

        const pauseMenu = new PauseMenu(
            () => { game.isPaused = false; game.engine.enterPointerlock(); },
            () => { location.reload(); },
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
        );

        // ── Injection du LightingManager (peut être null au démarrage) ────────
        const injectLM = (lm) => {
            sharedGfxMenu.lm = lm;
            mainMenu.lm      = lm;
            pauseMenu.lm     = lm;
        };

        if (game.lightingManager) {
            injectLM(game.lightingManager);
        } else {
            const inject = setInterval(() => {
                if (game.lightingManager) {
                    injectLM(game.lightingManager);
                    clearInterval(inject);
                }
            }, 200);
        }

        // ── Touche pause dynamique ────────────────────────────────────────────
        document.addEventListener('keydown', (evt) => {
            const pressed = evt.key === ' '    ? 'space'
                : evt.key === 'Enter'          ? 'enter'
                : evt.key === 'Escape'         ? 'escape'
                : evt.key.toLowerCase();

            if (pressed !== pauseKey) return;

            // Bloquer si le menu touches est en mode écoute
            if (document.querySelector('.kb-listening')) return;

            // Bloquer si le menu principal est encore affiché
            if (mainMenu.overlay && mainMenu.overlay.style.display !== 'none') return;

            game.isPaused = !game.isPaused;
            if (game.isPaused) {
                document.exitPointerLock();
                pauseMenu.show();
            } else {
                pauseMenu.hide();
                game.engine.enterPointerlock();
            }
        });
    });
});