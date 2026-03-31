/**
 * scorer.js — Calcul du score d'un coup
 *
 * Applique les bonus de cases (uniquement sur les nouvelles tuiles),
 * cumule les mots principaux et croisés, et ajoute le bonus Scrabble.
 */

import { BOARD_LAYOUT, RACK_SIZE, SCRABBLE_BONUS } from './constants.js';

export class Scorer {
  /**
   * Calcule le score total d'un coup.
   *
   * @param {import('./board.js').Board} board — plateau AVANT validation
   * @param {{ cells:{x:number,y:number,tile:{letter:string,value:number,isBlank:boolean}}[],isMain:boolean }[]} words
   * @param {import('./board.js').TempPlacement[]} newPlacements — tuiles posées ce tour
   * @returns {{ total:number, wordScores:{word:string,score:number}[], scrabble:boolean }}
   */
  scoreMove(words, newPlacements) {
    const newSet = new Set(newPlacements.map(p => `${p.x},${p.y}`));
    let total = 0;
    const wordScores = [];
    const scrabble   = newPlacements.length === RACK_SIZE;

    for (const { cells } of words) {
      let wordScore   = 0;
      let wordMultiplier = 1;
      let wordString  = '';
      const coords    = [];
      const bonuses   = [];

      for (const { x, y, tile } of cells) {
        const key     = `${x},${y}`;
        const isNew   = newSet.has(key);
        const bonus   = BOARD_LAYOUT[y][x];
        let tileVal   = tile.value;

        coords.push({ x, y });

        if (isNew) {
          if (bonus === 3) { tileVal *= 3; bonuses.push({ x, y, type: 'tl' }); }
          if (bonus === 4) { tileVal *= 2; bonuses.push({ x, y, type: 'dl' }); }
          if (bonus === 1) { wordMultiplier *= 3; bonuses.push({ x, y, type: 'tw' }); }
          if (bonus === 2 || bonus === 5) { wordMultiplier *= 2; bonuses.push({ x, y, type: 'dw' }); }
        }
        wordScore  += tileVal;
        wordString += tile.letter;
      }

      wordScore *= wordMultiplier;
      total     += wordScore;
      wordScores.push({ word: wordString, score: wordScore, coords, bonuses, wordMultiplier });
    }

    if (scrabble) total += SCRABBLE_BONUS;

    return { total, wordScores, scrabble };
  }

  /**
   * Calcule la pénalité de fin de partie pour un joueur
   * (somme des valeurs des tuiles restantes dans son chevalet).
   * @param {import('./tile-bag.js').Tile[]} rack
   * @returns {number}
   */
  rackPenalty(rack) {
    return rack.reduce((sum, t) => sum + t.value, 0);
  }
}
