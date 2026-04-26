import '../src/Styles/Game.css';
import { GameScene }       from './Scenes/GameScene.js';
import { MainMenu }        from './UI/MainMenu.js';
import { PauseMenu }       from './UI/PauseMenu.js';
import { GraphicsMenu }    from './UI/GraphicsMenu.js';
import { KeybindingsMenu } from './UI/KeybindingsMenu.js';
import { GamepadManager }  from './Systems/GamepadManager.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');

    game._init().then(() => {

        // ── Touche pause ──────────────────────────────────────────────────────
        let pauseKey = 'enter';
        const onPauseKeyChange = (newKey) => { pauseKey = newKey; };

        // ── GamepadManager ────────────────────────────────────────────────────
        const gamepad = new GamepadManager(game.player, () => togglePause());
        gamepad.start();
        if (game.player) game.player.gamepad = gamepad;

        // ── Instances partagées ───────────────────────────────────────────────
        const sharedGfxMenu = new GraphicsMenu(game.lightingManager);
        const sharedKbMenu  = new KeybindingsMenu(game.player, onPauseKeyChange, gamepad);

        // ── Fonction : retour au menu principal depuis la pause ───────────────
        function returnToMainMenu() {
            location.reload();
        }

        // ── Menus ─────────────────────────────────────────────────────────────
        const mainMenu = new MainMenu(
            () => {
                // Le joueur clique "PLAY" → lancer la partie
                mainMenu.overlay.style.display = 'none';
                game.engine.enterPointerlock();
                gamepad.flushMovement();
                gamepad.setMenuMode(false);
            },
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
        );

        const pauseMenu = new PauseMenu(
            // onResume
            () => {
                game.isPaused = false;
                game.engine.enterPointerlock();
                gamepad.flushMovement();   // FIX accumulation vitesse
                gamepad.setMenuMode(false);
            },
            // onQuit → retour menu principal
            () => returnToMainMenu(),
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
        );

        // Navigation manette dans le main menu au démarrage
        gamepad.setMenuMode(true, mainMenu.overlay);

        // ── Injection LightingManager (async) ─────────────────────────────────
        const injectLM = (lm) => {
            sharedGfxMenu.lm = lm;
            mainMenu.lm      = lm;
            pauseMenu.lm     = lm;
        };
        if (game.lightingManager) {
            injectLM(game.lightingManager);
        } else {
            const inject = setInterval(() => {
                if (game.lightingManager) { injectLM(game.lightingManager); clearInterval(inject); }
            }, 200);
        }

        // ── Toggle pause ──────────────────────────────────────────────────────
        function togglePause() {
            if (mainMenu.overlay?.style.display !== 'none') return;

            game.isPaused = !game.isPaused;
            if (game.isPaused) {
                document.exitPointerLock();
                pauseMenu.show();
                gamepad.setMenuMode(true, pauseMenu.overlay);
            } else {
                pauseMenu.hide();
                game.engine.enterPointerlock();
                gamepad.flushMovement();
                gamepad.setMenuMode(false);
            }
        }

        // ── Touche pause clavier ──────────────────────────────────────────────
        document.addEventListener('keydown', (evt) => {
            const pressed =
                evt.key === ' '     ? 'space'  :
                evt.key === 'Enter' ? 'enter'  :
                evt.key === 'Escape'? 'escape' :
                evt.key.toLowerCase();
            if (pressed !== pauseKey) return;
            if (document.querySelector('.kb-listening')) return;
            if (mainMenu.overlay?.style.display !== 'none') return;
            togglePause();
        });

        // ── Synchronisation manette pour les sous-menus ───────────────────────
        // Un MutationObserver détecte les changements de display dans les overlays
        // et met à jour le contexte de navigation manette automatiquement.
        const syncMenuRoot = () => {
            if (!gamepad._menuMode) return;
            if (pauseMenu.overlay?.style.display !== 'none') {
                gamepad.refreshMenuRoot(pauseMenu.overlay);
            } else if (mainMenu.overlay?.style.display !== 'none') {
                gamepad.refreshMenuRoot(mainMenu.overlay);
            }
        };

        const obs = new MutationObserver(() => {
            if (gamepad._menuMode) {
                clearTimeout(obs._tid);
                obs._tid = setTimeout(syncMenuRoot, 60);
            }
        });
        obs.observe(document.body, {
            attributes: true, subtree: true,
            attributeFilter: ['style'], childList: true,
        });
    });
});