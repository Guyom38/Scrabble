/**
 * constants.js — Constantes immuables du jeu Scrabble FR
 * Aucune logique ici, uniquement des données de configuration.
 */

/** Distribution officielle des tuiles françaises (102 au total) */
export const TILE_DISTRIBUTION = [
  { l: 'A', c: 9,  v: 1  }, { l: 'B', c: 2,  v: 3  },
  { l: 'C', c: 2,  v: 3  }, { l: 'D', c: 3,  v: 2  },
  { l: 'E', c: 15, v: 1  }, { l: 'F', c: 2,  v: 4  },
  { l: 'G', c: 2,  v: 2  }, { l: 'H', c: 2,  v: 4  },
  { l: 'I', c: 8,  v: 1  }, { l: 'J', c: 1,  v: 8  },
  { l: 'K', c: 1,  v: 10 }, { l: 'L', c: 5,  v: 1  },
  { l: 'M', c: 3,  v: 2  }, { l: 'N', c: 6,  v: 1  },
  { l: 'O', c: 6,  v: 1  }, { l: 'P', c: 2,  v: 3  },
  { l: 'Q', c: 1,  v: 8  }, { l: 'R', c: 6,  v: 1  },
  { l: 'S', c: 6,  v: 1  }, { l: 'T', c: 6,  v: 1  },
  { l: 'U', c: 6,  v: 1  }, { l: 'V', c: 2,  v: 4  },
  { l: 'W', c: 1,  v: 10 }, { l: 'X', c: 1,  v: 10 },
  { l: 'Y', c: 1,  v: 10 }, { l: 'Z', c: 1,  v: 10 },
  { l: '_', c: 2,  v: 0  },  // Joker
];

/**
 * Layout du plateau 15×15.
 * 0 = case normale
 * 1 = Mot Triple  (TW)
 * 2 = Mot Double  (DW)
 * 3 = Lettre Triple (TL)
 * 4 = Lettre Double (DL)
 * 5 = Case centrale (★, compte comme DW)
 */
export const BOARD_LAYOUT = [
  [1,0,0,4,0,0,0,1,0,0,0,4,0,0,1],
  [0,2,0,0,0,3,0,0,0,3,0,0,0,2,0],
  [0,0,2,0,0,0,4,0,4,0,0,0,2,0,0],
  [4,0,0,2,0,0,0,4,0,0,0,2,0,0,4],
  [0,0,0,0,2,0,0,0,0,0,2,0,0,0,0],
  [0,3,0,0,0,3,0,0,0,3,0,0,0,3,0],
  [0,0,4,0,0,0,4,0,4,0,0,0,4,0,0],
  [1,0,0,4,0,0,0,5,0,0,0,4,0,0,1],
  [0,0,4,0,0,0,4,0,4,0,0,0,4,0,0],
  [0,3,0,0,0,3,0,0,0,3,0,0,0,3,0],
  [0,0,0,0,2,0,0,0,0,0,2,0,0,0,0],
  [4,0,0,2,0,0,0,4,0,0,0,2,0,0,4],
  [0,0,2,0,0,0,4,0,4,0,0,0,2,0,0],
  [0,2,0,0,0,3,0,0,0,3,0,0,0,2,0],
  [1,0,0,4,0,0,0,1,0,0,0,4,0,0,1],
];

/** Classes CSS associées aux types de cases */
export const BONUS_CSS = {
  0: '',
  1: 'board__cell--tw',
  2: 'board__cell--dw',
  3: 'board__cell--tl',
  4: 'board__cell--dl',
  5: 'board__cell--start',
};

/** Labels HTML des cases bonus */
export const BONUS_LABELS = {
  0: '',
  1: 'MOT<br>TRIPLE',
  2: 'MOT<br>DOUBLE',
  3: 'LETTRE<br>TRIPLE',
  4: 'LETTRE<br>DOUBLE',
  5: '★',
};

/** Valeur de chaque lettre (lookup rapide) */
export const TILE_VALUES = Object.fromEntries(
  TILE_DISTRIBUTION.map(t => [t.l, t.v])
);

/** Taille du plateau */
export const BOARD_SIZE = 15;

/** Nombre de tuiles dans le chevalet */
export const RACK_SIZE = 7;

/** Bonus si toutes les tuiles du chevalet sont jouées en un coup */
export const SCRABBLE_BONUS = 50;

/** Case centrale (première pose obligatoire) */
export const CENTER = { x: 7, y: 7 };

/** États de la machine à états principale */
export const GAME_STATES = Object.freeze({
  LOADING:    'loading',
  MENU:       'menu',
  CONFIG:     'config',
  PLAYING:    'playing',
  AI_THINKING:'ai_thinking',
  GAME_OVER:  'game_over',
});

/** Types de joueurs */
export const PLAYER_TYPES = Object.freeze({
  HUMAN: 'human',
  AI:    'ai',
});

/** Niveaux d'IA */
export const AI_LEVELS = Object.freeze({
  EASY:   'easy',
  MEDIUM: 'medium',
  HARD:   'hard',
});

/** Labels des niveaux d'IA */
export const AI_LEVEL_LABELS = {
  easy:   'Facile',
  medium: 'Intermédiaire',
  hard:   'Difficile',
};

/** Couleurs par index de joueur */
export const PLAYER_COLORS = ['#f0c040', '#82e0aa', '#85c1e9', '#f1948a'];

/** Noms par défaut des IA */
export const AI_DEFAULT_NAMES = ['Alphonse', 'Bertrand', 'Claudette'];

/** Nombre max de passes consécutives avant fin de partie */
export const MAX_CONSECUTIVE_PASSES = 6;

/** Directions */
export const DIR = Object.freeze({ H: 'H', V: 'V' });

/** Touches alphabet pour le joker */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
