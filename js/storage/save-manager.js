/**
 * save-manager.js — Persistance via LocalStorage
 */

const SAVE_KEY = 'scrabble_save_v1';

export const SaveManager = {
  /**
   * Sauvegarde l'état de la partie.
   * @param {Object} state
   */
  save(state) {
    try {
      const data = JSON.stringify({ ...state, savedAt: Date.now() });
      localStorage.setItem(SAVE_KEY, data);
    } catch (e) {
      console.warn('Sauvegarde impossible :', e.message);
    }
  },

  /**
   * Charge la partie sauvegardée.
   * @returns {Object|null}
   */
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Lecture sauvegarde impossible :', e.message);
      return null;
    }
  },

  /**
   * Vérifie si une sauvegarde existe.
   * @returns {boolean}
   */
  hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  },

  /**
   * Supprime la sauvegarde.
   */
  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  },

  /**
   * Retourne la date de sauvegarde ou null.
   * @returns {Date|null}
   */
  getSaveDate() {
    const data = this.load();
    return data?.savedAt ? new Date(data.savedAt) : null;
  },
};
