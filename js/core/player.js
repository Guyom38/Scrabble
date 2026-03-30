/**
 * player.js — Modèle de joueur (humain ou IA)
 */

import { PLAYER_TYPES, AI_LEVELS } from './constants.js';

export class Player {
  /**
   * @param {Object} opts
   * @param {string} opts.id
   * @param {string} opts.name
   * @param {'human'|'ai'} opts.type
   * @param {'easy'|'medium'|'hard'} [opts.aiLevel]
   * @param {number} [opts.colorIndex]
   */
  constructor({ id, name, type, aiLevel = AI_LEVELS.MEDIUM, colorIndex = 0 }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.aiLevel = aiLevel;
    this.colorIndex = colorIndex;

    /** @type {import('./tile-bag.js').Tile[]} */
    this.rack = [];

    this.score = 0;
    this.consecutivePasses = 0;

    /** Historique des coups : { word, score, turn } */
    this.history = [];
  }

  get isHuman()  { return this.type === PLAYER_TYPES.HUMAN; }
  get isAI()     { return this.type === PLAYER_TYPES.AI; }
  get rackSize() { return this.rack.length; }

  /**
   * Ajoute des tuiles au chevalet.
   * @param {import('./tile-bag.js').Tile[]} tiles
   */
  addToRack(tiles) {
    this.rack.push(...tiles);
  }

  /**
   * Retire des tuiles du chevalet par leurs ids.
   * @param {string[]} ids
   * @returns {import('./tile-bag.js').Tile[]} les tuiles retirées
   */
  removeFromRackByIds(ids) {
    const idSet = new Set(ids);
    const removed = [];
    this.rack = this.rack.filter(t => {
      if (idSet.has(t.id)) { removed.push(t); return false; }
      return true;
    });
    return removed;
  }

  /**
   * Mélange le chevalet (Fisher-Yates).
   */
  shuffleRack() {
    const a = this.rack;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  /**
   * Ajoute des points et enregistre le coup.
   * @param {number} pts
   * @param {string} word
   * @param {number} turn
   */
  addScore(pts, word, turn) {
    this.score += pts;
    this.history.push({ word, score: pts, turn });
    this.consecutivePasses = 0;
  }

  /**
   * Incrémente le compteur de passes.
   */
  incrementPass() {
    this.consecutivePasses++;
    this.history.push({ word: '(passe)', score: 0, turn: this.history.length });
  }

  serialize() {
    return {
      id:   this.id,
      name: this.name,
      type: this.type,
      aiLevel: this.aiLevel,
      colorIndex: this.colorIndex,
      rack: this.rack.map(t => ({ ...t })),
      score: this.score,
      consecutivePasses: this.consecutivePasses,
      history: [...this.history],
    };
  }

  static deserialize(data) {
    const p = new Player(data);
    p.rack  = data.rack.map(t => ({ ...t }));
    p.score = data.score;
    p.consecutivePasses = data.consecutivePasses;
    p.history = data.history ?? [];
    return p;
  }
}
