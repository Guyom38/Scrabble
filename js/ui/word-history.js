/**
 * word-history.js — Historique des mots joués dans la colonne workspace
 *
 * Bulles empilées depuis le haut-droit de la colonne workspace.
 * Persistance via localStorage : résiste au F5.
 * Clic sur une bulle → affiche la définition du mot.
 */

import { wordInfoService } from '../core/word-info.js';
import { showWordCard } from './word-card.js';

const CONTAINER_ID   = 'word-history';
const STORAGE_KEY    = 'scrabble_word_history';
const MAX_ENTRIES    = 40;

/** @type {Array<{word:string, score:number, playerName:string, color:string}>} */
let _entries = [];

/* ── Persistance ─────────────────────────────────────────────────── */

function _save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_entries)); } catch {}
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _entries = JSON.parse(raw);
  } catch { _entries = []; }
}

/* ── DOM ─────────────────────────────────────────────────────────── */

function _getContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    const ws = document.getElementById('workspace');
    if (!ws) return null;
    c = document.createElement('div');
    c.id        = CONTAINER_ID;
    c.className = 'word-history';
    ws.appendChild(c);
  }
  return c;
}

/* ── Clic → définition ───────────────────────────────────────────── */

function _onBubbleClick(word) {
  wordInfoService.getAsync(word).then(info => {
    if (info && (info.description || info.definition)) {
      showWordCard(word, info);
    }
  }).catch(() => {});
}

/* ── Rendu ───────────────────────────────────────────────────────── */

function _render(animateLast = false) {
  const c = _getContainer();
  if (!c) return;
  c.innerHTML = '';

  for (let i = 0; i < _entries.length; i++) {
    const { word, score, playerName, color } = _entries[i];
    const isLast = i === _entries.length - 1;

    const item = document.createElement('div');
    item.className = 'word-history__item' + (isLast && animateLast ? ' word-history__item--new' : '');

    const bubble = document.createElement('div');
    bubble.className = 'word-history__bubble';
    bubble.title     = `${playerName} — cliquez pour la définition`;
    bubble.style.cursor = 'pointer';
    bubble.innerHTML = `
      <span class="word-history__dot" style="background:${color};box-shadow:0 0 4px ${color}"></span>
      <span class="word-history__word">${word}</span>
      <span class="word-history__score" style="color:${color}">+${score}</span>`;

    bubble.addEventListener('click', () => _onBubbleClick(word));

    item.appendChild(bubble);
    c.appendChild(item);
  }
}

/* ── API publique ────────────────────────────────────────────────── */

/**
 * Ajoute une entrée.
 * @param {{ word:string, score:number, playerName:string, color:string }} entry
 */
export function addWordHistory(entry) {
  _entries.push(entry);
  if (_entries.length > MAX_ENTRIES) _entries.shift();
  _save();
  _render(true);
}

/** Efface l'historique (nouvelle partie). */
export function clearWordHistory() {
  _entries = [];
  _save();
  const c = document.getElementById(CONTAINER_ID);
  if (c) c.innerHTML = '';
}

/** Restaure depuis localStorage (appeler au boot ou après F5). */
export function restoreWordHistory() {
  _load();
  if (_entries.length > 0) _render(false);
}
