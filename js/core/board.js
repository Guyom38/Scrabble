/**
 * board.js — État et logique du plateau de jeu
 *
 * Représente la grille 15×15, gère le placement des tuiles,
 * la validation des règles et la lecture de l'état.
 */

import { BOARD_SIZE, BOARD_LAYOUT, CENTER, DIR } from './constants.js';

/**
 * @typedef {Object} PlacedTile
 * @property {string} id
 * @property {string} letter     — lettre effective (joker → lettre choisie)
 * @property {number} value      — valeur de la tuile (joker → 0)
 * @property {boolean} isBlank
 */

/**
 * @typedef {Object} TempPlacement
 * @property {number} x
 * @property {number} y
 * @property {string} id
 * @property {string} letter
 * @property {number} value
 * @property {boolean} isBlank
 */

export class Board {
  constructor() {
    /**
     * Grille [y][x] : null ou PlacedTile
     * @type {(PlacedTile|null)[][]}
     */
    this._grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  }

  /* ------------------------------------------------------------------ */
  /* Lecture                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * @param {number} x
   * @param {number} y
   * @returns {PlacedTile|null}
   */
  getTile(x, y) {
    if (!this._inBounds(x, y)) return null;
    return this._grid[y][x];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isEmpty(x, y) {
    return this._inBounds(x, y) && this._grid[y][x] === null;
  }

  /** Vrai si aucune tuile n'est posée sur le plateau. */
  get isBlank() {
    return this._grid.every(row => row.every(cell => cell === null));
  }

  /**
   * Retourne toutes les cases occupées.
   * @returns {{ x:number, y:number, tile:PlacedTile }[]}
   */
  getOccupied() {
    const result = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this._grid[y][x]) result.push({ x, y, tile: this._grid[y][x] });
      }
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Écriture                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Place une tuile de façon permanente.
   * @param {number} x
   * @param {number} y
   * @param {PlacedTile} tile
   */
  placeTile(x, y, tile) {
    if (!this._inBounds(x, y)) throw new RangeError(`Hors plateau : (${x},${y})`);
    this._grid[y][x] = { ...tile };
  }

  /**
   * Retire une tuile.
   * @param {number} x
   * @param {number} y
   */
  removeTile(x, y) {
    if (this._inBounds(x, y)) this._grid[y][x] = null;
  }

  /* ------------------------------------------------------------------ */
  /* Mots                                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Retourne la séquence de cases d'un mot à partir d'une position,
   * en remontant au début du mot.
   * @param {number} x
   * @param {number} y
   * @param {string} direction — DIR.H ou DIR.V
   * @returns {{ x:number, y:number, tile:PlacedTile }[]}
   */
  getWordCells(x, y, direction) {
    const [dx, dy] = direction === DIR.H ? [1, 0] : [0, 1];

    // Remonter au début
    let sx = x, sy = y;
    while (sx - dx >= 0 && sy - dy >= 0 && this._grid[sy - dy][sx - dx]) {
      sx -= dx; sy -= dy;
    }

    // Avancer jusqu'à la fin
    const cells = [];
    let cx = sx, cy = sy;
    while (cx < BOARD_SIZE && cy < BOARD_SIZE && this._grid[cy][cx]) {
      cells.push({ x: cx, y: cy, tile: this._grid[cy][cx] });
      cx += dx; cy += dy;
    }
    return cells;
  }

  /**
   * Retourne tous les mots formés par une liste de placements.
   * Inclut le mot principal et tous les mots croisés.
   *
   * @param {TempPlacement[]} placements — tuiles jouées ce tour
   * @returns {{ cells:{ x:number,y:number,tile:PlacedTile }[], isMain:boolean }[]}
   */
  getWordsFormed(placements) {
    if (placements.length === 0) return [];

    const xs = placements.map(p => p.x);
    const ys = placements.map(p => p.y);
    const isHorizontal = ys.every(y => y === ys[0]);
    const mainDir = isHorizontal ? DIR.H : DIR.V;
    const crossDir = isHorizontal ? DIR.V : DIR.H;

    // Appliquer temporairement les placements sur la grille
    const tempTile = p => ({ id: p.id, letter: p.letter, value: p.value, isBlank: p.isBlank });
    placements.forEach(p => this._grid[p.y][p.x] = tempTile(p));

    const words = [];

    try {
      // Mot principal
      const mainCells = this.getWordCells(placements[0].x, placements[0].y, mainDir);
      if (mainCells.length >= 2) words.push({ cells: mainCells, isMain: true });

      // Mots croisés : uniquement pour les nouvelles tuiles placées
      for (const p of placements) {
        const cross = this.getWordCells(p.x, p.y, crossDir);
        if (cross.length >= 2) {
          // Éviter les doublons
          const key = cross.map(c => `${c.x},${c.y}`).join('|');
          if (!words.slice(1).some(w => w.cells.map(c => `${c.x},${c.y}`).join('|') === key)) {
            words.push({ cells: cross, isMain: false });
          }
        }
      }
    } finally {
      // Retirer les tuiles temporaires
      placements.forEach(p => this._grid[p.y][p.x] = null);
    }

    return words;
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Valide un ensemble de placements selon les règles du Scrabble.
   * @param {TempPlacement[]} placements
   * @param {boolean} isFirstTurn
   * @returns {{ valid: boolean, error?: string }}
   */
  validatePlacements(placements, isFirstTurn) {
    if (placements.length === 0) {
      return { valid: false, error: 'Aucune lettre placée.' };
    }

    // Vérifier qu'aucune case n'est déjà occupée
    for (const p of placements) {
      if (this._grid[p.y]?.[p.x] !== null && this._grid[p.y]?.[p.x] !== undefined) {
        return { valid: false, error: 'Une case est déjà occupée.' };
      }
    }

    const xs = placements.map(p => p.x);
    const ys = placements.map(p => p.y);
    const allSameRow = ys.every(y => y === ys[0]);
    const allSameCol = xs.every(x => x === xs[0]);

    // Une seule tuile placée sur le plateau vide → invalide
    if (placements.length === 1 && isFirstTurn) {
      return { valid: false, error: 'Le premier mot doit contenir au moins 2 lettres.' };
    }

    if (!allSameRow && !allSameCol) {
      return { valid: false, error: 'Les lettres doivent être alignées (même ligne ou colonne).' };
    }

    const isHorizontal = allSameRow;
    const sortedPlacements = [...placements].sort((a, b) =>
      isHorizontal ? a.x - b.x : a.y - b.y
    );

    // Vérifier les trous
    const start = isHorizontal ? sortedPlacements[0].x : sortedPlacements[0].y;
    const end   = isHorizontal ? sortedPlacements[sortedPlacements.length - 1].x
                               : sortedPlacements[sortedPlacements.length - 1].y;
    const fixed = isHorizontal ? sortedPlacements[0].y : sortedPlacements[0].x;

    for (let i = start; i <= end; i++) {
      const cx = isHorizontal ? i : fixed;
      const cy = isHorizontal ? fixed : i;
      const hasPlacement = placements.some(p => p.x === cx && p.y === cy);
      const hasExisting  = this._grid[cy][cx] !== null;
      if (!hasPlacement && !hasExisting) {
        return { valid: false, error: 'Il y a un trou dans le mot.' };
      }
    }

    // Premier tour : doit passer par la case centrale
    if (isFirstTurn) {
      const touchesCenter = placements.some(p => p.x === CENTER.x && p.y === CENTER.y);
      if (!touchesCenter) {
        return { valid: false, error: 'Le premier mot doit passer par la case centrale (★).' };
      }
      return { valid: true };
    }

    // Tours suivants : doit être connecté aux tuiles existantes
    const placementSet = new Set(placements.map(p => `${p.x},${p.y}`));

    // Appliquer temporairement pour vérifier les prolongements
    const tempTile = p => ({ id: p.id, letter: p.letter, value: p.value, isBlank: p.isBlank });
    placements.forEach(p => this._grid[p.y][p.x] = tempTile(p));
    let extConnected = false;
    for (const p of placements) {
      if (this._isAdjacentToExistingPermanent(p.x, p.y, placementSet)) {
        extConnected = true; break;
      }
    }
    placements.forEach(p => this._grid[p.y][p.x] = null);

    if (!extConnected) {
      return { valid: false, error: 'Le mot doit être connecté aux lettres déjà posées.' };
    }

    return { valid: true };
  }

  /* ------------------------------------------------------------------ */
  /* Ancres (pour l'IA)                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Retourne la liste des cases ancres pour la génération de coups IA.
   * Une ancre est une case vide adjacente à une tuile posée.
   * Sur un plateau vide, la case centrale est la seule ancre.
   * @returns {{ x:number, y:number }[]}
   */
  getAnchors() {
    if (this.isBlank) return [{ x: CENTER.x, y: CENTER.y }];

    const anchors = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this._grid[y][x]) continue;
        const adj = dirs.some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && this._grid[ny][nx];
        });
        if (adj) anchors.push({ x, y });
      }
    }
    return anchors;
  }

  /* ------------------------------------------------------------------ */
  /* Sérialisation                                                        */
  /* ------------------------------------------------------------------ */

  serialize() {
    return { grid: this._grid.map(row => row.map(cell => cell ? { ...cell } : null)) };
  }

  static deserialize(data) {
    const board = new Board();
    board._grid = data.grid.map(row => row.map(cell => cell ? { ...cell } : null));
    return board;
  }

  /* ------------------------------------------------------------------ */
  /* Privé                                                                */
  /* ------------------------------------------------------------------ */

  _inBounds(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
  }

  /**
   * Vérifie si (x,y) est adjacent à une case occupée de la grille permanente,
   * en excluant les placements temporaires du tour.
   */
  _isAdjacentToExisting(x, y, placementSet) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    return dirs.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return this._inBounds(nx, ny) && this._grid[ny][nx] !== null;
    });
  }

  _isAdjacentToExistingPermanent(x, y, placementSet) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    return dirs.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (!this._inBounds(nx, ny)) return false;
      const key = `${nx},${ny}`;
      return this._grid[ny][nx] !== null && !placementSet.has(key);
    });
  }
}
