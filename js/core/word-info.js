/**
 * word-info.js — Chargement à la demande des définitions par lettre
 *
 * Les fichiers data/defs/A.json … Z.json sont fetchés uniquement
 * quand un mot commençant par cette lettre est demandé.
 * Chaque fichier fait 1-3 Mo → chargement instantané.
 */

class WordInfoService {
  constructor() {
    /** @type {Map<string, Map<string, {d?:string, f?:string}>>} lettre → Map mot → info */
    this._cache   = new Map();
    /** @type {Set<string>} lettres en cours de fetch */
    this._loading = new Set();
    /** @type {Set<string>} lettres déjà chargées */
    this._loaded  = new Set();
    /** @type {Array<{word:string, resolve:Function}>} en attente */
    this._pending = [];
  }

  /**
   * Retourne les infos d'un mot. Charge le fichier de la lettre si nécessaire.
   * @param {string} word
   * @returns {Promise<{description:string, definition:string}|null>}
   */
  async getAsync(word) {
    const w = word.toUpperCase();
    if (w.length < 2) return null;
    const letter = w.charAt(0);

    // Déjà en cache
    if (this._loaded.has(letter)) {
      return this._lookup(letter, w);
    }

    // Lancer le fetch si pas déjà en cours
    if (!this._loading.has(letter)) {
      this._fetchLetter(letter);
    }

    // Attendre que le fetch se termine
    return new Promise(resolve => {
      this._pending.push({ word: w, resolve });
    });
  }

  /**
   * Version synchrone — retourne null si la lettre n'est pas encore chargée.
   * @param {string} word
   * @returns {{description:string, definition:string}|null}
   */
  get(word) {
    const w = word.toUpperCase();
    if (w.length < 2) return null;
    const letter = w.charAt(0);

    if (this._loaded.has(letter)) {
      return this._lookup(letter, w);
    }

    // Lancer le fetch en arrière-plan pour la prochaine fois
    if (!this._loading.has(letter)) {
      this._fetchLetter(letter);
    }
    return null;
  }

  /** @private */
  _lookup(letter, word) {
    const map = this._cache.get(letter);
    if (!map) return null;
    const entry = map.get(word);
    if (!entry) return null;
    return {
      description: entry.d || '',
      definition:  entry.f || '',
    };
  }

  /** @private */
  async _fetchLetter(letter) {
    this._loading.add(letter);
    try {
      // Chemin absolu depuis la racine du site
      const base = document.baseURI || location.href;
      const url  = new URL(`data/defs/${letter}.json`, base).href;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);
      const data = await resp.json();

      const map = new Map();
      for (const [word, info] of Object.entries(data)) {
        map.set(word, info);
      }
      this._cache.set(letter, map);
      this._loaded.add(letter);
    } catch (e) {
      console.error(`[WordInfo] Échec chargement ${letter}.json :`, e.message);
      this._loaded.add(letter); // Ne pas retenter
      this._cache.set(letter, new Map());
    }
    this._loading.delete(letter);

    // Résoudre les promesses en attente
    const stillPending = [];
    for (const item of this._pending) {
      if (item.word.charAt(0) === letter) {
        item.resolve(this._lookup(letter, item.word));
      } else {
        stillPending.push(item);
      }
    }
    this._pending = stillPending;
  }
}

export const wordInfoService = new WordInfoService();
