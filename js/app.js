/**
 * app.js — Bootstrap et navigation entre les écrans
 *
 * Orchestration :
 *   Splash → chargement dico → Menu → Config → Jeu
 */

import { dictionary }       from './core/dictionary.js';
import { GameEngine }       from './core/game-engine.js';
import { Renderer }         from './ui/renderer.js';
import { SplashScreen }     from './ui/splash-screen.js';
import { GameTimer }        from './ui/timer.js';
import { ModalManager, showToast } from './ui/modal-manager.js';
import { SaveManager }      from './storage/save-manager.js';
import { AI_LEVELS, AI_DEFAULT_NAMES, PLAYER_COLORS } from './core/constants.js';
import { DICO_DEF_COUNT }   from './data/dico-embedded.js';
import { initResolution }   from './useResolution.js';

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

  // Compteur dans le menu (nombre embarqué au build)
  const dicoCountEl = document.getElementById('dico-count');
  if (dicoCountEl && DICO_DEF_COUNT > 0) {
    dicoCountEl.textContent = `📚 ${DICO_DEF_COUNT.toLocaleString('fr-FR')} définitions disponibles`;
  }

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
  let totalPlayers = 2;

  // État de chaque joueur additionnel (index 0 = joueur 2, …, index 6 = joueur 8)
  const playerStates = Array.from({ length: 7 }, (_, i) => ({
    type: 'ai',
    name: AI_DEFAULT_NAMES[i] || `Joueur ${i + 2}`,
    level: AI_LEVELS.MEDIUM,
  }));

  // Sélecteur nombre total de joueurs
  const countBtns = document.querySelectorAll('.player-count-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      totalPlayers = parseInt(btn.dataset.count);
      countBtns.forEach(b => b.classList.toggle('active', b === btn));
      _updatePlayerRows(totalPlayers, playerStates);
    });
  });

  countBtns[0]?.classList.add('active');
  _updatePlayerRows(totalPlayers, playerStates);

  // Bouton Démarrer
  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    const p1Name = (document.getElementById('player-name')?.value.trim() || 'Joueur').substring(0, 20);

    const players = [{ name: p1Name, type: 'human', aiLevel: AI_LEVELS.MEDIUM }];

    for (let i = 0; i < totalPlayers - 1; i++) {
      const row = document.querySelector(`.player-config-row[data-player="${i}"]`);
      const activeTypeBtn = row?.querySelector('.player-type-btn.active');
      const type = activeTypeBtn?.dataset.type || 'ai';
      const nameInput = row?.querySelector('.player-name-input');
      const rawName = nameInput?.value.trim();
      const name = (rawName || playerStates[i].name).substring(0, 20);
      const activeLevelBtn = row?.querySelector('.level-btn.active');
      const aiLevel = activeLevelBtn?.dataset.level || AI_LEVELS.MEDIUM;
      players.push({ name, type, aiLevel });
    }

    _startGame({ players });
  });
}

function _updatePlayerRows(totalPlayers, states) {
  const container = document.getElementById('player-configs');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < totalPlayers - 1; i++) {
    const state = states[i];
    const color = PLAYER_COLORS[i + 1] || '#aaaaaa';
    const isHuman = state.type === 'human';

    const row = document.createElement('div');
    row.className = 'player-config-row';
    row.dataset.player = i;

    row.innerHTML = `
      <span class="player-config-row__label" style="color:${color}">Joueur ${i + 2}</span>
      <div class="player-type-toggle">
        <button class="player-type-btn ${isHuman ? 'active' : ''}" data-type="human">Humain</button>
        <button class="player-type-btn ${!isHuman ? 'active' : ''}" data-type="ai">IA</button>
      </div>
      <input class="player-name-input" type="text"
        placeholder="${isHuman ? `Joueur ${i + 2}` : state.name}"
        value="${isHuman ? '' : state.name}" maxlength="20" autocomplete="off">
      <div class="level-selector${isHuman ? ' level-selector--hidden' : ''}">
        <button class="level-btn ${state.level === 'easy'   ? 'active' : ''}" data-level="easy">Facile</button>
        <button class="level-btn ${state.level === 'medium' ? 'active' : ''}" data-level="medium">Moyen</button>
        <button class="level-btn ${state.level === 'hard'   ? 'active' : ''}" data-level="hard">Difficile</button>
      </div>
    `;

    // Toggle Humain / IA
    row.querySelectorAll('.player-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.player-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.type = btn.dataset.type;
        const levelSel  = row.querySelector('.level-selector');
        const nameInput = row.querySelector('.player-name-input');
        if (state.type === 'human') {
          levelSel.classList.add('level-selector--hidden');
          nameInput.value = '';
          nameInput.placeholder = `Joueur ${i + 2}`;
        } else {
          levelSel.classList.remove('level-selector--hidden');
          nameInput.value = state.name;
          nameInput.placeholder = state.name;
        }
      });
    });

    // Niveau de l'IA
    row.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.level = btn.dataset.level;
      });
    });

    container.appendChild(row);
  }
}

/* ================================================================== */
/* DÉMARRAGE DE LA PARTIE                                               */
/* ================================================================== */

function _startGame(config) {
  showScreen('screen-game');

  // Nettoyer l'ancien renderer (supprimer les listeners)
  if (renderer) renderer.destroy();

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

  // Chronomètre (reset efface aussi le localStorage)
  timer = new GameTimer(document.getElementById('timer-display'));
  timer.reset();
  timer.start();

  // Écouter la fin de partie pour arrêter le timer
  document.addEventListener('game:gameOver', () => timer.pause(), { once: true });

  engine.newGame(config);
}

function _resumeGame() {
  showScreen('screen-game');

  // Nettoyer l'ancien renderer (supprimer les listeners)
  if (renderer) renderer.destroy();

  engine   = new GameEngine();
  renderer = new Renderer(engine, {
    board:         document.getElementById('game-board'),
    workspace:     document.getElementById('workspace'),
    scoreList:     document.getElementById('score-list'),
    bagCount:      document.getElementById('bag-count'),
    turnIndicator: document.getElementById('turn-text'),
  });

  renderer.init();

  timer = new GameTimer(document.getElementById('timer-display'));
  timer.restore(); // lit depuis localStorage

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

  document.getElementById('btn-sac')?.addEventListener('click', () => {
    renderer?.recallAll();
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
    renderer?.destroy();
    engine   = null;
    renderer = null;
    showScreen('screen-menu');
    _refreshMenuButtons();
  });

  document.getElementById('btn-new-game-from-modal')?.addEventListener('click', () => {
    ModalManager.closeAll();
    timer?.pause();
    renderer?.destroy();
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
    renderer?.destroy();
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
  initResolution();
  wireButtons();
  boot();
});
