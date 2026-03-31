/**
 * timer.js — Chronomètre de partie
 */

const TIMER_KEY = 'scrabble_timer_elapsed';

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

  /** Remet à zéro et efface la persistance. */
  reset() {
    this.pause();
    this._elapsed = 0;
    try { localStorage.removeItem(TIMER_KEY); } catch {}
    this._render();
  }

  /** @returns {number} secondes écoulées */
  get elapsed() { return this._elapsed; }

  /** Restaure depuis localStorage (F5) ou une valeur explicite. */
  restore(seconds) {
    if (seconds != null && seconds > 0) {
      this._elapsed = seconds;
    } else {
      try {
        const saved = parseInt(localStorage.getItem(TIMER_KEY) || '0');
        this._elapsed = saved || 0;
      } catch { this._elapsed = 0; }
    }
    this._render();
  }

  /** @private */
  _tick() {
    this._elapsed++;
    try { localStorage.setItem(TIMER_KEY, this._elapsed); } catch {}
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
