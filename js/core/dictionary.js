/**
 * dictionary.js — Chargement et validation du dictionnaire français
 */

export class Dictionary {
  constructor() {
    /** @type {Set<string>} */
    this._words = new Set();
    /** @type {Set<string>} */
    this._prefixes = new Set();
    this._loaded = false;
  }

  /**
   * Charge le dictionnaire depuis une URL.
   * @param {string} url
   * @param {function(number):void} [onProgress]
   * @returns {Promise<void>}
   */
  async load(url = 'data/dico.txt', onProgress) {
    if (onProgress) onProgress(10);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (onProgress) onProgress(30);

    // Télécharger tout le fichier en une seule fois (simple et fiable)
    const buffer = await response.arrayBuffer();
    if (onProgress) onProgress(60);

    // Le fichier est en Latin-1 / Windows-1252
    const text = new TextDecoder('windows-1252').decode(buffer);
    if (onProgress) onProgress(80);

    this._parse(text);
    if (onProgress) onProgress(100);
    this._loaded = true;
  }

  /** @private */
  _parse(text) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const word = line.trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z]/g, '');

      if (word.length < 2) continue;

      this._words.add(word);

      for (let i = 1; i <= word.length; i++) {
        this._prefixes.add(word.substring(0, i));
      }
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
