export class Health {
  constructor(maxHealth, onDamageCallback, onDeathCallback) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;

    this.onDamage = onDamageCallback;
    this.onDeath = onDeathCallback;
  }

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.currentHealth <= 0) return;

    this.currentHealth -= amount;
    if (this.currentHealth < 0) this.currentHealth = 0;

    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);

    if (this.currentHealth === 0) {
      this.die();
    }
  }

  /**
   * @param {number} amount
   */
  heal(amount) {
    this.currentHealth += amount;
    if (this.currentHealth > this.maxHealth)
      this.currentHealth = this.maxHealth;

    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
  }

  die() {
    if (this.onDeath) this.onDeath();
  }

  /**
   * @param {number} amount
   */
  increaseMax(amount) {
    this.maxHealth += amount;
    this.currentHealth += amount;
    
    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
  }
}
