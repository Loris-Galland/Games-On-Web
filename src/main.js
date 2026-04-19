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

        // ── Touche pause clavier ──────────────────────────────────────────────
        let pauseKey = 'enter';
        const onPauseKeyChange = (newKey) => { pauseKey = newKey; };

        // ── GamepadManager ────────────────────────────────────────────────────
        // Créé avant les menus pour être injecté dans KeybindingsMenu
        const gamepad = new GamepadManager(game.player, () => togglePause());
        gamepad.start();

        // Injecter la référence dans le Player pour le bobbing
        if (game.player) game.player.gamepad = gamepad;

        // ── Instances partagées ───────────────────────────────────────────────
        const sharedGfxMenu = new GraphicsMenu(game.lightingManager);
        const sharedKbMenu  = new KeybindingsMenu(game.player, onPauseKeyChange, gamepad);

        // ── Menus ─────────────────────────────────────────────────────────────
        const mainMenu = new MainMenu(
            () => {
                game.engine.enterPointerlock();
                // Repasse en mode jeu dès que la partie démarre
                gamepad.setMenuMode(false);
            },
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
        );

        const pauseMenu = new PauseMenu(
            () => {
                game.isPaused = false;
                game.engine.enterPointerlock();
                gamepad.setMenuMode(false);
            },
            () => { location.reload(); },
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

        // ── Fonction toggle pause ─────────────────────────────────────────────
        function togglePause() {
            // Bloquer si le menu principal est encore affiché
            if (mainMenu.overlay && mainMenu.overlay.style.display !== 'none') return;

            game.isPaused = !game.isPaused;
            if (game.isPaused) {
                document.exitPointerLock();
                pauseMenu.show();
                // Passe la manette en mode navigation du menu pause
                gamepad.setMenuMode(true, pauseMenu.overlay);
            } else {
                pauseMenu.hide();
                game.engine.enterPointerlock();
                gamepad.setMenuMode(false);
            }
        }

        // ── Touche pause clavier ──────────────────────────────────────────────
        document.addEventListener('keydown', (evt) => {
            const pressed = evt.key === ' '   ? 'space'
                : evt.key === 'Enter'         ? 'enter'
                : evt.key === 'Escape'        ? 'escape'
                : evt.key.toLowerCase();

            if (pressed !== pauseKey) return;
            if (document.querySelector('.kb-listening')) return;
            if (mainMenu.overlay && mainMenu.overlay.style.display !== 'none') return;

            togglePause();
        });

        // ── Synchroniser la navigation manette quand les sous-panneaux s'ouvrent ──
        // On observe les clics sur les boutons PARAMÈTRES, GRAPHISMES, TOUCHES
        // pour mettre à jour l'élément de référence du gamepad
        document.addEventListener('click', () => {
            // Petit délai pour laisser le DOM se mettre à jour
            setTimeout(() => {
                const pauseVisible = pauseMenu.overlay?.style.display !== 'none';
                const mainVisible  = mainMenu.overlay?.style.display  !== 'none';
                if (pauseVisible) gamepad.setMenuMode(true, pauseMenu.overlay);
                else if (mainVisible) gamepad.setMenuMode(true, mainMenu.overlay);
                else gamepad.setMenuMode(false);
            }, 50);
        });
    });
});