/**
 * move-generator.js — Générateur de coups légaux pour l'IA
 *
 * Algorithme : backtracking par cases ancres avec élagage par préfixe.
 * Pour chaque case ancre et chaque direction (H/V), construit des mots
 * en utilisant les tuiles du rack + les tuiles existantes sur le plateau.
 *
 * Complexité pratique : acceptable pour un navigateur (< 2s pour la plupart des positions).
 */

import { BOARD_SIZE, DIR, ALPHABET } from '../core/constants.js';

export class MoveGenerator {
  /**
   * @param {import('../core/dictionary.js').Dictionary} dictionary
   */
  constructor(dictionary) {
    this._dict = dictionary;
  }

  /**
   * Génère tous les coups légaux.
   * @param {import('../core/board.js').Board} board
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @returns {Move[]}
   */
  generateMoves(board, rack) {
    const moves    = [];
    const anchors  = board.getAnchors();
    const anchorSet = new Set(anchors.map(a => `${a.x},${a.y}`));

    for (const dir of [DIR.H, DIR.V]) {
      for (const anchor of anchors) {
        this._generateFromAnchor(board, rack, anchor, dir, anchorSet, moves);
      }
    }

    // Dédupliquer (même ensemble de placements)
    return this._deduplicate(moves);
  }

  /**
   * Génère les coups depuis une case ancre dans une direction.
   * @private
   */
  _generateFromAnchor(board, rack, anchor, dir, anchorSet, moves) {
    const isH = dir === DIR.H;
    const anchorCoord = isH ? anchor.x : anchor.y;
    const fixedCoord  = isH ? anchor.y : anchor.x;

    // Trouver le début du segment (en remontant jusqu'à une case vide ou bord)
    let segStart = anchorCoord;
    while (segStart > 0) {
      const px = isH ? segStart - 1 : fixedCoord;
      const py = isH ? fixedCoord   : segStart - 1;
      if (board.getTile(px, py)) { segStart--; }
      else break;
    }

    // Essayer toutes les positions de départ possibles
    // (depuis segStart jusqu'à anchorCoord inclus)
    const maxBack = Math.min(anchorCoord - segStart, rack.length);
    for (let back = 0; back <= maxBack; back++) {
      const startCoord = anchorCoord - back;

      // Si une tuile existe juste avant le début → on ne peut pas commencer là
      if (startCoord > 0) {
        const px = isH ? startCoord - 1 : fixedCoord;
        const py = isH ? fixedCoord     : startCoord - 1;
        if (board.getTile(px, py)) continue;
      }

      this._backtrack(
        board, rack, dir, startCoord, fixedCoord,
        anchorCoord, startCoord, '', [], anchorSet, moves
      );
    }
  }

  /**
   * Backtracking récursif.
   * @private
   */
  _backtrack(board, rack, dir, pos, fixedCoord, anchorCoord, startCoord,
             prefix, placements, anchorSet, moves) {
    const isH = dir === DIR.H;
    const x   = isH ? pos : fixedCoord;
    const y   = isH ? fixedCoord : pos;

    // Hors plateau
    if (pos >= BOARD_SIZE) {
      this._tryRecord(prefix, placements, anchorCoord, startCoord, board, dir, fixedCoord, moves);
      return;
    }

    // Case suivante immédiatement après → vérifier qu'il n'y a pas déjà un mot
    const existingTile = board.getTile(x, y);

    if (existingTile) {
      // On doit utiliser cette lettre
      const letter = existingTile.letter;
      const newPrefix = prefix + letter;
      if (!this._dict.hasPrefix(newPrefix)) return;

      this._tryRecord(newPrefix, placements, anchorCoord, startCoord, board, dir, fixedCoord, moves);
      this._backtrack(board, rack, dir, pos + 1, fixedCoord,
        anchorCoord, startCoord, newPrefix, placements, anchorSet, moves);
    } else {
      // Case vide → essayer chaque lettre du rack
      const tried = new Set();

      for (let i = 0; i < rack.length; i++) {
        const tile = rack[i];
        const letters = tile.isBlank ? ALPHABET : [tile.letter];

        for (const letter of letters) {
          if (tried.has(letter)) continue;
          tried.add(letter);

          const newPrefix = prefix + letter;
          if (!this._dict.hasPrefix(newPrefix)) continue;

          // Vérifier que le mot croisé formé est valide (ou qu'il n'y en a pas)
          if (!this._crossWordValid(board, x, y, letter, dir)) continue;

          const newPlacements = [...placements, {
            x, y,
            letter,
            tileId:  tile.id,
            isBlank: tile.isBlank,
            value:   tile.value,
          }];

          const newRack = rack.filter((_, idx) => idx !== i);

          this._tryRecord(newPrefix, newPlacements, anchorCoord, startCoord, board, dir, fixedCoord, moves);

          this._backtrack(board, newRack, dir, pos + 1, fixedCoord,
            anchorCoord, startCoord, newPrefix, newPlacements, anchorSet, moves);
        }
      }
    }
  }

  /**
   * Enregistre un coup si le préfixe est un mot valide >= 2 lettres
   * qui couvre au moins une case ancre.
   * @private
   */
  _tryRecord(word, placements, anchorCoord, startCoord, board, dir, fixedCoord, moves) {
    if (word.length < 2) return;
    if (placements.length === 0) return;
    if (!this._dict.isValid(word)) return;

    // Vérifier que le mot ne se prolonge pas juste après (sinon il n'est pas complet)
    const endCoord = startCoord + word.length - 1;
    const isH = dir === DIR.H;
    const ex = isH ? endCoord + 1 : fixedCoord;
    const ey = isH ? fixedCoord   : endCoord + 1;
    if (endCoord + 1 < BOARD_SIZE && board.getTile(ex, ey)) return;

    moves.push({
      word,
      placements,
      direction: dir,
      score: 0, // calculé a posteriori par l'IA
    });
  }

  /**
   * Vérifie qu'en plaçant `letter` en (x,y), le mot perpendiculaire formé
   * (s'il existe) est dans le dictionnaire.
   * @private
   */
  _crossWordValid(board, x, y, letter, mainDir) {
    const crossDir = mainDir === DIR.H ? DIR.V : DIR.H;
    const [dx, dy] = crossDir === DIR.H ? [1, 0] : [0, 1];

    // Chercher les tuiles adjacentes dans la direction perpendiculaire
    let hasNeighbour = false;
    let start = { x, y };

    // Remonter
    while (start.x - dx >= 0 && start.y - dy >= 0 &&
           board.getTile(start.x - dx, start.y - dy)) {
      start = { x: start.x - dx, y: start.y - dy };
      hasNeighbour = true;
    }

    // Avancer après (x,y)
    let end = { x, y };
    while (end.x + dx < BOARD_SIZE && end.y + dy < BOARD_SIZE &&
           board.getTile(end.x + dx, end.y + dy)) {
      end = { x: end.x + dx, y: end.y + dy };
      hasNeighbour = true;
    }

    if (!hasNeighbour) return true; // Pas de mot croisé → toujours valide

    // Construire le mot croisé avec la lettre qu'on place
    let word = '';
    let cx = start.x, cy = start.y;
    while (cx !== x || cy !== y) {
      word += board.getTile(cx, cy).letter;
      cx += dx; cy += dy;
    }
    word += letter;
    cx += dx; cy += dy;
    while (cx < BOARD_SIZE && cy < BOARD_SIZE && board.getTile(cx, cy)) {
      word += board.getTile(cx, cy).letter;
      cx += dx; cy += dy;
    }

    return this._dict.isValid(word);
  }

  /**
   * Supprime les doublons (même ensemble de positions+lettres).
   * @private
   */
  _deduplicate(moves) {
    const seen = new Set();
    return moves.filter(m => {
      const key = m.placements
        .map(p => `${p.x},${p.y},${p.letter}`)
        .sort()
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/**
 * @typedef {Object} Move
 * @property {string} word
 * @property {{ x:number, y:number, letter:string, tileId:string, isBlank:boolean, value:number }[]} placements
 * @property {string} direction
 * @property {number} score
 */
