/**
 * renderer.js — Rendu DOM du jeu
 *
 * Écoute les événements du GameEngine et met à jour l'interface.
 */

import { BOARD_LAYOUT, BOARD_SIZE, BONUS_CSS, BONUS_LABELS, PLAYER_COLORS, AI_LEVEL_LABELS } from '../core/constants.js';
import { DragDropManager } from './drag-drop.js';
import { ModalManager, showToast } from './modal-manager.js';
import { floatScore, launchConfetti, animateRackDraw } from './animations.js';

export class Renderer {
  /**
   * @param {import('../core/game-engine.js').GameEngine} engine
   * @param {Object} elements — références DOM
   */
  constructor(engine, elements) {
    this._engine  = engine;
    this._els     = elements;
    /** @type {Map<string, {x:number, y:number, letter:string, value:number, isBlank:boolean, tileId:string}>} */
    this._tempPlacements = new Map(); // key: `x,y`
    this._selectedTileIndex = null;  // index dans le rack (click mode)
    this._dnd = null;
    this._humanPlayerId = null;
  }

  /** Initialise le plateau DOM et les listeners. */
  init() {
    this._buildBoard();
    this._attachEngineEvents();
  }

  /* ================================================================== */
  /* CONSTRUCTION DU PLATEAU                                              */
  /* ================================================================== */

  _buildBoard() {
    const container = this._els.board;
    container.innerHTML = '';

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = document.createElement('div');
        const bonusType = BOARD_LAYOUT[y][x];

        cell.className = `board__cell${bonusType > 0 ? ' ' + BONUS_CSS[bonusType] : ''}`;
        cell.dataset.x = x;
        cell.dataset.y = y;

        if (bonusType > 0) {
          const label = document.createElement('span');
          label.className = 'board__cell-label';
          label.innerHTML = BONUS_LABELS[bonusType];
          cell.appendChild(label);
        }

        container.appendChild(cell);
      }
    }
  }

  /* ================================================================== */
  /* ÉVÉNEMENTS DU MOTEUR                                                 */
  /* ================================================================== */

  _attachEngineEvents() {
    const on = (name, fn) => document.addEventListener(`game:${name}`, e => fn(e.detail));

    on('started',       d => this._onGameStarted(d));
    on('boardUpdate',   d => this._onBoardUpdate(d));
    on('rackUpdate',    d => this._onRackUpdate(d));
    on('scoresUpdate',  d => this._onScoresUpdate(d));
    on('tilesRemaining',d => this._onTilesRemaining(d));
    on('turnStart',     d => this._onTurnStart(d));
    on('moveValid',     d => this._onMoveValid(d));
    on('moveInvalid',   d => this._onMoveInvalid(d));
    on('message',       d => showToast(d.text, d.type));
    on('stateChange',   d => this._onStateChange(d));
    on('gameOver',      d => this._onGameOver(d));
  }

  _onGameStarted({ players }) {
    this._humanPlayerId = players.find(p => p.type === 'human')?.id;
    this._tempPlacements.clear();
    this._selectedTileIndex = null;
    this._buildBoard();
    this._renderScoreboard(players);

    // Initialiser le drag & drop
    this._dnd = new DragDropManager({
      onRackToBoard:  d => this._handleRackToBoard(d),
      onBoardToBoard: d => this._handleBoardToBoard(d),
      onBoardToRack:  d => this._handleBoardToRack(d),
      onRackReorder:  d => this._handleRackReorder(d),
      onCellClick:    d => this._handleCellClick(d),
    });

    // Attacher les cases
    this._attachAllCells();
  }

  _onBoardUpdate({ board }) {
    // Mettre à jour les tuiles verrouillées sur le plateau
    const grid = board.grid;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = this._getCell(x, y);
        const tile = grid[y][x];
        if (tile && !cell.querySelector('.tile--placed')) {
          // Ne pas écraser une tuile temporaire
          if (!this._tempPlacements.has(`${x},${y}`)) {
            this._renderLockedTile(cell, tile);
          }
        }
      }
    }
  }

  _onRackUpdate({ playerId, rack }) {
    if (playerId !== this._humanPlayerId) return;
    this._renderRack(rack);
  }

  _onScoresUpdate({ players }) {
    this._renderScoreboard(players);
  }

  _onTilesRemaining({ count }) {
    if (this._els.bagCount) this._els.bagCount.textContent = count;
  }

  _onTurnStart({ playerId, playerName, isHuman }) {
    // Mettre à jour l'indicateur de tour dans le scoreboard
    document.querySelectorAll('.score-entry').forEach(el => {
      el.classList.remove('score-entry--active', 'score-entry--thinking');
    });
    const activeEntry = document.querySelector(`.score-entry[data-player-id="${playerId}"]`);
    if (activeEntry) {
      activeEntry.classList.add('score-entry--active');
      if (!isHuman) activeEntry.classList.add('score-entry--thinking');
    }

    // Activer/désactiver les contrôles
    const isMyTurn = playerId === this._humanPlayerId;
    this._setControlsEnabled(isMyTurn);

    // Indicateur de tour
    if (this._els.turnIndicator) {
      this._els.turnIndicator.textContent = isMyTurn
        ? 'Votre tour'
        : `Tour de ${playerName}…`;
      this._els.turnIndicator.parentElement?.classList.toggle('turn-indicator--active', isMyTurn);
    }
  }

  _onMoveValid({ placements, wordScores, total, scrabble }) {
    // Verrouiller visuellement les tuiles temporaires
    placements.forEach(p => {
      const cell = this._getCell(p.x, p.y);
      const tempEl = cell.querySelector('.tile--temp');
      if (tempEl) {
        tempEl.classList.remove('tile--temp');
        tempEl.classList.add('tile--placed', 'anim-tile-lock');
        tempEl.draggable = false;
        tempEl.removeAttribute('draggable');
      }
      this._tempPlacements.delete(`${p.x},${p.y}`);
    });

    // Score flottant
    const firstCell = this._getCell(placements[0]?.x, placements[0]?.y);
    if (firstCell) {
      floatScore(firstCell, `+${total}`, scrabble ? '#f0c040' : '#82e0aa');
    }

    if (scrabble) launchConfetti();
  }

  _onMoveInvalid({ reason }) {
    showToast(reason, 'error', 3500);
    // Secouer le rack
    const rackEl = this._els.rackContainer;
    if (rackEl) {
      rackEl.classList.remove('anim-tile-shake');
      void rackEl.offsetWidth;
      rackEl.classList.add('anim-tile-shake');
      rackEl.addEventListener('animationend', () =>
        rackEl.classList.remove('anim-tile-shake'), { once: true });
    }
  }

  _onStateChange({ state }) {
    const gameScreen = document.getElementById('screen-game');
    if (!gameScreen) return;
    const overlay = gameScreen.querySelector('.ai-thinking-overlay');
    if (overlay) overlay.style.display = state === 'ai_thinking' ? 'flex' : 'none';
  }

  _onGameOver({ sorted }) {
    // Remplir la modale de fin de partie
    const list = document.getElementById('end-game-results');
    if (!list) { ModalManager.open('modal-end-game'); return; }

    list.innerHTML = '';
    sorted.forEach((p, i) => {
      const entry = document.createElement('div');
      entry.className = `end-game__player${i === 0 ? ' end-game__player--winner' : ''}`;
      entry.innerHTML = `
        <div class="end-game__rank">${i === 0 ? '🏆' : i + 1}</div>
        <div class="end-game__player-info">
          <div class="end-game__player-name">${p.name}</div>
          <div class="end-game__player-type">${p.type === 'human' ? 'Vous' : AI_LEVEL_LABELS[p.aiLevel]}</div>
        </div>
        <div class="end-game__player-score">${p.score} pts</div>
      `;
      list.appendChild(entry);
    });

    setTimeout(() => ModalManager.open('modal-end-game'), 600);
  }

  /* ================================================================== */
  /* RENDU RACK                                                           */
  /* ================================================================== */

  _renderRack(rack) {
    const container = this._els.rackContainer;
    if (!container) return;
    container.innerHTML = '';

    const newEls = [];
    for (let i = 0; i < 7; i++) {
      const slot = document.createElement('div');
      slot.className = 'rack-slot';
      slot.dataset.slot = i;

      const tile = rack[i];
      if (tile) {
        const tileEl = this._createTileEl(tile);
        slot.appendChild(tileEl);
        newEls.push(tileEl);

        if (this._dnd) {
          this._dnd.attachRackTile(tileEl, i, {
            tileId: tile.id, letter: tile.letter,
            value: tile.value, isBlank: tile.isBlank,
          });
        }

        // Click pour sélectionner (mode sans drag)
        tileEl.addEventListener('click', () => this._selectRackTile(i, tileEl, container));
      }

      if (this._dnd) this._dnd.attachRackSlot(slot, i);
      container.appendChild(slot);
    }

    // Animer les nouvelles tuiles
    animateRackDraw(newEls);
  }

  /* ================================================================== */
  /* RENDU SCOREBOARD                                                     */
  /* ================================================================== */

  _renderScoreboard(players) {
    const list = this._els.scoreList;
    if (!list) return;

    // Mettre à jour les entrées existantes ou les créer
    players.forEach(p => {
      let entry = list.querySelector(`.score-entry[data-player-id="${p.id}"]`);

      if (!entry) {
        entry = document.createElement('li');
        entry.className = 'score-entry';
        entry.dataset.playerId = p.id;
        entry.innerHTML = `
          <div class="score-entry__color" style="background:${PLAYER_COLORS[p.colorIndex]};box-shadow:0 0 8px ${PLAYER_COLORS[p.colorIndex]}"></div>
          <div class="score-entry__info">
            <div class="score-entry__name">${p.name}</div>
            <div class="score-entry__badge">${p.type === 'human' ? 'Joueur' : AI_LEVEL_LABELS[p.aiLevel]}</div>
          </div>
          <div class="score-entry__score" data-score>0</div>
          <div class="score-entry__thinking"></div>
        `;
        list.appendChild(entry);
      }

      // Mettre à jour le score avec animation delta
      const scoreEl = entry.querySelector('[data-score]');
      const oldScore = parseInt(scoreEl?.textContent || '0');
      if (scoreEl && p.score !== oldScore) {
        const delta = p.score - oldScore;
        scoreEl.textContent = p.score;
        if (delta > 0) {
          const deltaEl = document.createElement('div');
          deltaEl.className = 'score-entry__delta';
          deltaEl.textContent = `+${delta}`;
          entry.appendChild(deltaEl);
          deltaEl.addEventListener('animationend', () => deltaEl.remove(), { once: true });
        }
      }
    });
  }

  /* ================================================================== */
  /* TUILES VERROUILLÉES (posées définitivement)                          */
  /* ================================================================== */

  _renderLockedTile(cell, tileData) {
    // Enlever les éléments existants non-tuiles (labels de bonus)
    const existing = cell.querySelector('.tile');
    if (existing) return; // déjà rendu

    const tileEl = this._createTileEl(tileData);
    tileEl.classList.add('tile--placed', 'anim-tile-lock');
    tileEl.draggable = false;
    cell.appendChild(tileEl);
  }

  /* ================================================================== */
  /* DRAG & DROP HANDLERS                                                 */
  /* ================================================================== */

  _handleRackToBoard({ index, tileId, letter, value, isBlank, targetX, targetY }) {
    const key = `${targetX},${targetY}`;
    if (this._tempPlacements.has(key)) return;
    if (this._engine.board.getTile(targetX, targetY)) return;

    const rack = this._engine.players.find(p => p.isHuman)?.rack;
    if (!rack) return;

    const tile = rack[index];
    if (!tile) return;

    // Si joker → ouvrir modale de choix
    if (tile.isBlank) {
      this._openJokerModal(tile, (chosenLetter) => {
        tile.blankAs = chosenLetter;
        this._placeTempTile(targetX, targetY, {
          tileId: tile.id, letter: chosenLetter,
          value: 0, isBlank: true, rackIndex: index,
        });
      });
      return;
    }

    this._placeTempTile(targetX, targetY, {
      tileId: tile.id, letter: tile.letter,
      value: tile.value, isBlank: false, rackIndex: index,
    });
  }

  _handleBoardToBoard({ x, y, tileId, letter, value, isBlank, targetX, targetY }) {
    const key    = `${x},${y}`;
    const newKey = `${targetX},${targetY}`;
    if (this._engine.board.getTile(targetX, targetY)) return;
    if (this._tempPlacements.has(newKey)) return;

    const placement = this._tempPlacements.get(key);
    if (!placement) return;

    this._removeTempTile(x, y);
    this._placeTempTile(targetX, targetY, { ...placement });
  }

  _handleBoardToRack({ x, y }) {
    const key = `${x},${y}`;
    const placement = this._tempPlacements.get(key);
    if (!placement) return;

    this._removeTempTile(x, y);

    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;

    human.rack.push({
      id:      placement.tileId,
      letter:  placement.isBlank ? '_' : placement.letter,
      value:   placement.value,
      isBlank: placement.isBlank,
      blankAs: null,
    });
    this._renderRack(human.rack);
  }

  _handleRackReorder({ fromIndex, toIndex }) {
    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;
    const tile = human.rack.splice(fromIndex, 1)[0];
    human.rack.splice(toIndex, 0, tile);
    this._renderRack(human.rack);
  }

  _handleCellClick({ x, y }) {
    if (this._selectedTileIndex === null) return;
    const key = `${x},${y}`;
    if (this._engine.board.getTile(x, y) || this._tempPlacements.has(key)) return;

    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;
    const tile = human.rack[this._selectedTileIndex];
    if (!tile) return;

    if (tile.isBlank) {
      this._openJokerModal(tile, (chosenLetter) => {
        tile.blankAs = chosenLetter;
        this._placeTempTile(x, y, {
          tileId: tile.id, letter: chosenLetter,
          value: 0, isBlank: true, rackIndex: this._selectedTileIndex,
        });
        this._selectedTileIndex = null;
      });
      return;
    }

    this._placeTempTile(x, y, {
      tileId: tile.id, letter: tile.letter,
      value: tile.value, isBlank: false, rackIndex: this._selectedTileIndex,
    });
    this._selectedTileIndex = null;
  }

  /* ================================================================== */
  /* PLACEMENT TEMPORAIRE                                                 */
  /* ================================================================== */

  _placeTempTile(x, y, data) {
    const cell = this._getCell(x, y);
    if (!cell) return;

    // Retirer la tuile du rack DOM
    const human = this._engine.players.find(p => p.isHuman);
    if (human) {
      const rackIdx = human.rack.findIndex(t => t.id === data.tileId);
      if (rackIdx !== -1) {
        data.rackIndex = rackIdx;
        human.rack.splice(rackIdx, 1);
        this._renderRack(human.rack);
      }
    }

    // Créer la tuile temporaire sur le plateau
    const tileEl = this._createTileEl({
      letter: data.letter, value: data.value, isBlank: data.isBlank,
    });
    tileEl.classList.add('tile--temp');
    cell.appendChild(tileEl);

    this._tempPlacements.set(`${x},${y}`, data);

    // Attacher le drag pour repositionnement
    if (this._dnd) {
      this._dnd.attachBoardTile(tileEl, x, y, {
        tileId: data.tileId, letter: data.letter,
        value: data.value, isBlank: data.isBlank,
      });
    }
  }

  _removeTempTile(x, y) {
    const cell   = this._getCell(x, y);
    const tileEl = cell?.querySelector('.tile--temp');
    if (tileEl) tileEl.remove();
    this._tempPlacements.delete(`${x},${y}`);
  }

  /* ================================================================== */
  /* ACTIONS BOUTONS                                                      */
  /* ================================================================== */

  /** Rappelle toutes les tuiles temporaires dans le rack. */
  recallAll() {
    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;

    for (const [key, placement] of this._tempPlacements) {
      const [x, y] = key.split(',').map(Number);
      const cell = this._getCell(x, y);
      cell?.querySelector('.tile--temp')?.remove();

      human.rack.push({
        id:      placement.tileId,
        letter:  placement.isBlank ? '_' : placement.letter,
        value:   placement.value,
        isBlank: placement.isBlank,
        blankAs: null,
      });
    }

    this._tempPlacements.clear();
    this._renderRack(human.rack);
  }

  /** Soumet le coup au moteur. */
  submitMove() {
    const placements = [];
    this._tempPlacements.forEach((data, key) => {
      const [x, y] = key.split(',').map(Number);
      placements.push({
        x, y,
        id: data.tileId,
        letter: data.letter,
        value: data.value,
        isBlank: data.isBlank,
      });
    });
    this._engine.submitMove(placements);
  }

  /** Mélange le rack humain. */
  shuffleRack() {
    this._engine.shuffleRack();
  }

  /* ================================================================== */
  /* HELPERS                                                              */
  /* ================================================================== */

  _getCell(x, y) {
    return this._els.board.children[y * BOARD_SIZE + x];
  }

  _createTileEl(tile) {
    const el = document.createElement('div');
    el.className = `tile${tile.isBlank ? ' tile--blank' : ''}`;
    el.setAttribute('aria-label', `Tuile ${tile.letter} valeur ${tile.value}`);

    const letter = document.createElement('span');
    letter.textContent = tile.letter === '_' ? '?' : tile.letter;
    el.appendChild(letter);

    const value = document.createElement('span');
    value.className = 'tile__value';
    value.textContent = tile.value;
    el.appendChild(value);

    return el;
  }

  _selectRackTile(index, tileEl, container) {
    // Désélectionner le précédent
    container.querySelectorAll('.tile--selected').forEach(t => t.classList.remove('tile--selected'));
    if (this._selectedTileIndex === index) {
      this._selectedTileIndex = null;
    } else {
      this._selectedTileIndex = index;
      tileEl.classList.add('tile--selected');
    }
  }

  _setControlsEnabled(enabled) {
    const ids = ['btn-validate','btn-recall','btn-shuffle','btn-exchange','btn-pass'];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !enabled;
    });
  }

  _attachAllCells() {
    if (!this._dnd) return;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        this._dnd.attachBoardCell(this._getCell(x, y), x, y);
      }
    }
  }

  _openJokerModal(tile, callback) {
    ModalManager.open('modal-joker');
    const keyboard = document.getElementById('joker-keyboard');
    if (!keyboard) { callback('A'); return; }

    keyboard.innerHTML = '';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'joker-key';
      btn.textContent = letter;
      btn.addEventListener('click', () => {
        ModalManager.close('modal-joker');
        callback(letter);
      });
      keyboard.appendChild(btn);
    });
  }
}
