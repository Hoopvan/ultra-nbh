# Bfan — Personnalisation de l'identité graphique d'un club

Ce document liste tout ce qui peut être changé pour déployer Bfan aux couleurs d'un nouveau club, et les formats attendus pour chaque élément.

---

## Ce qui change automatiquement (base de données uniquement)

Ces éléments sont configurés dans la table `org_config` de Supabase. Aucun redéploiement nécessaire — l'app charge la config au démarrage.

### Couleurs

| Champ | Rôle dans l'app | Format | Exemple |
|-------|----------------|--------|---------|
| `primary_color` | Boutons, sélections, accents, bordures actives | Hex 6 chiffres | `#e8192c` |
| `secondary_color` | Fonds sombres (navbar, cards), dégradés | Hex 6 chiffres | `#0d1b3e` |
| `accent_color` | XP, coins, récompenses, badges | Hex 6 chiffres | `#f5a623` |

**Variantes calculées automatiquement (aucune action) :**
- `primary_color` à 12% d'opacité → fonds de sélection
- `primary_color` à 25% d'opacité → hover, états intermédiaires
- `secondary_color` éclaircie × 2 → dégradés de fond

**Conseil :** utiliser les couleurs officielles du club (charte graphique). Éviter les couleurs trop claires — l'app est sur fond sombre (`#0a0a0f`).

---

### Logo

| Champ | Rôle | Format | Contraintes |
|-------|------|--------|-------------|
| `logo_url` | Écran de chargement + écran d'accueil (remplace le logo texte et la mascotte) | URL HTTPS publique | PNG ou SVG recommandé, fond transparent, ratio libre, max 180×56px affiché |

Si `logo_url` est vide, l'app affiche le logo texte (`app_name` en typographie condensée).

**Hébergement conseillé :** Supabase Storage (bucket public), Cloudflare Images, ou tout CDN avec URL stable.

---

### Textes

| Champ | Affiché où | Format | Longueur conseillée |
|-------|-----------|--------|---------------------|
| `app_name` | Titre de page, meta PWA, écran de création de profil, slide d'installation | Texte libre | 8–15 caractères |
| `tagline` | Écran d'accueil (sous le logo) | Texte libre, markdown non supporté | 20–40 caractères |

Le **nom complet du club** (`organizations.name`) apparaît dans l'écran d'accueil sous le logo. Il est dans la table `organizations`, pas dans `org_config`.

---

### Missions activées

| Champ | Rôle | Format |
|-------|------|--------|
| `features_enabled` | Active/désactive chaque type de mission | JSON objet booléens |

Exemple :
```json
{
  "pouls": true,
  "vestiaire": true,
  "anecdote": true,
  "nantes_nbh": false,
  "avant_apres": true,
  "pronostic": true,
  "boite_mystere": true,
  "timeline": true,
  "photo_mystere": true
}
```

La mission `nantes_nbh` est spécifique à NBH — désactiver pour les autres clubs jusqu'à création d'un équivalent générique.

---

## Ce qui nécessite un nouveau déploiement

Ces éléments sont des fichiers statiques — ils demandent une action sur le repo/déploiement, mais pas de modification du code.

| Fichier | Rôle | Format | Dimensions |
|---------|------|--------|------------|
| `icon-192.png` | Icône PWA (écran d'accueil, splash) | PNG, fond plein (pas transparent pour iOS) | 192×192 px |
| `icon-512.png` | Icône PWA haute résolution | PNG, fond plein | 512×512 px |
| `manifest.json` | Nom, couleurs du splash screen PWA | JSON — modifier `name`, `short_name`, `theme_color`, `background_color` | — |

**`manifest.json` — champs à mettre à jour :**
```json
{
  "name": "Nom complet de l'app",
  "short_name": "NomCourt",
  "theme_color": "#COULEUR_PRIMAIRE",
  "background_color": "#COULEUR_SECONDAIRE"
}
```

---

## Ce qui n'est pas encore personnalisable

Ces éléments sont hardcodés et nécessitent un travail de refactoring (prévu Phase 1) :

| Élément | Statut |
|---------|--------|
| Police de caractères (Barlow) | Hardcodé — même pour tous les clubs |
| Palette de neutres (`--black`, `--white`) | Hardcodé — fond sombre universel |
| Items de la boutique (écharpe, casquette, maillot) | Hardcodés dans `config.js` — à migrer vers une table `unlockables` par org |
| Langue de l'interface | Hardcodé français — i18n prévu Phase 2 |
| Types de missions spécifiques à un sport | Hardcodés — templates génériques à créer |

---

## Récapitulatif — ce qu'il faut fournir pour onboarder un club

```
1. Couleur primaire        → ex: #e8192c  (hex)
2. Couleur secondaire      → ex: #0d1b3e  (hex)
3. Couleur accent          → ex: #f5a623  (hex)
4. Logo URL                → URL HTTPS (PNG/SVG fond transparent)
5. Nom de l'app            → ex: "Hoop NBH"  (8–15 car.)
6. Tagline                 → ex: "Bien plus que des matchs"
7. Nom complet du club     → ex: "Nantes Basket Hermine"
8. Slug unique             → ex: "nbh"  (minuscules, sans espace)
9. Icône 192×192 px        → fichier PNG
10. Icône 512×512 px       → fichier PNG
11. Missions à activer     → liste parmi les types disponibles
```

---

*Mis à jour : juin 2026*
