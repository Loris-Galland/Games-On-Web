export class Health {
  constructor(maxHealth, onDamageCallback, onDeathCallback) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;

    this.onDamage = onDamageCallback;
    this.onDeath = onDeathCallback;
  }

  // Applique les dégâts
  takeDamage(amount) {
    if (this.currentHealth <= 0) return;

    this.currentHealth -= amount;
    if (this.currentHealth < 0) this.currentHealth = 0;

    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);

    if (this.currentHealth === 0) {
      this.die();
    }
  }

  // Rend de la vie
  heal(amount) {
    this.currentHealth += amount;
    if (this.currentHealth > this.maxHealth)
      this.currentHealth = this.maxHealth;

    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
  }

  // Tue l'entité
  die() {
    if (this.onDeath) this.onDeath();
  }

  // Augmente la vie maximale et soigne le joueur de ce montant
  increaseMax(amount) {
    this.maxHealth += amount;
    this.currentHealth += amount;
    
    if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
  }
}
