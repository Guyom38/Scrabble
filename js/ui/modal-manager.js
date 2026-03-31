/**
 * modal-manager.js — Gestion de la pile de modales
 *
 * API :
 *   ModalManager.open(id, data?)   — ouvre une modale par son id HTML
 *   ModalManager.close(id?)        — ferme la modale du dessus (ou par id)
 *   ModalManager.closeAll()        — ferme toutes les modales
 */

const CLOSE_DURATION = 200; // ms

export const ModalManager = {
  /** @type {string[]} pile des modales ouvertes */
  _stack: [],

  /**
   * Ouvre une modale.
   * @param {string} id — id de l'élément .modal-overlay dans le DOM
   * @param {Object} [data] — données optionnelles à passer à la modale
   */
  open(id, data = {}) {
    const overlay = document.getElementById(id);
    if (!overlay) { console.warn(`Modale introuvable : ${id}`); return; }

    // Remplir les données dynamiques si nécessaire
    this._populate(overlay, data);

    overlay.style.display = 'flex';
    overlay.classList.remove('closing');
    const dialog = overlay.querySelector('.modal');
    if (dialog) dialog.classList.remove('closing');

    // Accessibilité
    overlay.setAttribute('aria-hidden', 'false');
    const focusable = overlay.querySelector('button, [tabindex]');
    if (focusable) focusable.focus();

    this._stack.push(id);

    // Fermer au clic sur l'overlay (hors dialog)
    overlay.onclick = (e) => {
      if (e.target === overlay) this.close(id);
    };

    // Fermer avec Escape
    this._keyHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._keyHandler, { once: true });
  },

  /**
   * Ferme une modale.
   * @param {string} [id] — si absent, ferme la dernière ouverte
   */
  close(id) {
    const targetId = id || this._stack[this._stack.length - 1];
    if (!targetId) return;

    const overlay = document.getElementById(targetId);
    if (!overlay) return;

    overlay.classList.add('closing');
    const dialog = overlay.querySelector('.modal');
    if (dialog) dialog.classList.add('closing');

    overlay.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('closing');
      if (dialog) dialog.classList.remove('closing');
    }, CLOSE_DURATION);

    this._stack = this._stack.filter(s => s !== targetId);
    document.removeEventListener('keydown', this._keyHandler);
  },

  /** Ferme toutes les modales. */
  closeAll() {
    [...this._stack].forEach(id => this.close(id));
  },

  /**
   * Injecte les données dynamiques dans la modale.
   * @private
   */
  _populate(overlay, data) {
    for (const [key, value] of Object.entries(data)) {
      const el = overlay.querySelector(`[data-modal-field="${key}"]`);
      if (!el) continue;
      if (typeof value === 'string') el.innerHTML = value;
      else if (typeof value === 'function') value(el);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Toast (notification légère en haut de l'écran)                      */
/* ------------------------------------------------------------------ */

const toastContainer = (() => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    (document.getElementById('app-canvas') || document.body).appendChild(container);
  }
  return container;
})();

/**
 * Affiche une notification courte.
 * @param {string} text
 * @param {'info'|'success'|'error'|'warning'|'scrabble'} [type='info']
 * @param {number} [duration=3000]
 */
export function showToast(text, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = text;

  // Empêcher accumulation excessive
  if (toastContainer.children.length > 3) {
    toastContainer.firstChild?.remove();
  }

  toastContainer.appendChild(el);

  const hide = () => {
    el.classList.add('toast--leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(hide, duration);

  // Clic pour fermer plus tôt
  el.addEventListener('click', () => {
    clearTimeout(timer);
    hide();
  });
}
