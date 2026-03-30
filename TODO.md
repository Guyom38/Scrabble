# Scrabble HTML5 — TODO & Roadmap

> Version cible : jeu solo (1 humain vs 1 à 3 IA) — HTML autonome, hébergeable en mutualisé.
> Standard : ES Modules natifs, CSS Custom Properties, aucune dépendance externe.

---

## Arborescence cible

```
scrabble/
├── index.html                        # Point d'entrée — Splash + Menu principal
├── css/
│   ├── variables.css                 # Design tokens (couleurs, espacements, polices)
│   ├── base.css                      # Reset, typographie, éléments globaux
│   ├── layout.css                    # Structures de pages (splash, menu, game)
│   ├── components/
│   │   ├── board.css                 # Plateau 15×15 + cases bonus
│   │   ├── tile.css                  # Tuiles (rendu bois, sub-score, états)
│   │   ├── rack.css                  # Chevalet joueur
│   │   ├── scoreboard.css            # Panneau scores multi-joueurs
│   │   ├── timer.css                 # Chronomètre
│   │   ├── modal.css                 # Système modal (overlay, dialog)
│   │   └── splash.css                # Écran de démarrage
│   └── animations.css                # Toutes les @keyframes du projet
├── js/
│   ├── core/
│   │   ├── constants.js              # Distribution FR, layout plateau, config
│   │   ├── dictionary.js             # Chargement dico.txt + validation O(1)
│   │   ├── tile-bag.js               # Sac : génération, mélange, pioche
│   │   ├── board.js                  # État plateau : placement, validation, lecture
│   │   ├── player.js                 # Modèle joueur (humain/IA, rack, score)
│   │   ├── scorer.js                 # Calcul score (mot principal + perpendiculaires)
│   │   └── game-engine.js            # Machine d'états principale du jeu
│   ├── ai/
│   │   ├── move-generator.js         # Génération de tous les coups légaux
│   │   ├── ai-easy.js                # Stratégie facile
│   │   ├── ai-medium.js              # Stratégie intermédiaire
│   │   └── ai-hard.js                # Stratégie difficile (optimisée)
│   ├── ui/
│   │   ├── renderer.js               # Rendu DOM : plateau, rack, scores, tour
│   │   ├── drag-drop.js              # Drag & Drop tuiles (rack↔plateau)
│   │   ├── modal-manager.js          # Gestion pile de modales
│   │   ├── splash-screen.js          # Animation intro + transitions
│   │   ├── timer.js                  # Chronomètre (global + par tour optionnel)
│   │   └── animations.js             # Helpers JS d'animation (FLIP, séquences)
│   ├── storage/
│   │   └── save-manager.js           # Sérialisation / LocalStorage
│   └── app.js                        # Bootstrap, routage entre écrans
├── assets/
│   ├── fonts/                        # Polices (ex: Playfair Display, Lato)
│   └── img/
│       ├── logo.svg                  # Logo Scrabble
│       ├── wood-table.jpg            # Texture fond de table en bois
│       └── tile-texture.png          # Texture surface tuile (optionnel)
└── data/
    └── dico.txt                      # Dictionnaire français (existant)
```

---

## PHASE 0 — Infrastructure & Setup

- [ ] **P0-01** Créer la structure de dossiers complète telle que définie ci-dessus
- [ ] **P0-02** Déplacer `dico.txt` dans `data/`
- [ ] **P0-03** Rédiger `css/variables.css` : palette bois (brun chaud, crème, bordeaux), tailles, radii, shadows, z-index
- [ ] **P0-04** Rédiger `css/base.css` : reset CSS minimal, `box-sizing: border-box`, typographie de base, sélection de police
- [ ] **P0-05** Rédiger `css/layout.css` : sections `.screen` avec `display:none/flex`, transitions entre vues
- [ ] **P0-06** Rédiger `css/animations.css` : toutes les `@keyframes` (`fadeIn`, `slideUp`, `tilePlace`, `tileScore`, `shake`, `scrabbleBonus`)
- [ ] **P0-07** Rédiger `js/core/constants.js` : distribution tuiles FR, layout plateau 15×15, BONUS_LABELS, TILE_VALUES

---

## PHASE 1 — Moteur de jeu (Core)

### 1.1 Dictionnaire
- [ ] **P1-01** `js/core/dictionary.js` — Charger `data/dico.txt` via `fetch()` à l'initialisation
- [ ] **P1-02** Stocker les mots dans un `Set` (validation O(1))
- [ ] **P1-03** Normaliser : uppercase, trim, supprimer les lignes vides / commentaires
- [ ] **P1-04** Exposer `Dictionary.isValid(word: string): boolean`
- [ ] **P1-05** Exposer `Dictionary.startsWith(prefix: string): boolean` (pour l'IA)
- [ ] **P1-06** Indicateur de chargement pendant le fetch du dico

### 1.2 Sac de tuiles
- [ ] **P1-07** `js/core/tile-bag.js` — Classe `TileBag`
- [ ] **P1-08** Méthode `generate()` : créer les 102 tuiles FR avec id unique
- [ ] **P1-09** Méthode `draw(n)` : piocher n tuiles, retourner tableau
- [ ] **P1-10** Méthode `exchange(tiles[])` : remettre des tuiles, piocher autant
- [ ] **P1-11** Getter `remaining` : nombre de tuiles restantes
- [ ] **P1-12** Méthode `isEmpty()` : booléen

### 1.3 Plateau
- [ ] **P1-13** `js/core/board.js` — Classe `Board`
- [ ] **P1-14** Grille 15×15 de cellules `{ tile: null | TileObj, locked: bool }`
- [ ] **P1-15** Méthode `placeTile(x, y, tile)` / `removeTile(x, y)`
- [ ] **P1-16** Méthode `getCell(x, y)` / `isEmpty(x, y)`
- [ ] **P1-17** Méthode `getWordAt(x, y, direction)` : retourne le mot complet sur la ligne/colonne
- [ ] **P1-18** Méthode `getAllWordsFormed(placements[])` : mot principal + tous les mots perpendiculaires formés
- [ ] **P1-19** Méthode `validatePlacements(placements[], isFirstTurn)` : alignement, trous, connexion, case centrale
- [ ] **P1-20** Méthode `lockTiles()` : fige les tuiles temporaires

### 1.4 Joueur
- [ ] **P1-21** `js/core/player.js` — Classe `Player`
- [ ] **P1-22** Propriétés : `id`, `name`, `type` (`human`|`ai`), `aiLevel` (`easy`|`medium`|`hard`), `score`, `rack[]`, `consecutivePasses`
- [ ] **P1-23** Méthode `addToRack(tiles[])`, `removeFromRack(tiles[])`
- [ ] **P1-24** Méthode `serialize()` / `static deserialize(data)` pour la sauvegarde

### 1.5 Calcul du score
- [ ] **P1-25** `js/core/scorer.js` — Classe `Scorer`
- [ ] **P1-26** Méthode `scoreWord(wordCells[], newPlacements[])` : applique les bonus de case uniquement sur les nouvelles tuiles
- [ ] **P1-27** Méthode `scoreMove(allWordsFormed[], newPlacements[])` : somme tous les mots + bonus Scrabble (50 pts si 7 tuiles)
- [ ] **P1-28** Bonus Scrabble : détection des 7 tuiles posées, affichage spécial

### 1.6 Moteur principal
- [ ] **P1-29** `js/core/game-engine.js` — Classe `GameEngine`
- [ ] **P1-30** Machine d'états : `IDLE` → `LOADING` → `MENU` → `CONFIG` → `PLAYING` → `GAME_OVER`
- [ ] **P1-31** Gestion des tours : `nextTurn()`, détection fin de partie (sac vide + rack vide, ou 6 passes consécutives)
- [ ] **P1-32** Méthode `submitMove(placements[])` : validation → calcul score → verrou → pioche → prochain tour
- [ ] **P1-33** Méthode `passTurn()` : passe le tour, incrémente `consecutivePasses`
- [ ] **P1-34** Méthode `exchangeTiles(tiles[])` : échange avec le sac (interdit si sac < 7)
- [ ] **P1-35** Méthode `endGame()` : déduire les tuiles restantes, calculer scores finaux
- [ ] **P1-36** Événements `CustomEvent` émis par le moteur : `game:turnChanged`, `game:scoreUpdated`, `game:ended`, `game:message`

---

## PHASE 2 — Intelligence Artificielle

### 2.1 Générateur de coups
- [ ] **P2-01** `js/ai/move-generator.js` — Classe `MoveGenerator`
- [ ] **P2-02** Algorithme de génération : pour chaque case anchor (adjacente à une tuile existante), essayer toutes les combinaisons possibles du rack de l'IA dans les deux directions
- [ ] **P2-03** Filtrer les coups par `Dictionary.isValid()` pour le mot principal
- [ ] **P2-04** Filtrer par `Dictionary.isValid()` pour chaque mot perpendiculaire formé
- [ ] **P2-05** Retourner la liste de tous les coups légaux avec leur score calculé
- [ ] **P2-06** Optimisation : utiliser `Dictionary.startsWith()` pour élagage précoce (pruning)
- [ ] **P2-07** Gérer les jokers (lettre `_`) : les essayer sur toutes les lettres de l'alphabet

### 2.2 IA Facile
- [ ] **P2-08** `js/ai/ai-easy.js` — Classe `AIEasy extends AIBase`
- [ ] **P2-09** Stratégie : jouer le coup de **score le plus bas** parmi les 10 premiers trouvés (IA intentionnellement faible)
- [ ] **P2-10** Si aucun coup : passer ou échanger des tuiles aléatoirement
- [ ] **P2-11** Délai artificiel de 0.8–1.5 s pour simuler la réflexion

### 2.3 IA Intermédiaire
- [ ] **P2-12** `js/ai/ai-medium.js` — Classe `AIMedium extends AIBase`
- [ ] **P2-13** Stratégie : jouer le coup **médian** parmi tous les coups légaux (ni le meilleur ni le pire)
- [ ] **P2-14** Légère pondération aléatoire (±20%) pour éviter les parties prévisibles
- [ ] **P2-15** Si aucun coup : échange de tuiles peu utiles (Q, W, X, Y sans contexte)
- [ ] **P2-16** Délai artificiel de 1–2 s

### 2.4 IA Difficile
- [ ] **P2-17** `js/ai/ai-hard.js` — Classe `AIHard extends AIBase`
- [ ] **P2-18** Stratégie : jouer le coup de **score maximal** parmi tous les coups légaux
- [ ] **P2-19** Bonus : préférence pour les cases bonus TW/DW lorsque scores équivalents
- [ ] **P2-20** Gestion optimale du rack : conserver les combinaisons de lettres polyvalentes
- [ ] **P2-21** Délai artificiel de 1.5–3 s (simuler une réflexion sérieuse)

---

## PHASE 3 — Interface Utilisateur

### 3.1 Splash Screen
- [ ] **P3-01** `js/ui/splash-screen.js` + `css/components/splash.css`
- [ ] **P3-02** Écran plein fond bois avec logo Scrabble centré
- [ ] **P3-03** Animation d'entrée : tuiles qui tombent pour former le mot "SCRABBLE"
- [ ] **P3-04** Barre de progression pendant le chargement du dictionnaire
- [ ] **P3-05** Transition fluide vers le menu principal (fondu + glissement)

### 3.2 Menu Principal
- [ ] **P3-06** Bouton **"Nouvelle Partie"** : navigue vers la page de configuration
- [ ] **P3-07** Bouton **"Continuer"** : affiché seulement si une sauvegarde existe en LocalStorage, reprend la partie
- [ ] **P3-08** Bouton **"Règles"** : ouvre une modale avec les règles du jeu
- [ ] **P3-09** Style : fond bois, cartes avec hover, typographie chaleureuse (Playfair Display)

### 3.3 Page de Configuration
- [ ] **P3-10** Choix du nombre d'adversaires IA : 1, 2 ou 3 (sélecteur visuel)
- [ ] **P3-11** Pour chaque IA : choisir le niveau (Facile / Intermédiaire / Difficile) via boutons radio stylisés
- [ ] **P3-12** Saisie du nom du joueur humain
- [ ] **P3-13** Bouton **"Démarrer"** → lancer la partie
- [ ] **P3-14** Bouton **"Retour"** → menu principal

### 3.4 Interface de Jeu
- [ ] **P3-15** `js/ui/renderer.js` — Rendu du plateau, du rack, du scoreboard, de l'indicateur de tour
- [ ] **P3-16** Plateau 15×15 : fond bois + cases colorées selon bonus + labels (MOT×3, LETTRE×2, etc.)
- [ ] **P3-17** Chevalet joueur : fond bois foncé, 7 slots, tuiles avec valeurs
- [ ] **P3-18** Panneau scores : liste des joueurs avec score, indicateur de tour actif (nom + avatar/couleur)
- [ ] **P3-19** Indicateur sac : nombre de tuiles restantes
- [ ] **P3-20** Chronomètre global (temps de partie) toujours visible
- [ ] **P3-21** Boutons d'action : Valider / Rappeler / Mélanger / Passer / Échanger

### 3.5 Drag & Drop
- [ ] **P3-22** `js/ui/drag-drop.js` — Gestion complète drag & drop
- [ ] **P3-23** Drag depuis le rack vers le plateau (placement temporaire)
- [ ] **P3-24** Drag d'une case du plateau vers une autre case (repositionnement tant que non validé)
- [ ] **P3-25** Drag depuis le plateau vers le rack (rappel d'une tuile)
- [ ] **P3-26** Réorganisation des tuiles dans le rack par drag & drop
- [ ] **P3-27** Feedback visuel : case cible mise en évidence au survol (`dragover`)
- [ ] **P3-28** Support tactile (touch events) pour mobile/tablette

### 3.6 Chronomètre
- [ ] **P3-29** `js/ui/timer.js` — Classe `GameTimer`
- [ ] **P3-30** Chrono global : `start()`, `stop()`, `reset()`, `getElapsed()`
- [ ] **P3-31** Affichage format `HH:MM:SS` mis à jour chaque seconde
- [ ] **P3-32** Persistance du temps écoulé dans la sauvegarde

### 3.7 Modales
- [ ] **P3-33** `js/ui/modal-manager.js` — `ModalManager` : pile LIFO, ouverture/fermeture avec animation
- [ ] **P3-34** **Modale Joker** : clavier visuel pour choisir la lettre du joker
- [ ] **P3-35** **Modale Confirmation** : "Passer votre tour ?" / "Êtes-vous sûr ?"
- [ ] **P3-36** **Modale Échange** : sélectionner les tuiles à échanger, validation
- [ ] **P3-37** **Modale Fin de Partie** : scores finaux, classement, boutons Rejouer / Menu
- [ ] **P3-38** **Modale Toast** : notification courte (haut de l'écran) pour les messages de jeu (mot invalide, score, Scrabble !)
- [ ] **P3-39** **Modale Règles** : texte des règles, fermeture par croix ou clic extérieur
- [ ] **P3-40** **Modale Tour IA** : indicateur pendant que l'IA réfléchit (spinner + nom IA)

### 3.8 Animations
- [ ] **P3-41** `js/ui/animations.js` — Helpers : `animateTileDrop()`, `animateScore()`, `animateTileToRack()`
- [ ] **P3-42** Animation FLIP (First/Last/Invert/Play) pour les tuiles lors du repositionnement
- [ ] **P3-43** Animation de score flottant ("+12 pts" qui monte et disparaît) lors de la validation
- [ ] **P3-44** Animation Scrabble Bonus : flash doré + confettis si 7 tuiles posées
- [ ] **P3-45** Animation shake sur le chevalet si coup invalide
- [ ] **P3-46** Animation de pioche : les nouvelles tuiles arrivent une par une avec délai
- [ ] **P3-47** Transition de tour : fondu sur l'indicateur de joueur actif

---

## PHASE 4 — Sauvegarde

- [ ] **P4-01** `js/storage/save-manager.js` — Classe `SaveManager`
- [ ] **P4-02** `save(gameState)` : sérialiser et écrire dans `localStorage['scrabble_save']`
- [ ] **P4-03** `load()` : désérialiser et retourner l'état (ou `null` si absent)
- [ ] **P4-04** `hasSave()` : booléen — utilisé pour afficher/masquer "Continuer" dans le menu
- [ ] **P4-05** `deleteSave()` : effacer la sauvegarde en fin de partie ou nouvelle partie
- [ ] **P4-06** Sauvegarde automatique après chaque coup validé
- [ ] **P4-07** Sérialiser : état du plateau, racks, scores, sac, tour actuel, temps écoulé, config IA

---

## PHASE 5 — HTML & Assemblage

- [ ] **P5-01** `index.html` : inclure tous les CSS, définir les 4 sections `.screen` (`#screen-splash`, `#screen-menu`, `#screen-config`, `#screen-game`), charger `app.js` en `type="module"`
- [ ] **P5-02** `js/app.js` : initialisation au `DOMContentLoaded`, instanciation des modules, gestion de la navigation entre écrans
- [ ] **P5-03** Pré-charger les assets critiques (fond bois, police) via `<link rel="preload">`
- [ ] **P5-04** Vérifier l'absence de dépendances externes (tout en local)

---

## PHASE 6 — Polish & Qualité

- [ ] **P6-01** Responsive : adapter le plateau en 22px/cell sous 600 px de large
- [ ] **P6-02** Support tactile complet (touch events sur les tuiles)
- [ ] **P6-03** Accessibilité : `aria-label` sur les cases et boutons, focus visible, navigation clavier
- [ ] **P6-04** Vérification des règles officielles FR : fin de partie, décompte des tuiles restantes, 6 passes consécutives
- [ ] **P6-05** Tests manuels : une partie complète avec 1, 2 et 3 IA à chaque niveau
- [ ] **P6-06** Test de rechargement avec sauvegarde (F5 → reprendre la partie)
- [ ] **P6-07** Test de l'hébergement : upload sur mutualisé, vérifier que `fetch('data/dico.txt')` fonctionne avec les bons MIME types
- [ ] **P6-08** Minification optionnelle (non nécessaire pour le mutualisé, mais possible)
- [ ] **P6-09** Favicon + meta description pour le déploiement

---

## Conventions de développement

| Règle | Détail |
|---|---|
| **Modules** | ES Modules natifs (`import/export`), pas de bundler |
| **CSS** | BEM pour les noms de classes (`.board__cell--bonus-tw`) |
| **Nommage JS** | camelCase fonctions/variables, PascalCase classes, SCREAMING_SNAKE constantes |
| **Événements** | `CustomEvent` pour la communication moteur → UI (découplage) |
| **Données** | Structures immutables dans le core ; le renderer lit, ne modifie pas |
| **Commentaires** | JSDoc sur les méthodes publiques, commentaires inline si logique non triviale |
| **Pas de libs** | Vanilla JS/CSS uniquement — jQuery, frameworks, CDN : interdits |

---

## Ordre de développement recommandé

```
P0 (infra) → P1 (core engine) → P4 (save) → P2 (AI) → P3 (UI) → P6 (polish)
```
Tester le moteur en console avant de connecter l'UI.
