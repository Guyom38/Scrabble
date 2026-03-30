/**
 * splash-screen.js — Gestion du splash screen
 *
 * Anime les tuiles SCRABBLE, gère la barre de progression pendant
 * le chargement du dictionnaire et la transition vers le menu.
 */

const WORD   = 'SCRABBLE';
const VALUES = { S:1,C:3,R:1,A:1,B:3,B:3,L:1,E:1 };

export class SplashScreen {
  /**
   * @param {HTMLElement} el — #screen-splash
   */
  constructor(el) {
    this._el        = el;
    this._tilesEl   = el.querySelector('.splash-logo__tiles');
    this._textEl    = el.querySelector('.splash-loading__text');
    this._fillEl    = el.querySelector('.progress-bar__fill');
    this._built     = false;
  }

  /** Construit et anime les tuiles du logo. */
  show() {
    if (!this._built) {
      this._buildTiles();
      this._built = true;
    }
    this._el.style.display = 'flex';
    this._el.classList.remove('splash--hiding');
  }

  /**
   * Met à jour la barre de progression.
   * @param {number} pct — 0 à 100
   * @param {string} [msg]
   */
  setProgress(pct, msg) {
    if (this._fillEl) this._fillEl.style.width = `${pct}%`;
    if (this._textEl && msg) this._textEl.textContent = msg;
  }

  /**
   * Cache le splash avec un fondu et appelle le callback.
   * @param {function} onDone
   */
  hide(onDone) {
    this.setProgress(100, 'Prêt !');
    setTimeout(() => {
      this._el.classList.add('splash--hiding');
      setTimeout(() => {
        this._el.remove();
        if (onDone) onDone();
      }, 700);
    }, 400);
  }

  /** @private */
  _buildTiles() {
    if (!this._tilesEl) return;
    this._tilesEl.innerHTML = '';

    WORD.split('').forEach((letter, i) => {
      const tile = document.createElement('div');
      tile.className = 'splash-logo__tile';
      tile.style.animationDelay = `${0.4 + i * 0.08}s`;

      const span = document.createElement('span');
      span.textContent = letter;

      const sub = document.createElement('span');
      sub.className = 'tile__value';
      sub.textContent = VALUES[letter] ?? 1;

      tile.appendChild(span);
      tile.appendChild(sub);
      this._tilesEl.appendChild(tile);
    });
  }
}
