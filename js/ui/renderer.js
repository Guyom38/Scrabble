/**
 * renderer.js — Rendu DOM du jeu
 */

import { BOARD_LAYOUT, BOARD_SIZE, BONUS_CSS, BONUS_LABELS, PLAYER_COLORS, AI_LEVEL_LABELS } from '../core/constants.js';
import { DragDropManager } from './drag-drop.js';
import { ModalManager, showToast } from './modal-manager.js';
import { floatScore, launchConfetti, animateRackDraw } from './animations.js';
import { wordInfoService } from '../core/word-info.js';
import { showWordCard } from './word-card.js';
import { addWordHistory, clearWordHistory, restoreWordHistory } from './word-history.js';

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
    this._lastHighlightSlot = null;

    // Définitions automatiques (off par défaut)
    this._autoDef = false;

    // AbortController pour nettoyage propre des listeners document
    this._abortCtrl = new AbortController();
  }

  destroy() {
    this._abortCtrl.abort();
  }

  init() {
    this._buildBoard();
    this._attachEngineEvents();
    this._setupWorkspaceDrag();
    this._setupAutoDefToggle();
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
    const sig = { signal: this._abortCtrl.signal };
    const on = (name, fn) => document.addEventListener(`game:${name}`, e => fn(e.detail), sig);
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

    // Clic sur une bulle d'historique → afficher la définition
    document.addEventListener('wordHistory:click', (e) => {
      const { word } = e.detail;
      if (!word) return;
      wordInfoService.getAsync(word).then(info => {
        if (info && (info.description || info.definition)) {
          showWordCard(word, info);
        }
      }).catch(() => {});
    }, sig);
  }

  _onGameStarted({ players, resumed = false }) {
    this._humanPlayerId = players.find(p => p.type === 'human')?.id;
    this._players       = players; // pour retrouver couleur + nom par id
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

    if (!resumed) clearWordHistory();

    this._buildBoard();
    this._renderScoreboard(players);

    // Pulse sur le sac pour inviter à jouer (uniquement nouvelle partie)
    const sacBtn = document.getElementById('btn-sac');
    if (sacBtn) {
      sacBtn.classList.toggle('btn-sac--pulse', !resumed);
    }

    // Restaurer les bulles après que le workspace a été reconstruit
    if (resumed) restoreWordHistory();

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

    // Animer le sac pour indiquer la pioche
    this._shakeSac();

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

    if (isHuman) this._showTurnOverlay(playerName);
  }

  _onMoveValid({ playerId, placements, total, scrabble, mainWord, wordScores }) {
    // Arrêter le pulse du sac dès le premier coup
    document.getElementById('btn-sac')?.classList.remove('btn-sac--pulse');

    placements.forEach((p, idx) => {
      const cell = this._getCell(p.x, p.y);
      const tempEl = cell.querySelector('.tile--temp');
      if (tempEl) {
        tempEl.classList.remove('tile--temp');
        tempEl.classList.add('tile--placed', 'anim-tile-lock');
        tempEl.style.animationDelay = `${idx * 70}ms`;
        tempEl.draggable = false;
        tempEl.removeAttribute('draggable');
      }
      this._tempPlacements.delete(`${p.x},${p.y}`);
    });

    // 1) Entourer les mots formés
    const allBonuses = [];
    if (wordScores) {
      for (const ws of wordScores) {
        if (ws.coords) {
          for (const c of ws.coords) {
            const cell = this._getCell(c.x, c.y);
            if (cell) {
              cell.classList.add('cell--word-highlight');
              setTimeout(() => cell.classList.remove('cell--word-highlight'), 1200);
            }
          }
        }
        if (ws.bonuses) allBonuses.push(...ws.bonuses);
      }
    }

    // 2) Après le highlight, afficher les bonus BD
    if (allBonuses.length > 0) {
      setTimeout(() => {
        allBonuses.forEach((b, i) => {
          const cell = this._getCell(b.x, b.y);
          if (!cell) return;
          const LABELS = { tw: 'MOT ×3', dw: 'MOT ×2', tl: 'LET ×3', dl: 'LET ×2' };
          const COLORS = { tw: '#e74c3c', dw: '#e08090', tl: '#3498db', dl: '#5aaad8' };
          const isWord = b.type === 'dw' || b.type === 'tw';
          const pop = document.createElement('div');
          pop.className = 'bonus-pop' + (isWord ? ' bonus-pop--word' : '');
          if (b.type === 'tw') pop.classList.add('bonus-pop--tw');
          pop.textContent = LABELS[b.type] || '';
          pop.style.color = COLORS[b.type] || '#f0c040';
          pop.style.animationDelay = `${i * 120}ms`;
          cell.appendChild(pop);
          pop.addEventListener('animationend', () => pop.remove(), { once: true });
        });
      }, 400);
    }

    // 3) Score flottant + confettis
    const firstCell = this._getCell(placements[0]?.x, placements[0]?.y);
    if (firstCell) floatScore(firstCell, `+${total}`, scrabble ? '#f0c040' : '#82e0aa');
    if (scrabble) launchConfetti();

    // 4) Historique des mots joués
    if (mainWord) {
      const playerIdx = (this._players || []).findIndex(p => p.id === playerId);
      const color     = PLAYER_COLORS[playerIdx] ?? '#f0c040';
      const name      = (this._players || [])[playerIdx]?.name ?? '';
      addWordHistory({ word: mainWord, score: total, playerName: name, color });
    }

    // 5) Définition du mot (seulement si auto-définition activée)
    if (mainWord && this._autoDef) {
      wordInfoService.getAsync(mainWord).then(info => {
        if (info && (info.description || info.definition)) {
          showWordCard(mainWord, info);
        }
      }).catch(e => console.warn('[WordCard] getAsync error:', e));
    }
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

    const sig = { signal: this._abortCtrl.signal };

    // Déplacement du tile en cours de drag
    document.addEventListener('mousemove', (e) => {
      if (!this._drag) return;
      this._moveDrag(e.clientX, e.clientY);
    }, sig);

    // Relâchement : déposer
    document.addEventListener('mouseup', (e) => {
      if (!this._drag) return;
      this._endDrag(e.clientX, e.clientY);
    }, sig);

    // Échap : annuler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._drag) this._cancelDrag();
    }, sig);
  }

  _setupAutoDefToggle() {
    const btn = document.getElementById('btn-auto-def');
    if (!btn) return;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._autoDef = !this._autoDef;
      btn.setAttribute('aria-pressed', String(this._autoDef));
      console.log('[AutoDef]', this._autoDef ? 'ON' : 'OFF');
    }, { signal: this._abortCtrl.signal });
  }

  _renderWorkspace(rack) {
    const ws = this._els.workspace;
    if (!ws) { this._renderRack(rack); return; }

    const wsW = ws.offsetWidth  || 340;
    const wsH = ws.offsetHeight || 1080;
    const tileSize = this._computeTileSize(wsW);

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

    const RACK_COLS = 8;

    for (const tile of newTiles) {
      if (!tile) continue;

      // Priorité ligne 1 (slots 0..RACK_COLS-1), puis ligne 2
      let slotIdx = -1;
      for (let i = 0; i < RACK_COLS; i++) {
        if (!occupiedSlots.has(i)) { slotIdx = i; break; }
      }
      if (slotIdx === -1) {
        for (let i = RACK_COLS; i < slots.length; i++) {
          if (!occupiedSlots.has(i)) { slotIdx = i; break; }
        }
      }
      if (slotIdx === -1) slotIdx = 0;
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

  /** Retourne les facteurs de scale courants du canvas */
  _getCanvasScale() {
    const canvas = document.getElementById('app-canvas');
    if (!canvas) return { sx: 1, sy: 1 };
    const rect = canvas.getBoundingClientRect();
    return { sx: rect.width / 1920, sy: rect.height / 1080 };
  }

  /** Convertit les coordonnées écran en coordonnées canvas (tenant compte du scale X/Y) */
  _toCanvasCoords(clientX, clientY) {
    const canvas = document.getElementById('app-canvas');
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / (rect.width  / 1920),
      y: (clientY - rect.top)  / (rect.height / 1080),
    };
  }

  /** Convertit les coordonnées écran en coordonnées locales d'un élément (dans l'espace canvas) */
  _toLocalCoords(clientX, clientY, element) {
    const { sx, sy } = this._getCanvasScale();
    const rect = element.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / sx,
      y: (clientY - rect.top)  / sy,
    };
  }

  _startDrag(el, tile, clientX, clientY) {
    if (this._drag) this._cancelDrag(); // annuler un éventuel drag en cours

    // Taille cible = cellule du plateau (taille finale sur le board)
    const cellSize = this._getCellSize();
    const pos = this._toCanvasCoords(clientX, clientY);

    this._drag = {
      el,
      tileId:  tile.id,
      letter:  tile.isBlank ? '_' : tile.letter,
      value:   tile.value,
      isBlank: tile.isBlank,
      clientX, clientY,
      dragSize: cellSize,
    };

    el.style.position      = 'absolute';
    el.style.width          = cellSize + 'px';
    el.style.height         = cellSize + 'px';
    el.style.left          = (pos.x - cellSize / 2) + 'px';
    el.style.top           = (pos.y - cellSize / 2) + 'px';
    el.style.zIndex        = '9999';
    el.style.pointerEvents = 'none';
    el.style.transform     = '';
    el.style.boxShadow     = '0 14px 36px rgba(0,0,0,0.85), 0 0 0 2px rgba(212,160,23,0.85)';
    el.style.transition    = 'none';
    el.style.cursor        = 'grabbing';

    // Déplacer dans le canvas pour un positionnement absolu correct
    document.getElementById('app-canvas').appendChild(el);

    document.body.classList.add('tile-held');
  }

  _moveDrag(clientX, clientY) {
    const { el, dragSize } = this._drag;
    const sz = dragSize || el.offsetWidth || 40;
    const pos = this._toCanvasCoords(clientX, clientY);
    el.style.left = (pos.x - sz / 2) + 'px';
    el.style.top  = (pos.y - sz / 2) + 'px';
    this._drag.clientX = clientX;
    this._drag.clientY = clientY;

    // Surbrillance de la case cible (plateau ou slot rack)
    const under = document.elementFromPoint(clientX, clientY);
    const newCell = under?.closest('.board__cell') ?? null;
    const newSlot = under?.closest('.tile-rack__slot') ?? null;

    if (newCell !== this._lastHighlightCell) {
      this._lastHighlightCell?.classList.remove('drag-over');
      this._lastHighlightCell = null;
      if (newCell && !newCell.querySelector('.tile--placed') && !newCell.querySelector('.tile--temp')) {
        newCell.classList.add('drag-over');
        this._lastHighlightCell = newCell;
      }
    }

    if (newSlot !== this._lastHighlightSlot) {
      this._lastHighlightSlot?.classList.remove('drag-over');
      this._lastHighlightSlot = newSlot;
      newSlot?.classList.add('drag-over');
    }
  }

  _endDrag(clientX, clientY) {
    if (!this._drag) return;

    // Nettoyer highlights
    this._lastHighlightCell?.classList.remove('drag-over');
    this._lastHighlightCell = null;
    this._lastHighlightSlot?.classList.remove('drag-over');
    this._lastHighlightSlot = null;

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

    const wsW = ws.offsetWidth  || 340;
    const wsH = ws.offsetHeight || 1080;
    const tileSize = this._computeTileSize(wsW);

    this._ensureTileRack(ws, tileSize, wsW, wsH);
    const { slots } = this._computeRackSlotPositions(tileSize, wsW, wsH);

    // Convertir les coords écran en coords locales du workspace
    const local = this._toLocalCoords(clientX, clientY, ws);
    const dropX = local.x;
    const dropY = local.y;

    // Emplacements déjà pris par les autres tuiles
    const occupiedSlots = new Set(
      [...this._tileSlotIdx.entries()]
        .filter(([id]) => id !== tileId)
        .map(([, s]) => s)
    );

    // Trouver l'emplacement le plus proche du point de dépôt (occupé ou non)
    // Comparer le curseur au CENTRE du slot (pas son coin supérieur-gauche)
    const half = tileSize / 2;
    let bestSlot = 0, bestDist = Infinity;
    for (let i = 0; i < slots.length; i++) {
      const dx = (slots[i].x + half) - dropX, dy = (slots[i].y + half) - dropY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; bestSlot = i; }
    }

    // Si l'emplacement cible est occupé → décalage intelligent
    if (occupiedSlots.has(bestSlot)) {
      bestSlot = this._shiftSlots(bestSlot, tileId, slots);
    }

    const pos = slots[bestSlot];
    this._tileSlotIdx.set(tileId, bestSlot);
    this._workspacePositions.set(tileId, pos);

    el.style.position      = 'absolute';
    el.style.width          = '';
    el.style.height         = '';
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
      const wsW2 = ws.offsetWidth || 340;
      const { slots } = this._computeRackSlotPositions(
        this._computeTileSize(wsW2), wsW2, ws.offsetHeight || 1080
      );
      const slotIdx = this._tileSlotIdx.get(tileId);
      if (slots[slotIdx]) pos = slots[slotIdx];
    }

    el.style.position      = 'absolute';
    el.style.width          = '';
    el.style.height         = '';
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
    this._lastHighlightSlot?.classList.remove('drag-over');
    this._lastHighlightSlot = null;
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

    // Tri par score décroissant pour le rang
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const _ordinal = i => i === 0 ? '1er' : `${i + 1}ème`;

    sorted.forEach((p, rankIdx) => {
      let entry = list.querySelector(`.score-entry[data-player-id="${p.id}"]`);
      if (!entry) {
        entry = document.createElement('li');
        entry.className = 'score-entry';
        entry.dataset.playerId = p.id;
        entry.innerHTML = `
          <div class="score-entry__rank"></div>
          <div class="score-entry__color" style="background:${PLAYER_COLORS[p.colorIndex]};box-shadow:0 0 8px ${PLAYER_COLORS[p.colorIndex]}"></div>
          <div class="score-entry__info">
            <div class="score-entry__name">${p.name}</div>
            <div class="score-entry__badge">${p.type === 'human' ? 'Humain' : AI_LEVEL_LABELS[p.aiLevel]}</div>
          </div>
          <div class="score-entry__score" data-score>0</div>
          <div class="score-entry__thinking"></div>`;
      }

      // Mise à jour du rang
      const rankEl = entry.querySelector('.score-entry__rank');
      if (rankEl) {
        rankEl.textContent = _ordinal(rankIdx);
        rankEl.dataset.rank = rankIdx;
      }

      // Mise à jour du score
      const scoreEl = entry.querySelector('[data-score]');
      const oldScore = parseInt(scoreEl?.textContent || '0');
      if (scoreEl && p.score !== oldScore) {
        const delta = p.score - oldScore;
        scoreEl.textContent = p.score;
        if (delta > 0) {
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

      // Réordonne le DOM selon le tri
      list.appendChild(entry);
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

  _shakeSac() {
    const btn = document.getElementById('btn-sac');
    if (!btn) return;
    btn.classList.remove('btn-sac--pulse');
    btn.classList.remove('btn-sac--shaking');
    void btn.offsetWidth;
    btn.classList.add('btn-sac--shaking');
    btn.addEventListener('animationend', () => {
      btn.classList.remove('btn-sac--shaking');
    }, { once: true });
  }

  _setControlsEnabled(enabled) {
    ['btn-validate','btn-sac','btn-exchange','btn-pass'].forEach(id => {
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

  _showTurnOverlay(playerName) {
    const overlay = document.getElementById('turn-overlay');
    if (!overlay) return;

    // Move overlay inside board-frame if not already there
    const boardFrame = document.querySelector('.board-frame');
    if (boardFrame && overlay.parentNode !== boardFrame) {
      boardFrame.appendChild(overlay);
    }

    const nameEl = overlay.querySelector('.turn-overlay__name');
    if (nameEl) nameEl.textContent = playerName;

    overlay.classList.remove('turn-overlay--active');
    void overlay.offsetWidth; // force reflow
    overlay.classList.add('turn-overlay--active');

    overlay.addEventListener('animationend', () => {
      overlay.classList.remove('turn-overlay--active');
    }, { once: true });
  }

  /* ================================================================== */
  /* CADRE DE PIOCHE (rack workspace)                                    */
  /* ================================================================== */

  /** Retourne la taille d'une cellule du plateau (px dans l'espace canvas) */
  _getCellSize() {
    const cell = this._els.board?.querySelector('.board__cell');
    return cell ? cell.offsetWidth : 65;
  }

  /** Calcule la taille des tuiles pour que les 8 colonnes tiennent dans wsW. */
  _computeTileSize(wsW) {
    const COLS = 8, GAP = 8, PAD_X = 14, BDR = 3;
    const max = Math.floor((wsW - 2 * (BDR + PAD_X) - (COLS - 1) * GAP) / COLS);
    return Math.max(24, Math.min(max, 52)); // entre 24 px et 52 px
  }

  _computeRackSlotPositions(tileSize, wsW, wsH) {
    const COLS = 8, ROWS = 2, GAP = 8, PAD_X = 14, PAD_Y = 14, BDR = 3;
    const innerW = COLS * tileSize + (COLS - 1) * GAP;
    const innerH = ROWS * tileSize + (ROWS - 1) * GAP;
    const rackW  = 2 * (BDR + PAD_X) + innerW;
    const rackH  = 2 * (BDR + PAD_Y) + innerH;
    // Centrer le rack entre le début du workspace et le bord du plateau (déborde à droite)
    const boardFrame = document.querySelector('.board-frame');
    let availW = wsW;
    if (boardFrame) {
      const wsEl = document.getElementById('workspace');
      if (wsEl) {
        const wsRect = wsEl.getBoundingClientRect();
        const bfRect = boardFrame.getBoundingClientRect();
        const { sx } = (() => {
          const canvas = document.getElementById('app-canvas');
          if (!canvas) return { sx: 1 };
          const r = canvas.getBoundingClientRect();
          return { sx: r.width / 1920 };
        })();
        availW = (bfRect.left - wsRect.left) / sx;
      }
    }
    const rackLeft = Math.round((availW - rackW) / 2) + 5;
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

  /**
   * Décale les tuiles pour faire de la place à `targetSlot`.
   * Retourne le slot final où la tuile draggée sera posée.
   * @param {number} targetSlot  - slot cible (occupé par une autre tuile)
   * @param {string} draggingId  - id de la tuile en cours de drag (à exclure)
   * @param {Array}  slots       - tableau des positions {x, y} de chaque slot
   * @returns {number}           - slot effectivement utilisé
   */
  _shiftSlots(targetSlot, draggingId, slots) {
    const COLS  = 8;
    const TOTAL = slots.length;

    // Construire slotIdx → tileId (sans la tuile draggée)
    const slotToTile = new Map();
    for (const [id, si] of this._tileSlotIdx.entries()) {
      if (id !== draggingId) slotToTile.set(si, id);
    }

    if (!slotToTile.has(targetSlot)) return targetSlot; // déjà libre

    // Limites de la ligne courante
    const row      = Math.floor(targetSlot / COLS);
    const rowStart = row * COLS;
    const rowEnd   = rowStart + COLS - 1;

    // Slot libre le plus proche à gauche dans la même ligne
    let leftFree = -1;
    for (let i = targetSlot - 1; i >= rowStart; i--) {
      if (!slotToTile.has(i)) { leftFree = i; break; }
    }
    // Slot libre le plus proche à droite dans la même ligne
    let rightFree = -1;
    for (let i = targetSlot + 1; i <= rowEnd; i++) {
      if (!slotToTile.has(i)) { rightFree = i; break; }
    }

    // Aucune place dans cette ligne → chercher n'importe où
    if (leftFree === -1 && rightFree === -1) {
      for (let i = 0; i < TOTAL; i++) {
        if (!slotToTile.has(i)) return i;
      }
      return targetSlot;
    }

    // Choisir le sens qui nécessite le moins de décalages
    let shiftLeft;
    if      (leftFree  === -1) shiftLeft = false; // obligé d'aller à droite
    else if (rightFree === -1) shiftLeft = true;  // obligé d'aller à gauche
    else shiftLeft = (targetSlot - leftFree) <= (rightFree - targetSlot);

    if (shiftLeft) {
      // Décaler vers la gauche : chaque tuile de leftFree+1 → targetSlot recule d'un cran
      for (let i = leftFree; i < targetSlot; i++) {
        const tid = slotToTile.get(i + 1);
        if (!tid) continue;
        this._tileSlotIdx.set(tid, i);
        this._workspacePositions.set(tid, slots[i]);
        const tel = this._workspaceEls.get(tid);
        if (tel) {
          tel.style.transition = 'left 180ms ease, top 180ms ease';
          tel.style.left = slots[i].x + 'px';
          tel.style.top  = slots[i].y + 'px';
          setTimeout(() => { if (tel) tel.style.transition = ''; }, 200);
        }
      }
    } else {
      // Décaler vers la droite : chaque tuile de targetSlot → rightFree-1 avance d'un cran
      for (let i = rightFree; i > targetSlot; i--) {
        const tid = slotToTile.get(i - 1);
        if (!tid) continue;
        this._tileSlotIdx.set(tid, i);
        this._workspacePositions.set(tid, slots[i]);
        const tel = this._workspaceEls.get(tid);
        if (tel) {
          tel.style.transition = 'left 180ms ease, top 180ms ease';
          tel.style.left = slots[i].x + 'px';
          tel.style.top  = slots[i].y + 'px';
          setTimeout(() => { if (tel) tel.style.transition = ''; }, 200);
        }
      }
    }

    return targetSlot;
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
      for (let i = 0; i < 16; i++) {
        const slot = document.createElement('div');
        slot.className = 'tile-rack__slot';
        slot.dataset.slotIdx = i;
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
    // Propager sur le workspace pour que les tuiles s'y adaptent via CSS
    ws.style.setProperty('--rack-tile-sz', tileSize + 'px');
  }
}
