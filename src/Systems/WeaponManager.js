import { PlasmaShotgun } from "../Weapons/PlasmaShotgun";
import { QuantumSniper }  from "../Weapons/QuantumSniper";
import { VoidRocket }     from "../Weapons/VoidRocket";
// Le dagger original (Projectile + Ammo) est géré par PlayerShoot
// WeaponManager gère les armes secondaires / remplacements

/**
 * WeaponManager
 * -------------
 * Gère l'inventaire d'armes du joueur, le switch, et l'intégration boutique.
 *
 * Slot 0 : arme de départ (dagger — géré par PlayerShoot)
 * Slot 1 : arme secondaire acquise en jeu
 * Slot 2 : arme tertiaire
 *
 * Usage :
 *   const wm = new WeaponManager(player);
 *   wm.give("shotgun");
 *   wm.give("sniper");
 *   wm.give("rocket");
 *   wm.switchTo(1);
 *   wm.fire();
 *   wm.dispose();
 */
export class WeaponManager {

    static WEAPON_CATALOG = {
        shotgun: {
            id:          "shotgun",
            name:        "PLASMA SHOTGUN",
            description: "7 plombs plasma, dévastateur à courte portée.",
            category:    "ASSAULT",
            shopCost:    0,  // gratuit (donné par salle boutique)
            iconColor:   "#ff4400",
            Class:       PlasmaShotgun,
        },
        sniper: {
            id:          "sniper",
            name:        "QUANTUM SNIPER",
            description: "Hitscan longue portée, zoom, perfore l'armure.",
            category:    "PRECISION",
            shopCost:    0,
            iconColor:   "#00ccff",
            Class:       QuantumSniper,
        },
        rocket: {
            id:          "rocket",
            name:        "VOID ROCKET",
            description: "Explosion de zone AoE, danger de splash.",
            category:    "EXPLOSIVE",
            shopCost:    0,
            iconColor:   "#aa00ff",
            Class:       VoidRocket,
        },
    };

    constructor(player) {
        this.player   = player;
        this.scene    = player.scene;

        // Slots d'armes (null = vide)
        this._slots       = [null, null, null]; // slot 0 = dagger natif
        this._activeSlot  = 0;
        this._activeWeapon = null; // instance active (non-dagger)

        // Masquer le mesh dagger si slot actif ≠ 0
        this._daggerMesh  = player.weapon ?? null;

        // Zoom sniper
        this._zoomActive  = false;

        this._initInputs();
    }

    // ── Inputs ───────────────────────────────────────────────────────────────

    _initInputs() {
        // Molette souris → switch arme
        this.player.scene.onPointerObservable.add((info) => {
            if (info.type === BABYLON.PointerEventTypes?.POINTERWHEEL) {
                const delta = info.event.deltaY > 0 ? 1 : -1;
                this._scrollSwitch(delta);
            }
        });

        // Touches 1-3 → switch direct
        this.player.scene.onKeyboardObservable?.add((kbInfo) => {
            if (kbInfo.type !== 1) return; // KEYDOWN
            const code = kbInfo.event.code;
            if (code === "Digit1") this.switchTo(0);
            if (code === "Digit2") this.switchTo(1);
            if (code === "Digit3") this.switchTo(2);

            // Zoom sniper : touche ALT
            if (code === "AltLeft" || code === "AltRight") {
                if (this._activeWeapon instanceof QuantumSniper) {
                    this._activeWeapon.toggleZoom();
                }
            }
        });

        // Clic droit → zoom sniper
        this.player.scene.onPointerDown?.((evt) => {
            if (evt.button === 2) {
                if (this._activeWeapon instanceof QuantumSniper) {
                    this._activeWeapon.toggleZoom();
                }
            }
        });
    }

    _scrollSwitch(delta) {
        const count = this._slots.filter((_, i) => i === 0 || !!this._slots[i]).length;
        if (count <= 1) return;
        const next = (this._activeSlot + delta + 3) % 3;
        this.switchTo(next);
    }

    // ── Gestion des armes ─────────────────────────────────────────────────────

    /**
     * Donne une arme au joueur (remplissage automatique des slots).
     * @param {"shotgun"|"sniper"|"rocket"} weaponId
     * @returns {boolean} succès
     */
    give(weaponId) {
        const info = WeaponManager.WEAPON_CATALOG[weaponId];
        if (!info) { console.warn("[WeaponManager] Arme inconnue :", weaponId); return false; }

        // Cherche un slot vide (1 ou 2)
        const freeSlot = this._slots.findIndex((s, i) => i > 0 && s === null);
        if (freeSlot === -1) {
            // Remplace le slot actif si pas le dagger
            if (this._activeSlot > 0) this._replaceSlot(this._activeSlot, info);
            else this._replaceSlot(1, info);
            return true;
        }

        this._slots[freeSlot] = info;
        this.player.hud?.addWeaponSlot?.(freeSlot, info);

        // Auto-switch vers la nouvelle arme
        this.switchTo(freeSlot);
        return true;
    }

    _replaceSlot(slotIdx, info) {
        // Détruit l'arme existante dans ce slot
        if (this._activeSlot === slotIdx && this._activeWeapon) {
            this._activeWeapon.destroy();
            this._activeWeapon = null;
        }
        this._slots[slotIdx] = info;
        this.player.hud?.addWeaponSlot?.(slotIdx, info);
        if (this._activeSlot === slotIdx) this._activateSlot(slotIdx);
    }

    /**
     * Active un slot d'arme.
     * @param {0|1|2} slotIdx
     */
    switchTo(slotIdx) {
        if (slotIdx === this._activeSlot) return;

        // Vérifie que le slot est disponible
        if (slotIdx > 0 && !this._slots[slotIdx]) return;

        // Désactive le sniper zoom si on quitte
        if (this._activeWeapon instanceof QuantumSniper) this._activeWeapon.cancelZoom();

        // Cache / détache l'arme active
        if (this._activeSlot === 0) {
            if (this._daggerMesh) this._daggerMesh.isVisible = false;
            if (this.player.shootController) this.player.shootController._enabled = false;
        } else if (this._activeWeapon) {
            if (this._activeWeapon.mesh) this._activeWeapon.mesh.isVisible = false;
        }

        this._activeSlot = slotIdx;
        this._activateSlot(slotIdx);
    }

    _activateSlot(slotIdx) {
        if (slotIdx === 0) {
            // Revenir au dagger
            if (this._daggerMesh) this._daggerMesh.isVisible = true;
            if (this.player.shootController) this.player.shootController._enabled = true;
            if (this._activeWeapon) { this._activeWeapon.mesh.isVisible = false; }
            this._activeWeapon = null;
            this.player.hud?.updateWeaponAmmo?.(
                this.player.shootController?.daggerAmmo?.currentAmmo ?? 5,
                this.player.shootController?.daggerAmmo?.maxAmmo ?? 5,
                "PLASMA DAGGER",
                false,
            );
        } else {
            const info = this._slots[slotIdx];
            if (!info) return;

            if (this._daggerMesh) this._daggerMesh.isVisible = false;
            if (this.player.shootController) this.player.shootController._enabled = false;

            // Instancie si pas encore fait, sinon réactive
            if (!this._activeWeapon || !(this._activeWeapon instanceof info.Class)) {
                if (this._activeWeapon) {
                    this._activeWeapon.destroy();
                }
                this._activeWeapon = new info.Class(this.player);
            } else {
                if (this._activeWeapon.mesh) this._activeWeapon.mesh.isVisible = true;
            }

            this.player.hud?.updateWeaponAmmo?.(
                this._activeWeapon.currentAmmo,
                this._activeWeapon.ammoMax,
                info.name,
                false,
            );
        }

        this.player.hud?.highlightWeaponSlot?.(slotIdx);
    }

    // ── Tir ─────────────────────────────────────────────────────────────────

    /**
     * Déclenche le tir de l'arme active.
     * @returns {boolean} true si a tiré
     */
    fire() {
        if (this._activeSlot === 0) {
            // Délègue au PlayerShoot
            this.player.shootController?.fireBasicDagger?.();
            return true;
        }
        return this._activeWeapon?.fire() ?? false;
    }

    get isSecondaryActive() { return this._activeSlot > 0; }
    get activeWeapon()      { return this._activeWeapon; }
    get activeSlotIdx()     { return this._activeSlot; }

    // ── Shop helper ───────────────────────────────────────────────────────────

    /** Retourne la liste des armes disponibles à la vente (pas encore possédées). */
    getShopInventory() {
        const owned = this._slots.filter(Boolean).map(s => s?.id);
        return Object.values(WeaponManager.WEAPON_CATALOG).filter(w => !owned.includes(w.id));
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    dispose() {
        if (this._activeWeapon) {
            this._activeWeapon.destroy();
            this._activeWeapon = null;
        }
    }
}
