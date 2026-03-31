/**
 * drag-drop.js — Gestion du glisser-déposer des tuiles
 *
 * Gère :
 *   - Drag du rack vers le plateau
 *   - Drag du plateau vers le plateau (repositionnement)
 *   - Drag du plateau vers le rack (rappel)
 *   - Réorganisation dans le rack
 *   - Support tactile (touch events)
 */

export class DragDropManager {
  /**
   * @param {{
   *   onRackToBoard: function,
   *   onBoardToBoard: function,
   *   onBoardToRack:  function,
   *   onRackReorder:  function,
   * }} handlers
   */
  constructor(handlers) {
    this._handlers = handlers;
    this._dragging = null; // { source, index|coords, tileId, letter, value, isBlank }
    this._touchEl  = null;
    this._touchOffset = { x: 0, y: 0 };
    this._ghost    = null;
  }

  /* ================================================================== */
  /* DRAG & DROP HTML5                                                    */
  /* ================================================================== */

  /** Attache les listeners drag sur une tuile du rack. */
  attachRackTile(tileEl, rackIndex, tileData) {
    tileEl.draggable = true;

    tileEl.addEventListener('dragstart', (e) => {
      this._dragging = { source: 'rack', index: rackIndex, ...tileData };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(this._dragging));
      tileEl.classList.add('tile--dragging');
      // Masquer le fantôme natif (on crée le nôtre)
      const img = document.createElement('div');
      img.style.display = 'none';
      document.body.appendChild(img);
      e.dataTransfer.setDragImage(img, 0, 0);
      document.body.removeChild(img);
    });

    tileEl.addEventListener('dragend', () => {
      tileEl.classList.remove('tile--dragging');
      this._dragging = null;
    });

    this._attachTouchDrag(tileEl, () => ({ source: 'rack', index: rackIndex, ...tileData }));
  }

  /** Attache les listeners drag sur une tuile temporaire du plateau. */
  attachBoardTile(tileEl, x, y, tileData) {
    tileEl.draggable = true;

    tileEl.addEventListener('dragstart', (e) => {
      this._dragging = { source: 'board', x, y, ...tileData };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(this._dragging));
      tileEl.classList.add('tile--dragging');
    });

    tileEl.addEventListener('dragend', () => {
      tileEl.classList.remove('tile--dragging');
      this._dragging = null;
    });

    // Double-clic pour rappel rapide
    tileEl.addEventListener('dblclick', () => {
      this._handlers.onBoardToRack?.({ x, y, ...tileData });
    });

    this._attachTouchDrag(tileEl, () => ({ source: 'board', x, y, ...tileData }));
  }

  /** Attache les listeners drop sur une case du plateau. */
  attachBoardCell(cellEl, x, y) {
    cellEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cellEl.classList.add('drag-over');
    });

    cellEl.addEventListener('dragleave', () => {
      cellEl.classList.remove('drag-over');
    });

    cellEl.addEventListener('drop', (e) => {
      e.preventDefault();
      cellEl.classList.remove('drag-over');
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      if (data.source === 'rack') {
        this._handlers.onRackToBoard?.({ ...data, targetX: x, targetY: y });
      } else if (data.source === 'board') {
        if (data.x !== x || data.y !== y) {
          this._handlers.onBoardToBoard?.({ ...data, targetX: x, targetY: y });
        }
      }
    });

    // Clic simple sur la case (placement rapide si tuile sélectionnée)
    cellEl.addEventListener('click', () => {
      this._handlers.onCellClick?.({ x, y });
    });
  }

  /** Attache les listeners drop sur un slot du rack. */
  attachRackSlot(slotEl, slotIndex) {
    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      slotEl.classList.add('drag-over');
    });

    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('drag-over');
    });

    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      if (data.source === 'board') {
        this._handlers.onBoardToRack?.({ ...data, targetSlot: slotIndex });
      } else if (data.source === 'rack' && data.index !== slotIndex) {
        this._handlers.onRackReorder?.({ fromIndex: data.index, toIndex: slotIndex });
      }
    });
  }

  /* ================================================================== */
  /* SUPPORT TACTILE                                                      */
  /* ================================================================== */

  _attachTouchDrag(el, getData) {
    let startX, startY, ghost;

    el.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const data = getData();

      // Créer le fantôme
      ghost = el.cloneNode(true);
      ghost.style.cssText = `
        position: absolute; pointer-events: none; z-index: 9999;
        opacity: 0.9; transform: scale(1.15) rotate(2deg);
        left: ${touch.clientX}px; top: ${touch.clientY}px;
        transition: none;
      `;
      (document.getElementById('app-canvas') || document.body).appendChild(ghost);
      this._touchEl   = el;
      this._ghostData = data;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (ghost) {
        ghost.style.left = `${touch.clientX - 20}px`;
        ghost.style.top  = `${touch.clientY - 30}px`;
      }

      // Highlight la case sous le doigt
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell   = target?.closest('.board__cell');
      const slot   = target?.closest('.rack-slot');
      document.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over'));
      if (cell || slot) (cell || slot).classList.add('drag-over');

    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (ghost) { ghost.remove(); ghost = null; }
      document.querySelectorAll('.drag-over').forEach(e => e.classList.remove('drag-over'));

      const touch  = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell   = target?.closest('.board__cell');
      const slot   = target?.closest('.rack-slot');
      const data   = this._ghostData;
      if (!data) return;

      if (cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        if (data.source === 'rack') {
          this._handlers.onRackToBoard?.({ ...data, targetX: x, targetY: y });
        } else if (data.source === 'board' && (data.x !== x || data.y !== y)) {
          this._handlers.onBoardToBoard?.({ ...data, targetX: x, targetY: y });
        }
      } else if (slot) {
        const slotIndex = parseInt(slot.dataset.slot);
        if (data.source === 'board') {
          this._handlers.onBoardToRack?.({ ...data, targetSlot: slotIndex });
        } else if (data.source === 'rack' && data.index !== slotIndex) {
          this._handlers.onRackReorder?.({ fromIndex: data.index, toIndex: slotIndex });
        }
      }

      this._ghostData = null;
      this._touchEl   = null;
    });
  }
}
