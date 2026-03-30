/**
 * tile-bag.js — Sac de tuiles
 *
 * Gère les 102 tuiles françaises : génération, mélange, pioche et échange.
 */

import { TILE_DISTRIBUTION, RACK_SIZE } from './constants.js';

let _idCounter = 0;

/**
 * Génère un identifiant unique pour une tuile.
 * @returns {string}
 */
function nextId() {
  return `tile_${++_idCounter}`;
}

/**
 * @typedef {Object} Tile
 * @property {string} id       — identifiant unique
 * @property {string} letter   — lettre (A–Z ou '_' pour joker)
 * @property {number} value    — valeur en points
 * @property {boolean} isBlank — true si joker
 * @property {string|null} blankAs — lettre choisie pour le joker
 */

export class TileBag {
  constructor() {
    /** @type {Tile[]} */
    this._tiles = [];
    this._generate();
  }

  /** Génère et mélange les 102 tuiles. */
  _generate() {
    this._tiles = [];
    _idCounter = 0;
    for (const { l, c, v } of TILE_DISTRIBUTION) {
      for (let i = 0; i < c; i++) {
        this._tiles.push({
          id: nextId(),
          letter: l,
          value: v,
          isBlank: l === '_',
          blankAs: null,
        });
      }
    }
    this._shuffle();
  }

  /** Mélange le sac (Fisher-Yates). */
  _shuffle() {
    const a = this._tiles;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  /**
   * Pioche n tuiles.
   * @param {number} [n=RACK_SIZE]
   * @returns {Tile[]}
   */
  draw(n = RACK_SIZE) {
    const count = Math.min(n, this._tiles.length);
    return this._tiles.splice(this._tiles.length - count, count);
  }

  /**
   * Remet des tuiles dans le sac et mélange.
   * @param {Tile[]} tiles
   */
  putBack(tiles) {
    this._tiles.push(...tiles);
    this._shuffle();
  }

  /**
   * Échange des tuiles : les remet dans le sac, pioche autant.
   * @param {Tile[]} tiles
   * @returns {Tile[]} les nouvelles tuiles
   * @throws si le sac a moins de tuiles que demandé
   */
  exchange(tiles) {
    if (tiles.length > this._tiles.length) {
      throw new Error('Pas assez de tuiles dans le sac pour effectuer un échange.');
    }
    const drawn = this.draw(tiles.length);
    this.putBack(tiles);
    return drawn;
  }

  /** Nombre de tuiles restantes. */
  get remaining() {
    return this._tiles.length;
  }

  /** Vrai si le sac est vide. */
  get isEmpty() {
    return this._tiles.length === 0;
  }

  /** Peut-on faire un échange ? (sac >= 7) */
  get canExchange() {
    return this._tiles.length >= RACK_SIZE;
  }

  /**
   * Sérialise le sac pour la sauvegarde.
   * @returns {Object}
   */
  serialize() {
    return { tiles: this._tiles.map(t => ({ ...t })) };
  }

  /**
   * Restaure le sac depuis une sauvegarde.
   * @param {Object} data
   */
  static deserialize(data) {
    const bag = new TileBag();
    bag._tiles = data.tiles.map(t => ({ ...t }));
    return bag;
  }
}
