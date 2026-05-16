import '../src/Styles/Game.css';
import { GameScene }       from './Scenes/GameScene.js';
import { MainMenu }        from './UI/MainMenu.js';
import { PauseMenu }       from './UI/PauseMenu.js';
import { GraphicsMenu }    from './UI/GraphicsMenu.js';
import { KeybindingsMenu } from './UI/KeybindingsMenu.js';
import { GamepadManager }  from './Systems/GamepadManager.js';
import { ScoreManager }    from './Systems/ScoreManager.js';
import { WeaponManager }   from './Systems/WeaponManager.js';
import { DebugPanel } from './UI/DebugPanel';
import { IntroSequence } from './UI/IntroSequence.js';
import { SoundManager } from './Systems/SoundManager.js';
import * as BABYLON from "@babylonjs/core";


window.addEventListener('DOMContentLoaded', () => {
    const game = new GameScene('renderCanvas');

    game._init().then(async () => {

        // ── SoundManager ──────────────────────────────────────────────────────────
        const soundManager = new SoundManager;
        soundManager.init(); // sans await
        game.soundManager = soundManager;

        // ── Touche pause clavier ──────────────────────────────────────────────
        let pauseKey = 'enter';
        const onPauseKeyChange = (newKey) => { pauseKey = newKey; };

        // ── GamepadManager ────────────────────────────────────────────────────
        const gamepad = new GamepadManager(game.player, () => togglePause());
        gamepad.start();
        if (game.player) game.player.gamepad = gamepad;

        // ── ScoreManager ──────────────────────────────────────────────────────
        const scoreManager = new ScoreManager(game.player?.hud ?? null);
        game.scoreManager  = scoreManager;

        // ── WeaponManager ─────────────────────────────────────────────────────
        const weaponManager = game.player ? new WeaponManager(game.player) : null;
        game.weaponManager  = weaponManager;

        // Injecter dans WaveManager si déjà créé
        if (game.waveManager) {
            game.waveManager.scoreManager  = scoreManager;
            game.waveManager.weaponManager = weaponManager;
        }

        // ── Instances partagées ───────────────────────────────────────────────
        const sharedGfxMenu = new GraphicsMenu(game.lightingManager);
        const sharedKbMenu  = new KeybindingsMenu(game.player, onPauseKeyChange, gamepad);

        sharedKbMenu.onBindingsChanged = () => {
            if (game.player) game.player.keybindings = sharedKbMenu.getBindings();
        };

        // ── Menus ─────────────────────────────────────────────────────────────
        const mainMenu = new MainMenu(
            () => {
                const intro = new IntroSequence(soundManager);
                intro.play(() => {
                    game.engine.enterPointerlock();
                    game.player.hud._createControlsHint();
                    gamepad.setMenuMode(false);
                });
            },
            game.player,
            sharedGfxMenu,
            sharedKbMenu,
            soundManager,
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
            soundManager,
        );

        gamepad.setMenuMode(true, mainMenu.overlay);

        // ── Injection LightingManager ─────────────────────────────────────────
        const injectLM = (lm) => {
            sharedGfxMenu.lm = lm;
            mainMenu.lm      = lm;
            pauseMenu.lm     = lm;
        };
        if (game.lightingManager) injectLM(game.lightingManager);
        else {
            const inject = setInterval(() => {
                if (game.lightingManager) { injectLM(game.lightingManager); clearInterval(inject); }
            }, 200);
        }

        // ── Stats Game Over enrichi ───────────────────────────────────────────
        if (game.player) {
            game.player.getStatsCallback = () => ({
                wavesCleared:  game.waveManager?.currentWave   ?? 0,
                roomsCleared:  game.waveManager?._clearedRooms?.size ?? 0,
                scoreManager,
            });
        }

        // ── Hook WaveManager pour ScoreManager + WeaponManager ────────────────
        const injectManagers = () => {
            if (!game.waveManager) return;
            game.waveManager.scoreManager  = scoreManager;
            game.waveManager.weaponManager = weaponManager;
            game.waveManager.soundManager  = soundManager;
        };
        injectManagers();
        const injectInterval = setInterval(() => {
            if (game.waveManager?.scoreManager !== scoreManager) {
                injectManagers();
            } else {
                clearInterval(injectInterval);
            }
        }, 300);

        const debugPanel = new DebugPanel(
            game.player,
            game.upgradeManager,
            game.waveManager,
            scoreManager
        );

        // ── Crosshair DOM ─────────────────────────────────────────────────────
        const crosshair = document.createElement("div");
        crosshair.id = "crosshair";
        document.body.appendChild(crosshair);

        // ── Toggle pause ──────────────────────────────────────────────────────
        function togglePause() {
            if (mainMenu.overlay && mainMenu.overlay.style.display !== 'none') return;
            game.isPaused = !game.isPaused;
            if (game.isPaused) {
                document.exitPointerLock();
                pauseMenu.show();
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

            if (pressed !== pauseKey && pressed !== 'escape') return;
            if (document.querySelector('.kb-listening')) return;
            if (mainMenu.overlay && mainMenu.overlay.style.display !== 'none') return;
            togglePause();
        });

        // ── Synchroniser navigation manette ──────────────────────────────────
        document.addEventListener('click', () => {
            setTimeout(() => {
                const pauseVisible = pauseMenu.overlay?.style.display !== 'none';
                const mainVisible  = mainMenu.overlay?.style.display  !== 'none';
                if (pauseVisible)      gamepad.setMenuMode(true, pauseMenu.overlay);
                else if (mainVisible)  gamepad.setMenuMode(true, mainMenu.overlay);
                else                   gamepad.setMenuMode(false);
            }, 50);
        });

        // ── Score HUD initial ─────────────────────────────────────────────────
        game.player?.hud?.updateScore?.(0);
        game.player?.hud?.updateCombo?.(1, "", false);
        game.player?.hud?.highlightWeaponSlot?.(0);

    });
});