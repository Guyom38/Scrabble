/**
 * ai-easy.js — IA niveau Facile
 *
 * Stratégie : joue intentionnellement de petits coups parmi les moins bons.
 * Préfère les mots courts et les cases peu valorisées.
 */

import { MoveGenerator } from './move-generator.js';
import { Scorer }        from '../core/scorer.js';

export class AIEasy {
  constructor() {
    this._scorer = new Scorer();
  }

  /**
   * Choisit un coup parmi les moins bons disponibles.
   * @param {import('../core/board.js').Board} board
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @param {import('../core/dictionary.js').Dictionary} dict
   * @returns {import('./move-generator.js').Move|null}
   */
  chooseMove(board, rack, dict) {
    const gen   = new MoveGenerator(dict);
    const moves = gen.generateMoves(board, rack);
    if (moves.length === 0) return null;

    // Scorer tous les coups
    this._scoreMoves(moves, board);

    // Trier par score croissant, prendre dans les 30% les moins bons
    moves.sort((a, b) => a.score - b.score);
    const pool = moves.slice(0, Math.max(1, Math.ceil(moves.length * 0.3)));

    // Choisir aléatoirement dans ce pool faible
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Choisit les tuiles les moins utiles à échanger.
   * @param {import('../core/tile-bag.js').Tile[]} rack
   * @returns {import('../core/tile-bag.js').Tile[]}
   */
  chooseTilesToExchange(rack) {
    // Échange toujours quelques tuiles au hasard
    const count  = Math.ceil(rack.length * 0.5);
    const shuffled = [...rack].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /** @private */
  _scoreMoves(moves, board) {
    for (const move of moves) {
      const fakeWords = [{ cells: move.placements.map(p => ({ x: p.x, y: p.y, tile: { value: p.value, letter: p.letter, isBlank: p.isBlank } })) }];
      const { total } = this._scorer.scoreMove(fakeWords, move.placements);
      move.score = total;
    }
  }
}
