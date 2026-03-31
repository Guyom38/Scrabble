/**
 * useResolution.js — Scale du canvas 1920×1080 plein ecran (vanilla JS)
 *
 * Le canvas est positionne en 0,0 et scale pour couvrir tout l'ecran.
 * Gere le resize, les barres d'adresse mobiles, et le plein ecran.
 */

window.GAME_RESOLUTION = {
  WIDTH:  1920,
  HEIGHT: 1080,
  READY_DELAY: 300,
};

export function initResolution() {
  const { WIDTH, HEIGHT, READY_DELAY } = window.GAME_RESOLUTION;
  const canvas = document.getElementById('app-canvas');
  if (!canvas) return;

  function updateLayout() {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const scaleX = screenW / WIDTH;
    const scaleY = screenH / HEIGHT;

    canvas.style.transform = `scale(${scaleX}, ${scaleY})`;
  }

  // 1er calcul immediat
  updateLayout();

  // 2eme calcul apres stabilisation (mobile: barre d'adresse)
  setTimeout(updateLayout, READY_DELAY);

  window.addEventListener('resize', updateLayout);
}
