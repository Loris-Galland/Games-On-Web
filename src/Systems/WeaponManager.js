import * as BABYLON from "@babylonjs/core";
import { PlasmaShotgun } from "../Weapons/PlasmaShotgun";
import { QuantumSniper }  from "../Weapons/QuantumSniper";
import { VoidRocket }     from "../Weapons/VoidRocket";

/**
 * WeaponManager (corrigé)
 * -----------------------
 * Fix : au lieu de mettre isVisible = false uniquement sur mesh,
 * on appelle weapon.setVisible(false) qui masque TOUTES les pièces.
 * Les armes qui n'ont pas de setVisible() reçoivent un fallback.
 */
export class WeaponManager {

    static WEAPON_CATALOG = {
        shotgun: {
            id:          "shotgun",
            name:        "PLASMA SHOTGUN",
            description: "7 plombs plasma, dévastateur à courte portée.",
            category:    "ASSAULT",
            iconColor:   "#ff4400",
            cost : 20000,
            Class:       PlasmaShotgun,
        },
        sniper: {
            id:          "sniper",
            name:        "QUANTUM SNIPER",
            description: "Hitscan longue portée, zoom, perfore l'armure.",
            category:    "PRECISION",
            iconColor:   "#00ccff",
            cost : 1000,
            Class:       QuantumSniper,
        },
        rocket: {
            id:          "rocket",
            name:        "VOID ROCKET",
            description: "Explosion de zone AoE, danger de splash.",
            category:    "EXPLOSIVE",
            iconColor:   "#aa00ff",
            cost : 90000,
            Class:       VoidRocket,
        },
    };

    constructor(player) {
        this.player  = player;
        this.scene   = player.scene;

        this._slots        = [null, null, null]; // slot 0 = dagger natif
        this._activeSlot   = 0;
        this._activeWeapon = null;
        this._daggerMesh   = player.weapon ?? null;

        this._initInputs();
    }

    // ── Inputs ───────────────────────────────────────────────────────────────

    _initInputs() {
        // Touches 1-3
        this.scene.onKeyboardObservable?.add((kbInfo) => {
            if (kbInfo.type !== 1) return;
            const code = kbInfo.event.code;
            if (code === "Digit1") this.switchTo(0);
            if (code === "Digit2") this.switchTo(1);
            if (code === "Digit3") this.switchTo(2);
            // Zoom sniper clavier (Alt)
            if ((code === "AltLeft" || code === "AltRight") && this._activeWeapon instanceof QuantumSniper) {
                this._activeWeapon.toggleZoom();
            }
        });

        // Molette souris
        this.scene.onPointerObservable?.add((info) => {
            if (info.type === BABYLON.PointerEventTypes?.POINTERWHEEL) {
                const delta = info.event.deltaY > 0 ? 1 : -1;
                this._scrollSwitch(delta);
            }
        });

        // Clic droit → zoom sniper
        this.scene.onPointerDown?.((evt) => {
            if (evt.button === 2 && this._activeWeapon instanceof QuantumSniper) {
                this._activeWeapon.toggleZoom();
            }
        });
    }

    _scrollSwitch(delta) {
        // Compte les slots disponibles
        const available = [0, ...this._slots.map((s, i) => i > 0 && s ? i : -1).filter(i => i > 0)];
        if (available.length <= 1) return;
        const curIdx  = available.indexOf(this._activeSlot);
        const nextIdx = (curIdx + delta + available.length) % available.length;
        this.switchTo(available[nextIdx]);
    }

    // ── Gestion des armes ─────────────────────────────────────────────────────

    give(weaponId) {
        const info = WeaponManager.WEAPON_CATALOG[weaponId];
        if (!info) { console.warn("[WeaponManager] Arme inconnue :", weaponId); return false; }

        const freeSlot = this._slots.findIndex((s, i) => i > 0 && s === null);
        if (freeSlot === -1) {
            const target = this._activeSlot > 0 ? this._activeSlot : 1;
            this._replaceSlot(target, info);
        } else {
            this._slots[freeSlot] = info;
            this.player.hud?.addWeaponSlot?.(freeSlot, info);
            this.switchTo(freeSlot);
        }
        return true;
    }

    _replaceSlot(slotIdx, info) {
        if (this._activeSlot === slotIdx && this._activeWeapon) {
            this._hideWeapon(this._activeWeapon);
            this._activeWeapon.destroy();
            this._activeWeapon = null;
        }
        this._slots[slotIdx] = info;
        this.player.hud?.addWeaponSlot?.(slotIdx, info);
        if (this._activeSlot === slotIdx) this._activateSlot(slotIdx);
    }

    switchTo(slotIdx) {
        if (slotIdx === this._activeSlot) return;
        if (slotIdx > 0 && !this._slots[slotIdx]) return;

        // Désactiver proprement l'arme courante
        if (this._activeSlot === 0) {
            if (this._daggerMesh) this._daggerMesh.isVisible = false;
            if (this.player.shootController) this.player.shootController._enabled = false;
        } else if (this._activeWeapon) {
            this._hideWeapon(this._activeWeapon);
        }

        this._activeSlot = slotIdx;
        this._activateSlot(slotIdx);
    }

    /**
     * Cache toutes les pièces d'une arme secondaire.
     * Préfère weapon.setVisible(false) si disponible, sinon fallback sur mesh.isVisible.
     */
    _hideWeapon(weapon) {
        if (!weapon) return;
        if (typeof weapon.setVisible === "function") {
            weapon.setVisible(false);
        } else if (weapon.mesh && !weapon.mesh.isDisposed()) {
            weapon.mesh.isVisible = false;
            // Cacher aussi les enfants connus
            weapon.mesh.getChildMeshes?.()?.forEach(c => { c.isVisible = false; });
        }
    }

    _showWeapon(weapon) {
        if (!weapon) return;
        if (typeof weapon.setVisible === "function") {
            weapon.setVisible(true);
        } else if (weapon.mesh && !weapon.mesh.isDisposed()) {
            weapon.mesh.isVisible = true;
            weapon.mesh.getChildMeshes?.()?.forEach(c => { c.isVisible = true; });
        }
    }

    _activateSlot(slotIdx) {
        if (slotIdx === 0) {
            // Dagger
            if (this._daggerMesh) this._daggerMesh.isVisible = true;
            if (this.player.shootController) this.player.shootController._enabled = true;
            // Cacher l'arme secondaire active si différente
            if (this._activeWeapon) {
                this._hideWeapon(this._activeWeapon);
                this._activeWeapon = null;
            }
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

            if (!this._activeWeapon || !(this._activeWeapon instanceof info.Class)) {
                // Détruire l'arme précédente
                if (this._activeWeapon) {
                    this._hideWeapon(this._activeWeapon);
                    this._activeWeapon.destroy?.();
                    this._activeWeapon = null;
                }
                // Créer la nouvelle
                this._activeWeapon = new info.Class(this.player);
            } else {
                // Même arme : juste la remontrer
                this._showWeapon(this._activeWeapon);
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

    fire() {
        if (this._activeSlot === 0) {
            this.player.shootController?.fireBasicDagger?.();
            return true;
        }
        return this._activeWeapon?.fire() ?? false;
    }

    get isSecondaryActive() { return this._activeSlot > 0; }
    get activeWeapon()      { return this._activeWeapon; }
    get activeSlotIdx()     { return this._activeSlot; }

    getShopInventory() {
        const owned = this._slots.filter(Boolean).map(s => s?.id);
        return Object.values(WeaponManager.WEAPON_CATALOG).filter(w => !owned.includes(w.id));
    }

    dispose() {
        if (this._activeWeapon) {
            this._activeWeapon.destroy?.();
            this._activeWeapon = null;
        }
    }
}