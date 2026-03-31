/**
 * renderer.js — Rendu DOM du jeu
 */

import { BOARD_LAYOUT, BOARD_SIZE, BONUS_CSS, BONUS_LABELS, PLAYER_COLORS, AI_LEVEL_LABELS } from '../core/constants.js';
import { DragDropManager } from './drag-drop.js';
import { ModalManager, showToast } from './modal-manager.js';
import { floatScore, launchConfetti, animateRackDraw } from './animations.js';

export class Renderer {
  constructor(engine, elements) {
    this._engine  = engine;
    this._els     = elements;
    this._tempPlacements = new Map();
    this._selectedTileIndex = null;
    this._dnd = null;
    this._humanPlayerId = null;

    // Workspace
    this._workspaceEls       = new Map(); // tileId → HTMLElement
    this._workspacePositions = new Map(); // tileId → {x, y}
    this._tileSlotIdx        = new Map(); // tileId → slotIndex (0..7)

    // Drag en cours
    this._drag = null; // { el, tileId, letter, value, isBlank, clientX, clientY }
    this._lastHighlightCell = null;
  }

  init() {
    this._buildBoard();
    this._attachEngineEvents();
    this._setupWorkspaceDrag();
  }

  /* ================================================================== */
  /* PLATEAU                                                              */
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

        // Label centré pour toutes les cases bonus (sous les tuiles via z-index:2)
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
  /* ÉVÉNEMENTS MOTEUR                                                    */
  /* ================================================================== */

  _attachEngineEvents() {
    const on = (name, fn) => document.addEventListener(`game:${name}`, e => fn(e.detail));
    on('started',        d => this._onGameStarted(d));
    on('boardUpdate',    d => this._onBoardUpdate(d));
    on('rackUpdate',     d => this._onRackUpdate(d));
    on('scoresUpdate',   d => this._onScoresUpdate(d));
    on('tilesRemaining', d => this._onTilesRemaining(d));
    on('turnStart',      d => this._onTurnStart(d));
    on('moveValid',      d => this._onMoveValid(d));
    on('moveInvalid',    d => this._onMoveInvalid(d));
    on('message',        d => showToast(d.text, d.type));
    on('stateChange',    d => this._onStateChange(d));
    on('gameOver',       d => this._onGameOver(d));
  }

  _onGameStarted({ players }) {
    this._humanPlayerId = players.find(p => p.type === 'human')?.id;
    this._tempPlacements.clear();
    this._selectedTileIndex = null;

    if (this._els.workspace) {
      this._els.workspace.innerHTML = '';
      this._workspaceEls.clear();
      this._workspacePositions.clear();
      this._tileSlotIdx.clear();
      this._drag = null;
      document.body.classList.remove('tile-held');
    }

    this._buildBoard();
    this._renderScoreboard(players);

    this._dnd = new DragDropManager({
      onRackToBoard:  d => this._handleRackToBoard(d),
      onBoardToBoard: d => this._handleBoardToBoard(d),
      onBoardToRack:  d => this._handleBoardToRack(d),
      onRackReorder:  d => this._handleRackReorder(d),
      onCellClick:    d => this._handleCellClick(d),
    });

    this._attachAllCells();
  }

  _onBoardUpdate({ board }) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = this._getCell(x, y);
        const tile = board.grid[y][x];
        if (tile && !cell.querySelector('.tile--placed')) {
          if (!this._tempPlacements.has(`${x},${y}`)) {
            this._renderLockedTile(cell, tile);
          }
        }
      }
    }
  }

  _onRackUpdate({ playerId, rack }) {
    if (playerId !== this._humanPlayerId) return;
    if (this._els.workspace) {
      this._renderWorkspace(rack);
    } else {
      this._renderRack(rack);
    }
  }

  _onScoresUpdate({ players }) { this._renderScoreboard(players); }

  _onTilesRemaining({ count }) {
    if (this._els.bagCount) this._els.bagCount.textContent = count;
  }

  _onTurnStart({ playerId, playerName, isHuman }) {
    document.querySelectorAll('.score-entry').forEach(el =>
      el.classList.remove('score-entry--active', 'score-entry--thinking')
    );
    const activeEntry = document.querySelector(`.score-entry[data-player-id="${playerId}"]`);
    if (activeEntry) {
      activeEntry.classList.add('score-entry--active');
      if (!isHuman) activeEntry.classList.add('score-entry--thinking');
    }

    const isMyTurn = playerId === this._humanPlayerId;
    this._setControlsEnabled(isMyTurn);

    if (this._els.turnIndicator) {
      this._els.turnIndicator.textContent = isMyTurn ? 'Votre tour' : `Tour de ${playerName}…`;
      this._els.turnIndicator.parentElement?.classList.toggle('turn-indicator--active', isMyTurn);
    }

    if (isHuman) this._showTurnRibbon(playerName);
  }

  _onMoveValid({ placements, total, scrabble }) {
    placements.forEach((p, idx) => {
      const cell = this._getCell(p.x, p.y);
      const tempEl = cell.querySelector('.tile--temp');
      if (tempEl) {
        tempEl.classList.remove('tile--temp');
        tempEl.classList.add('tile--placed', 'anim-tile-lock');
        tempEl.style.animationDelay = `${idx * 70}ms`; // vague séquentielle
        tempEl.draggable = false;
        tempEl.removeAttribute('draggable');
      }
      this._tempPlacements.delete(`${p.x},${p.y}`);
    });

    const firstCell = this._getCell(placements[0]?.x, placements[0]?.y);
    if (firstCell) floatScore(firstCell, `+${total}`, scrabble ? '#f0c040' : '#82e0aa');
    if (scrabble) launchConfetti();
  }

  _onMoveInvalid({ reason }) {
    showToast(reason, 'error', 3500);
    const target = this._els.workspace || this._els.rackContainer;
    if (target) {
      target.classList.remove('anim-tile-shake');
      void target.offsetWidth;
      target.classList.add('anim-tile-shake');
      target.addEventListener('animationend', () => target.classList.remove('anim-tile-shake'), { once: true });
    }
  }

  _onStateChange({ state }) {
    const overlay = document.querySelector('.ai-thinking-overlay');
    if (overlay) overlay.style.display = state === 'ai_thinking' ? 'flex' : 'none';
  }

  _onGameOver({ sorted }) {
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
          <div class="end-game__player-type">${p.type === 'human' ? 'Humain' : AI_LEVEL_LABELS[p.aiLevel]}</div>
        </div>
        <div class="end-game__player-score">${p.score} pts</div>`;
      list.appendChild(entry);
    });
    setTimeout(() => ModalManager.open('modal-end-game'), 600);
  }

  /* ================================================================== */
  /* WORKSPACE — drag fluide (mousedown → mousemove → mouseup)           */
  /* ================================================================== */

  _setupWorkspaceDrag() {
    const ws = this._els.workspace;
    if (!ws) return;

    // Déplacement du tile en cours de drag
    document.addEventListener('mousemove', (e) => {
      if (!this._drag) return;
      this._moveDrag(e.clientX, e.clientY);
    });

    // Relâchement : déposer
    document.addEventListener('mouseup', (e) => {
      if (!this._drag) return;
      this._endDrag(e.clientX, e.clientY);
    });

    // Échap : annuler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._drag) this._cancelDrag();
    });
  }

  _renderWorkspace(rack) {
    const ws = this._els.workspace;
    if (!ws) { this._renderRack(rack); return; }

    const wsRect = ws.getBoundingClientRect();
    const wsW = wsRect.width  || 340;
    const wsH = wsRect.height || window.innerHeight;

    const cellSize = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--cell-size')) || 42;
    const tileSize = cellSize - 2;

    // Créer / mettre à jour le cadre de pioche
    this._ensureTileRack(ws, tileSize, wsW, wsH);
    const { slots } = this._computeRackSlotPositions(tileSize, wsW, wsH);

    const existingIds = new Set(rack.filter(Boolean).map(t => t.id));

    // Supprimer les tuiles absentes du rack
    for (const [id, el] of this._workspaceEls) {
      if (!existingIds.has(id)) {
        el.remove();
        this._workspaceEls.delete(id);
        this._workspacePositions.delete(id);
        this._tileSlotIdx.delete(id);
      }
    }

    // Ajouter les nouvelles tuiles dans les emplacements libres
    const newTiles = rack.filter(t => t && !this._workspaceEls.has(t.id));
    if (newTiles.length === 0) return;

    const occupiedSlots = new Set(this._tileSlotIdx.values());
    const newEls = [];

    for (const tile of newTiles) {
      if (!tile) continue;

      // Premier emplacement libre
      let slotIdx = 0;
      for (let i = 0; i < slots.length; i++) {
        if (!occupiedSlots.has(i)) { slotIdx = i; break; }
      }
      occupiedSlots.add(slotIdx);
      this._tileSlotIdx.set(tile.id, slotIdx);

      const pos = slots[slotIdx];
      this._workspacePositions.set(tile.id, pos);

      const el = this._createTileEl(tile);
      el.dataset.tileId = tile.id;
      el.style.position = 'absolute';
      el.style.left     = pos.x + 'px';
      el.style.top      = pos.y + 'px';
      el.style.zIndex   = String(slotIdx + 10);
      el.style.cursor   = 'grab';

      ws.appendChild(el);
      this._workspaceEls.set(tile.id, el);
      this._attachWorkspaceTileDrag(el, tile);
      newEls.push(el);
    }

    animateRackDraw(newEls);
  }

  _attachWorkspaceTileDrag(el, tile) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._startDrag(el, tile, e.clientX, e.clientY);
    });

    // Touch support
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      e.preventDefault();
      this._startDrag(el, tile, t.clientX, t.clientY);
    }, { passive: false });
  }

  _startDrag(el, tile, clientX, clientY) {
    if (this._drag) this._cancelDrag(); // annuler un éventuel drag en cours

    const sz = el.offsetWidth || 40;

    this._drag = {
      el,
      tileId:  tile.id,
      letter:  tile.isBlank ? '_' : tile.letter,
      value:   tile.value,
      isBlank: tile.isBlank,
      clientX, clientY,
    };

    el.style.position      = 'fixed';
    el.style.left          = (clientX - sz / 2) + 'px';
    el.style.top           = (clientY - sz / 2) + 'px';
    el.style.zIndex        = '9999';
    el.style.pointerEvents = 'none';
    el.style.transform     = 'scale(1.18) rotate(2deg)';
    el.style.boxShadow     = '0 14px 36px rgba(0,0,0,0.85), 0 0 0 2px rgba(212,160,23,0.85)';
    el.style.transition    = 'none';
    el.style.cursor        = 'grabbing';

    document.body.classList.add('tile-held');
  }

  _moveDrag(clientX, clientY) {
    const { el } = this._drag;
    const sz = el.offsetWidth || 40;
    el.style.left = (clientX - sz / 2) + 'px';
    el.style.top  = (clientY - sz / 2) + 'px';
    this._drag.clientX = clientX;
    this._drag.clientY = clientY;

    // Surbrillance de la case cible
    const under = document.elementFromPoint(clientX, clientY);
    const newCell = under?.closest('.board__cell') ?? null;

    if (newCell !== this._lastHighlightCell) {
      this._lastHighlightCell?.classList.remove('drag-over');
      this._lastHighlightCell = null;
      if (newCell && !newCell.querySelector('.tile--placed') && !newCell.querySelector('.tile--temp')) {
        newCell.classList.add('drag-over');
        this._lastHighlightCell = newCell;
      }
    }
  }

  _endDrag(clientX, clientY) {
    if (!this._drag) return;

    // Nettoyer highlight
    this._lastHighlightCell?.classList.remove('drag-over');
    this._lastHighlightCell = null;

    const { el, tileId, letter, value, isBlank } = this._drag;
    document.body.classList.remove('tile-held');

    // Détecter la cible (le tile est pointer-events:none → on voit à travers)
    const under = document.elementFromPoint(clientX, clientY);
    const boardCell = under?.closest('.board__cell');

    if (boardCell) {
      const x = parseInt(boardCell.dataset.x);
      const y = parseInt(boardCell.dataset.y);
      if (!isNaN(x) && !isNaN(y) &&
          !this._engine.board.getTile(x, y) &&
          !this._tempPlacements.has(`${x},${y}`)) {

        if (isBlank) {
          const human = this._engine.players.find(p => p.isHuman);
          const tileObj = human?.rack.find(t => t?.id === tileId) || { id: tileId };
          this._openJokerModal(tileObj, (chosenLetter) => {
            this._placeTileFromDrag(x, y, { tileId, letter: chosenLetter, value: 0, isBlank: true });
          });
        } else {
          this._placeTileFromDrag(x, y, { tileId, letter, value, isBlank });
        }
        this._drag = null;
        return;
      }
    }

    // Sinon : déposer dans le workspace
    this._dropDragToWorkspace(clientX, clientY);
    this._drag = null;
  }

  _placeTileFromDrag(x, y, data) {
    const drag = this._drag;
    if (!drag) return;

    // Retirer le tile du workspace
    drag.el.remove();
    this._workspaceEls.delete(drag.tileId);
    this._workspacePositions.delete(drag.tileId);
    this._tileSlotIdx.delete(drag.tileId);

    // Retirer du rack
    const human = this._engine.players.find(p => p.isHuman);
    if (human) {
      const idx = human.rack.findIndex(t => t?.id === drag.tileId);
      if (idx !== -1) human.rack.splice(idx, 1);
    }

    // Créer la tuile temporaire sur le plateau
    const cell = this._getCell(x, y);
    if (!cell) return;

    const tileEl = this._createTileEl({ letter: data.letter, value: data.value, isBlank: data.isBlank });
    tileEl.classList.add('tile--temp');
    cell.appendChild(tileEl);

    this._tempPlacements.set(`${x},${y}`, data);

    if (this._dnd) {
      this._dnd.attachBoardTile(tileEl, x, y, {
        tileId: data.tileId, letter: data.letter, value: data.value, isBlank: data.isBlank,
      });
    }
  }

  _dropDragToWorkspace(clientX, clientY) {
    const { el, tileId } = this._drag;
    const ws = this._els.workspace;
    if (!ws) return;

    const wsRect = ws.getBoundingClientRect();
    const wsW = wsRect.width  || 340;
    const wsH = wsRect.height || window.innerHeight;
    const cellSize = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--cell-size')) || 42;
    const tileSize = cellSize - 2;

    this._ensureTileRack(ws, tileSize, wsW, wsH);
    const { slots } = this._computeRackSlotPositions(tileSize, wsW, wsH);

    const dropX = clientX - wsRect.left;
    const dropY = clientY - wsRect.top;

    // Emplacements déjà pris par les autres tuiles
    const occupiedSlots = new Set(
      [...this._tileSlotIdx.entries()]
        .filter(([id]) => id !== tileId)
        .map(([, s]) => s)
    );

    // Garder l'emplacement d'origine si libre, sinon prendre le plus proche libre
    const origSlot = this._tileSlotIdx.get(tileId);
    let bestSlot = -1;
    if (origSlot !== undefined && !occupiedSlots.has(origSlot)) {
      bestSlot = origSlot;
    } else {
      let bestDist = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (occupiedSlots.has(i)) continue;
        const dx = slots[i].x - dropX, dy = slots[i].y - dropY;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; bestSlot = i; }
      }
    }
    if (bestSlot === -1) bestSlot = 0;

    const pos = slots[bestSlot];
    this._tileSlotIdx.set(tileId, bestSlot);
    this._workspacePositions.set(tileId, pos);

    el.style.position      = 'absolute';
    el.style.left          = pos.x + 'px';
    el.style.top           = pos.y + 'px';
    el.style.zIndex        = String(bestSlot + 10);
    el.style.pointerEvents = '';
    el.style.transform     = '';
    el.style.boxShadow     = '';
    el.style.transition    = '';
    el.style.cursor        = 'grab';

    ws.appendChild(el);
  }

  _cancelDrag() {
    if (!this._drag) return;
    const { el, tileId } = this._drag;

    // Recalculer la position du slot si disponible
    let pos = this._workspacePositions.get(tileId) ?? { x: 0, y: 0 };
    const ws = this._els.workspace;
    if (ws && this._tileSlotIdx.has(tileId)) {
      const wsRect = ws.getBoundingClientRect();
      const cellSize = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--cell-size')) || 42;
      const { slots } = this._computeRackSlotPositions(
        cellSize - 2, wsRect.width || 340, wsRect.height || window.innerHeight
      );
      const slotIdx = this._tileSlotIdx.get(tileId);
      if (slots[slotIdx]) pos = slots[slotIdx];
    }

    el.style.position      = 'absolute';
    el.style.left          = pos.x + 'px';
    el.style.top           = pos.y + 'px';
    el.style.zIndex        = '';
    el.style.pointerEvents = '';
    el.style.transform     = '';
    el.style.boxShadow     = '';
    el.style.transition    = '';
    el.style.cursor        = 'grab';

    ws?.appendChild(el);
    this._lastHighlightCell?.classList.remove('drag-over');
    this._lastHighlightCell = null;
    this._drag = null;
    document.body.classList.remove('tile-held');
  }

  /* ================================================================== */
  /* RACK FALLBACK (mobile / sans workspace)                              */
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
        tileEl.addEventListener('click', () => this._selectRackTile(i, tileEl, container));
      }

      if (this._dnd) this._dnd.attachRackSlot(slot, i);
      container.appendChild(slot);
    }
    animateRackDraw(newEls);
  }

  /* ================================================================== */
  /* SCOREBOARD                                                           */
  /* ================================================================== */

  _renderScoreboard(players) {
    const list = this._els.scoreList;
    if (!list) return;

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
            <div class="score-entry__badge">${p.type === 'human' ? 'Humain' : AI_LEVEL_LABELS[p.aiLevel]}</div>
          </div>
          <div class="score-entry__score" data-score>0</div>
          <div class="score-entry__thinking"></div>`;
        list.appendChild(entry);
      }

      const scoreEl = entry.querySelector('[data-score]');
      const oldScore = parseInt(scoreEl?.textContent || '0');
      if (scoreEl && p.score !== oldScore) {
        const delta = p.score - oldScore;
        scoreEl.textContent = p.score;
        if (delta > 0) {
          // Flash doré sur le score
          scoreEl.classList.remove('score-flash');
          void scoreEl.offsetWidth;
          scoreEl.classList.add('score-flash');
          scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('score-flash'), { once: true });

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
  /* TUILES VERROUILLÉES                                                  */
  /* ================================================================== */

  _renderLockedTile(cell, tileData) {
    if (cell.querySelector('.tile')) return;
    const tileEl = this._createTileEl(tileData);
    tileEl.classList.add('tile--placed', 'anim-tile-lock');
    tileEl.draggable = false;
    cell.appendChild(tileEl);
  }

  /* ================================================================== */
  /* DRAG & DROP HTML5 (tuiles temporaires sur plateau)                  */
  /* ================================================================== */

  _handleRackToBoard({ index, tileId, letter, value, isBlank, targetX, targetY }) {
    const key = `${targetX},${targetY}`;
    if (this._tempPlacements.has(key)) return;
    if (this._engine.board.getTile(targetX, targetY)) return;

    const rack = this._engine.players.find(p => p.isHuman)?.rack;
    if (!rack) return;
    const tile = rack[index];
    if (!tile) return;

    if (tile.isBlank) {
      this._openJokerModal(tile, (chosenLetter) => {
        tile.blankAs = chosenLetter;
        this._placeTempTile(targetX, targetY, { tileId: tile.id, letter: chosenLetter, value: 0, isBlank: true, rackIndex: index });
      });
      return;
    }
    this._placeTempTile(targetX, targetY, { tileId: tile.id, letter: tile.letter, value: tile.value, isBlank: false, rackIndex: index });
  }

  _handleBoardToBoard({ x, y, targetX, targetY }) {
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
    const placement = this._tempPlacements.get(`${x},${y}`);
    if (!placement) return;
    this._removeTempTile(x, y);

    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;
    human.rack.push({
      id: placement.tileId, letter: placement.isBlank ? '_' : placement.letter,
      value: placement.value, isBlank: placement.isBlank, blankAs: null,
    });

    if (this._els.workspace) this._renderWorkspace(human.rack);
    else this._renderRack(human.rack);
  }

  _handleRackReorder({ fromIndex, toIndex }) {
    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;
    const tile = human.rack.splice(fromIndex, 1)[0];
    human.rack.splice(toIndex, 0, tile);
    if (!this._els.workspace) this._renderRack(human.rack);
  }

  _handleCellClick({ x, y }) {
    // En mode workspace, le placement se fait via drag (mouseup).
    // Ce handler gère uniquement le mode rack classique (mobile).
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
        this._placeTempTile(x, y, { tileId: tile.id, letter: chosenLetter, value: 0, isBlank: true, rackIndex: this._selectedTileIndex });
        this._selectedTileIndex = null;
      });
      return;
    }
    this._placeTempTile(x, y, { tileId: tile.id, letter: tile.letter, value: tile.value, isBlank: false, rackIndex: this._selectedTileIndex });
    this._selectedTileIndex = null;
  }

  /* ================================================================== */
  /* PLACEMENT TEMPORAIRE                                                 */
  /* ================================================================== */

  _placeTempTile(x, y, data) {
    const cell = this._getCell(x, y);
    if (!cell) return;

    const human = this._engine.players.find(p => p.isHuman);
    if (human) {
      const rackIdx = human.rack.findIndex(t => t?.id === data.tileId);
      if (rackIdx !== -1) {
        data.rackIndex = rackIdx;
        human.rack.splice(rackIdx, 1);
        // Retirer du workspace si présent
        const wsEl = this._workspaceEls.get(data.tileId);
        if (wsEl) {
          wsEl.remove();
          this._workspaceEls.delete(data.tileId);
          this._workspacePositions.delete(data.tileId);
          this._tileSlotIdx.delete(data.tileId);
        } else if (!this._els.workspace) {
          this._renderRack(human.rack);
        }
      }
    }

    const tileEl = this._createTileEl({ letter: data.letter, value: data.value, isBlank: data.isBlank });
    tileEl.classList.add('tile--temp');
    cell.appendChild(tileEl);
    this._tempPlacements.set(`${x},${y}`, data);

    if (this._dnd) {
      this._dnd.attachBoardTile(tileEl, x, y, {
        tileId: data.tileId, letter: data.letter, value: data.value, isBlank: data.isBlank,
      });
    }
  }

  _removeTempTile(x, y) {
    this._getCell(x, y)?.querySelector('.tile--temp')?.remove();
    this._tempPlacements.delete(`${x},${y}`);
  }

  /* ================================================================== */
  /* ACTIONS BOUTONS                                                      */
  /* ================================================================== */

  recallAll() {
    const human = this._engine.players.find(p => p.isHuman);
    if (!human) return;

    for (const [key, placement] of this._tempPlacements) {
      const [x, y] = key.split(',').map(Number);
      this._getCell(x, y)?.querySelector('.tile--temp')?.remove();
      human.rack.push({
        id: placement.tileId, letter: placement.isBlank ? '_' : placement.letter,
        value: placement.value, isBlank: placement.isBlank, blankAs: null,
      });
    }
    this._tempPlacements.clear();

    if (this._els.workspace) this._renderWorkspace(human.rack);
    else this._renderRack(human.rack);
  }

  submitMove() {
    const placements = [];
    this._tempPlacements.forEach((data, key) => {
      const [x, y] = key.split(',').map(Number);
      placements.push({ x, y, id: data.tileId, letter: data.letter, value: data.value, isBlank: data.isBlank });
    });
    this._engine.submitMove(placements);
  }

  shuffleRack() { this._engine.shuffleRack(); }

  /* ================================================================== */
  /* HELPERS                                                              */
  /* ================================================================== */

  _getCell(x, y) { return this._els.board.children[y * BOARD_SIZE + x]; }

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
    container.querySelectorAll('.tile--selected').forEach(t => t.classList.remove('tile--selected'));
    if (this._selectedTileIndex === index) {
      this._selectedTileIndex = null;
    } else {
      this._selectedTileIndex = index;
      tileEl.classList.add('tile--selected');
    }
  }

  _setControlsEnabled(enabled) {
    ['btn-validate','btn-recall','btn-shuffle','btn-exchange','btn-pass'].forEach(id => {
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
      btn.addEventListener('click', () => { ModalManager.close('modal-joker'); callback(letter); });
      keyboard.appendChild(btn);
    });
  }

  /* ================================================================== */
  /* RUBAN DE TOUR                                                        */
  /* ================================================================== */

  _showTurnRibbon(playerName) {
    const ribbon = document.getElementById('turn-ribbon');
    if (!ribbon) return;
    const nameEl = ribbon.querySelector('.turn-ribbon__name');
    if (nameEl) nameEl.textContent = playerName;

    ribbon.classList.remove('turn-ribbon--active');
    void ribbon.offsetWidth; // force reflow
    ribbon.classList.add('turn-ribbon--active');

    ribbon.addEventListener('animationend', () => {
      ribbon.classList.remove('turn-ribbon--active');
    }, { once: true });
  }

  /* ================================================================== */
  /* CADRE DE PIOCHE (rack workspace)                                    */
  /* ================================================================== */

  _computeRackSlotPositions(tileSize, wsW, wsH) {
    const COLS = 4, ROWS = 2, GAP = 8, PAD_X = 14, PAD_Y = 14, BDR = 3;
    const innerW = COLS * tileSize + (COLS - 1) * GAP;
    const innerH = ROWS * tileSize + (ROWS - 1) * GAP;
    const rackW  = 2 * (BDR + PAD_X) + innerW;
    const rackH  = 2 * (BDR + PAD_Y) + innerH;
    const rackLeft = Math.round((wsW - rackW) / 2);
    const rackTop  = Math.max(64, Math.round(wsH * 0.6 - rackH / 2));

    const slots = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        slots.push({
          x: rackLeft + BDR + PAD_X + col * (tileSize + GAP),
          y: rackTop  + BDR + PAD_Y + row * (tileSize + GAP),
        });
      }
    }
    return { rackLeft, rackTop, rackW, rackH, slots };
  }

  _ensureTileRack(ws, tileSize, wsW, wsH) {
    const { rackLeft, rackTop, rackW, rackH } =
      this._computeRackSlotPositions(tileSize, wsW, wsH);

    let rack = ws.querySelector('.tile-rack');
    if (!rack) {
      rack = document.createElement('div');
      rack.className = 'tile-rack';
      const inner = document.createElement('div');
      inner.className = 'tile-rack__slots';
      for (let i = 0; i < 8; i++) {
        const slot = document.createElement('div');
        slot.className = 'tile-rack__slot';
        inner.appendChild(slot);
      }
      rack.appendChild(inner);
      ws.appendChild(rack);
    }

    rack.style.left    = rackLeft + 'px';
    rack.style.top     = rackTop  + 'px';
    rack.style.width   = rackW    + 'px';
    rack.style.height  = rackH    + 'px';
    rack.style.padding = '14px';
    rack.style.setProperty('--rack-tile-sz', tileSize + 'px');
  }
}
