export class Ammo {
  constructor(maxAmmo, rechargeRateMs, onAmmoChangeCallback) {
    this.maxAmmo = maxAmmo;
    this.currentAmmo = maxAmmo;
    this.rechargeRateMs = rechargeRateMs;
    this.onAmmoChange = onAmmoChangeCallback;

    this.rechargeInterval = null;
  }

  // Renvoie true si on a tiré, false si le chargeur est vide
  consume() {
    if (this.currentAmmo > 0) {
      this.currentAmmo--;

      if (this.onAmmoChange) this.onAmmoChange(this.currentAmmo, this.maxAmmo);

      this._startRecharge();
      return true;
    }
    return false;
  }

  // Logique de rechargement automatique
  _startRecharge() {
    if (this.rechargeInterval !== null) return;

    this.rechargeInterval = setInterval(() => {
      if (this.currentAmmo < this.maxAmmo) {
        this.currentAmmo++;
        if (this.onAmmoChange)
          this.onAmmoChange(this.currentAmmo, this.maxAmmo);
      }

      if (this.currentAmmo >= this.maxAmmo) {
        clearInterval(this.rechargeInterval);
        this.rechargeInterval = null;
      }
    }, this.rechargeRateMs);
  }
}
