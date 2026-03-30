/**
 * app.js — Bootstrap et navigation entre les écrans
 *
 * Orchestration :
 *   Splash → chargement dico → Menu → Config → Jeu
 */

import { dictionary }   from './core/dictionary.js';
import { GameEngine }   from './core/game-engine.js';
import { Renderer }     from './ui/renderer.js';
import { SplashScreen } from './ui/splash-screen.js';
import { GameTimer }    from './ui/timer.js';
import { ModalManager, showToast } from './ui/modal-manager.js';
import { SaveManager }  from './storage/save-manager.js';
import { AI_LEVELS, AI_DEFAULT_NAMES, PLAYER_COLORS } from './core/constants.js';

/* ================================================================== */
/* ÉTAT GLOBAL DE L'APPLICATION                                         */
/* ================================================================== */

let engine   = null;
let renderer = null;
let timer    = null;

/* ================================================================== */
/* NAVIGATION (affiche un écran, cache les autres)                      */
/* ================================================================== */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('screen--active', s.id === id);
  });
}

/* ================================================================== */
/* DÉMARRAGE                                                            */
/* ================================================================== */

async function boot() {
  console.log('[boot] Démarrage…');
  const splashEl = document.getElementById('screen-splash');
  const splash   = new SplashScreen(splashEl);
  splash.show();
  splash.setProgress(0, 'Chargement du dictionnaire…');

  // Afficher le splash au minimum 1.8s pour laisser l'animation se dérouler
  const minDisplayTime = new Promise(resolve => setTimeout(resolve, 1800));

  try {
    await dictionary.load('data/dico.txt', (pct) => {
      splash.setProgress(pct, `Dictionnaire… ${pct}%`);
    });
    console.log('[boot] Dictionnaire chargé :', dictionary.size, 'mots');
    splash.setProgress(100, `${dictionary.size.toLocaleString()} mots chargés !`);
  } catch (e) {
    splash.setProgress(100, 'Dictionnaire non disponible.');
    console.error('Dictionnaire :', e.message);
  }

  // Attendre que le minimum de temps soit écoulé
  await minDisplayTime;
  console.log('[boot] Transition vers le menu…');

  splash.hide(() => {
    console.log('[boot] Splash caché');
    if (SaveManager.hasSave()) {
      console.log('[boot] Sauvegarde détectée, reprise automatique');
      _resumeGame();
    } else {
      showScreen('screen-menu');
      _refreshMenuButtons();
    }
  });
}

/* ================================================================== */
/* MENU PRINCIPAL                                                        */
/* ================================================================== */

function _refreshMenuButtons() {
  const btnContinue = document.getElementById('btn-continue');
  if (!btnContinue) return;

  if (SaveManager.hasSave()) {
    btnContinue.style.display = '';
    const date = SaveManager.getSaveDate();
    if (date) {
      const label = btnContinue.querySelector('.save-date');
      if (label) label.textContent = date.toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
    }
  } else {
    btnContinue.style.display = 'none';
  }
}

/* ================================================================== */
/* PAGE DE CONFIGURATION                                                 */
/* ================================================================== */

function _setupConfigPage() {
  let aiCount  = 1;
  const aiLevels = [AI_LEVELS.MEDIUM, AI_LEVELS.MEDIUM, AI_LEVELS.MEDIUM];

  // --- Sélecteur nombre d'IA ---
  const countBtns = document.querySelectorAll('.ai-count-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aiCount = parseInt(btn.dataset.count);
      countBtns.forEach(b => b.classList.toggle('active', b === btn));
      _updateAiConfigRows(aiCount, aiLevels);
    });
  });

  // Sélectionner 1 par défaut
  countBtns[0]?.classList.add('active');
  _updateAiConfigRows(aiCount, aiLevels);

  // --- Bouton Démarrer ---
  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    const playerName = (document.getElementById('player-name')?.value.trim() || 'Joueur').substring(0, 20);

    // Lire les niveaux sélectionnés
    const finalLevels = [];
    for (let i = 0; i < aiCount; i++) {
      const activeBtn = document.querySelector(`.level-btn.active[data-ai="${i}"]`);
      finalLevels.push(activeBtn?.dataset.level || AI_LEVELS.MEDIUM);
    }

    _startGame({ playerName, aiCount, aiLevels: finalLevels });
  });
}

function _updateAiConfigRows(count, levels) {
  const container = document.getElementById('ai-configs');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'ai-config-row';
    row.innerHTML = `
      <div class="ai-config-row__name" style="color:${PLAYER_COLORS[i+1]}">${AI_DEFAULT_NAMES[i]}</div>
      <div class="level-selector">
        <button class="level-btn ${levels[i]==='easy'?'active':''}"   data-level="easy"   data-ai="${i}">Facile</button>
        <button class="level-btn ${levels[i]==='medium'?'active':''}" data-level="medium" data-ai="${i}">Moyen</button>
        <button class="level-btn ${levels[i]==='hard'?'active':''}"   data-level="hard"   data-ai="${i}">Difficile</button>
      </div>
    `;
    // Activer le bon bouton par défaut
    if (!row.querySelector('.level-btn.active')) {
      row.querySelector(`.level-btn[data-level="medium"]`)?.classList.add('active');
    }
    container.appendChild(row);
  }

  // Délégation d'événements pour les boutons de niveau
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    const ai = btn.dataset.ai;
    container.querySelectorAll(`.level-btn[data-ai="${ai}"]`).forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    levels[parseInt(ai)] = btn.dataset.level;
  });
}

/* ================================================================== */
/* DÉMARRAGE DE LA PARTIE                                               */
/* ================================================================== */

function _startGame(config) {
  showScreen('screen-game');

  // Initialiser le moteur
  engine   = new GameEngine();
  renderer = new Renderer(engine, {
    board:         document.getElementById('game-board'),
    workspace:     document.getElementById('workspace'),
    scoreList:     document.getElementById('score-list'),
    bagCount:      document.getElementById('bag-count'),
    turnIndicator: document.getElementById('turn-text'),
  });

  renderer.init();

  // Chronomètre
  timer = new GameTimer(document.getElementById('timer-display'));
  timer.start();

  // Écouter la fin de partie pour arrêter le timer
  document.addEventListener('game:gameOver', () => timer.pause(), { once: true });

  engine.newGame(config);

  // Persister le timer dans la sauvegarde après chaque coup
  document.addEventListener('game:moveValid', () => {
    if (timer && SaveManager.hasSave()) {
      const save = SaveManager.load();
      if (save) { save.elapsed = timer.elapsed; SaveManager.save(save); }
    }
  });
}

function _resumeGame() {
  showScreen('screen-game');

  engine   = new GameEngine();
  renderer = new Renderer(engine, {
    board:         document.getElementById('game-board'),
    workspace:     document.getElementById('workspace'),
    scoreList:     document.getElementById('score-list'),
    bagCount:      document.getElementById('bag-count'),
    turnIndicator: document.getElementById('turn-text'),
  });

  renderer.init();

  const save = SaveManager.load();
  timer = new GameTimer(document.getElementById('timer-display'));
  timer.restore(save?.elapsed ?? 0);

  document.addEventListener('game:gameOver', () => timer.pause(), { once: true });

  if (!engine.resumeGame()) {
    showToast('Impossible de reprendre la partie.', 'error');
    showScreen('screen-menu');
  } else {
    timer.start();
  }
}

/* ================================================================== */
/* WIRING DES BOUTONS                                                    */
/* ================================================================== */

function wireButtons() {
  // Menu
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    showScreen('screen-config');
    _setupConfigPage();
  });

  document.getElementById('btn-continue')?.addEventListener('click', () => {
    _resumeGame();
  });

  document.getElementById('btn-rules')?.addEventListener('click', () => {
    ModalManager.open('modal-rules');
  });

  // Config
  document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
    showScreen('screen-menu');
  });

  // Jeu — contrôles rack
  document.getElementById('btn-validate')?.addEventListener('click', () => {
    renderer?.submitMove();
  });

  document.getElementById('btn-recall')?.addEventListener('click', () => {
    renderer?.recallAll();
  });

  document.getElementById('btn-shuffle')?.addEventListener('click', () => {
    renderer?.shuffleRack();
  });

  document.getElementById('btn-pass')?.addEventListener('click', () => {
    ModalManager.open('modal-confirm-pass');
  });

  document.getElementById('btn-exchange')?.addEventListener('click', () => {
    _openExchangeModal();
  });

  // Jeu — menu rapide
  document.getElementById('btn-game-menu')?.addEventListener('click', () => {
    ModalManager.open('modal-game-menu');
  });

  // Modal — confirmer la passe
  document.getElementById('confirm-pass-yes')?.addEventListener('click', () => {
    ModalManager.close('modal-confirm-pass');
    engine?.passTurn();
  });
  document.getElementById('confirm-pass-no')?.addEventListener('click', () => {
    ModalManager.close('modal-confirm-pass');
  });

  // Modal — menu de jeu
  document.getElementById('btn-quit-game')?.addEventListener('click', () => {
    ModalManager.closeAll();
    timer?.pause();
    engine   = null;
    renderer = null;
    showScreen('screen-menu');
    _refreshMenuButtons();
  });

  document.getElementById('btn-new-game-from-modal')?.addEventListener('click', () => {
    ModalManager.closeAll();
    timer?.pause();
    engine   = null;
    renderer = null;
    showScreen('screen-config');
    _setupConfigPage();
  });

  // Modal — fin de partie
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    ModalManager.closeAll();
    showScreen('screen-config');
    _setupConfigPage();
  });

  document.getElementById('btn-back-menu-end')?.addEventListener('click', () => {
    ModalManager.closeAll();
    engine   = null;
    renderer = null;
    showScreen('screen-menu');
    _refreshMenuButtons();
  });

  // Fermeture des modales via le bouton ×
  document.querySelectorAll('.modal__close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) ModalManager.close(modal.id);
    });
  });
}

/* ================================================================== */
/* ÉCHANGE DE TUILES                                                     */
/* ================================================================== */

function _openExchangeModal() {
  if (!engine?.bag.canExchange) {
    showToast('Pas assez de tuiles dans le sac pour échanger.', 'error');
    return;
  }
  const human = engine.players.find(p => p.isHuman);
  if (!human) return;

  const container = document.getElementById('exchange-tiles');
  if (!container) return;
  container.innerHTML = '';

  const selected = new Set();

  human.rack.forEach((tile, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'exchange-modal__tile';
    wrapper.dataset.index = i;

    const tileEl = document.createElement('div');
    tileEl.className = 'tile';
    tileEl.innerHTML = `<span>${tile.letter === '_' ? '?' : tile.letter}</span><span class="tile__value">${tile.value}</span>`;
    wrapper.appendChild(tileEl);

    wrapper.addEventListener('click', () => {
      if (selected.has(i)) {
        selected.delete(i);
        wrapper.classList.remove('selected');
      } else {
        selected.add(i);
        wrapper.classList.add('selected');
      }
      confirmBtn.disabled = selected.size === 0;
    });

    container.appendChild(wrapper);
  });

  const confirmBtn = document.getElementById('btn-confirm-exchange');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => {
      const ids = [...selected].map(i => human.rack[i].id);
      ModalManager.close('modal-exchange');
      engine.exchangeTiles(ids);
    };
  }

  ModalManager.open('modal-exchange');
}

/* ================================================================== */
/* POINT D'ENTRÉE                                                        */
/* ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  wireButtons();
  boot();
});
