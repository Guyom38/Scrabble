/**
 * ai-hard.js — IA niveau Difficile
 *
 * Stratégie : joue le coup de score maximum.
 * Tiebreak : préfère les cases bonus TW/DW.
 * Gestion du rack : conserve les combinaisons de lettres polyvalentes.
 */

import { MoveGenerator }  from './move-generator.js';
import { Scorer }         from '../core/scorer.js';
import { BOARD_LAYOUT }   from '../core/constants.js';

const HIGH_VALUE_POSITIONS = new Set();
(function buildHighValueSet() {
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const b = BOARD_LAYOUT[y][x];
      if (b === 1 || b === 2) HIGH_VALUE_POSITIONS.add(`${x},${y}`);
    }
  }
})();

export class AIHard {
  constructor() {
    this._scorer = new Scorer();
  }

  /**
   * @param {import('../core/board.js').Board} board
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @param {import('../core/dictionary.js').Dictionary} dict
   * @returns {import('./move-generator.js').Move|null}
   */
  chooseMove(board, rack, dict) {
    const gen   = new MoveGenerator(dict);
    const moves = gen.generateMoves(board, rack);
    if (moves.length === 0) return null;

    // Scorer tous les coups avec les vrais mots croisés
    for (const move of moves) {
      const norm  = move.placements.map(p => ({ ...p, id: p.tileId }));
      const words = board.getWordsFormed(norm);
      const { total } = this._scorer.scoreMove(words, norm);
      move.score = total;

      // Bonus pour les cases bonus couvertes
      const bonusBoost = move.placements.reduce((sum, p) => {
        const key = `${p.x},${p.y}`;
        return sum + (HIGH_VALUE_POSITIONS.has(key) ? 5 : 0);
      }, 0);
      move._adjusted = total + bonusBoost;
    }

    moves.sort((a, b) => b._adjusted - a._adjusted);
    return moves[0];
  }

  /**
   * Échange les tuiles qui déséquilibrent le rack (trop de consonnes rares).
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @returns {import('../core/tile-bag.js').Tile[]}
   */
  chooseTilesToExchange(rack) {
    // Conserver les voyelles et lettres utiles
    const vowels  = new Set(['A','E','I','O','U','Y']);
    const toKeep  = new Set(['S','R','N','T','L','E','A','I']);
    const toExchange = rack.filter(t =>
      !vowels.has(t.letter) && !toKeep.has(t.letter) && !t.isBlank
    );
    if (toExchange.length === 0) {
      // Échange la tuile de valeur max
      const sorted = [...rack].sort((a, b) => b.value - a.value);
      return [sorted[0]];
    }
    return toExchange;
  }
}
