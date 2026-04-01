# Contribuer à PROJECT // ROGUE

Merci de votre intérêt pour le projet ! Ce document décrit notre stratégie Git et les étapes à suivre pour contribuer proprement.

---

## Stratégie Git — Git Flow simplifié

Nous utilisons un flux basé sur **deux branches permanentes** et des **branches de feature/fix éphémères**.

```
main
 └── develop
      ├── feature/nom-de-la-feature
      ├── fix/description-du-bug
      └── refactor/nom-du-refactor
```

### Branches permanentes

| Branche | Rôle |
|---|---|
| `main` | Code stable, prêt pour la production. Jamais de commit direct. |
| `develop` | Branche d'intégration. Toutes les features finies y sont fusionnées avant de passer sur `main`. |

### Branches temporaires

Créez toujours une branche depuis `develop`, jamais depuis `main`.

| Préfixe | Usage | Exemple |
|---|---|---|
| `feature/` | Nouvelle fonctionnalité | `feature/upgrade-multishot` |
| `fix/` | Correction de bug | `fix/navmesh-crash-on-room-change` |
| `refactor/` | Refactorisation sans ajout de fonctionnalité | `refactor/basenenemy-cleanup` |
| `docs/` | Documentation uniquement | `docs/readme-update` |

---

## Processus de contribution pas-à-pas

### 1. Cloner et configurer le dépôt

```bash
git clone <url-du-repo>
cd project-rogue
npm install
```

### 2. Créer votre branche depuis `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ma-nouvelle-feature
```

### 3. Développer et committer

Nous suivons la convention **Conventional Commits** pour les messages :

```
type(scope): description courte en français ou anglais

# Exemples :
feat(enemies): ajouter un ennemi de type Sniper
fix(navmesh): corriger le crash au changement de salle
refactor(player): extraire la logique de saut dans une méthode dédiée
docs(readme): mettre à jour la section installation
```

Types acceptés : `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `perf`.

Faites des commits **atomiques** : un commit = une modification logique cohérente.

```bash
git add .
git commit -m "feat(upgrades): ajouter l'amélioration de vitesse de déplacement"
```

### 4. Pousser et ouvrir une Pull Request

```bash
git push origin feature/ma-nouvelle-feature
```

Ouvrez ensuite une **Pull Request** vers `develop` sur la forge Git utilisée. La PR doit :

- Avoir un titre clair reprenant la convention de commit.
- Décrire ce qui a été fait et pourquoi.
- Mentionner l'issue associée si applicable (`Closes #42`).

### 5. Review et merge

- Au moins **un autre membre** de l'équipe doit approuver la PR avant le merge.
- Résolvez tous les commentaires avant de merger.
- Utilisez **Squash and Merge** si la branche contient beaucoup de commits de travail intermédiaires, ou **Merge Commit** si l'historique doit rester lisible.
- Supprimez la branche après le merge.

### 6. Merge de `develop` vers `main`

Quand `develop` est stable et testé manuellement, un membre de l'équipe ouvre une PR `develop → main`. Le merge sur `main` doit être validé par l'ensemble de l'équipe.

---

## Règles générales

- **Ne jamais committer directement sur `main` ou `develop`.**
- Gardez vos branches à jour avec `develop` en faisant régulièrement un rebase ou un merge :
  ```bash
  git fetch origin
  git rebase origin/develop
  ```
- Ne committez pas de fichiers générés (`node_modules/`, `dist/`, `.env`). Vérifiez le `.gitignore`.
- Un seul fichier CSS global (`Game.css`) — discutez avant d'en ajouter d'autres.
- Les assets binaires (`.glb`, images) ne doivent pas transiter par Git si leur taille est importante ; utilisez un stockage externe (Git LFS, drive partagé) et documentez l'emplacement dans le README.

---

## Signaler un bug ou proposer une feature

Ouvrez une **Issue** sur le dépôt en utilisant les templates disponibles :

- 🐛 **Bug report** : décrivez le comportement observé, le comportement attendu et les étapes pour reproduire.
- ✨ **Feature request** : décrivez la fonctionnalité souhaitée et son intérêt pour le jeu.