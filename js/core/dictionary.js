/**
 * dictionary.js — Chargement et validation du dictionnaire français
 */
import { DICO_WORDS, DICO_PREFIXES } from '../data/dico-embedded.js';

export class Dictionary {
  constructor() {
    this._words = DICO_WORDS;
    this._prefixes = DICO_PREFIXES;
    this._loaded = true;
  }

  /** @param {function(number):void} [onProgress] */
  async load(url, onProgress) {
    // Données déjà embarquées dans le bundle — aucun fetch requis
    if (onProgress) {
      onProgress(10); onProgress(30); onProgress(60); onProgress(80); onProgress(100);
    }
  }

  /** @returns {boolean} */
  isValid(word) { return this._words.has(word.toUpperCase()); }

  /** @returns {boolean} */
  hasPrefix(prefix) { return this._prefixes.has(prefix.toUpperCase()); }

  /** @returns {number} */
  get size() { return this._words.size; }

  get isLoaded() { return this._loaded; }
}

export const dictionary = new Dictionary();
