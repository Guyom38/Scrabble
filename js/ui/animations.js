/**
 * animations.js — Helpers d'animation JavaScript
 *
 * Toutes les animations qui nécessitent de la logique JS
 * (FLIP, score flottant, confettis, etc.)
 */

/**
 * Affiche un score flottant au-dessus d'un élément cible.
 * @param {HTMLElement} anchor — élément de référence
 * @param {string} text — ex: "+42 pts"
 * @param {string} [color]
 */
export function floatScore(anchor, text, color = '#82e0aa') {
  const canvas = document.getElementById('app-canvas');
  const canvasRect = canvas?.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const sx = canvasRect ? canvasRect.width  / 1920 : 1;
  const sy = canvasRect ? canvasRect.height / 1080 : 1;
  const el   = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position: absolute;
    left:   ${(anchorRect.left - (canvasRect?.left || 0)) / sx + anchorRect.width / sx / 2}px;
    top:    ${(anchorRect.top  - (canvasRect?.top  || 0)) / sy}px;
    transform: translateX(-50%);
    color:  ${color};
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.1rem;
    font-weight: 700;
    pointer-events: none;
    z-index: 9999;
    white-space: nowrap;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    animation: scoreFloat 900ms ease forwards;
  `;
  (canvas || document.body).appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/**
 * Secoue un élément (coup invalide).
 * @param {HTMLElement} el
 */
export function shakeElement(el) {
  el.classList.remove('anim-tile-shake');
  void el.offsetWidth; // reflow
  el.classList.add('anim-tile-shake');
  el.addEventListener('animationend', () => el.classList.remove('anim-tile-shake'), { once: true });
}

/**
 * Lance l'animation de confettis dorés pour le bonus Scrabble.
 * @param {number} [count=60]
 */
export function launchConfetti(count = 60) {
  const colors = ['#f0c040', '#d4a017', '#fff8e0', '#e67e22', '#f1c40f'];
  const container = document.getElementById('app-canvas') || document.body;

  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    const size  = 4 + Math.random() * 8;
    const color = colors[Math.floor(Math.random() * colors.length)];
    c.style.cssText = `
      position: absolute;
      left:   ${Math.random() * 1920}px;
      top:    -20px;
      width:  ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9998;
      animation: confettiFall ${1.5 + Math.random() * 2}s ease ${Math.random() * 0.8}s forwards;
    `;
    container.appendChild(c);
    c.addEventListener('animationend', () => c.remove());
  }
}

/**
 * Animation FLIP : déplace un élément de sa position courante vers une cible.
 * @param {HTMLElement} el
 * @param {DOMRect} from
 * @param {DOMRect} to
 * @param {number} [duration=300]
 */
export function flipAnimate(el, from, to, duration = 300) {
  const dx = from.left - to.left;
  const dy = from.top  - to.top;

  el.style.transition = 'none';
  el.style.transform  = `translate(${dx}px, ${dy}px)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `transform ${duration}ms cubic-bezier(0.34,1.1,0.64,1)`;
      el.style.transform  = 'translate(0,0)';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform  = '';
      }, { once: true });
    });
  });
}

/**
 * Fait clignoter un élément de façon dorée (bonus Scrabble).
 * @param {HTMLElement} el
 */
export function scrabbleFlash(el) {
  el.classList.add('anim-scrabble');
  el.addEventListener('animationend', () => el.classList.remove('anim-scrabble'), { once: true });
}

/**
 * Applique un délai (promise).
 * @param {number} ms
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Anime les nouvelles tuiles du chevalet une par une.
 * @param {NodeList|HTMLElement[]} tileEls
 */
export function animateRackDraw(tileEls) {
  tileEls.forEach((el, i) => {
    el.style.animationDelay = `${i * 80}ms`;
    el.classList.add('tile--arriving');
    el.addEventListener('animationend', () => {
      el.classList.remove('tile--arriving');
      el.style.animationDelay = '';
    }, { once: true });
  });
}
