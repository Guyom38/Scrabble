/**
 * timer.js — Chronomètre de partie
 */

export class GameTimer {
  /**
   * @param {HTMLElement} el — élément affichant HH:MM:SS
   */
  constructor(el) {
    this._el       = el;
    this._elapsed  = 0;   // secondes écoulées
    this._interval = null;
    this._running  = false;
  }

  /** Démarre ou reprend le chrono. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTick = Date.now();
    this._interval = setInterval(() => this._tick(), 1000);
    this._render();
  }

  /** Met en pause. */
  pause() {
    this._running = false;
    clearInterval(this._interval);
    this._interval = null;
  }

  /** Remet à zéro. */
  reset() {
    this.pause();
    this._elapsed = 0;
    this._render();
  }

  /** @returns {number} secondes écoulées */
  get elapsed() { return this._elapsed; }

  /** Restaure depuis une sauvegarde. */
  restore(seconds) {
    this._elapsed = seconds || 0;
    this._render();
  }

  /** @private */
  _tick() {
    this._elapsed++;
    this._render();
  }

  /** @private */
  _render() {
    if (!this._el) return;
    const h = Math.floor(this._elapsed / 3600);
    const m = Math.floor((this._elapsed % 3600) / 60);
    const s = this._elapsed % 60;
    this._el.textContent =
      (h > 0 ? String(h).padStart(2,'0') + ':' : '') +
      String(m).padStart(2,'0') + ':' +
      String(s).padStart(2,'0');
  }
}
