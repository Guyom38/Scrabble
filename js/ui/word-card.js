/**
 * word-card.js — Panneau de définition du mot posé
 *
 * Position fixe calculée dynamiquement à partir du workspace,
 * pour ne jamais être caché derrière la sidebar.
 * Disparaît après 6 s ou au prochain coup.
 */

const PANEL_ID = 'word-def-panel';
let   _hideTimer = null;

function _getPanel() {
  let p = document.getElementById(PANEL_ID);
  if (!p) {
    p = document.createElement('div');
    p.id        = PANEL_ID;
    p.className = 'word-def-panel';
    document.body.appendChild(p);
  }
  return p;
}

/** Calcule left/width depuis les bounds du workspace. */
function _positionPanel(panel) {
  const ws = document.getElementById('workspace');
  if (!ws) return;
  const r = ws.getBoundingClientRect();
  panel.style.left  = (r.left + 12) + 'px';
  panel.style.width = Math.min(r.width - 24, 360) + 'px';
}

/**
 * Affiche la définition.
 * @param {string} word
 * @param {{ description:string, definition:string }} info
 */
export function showWordCard(word, info) {
  if (!info || (!info.description && !info.definition)) return;

  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }

  const panel = _getPanel();
  _positionPanel(panel);

  let html = `
    <div class="word-def-panel__header">
      <span class="word-def-panel__icon">📖</span>
      <span class="word-def-panel__word">${word}</span>
    </div>`;
  if (info.description) html += `<p class="word-def-panel__desc">${info.description}</p>`;
  if (info.definition)  html += `<p class="word-def-panel__def">${info.definition}</p>`;

  panel.innerHTML = html;

  panel.classList.remove('word-def-panel--visible', 'word-def-panel--out');
  void panel.offsetWidth;
  panel.classList.add('word-def-panel--visible');

  _hideTimer = setTimeout(hideWordCard, 6000);
}

export function hideWordCard() {
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
  const panel = document.getElementById(PANEL_ID);
  if (!panel || !panel.classList.contains('word-def-panel--visible')) return;
  panel.classList.remove('word-def-panel--visible');
  panel.classList.add('word-def-panel--out');
  panel.addEventListener('animationend', () => {
    panel.classList.remove('word-def-panel--out');
  }, { once: true });
}
