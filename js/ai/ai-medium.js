/**
 * ai-medium.js — IA niveau Intermédiaire
 *
 * Stratégie : joue un coup de score médian avec un peu d'aléatoire.
 * Ni le meilleur ni le pire — comparable à un joueur ordinaire.
 */

import { MoveGenerator } from './move-generator.js';
import { Scorer }        from '../core/scorer.js';

export class AIMedium {
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

    this._scoreMoves(moves, board);
    moves.sort((a, b) => a.score - b.score);

    // Plage médiane : 30% à 70%
    const lo   = Math.floor(moves.length * 0.3);
    const hi   = Math.floor(moves.length * 0.7);
    const pool = moves.slice(lo, Math.max(lo + 1, hi));

    // Légère perturbation ±20%
    const scored = pool.map(m => ({
      move:  m,
      noise: m.score * (1 + (Math.random() - 0.5) * 0.4),
    }));
    scored.sort((a, b) => b.noise - a.noise);
    return scored[0].move;
  }

  /**
   * Échange les tuiles les moins fréquentes (Q, W, X, Y sans contexte).
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @returns {import('../core/tile-bag.js').Tile[]}
   */
  chooseTilesToExchange(rack) {
    const rare  = new Set(['Q','W','X','Y','Z','K','J']);
    const bad   = rack.filter(t => rare.has(t.letter) || t.isBlank === false && t.value >= 8);
    return bad.length > 0 ? bad : [rack[0]];
  }

  /** @private */
  _scoreMoves(moves, board) {
    for (const move of moves) {
      // Normaliser les placements (tileId → id) pour board.getWordsFormed
      const norm = move.placements.map(p => ({ ...p, id: p.tileId }));
      const words = board.getWordsFormed(norm);
      const { total } = this._scorer.scoreMove(words, norm);
      move.score = total;
    }
  }
}
