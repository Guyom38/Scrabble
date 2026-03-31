/**
 * word-card.js — Panneaux de définition empilables
 *
 * Placés dans le workspace (colonne 3), en bas.
 * Chaque panneau disparaît après 8s.
 */

const CONTAINER_ID = 'word-def-stack';

function _getContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    const ws = document.getElementById('workspace');
    if (!ws) return null;
    c = document.createElement('div');
    c.id = CONTAINER_ID;
    c.className = 'word-def-stack';
    ws.appendChild(c);
  }
  return c;
}

/**
 * Affiche la définition — empile si d'autres sont visibles.
 */
export function showWordCard(word, info) {
  if (!info || (!info.description && !info.definition)) return;

  const container = _getContainer();
  if (!container) return;

  const panel = document.createElement('div');
  panel.className = 'word-def-panel word-def-panel--visible';

  let html = `
    <div class="word-def-panel__header">
      <span class="word-def-panel__icon">📖</span>
      <span class="word-def-panel__word">${word}</span>
      <button class="word-def-panel__close" aria-label="Fermer">&times;</button>
    </div>`;
  if (info.description) html += `<p class="word-def-panel__desc">${info.description}</p>`;
  if (info.definition)  html += `<p class="word-def-panel__def">${info.definition}</p>`;

  panel.innerHTML = html;
  panel.querySelector('.word-def-panel__close').addEventListener('click', () => _hidePanel(panel));
  container.appendChild(panel);

  setTimeout(() => _hidePanel(panel), 8000);
}

function _hidePanel(panel) {
  if (!panel || !panel.parentNode) return;
  panel.classList.remove('word-def-panel--visible');
  panel.classList.add('word-def-panel--out');
  panel.addEventListener('animationend', () => panel.remove(), { once: true });
  setTimeout(() => { if (panel.parentNode) panel.remove(); }, 400);
}

export function hideWordCard() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  container.querySelectorAll('.word-def-panel--visible').forEach(p => _hidePanel(p));
}
