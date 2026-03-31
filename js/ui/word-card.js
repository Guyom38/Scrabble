/**
 * word-card.js — Panneau de définition affiché dans la colonne du deck
 *
 * S'affiche dans #workspace (position absolute) au-dessus du rack,
 * et reste visible jusqu'au prochain coup ou jusqu'à disparaître via hideWordCard().
 * N'affiche rien si description ET définition sont vides.
 */

const PANEL_ID = 'word-def-panel';

function _getPanel() {
  const ws = document.getElementById('workspace');
  if (!ws) return null;

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id        = PANEL_ID;
    panel.className = 'word-def-panel';
    panel.setAttribute('aria-live', 'polite');
    ws.appendChild(panel);
  }
  return panel;
}

/**
 * Affiche la définition du mot dans le deck.
 * @param {string} word
 * @param {{ description: string, definition: string }} info
 */
export function showWordCard(word, info) {
  if (!info.description && !info.definition) return;

  const panel = _getPanel();
  if (!panel) return;

  let html = `
    <div class="word-def-panel__header">
      <span class="word-def-panel__icon" aria-hidden="true">📖</span>
      <span class="word-def-panel__word">${word}</span>
    </div>`;

  if (info.description) html += `<p class="word-def-panel__desc">${info.description}</p>`;
  if (info.definition)  html += `<p class="word-def-panel__def">${info.definition}</p>`;

  panel.innerHTML = html;
  panel.classList.remove('word-def-panel--out');
  panel.classList.add('word-def-panel--visible');
}

/** Masque le panneau de définition. */
export function hideWordCard() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.classList.remove('word-def-panel--visible');
  panel.classList.add('word-def-panel--out');
  panel.addEventListener('animationend', () => {
    panel.classList.remove('word-def-panel--out');
    panel.innerHTML = '';
  }, { once: true });
}
