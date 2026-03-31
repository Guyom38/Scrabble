/**
 * game-engine.js — Machine d'états principale du jeu
 *
 * Coordonne le plateau, les joueurs, le sac, le score et les IA.
 * Communique avec l'UI via des CustomEvents émis sur `document`.
 */

import { Board }    from './board.js';
import { TileBag }  from './tile-bag.js';
import { Player }   from './player.js';
import { Scorer }   from './scorer.js';
import { dictionary }  from './dictionary.js';
import {
  GAME_STATES, PLAYER_TYPES, AI_LEVELS, AI_DEFAULT_NAMES,
  RACK_SIZE, MAX_CONSECUTIVE_PASSES, CENTER,
} from './constants.js';
import { AIEasy }   from '../ai/ai-easy.js';
import { AIMedium } from '../ai/ai-medium.js';
import { AIHard }   from '../ai/ai-hard.js';
import { SaveManager } from '../storage/save-manager.js';

/* ---------- Helpers d'événements ---------- */
const emit = (name, detail = {}) =>
  document.dispatchEvent(new CustomEvent(`game:${name}`, { detail }));

export class GameEngine {
  constructor() {
    this.state    = GAME_STATES.LOADING;
    this.board    = new Board();
    this.bag      = new TileBag();
    this.scorer   = new Scorer();
    /** @type {Player[]} */
    this.players  = [];
    this.turnIndex = 0;
    this.turnNumber = 0;
    this.isFirstTurn = true;
    this._aiTimer  = null;
  }

  /* ================================================================== */
  /* INITIALISATION                                                       */
  /* ================================================================== */

  /**
   * Démarre une nouvelle partie.
   * @param {{ playerName:string, aiCount:number, aiLevels:string[] }} config
   */
  newGame(config) {
    this.board       = new Board();
    this.bag         = new TileBag();
    this.scorer      = new Scorer();
    this.players     = [];
    this.turnIndex   = 0;
    this.turnNumber  = 0;
    this.isFirstTurn = true;

    if (config.players) {
      // Nouveau format : tableau de joueurs
      config.players.forEach((p, i) => {
        this.players.push(new Player({
          id: `p${i}`, name: p.name, type: p.type,
          aiLevel: p.aiLevel || AI_LEVELS.MEDIUM, colorIndex: i,
        }));
      });
    } else {
      // Ancien format (rétro-compatibilité)
      const { playerName, aiCount, aiLevels } = config;
      this.players.push(new Player({
        id: 'p0', name: playerName || 'Joueur', type: PLAYER_TYPES.HUMAN, colorIndex: 0,
      }));
      for (let i = 0; i < aiCount; i++) {
        this.players.push(new Player({
          id: `ai${i}`, name: AI_DEFAULT_NAMES[i], type: PLAYER_TYPES.AI,
          aiLevel: aiLevels[i] || AI_LEVELS.MEDIUM, colorIndex: i + 1,
        }));
      }
    }

    // Distribution initiale
    for (const p of this.players) {
      p.addToRack(this.bag.draw(RACK_SIZE));
    }

    this._setState(GAME_STATES.PLAYING);
    emit('started', { players: this._serializePlayers() });
    emit('boardUpdate', { board: this.board.serialize() });
    emit('tilesRemaining', { count: this.bag.remaining });
    this._startTurn();
  }

  /**
   * Reprend une partie sauvegardée.
   */
  resumeGame() {
    const save = SaveManager.load();
    if (!save) return false;
    this._restoreFromSave(save);
    this._setState(GAME_STATES.PLAYING);
    emit('started', { players: this._serializePlayers(), resumed: true });
    emit('boardUpdate', { board: this.board.serialize() });
    emit('tilesRemaining', { count: this.bag.remaining });
    this._startTurn();
    return true;
  }

  /* ================================================================== */
  /* ACTIONS JOUEUR HUMAIN                                                */
  /* ================================================================== */

  /**
   * Soumet un coup.
   * @param {import('./board.js').TempPlacement[]} placements
   */
  submitMove(placements) {
    if (!this._isHumanTurn()) return;

    const validation = this.board.validatePlacements(placements, this.isFirstTurn);
    if (!validation.valid) {
      emit('moveInvalid', { reason: validation.error });
      return;
    }

    const words = this.board.getWordsFormed(placements);

    // Vérifier qu'au moins un mot est formé
    if (words.length === 0) {
      emit('moveInvalid', { reason: 'Aucun mot valide formé (minimum 2 lettres).' });
      return;
    }

    // Valider tous les mots dans le dictionnaire
    for (const { cells } of words) {
      const word = cells.map(c => c.tile.letter).join('');
      if (!dictionary.isValid(word)) {
        emit('moveInvalid', { reason: `"${word}" n'est pas dans le dictionnaire.` });
        return;
      }
    }

    this._applyMove(placements, words);
  }

  /** Passe le tour. */
  passTurn() {
    if (!this._isHumanTurn()) return;
    const player = this._currentPlayer();
    player.incrementPass();
    emit('message', { text: `${player.name} passe son tour.`, type: 'info' });
    this._checkEndByPasses();
    if (this.state !== GAME_STATES.GAME_OVER) this._nextTurn();
  }

  /**
   * Échange des tuiles.
   * @param {string[]} tileIds
   */
  exchangeTiles(tileIds) {
    if (!this._isHumanTurn()) return;
    if (!this.bag.canExchange) {
      emit('message', { text: 'Pas assez de tuiles dans le sac pour échanger.', type: 'error' });
      return;
    }
    const player = this._currentPlayer();
    const tiles  = player.removeFromRackByIds(tileIds);
    const newTiles = this.bag.exchange(tiles);
    player.addToRack(newTiles);
    player.incrementPass();
    emit('rackUpdate', { playerId: player.id, rack: player.rack });
    emit('tilesRemaining', { count: this.bag.remaining });
    emit('message', { text: `${player.name} échange ${tileIds.length} tuile(s).`, type: 'info' });
    this._checkEndByPasses();
    if (this.state !== GAME_STATES.GAME_OVER) this._nextTurn();
  }

  /** Mélange le chevalet du joueur humain. */
  shuffleRack() {
    if (!this._isHumanTurn()) return;
    this._currentPlayer().shuffleRack();
    const p = this._currentPlayer();
    emit('rackUpdate', { playerId: p.id, rack: p.rack });
  }

  /* ================================================================== */
  /* MÉCANIQUE INTERNE                                                    */
  /* ================================================================== */

  _applyMove(placements, words) {
    // Verrouiller les tuiles sur le plateau
    const player = this._currentPlayer();
    placements.forEach(p => {
      this.board.placeTile(p.x, p.y, {
        id: p.id, letter: p.letter, value: p.value, isBlank: p.isBlank,
      });
      // Retirer du chevalet
      player.removeFromRackByIds([p.id]);
    });

    const { total, wordScores, scrabble } = this.scorer.scoreMove(words, placements);
    const mainWord = wordScores[0]?.word ?? '';
    player.addScore(total, mainWord, this.turnNumber);

    this.isFirstTurn = false;

    // Piocher
    const drawn = this.bag.draw(RACK_SIZE - player.rackSize);
    player.addToRack(drawn);

    emit('moveValid', {
      playerId: player.id, placements,
      wordScores, total, scrabble, mainWord,
    });
    emit('boardUpdate', { board: this.board.serialize() });
    emit('rackUpdate',  { playerId: player.id, rack: player.rack });
    emit('scoresUpdate', { players: this._serializePlayers() });
    emit('tilesRemaining', { count: this.bag.remaining });

    if (scrabble) {
      emit('message', { text: 'SCRABBLE ! +50 points !', type: 'scrabble' });
    } else if (wordScores.length > 1) {
      emit('message', {
        text: `${mainWord} — ${total} pts (${wordScores.length} mots)`, type: 'success',
      });
    } else {
      emit('message', { text: `${mainWord} — ${total} pts`, type: 'success' });
    }

    // Fin de partie si le joueur a vidé son chevalet et le sac est vide
    if (player.rackSize === 0 && this.bag.isEmpty) {
      this._endGame(player);
      return;
    }

    this._nextTurn();
  }

  _startTurn() {
    const player = this._currentPlayer();
    emit('turnStart', {
      playerId: player.id,
      playerName: player.name,
      turnIndex: this.turnIndex,
      isHuman: player.isHuman,
    });

    if (player.isAI) {
      this._setState(GAME_STATES.AI_THINKING);
      this._scheduleAIMove(player);
    } else {
      this._setState(GAME_STATES.PLAYING);
    }
  }

  _nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.turnNumber++;
    SaveManager.save(this._buildSave());
    this._startTurn();
  }

  _scheduleAIMove(player) {
    const delays = { easy: [800, 1600], medium: [1200, 2400], hard: [1800, 3000] };
    const [min, max] = delays[player.aiLevel] || [1200, 2400];
    const delay = 1000 + min + Math.random() * (max - min); // +1s pour laisser la définition s'afficher

    this._aiTimer = setTimeout(() => this._executeAIMove(player), delay);
  }

  _executeAIMove(player) {
    const ai = this._getAIAgent(player.aiLevel);
    const move = ai.chooseMove(this.board, player.rack, dictionary);

    if (!move) {
      // L'IA passe ou échange
      if (this.bag.canExchange && player.rackSize > 0) {
        // Échange de tuiles peu utiles
        const toExchange = ai.chooseTilesToExchange(player.rack);
        if (toExchange.length > 0) {
          const tiles  = player.removeFromRackByIds(toExchange.map(t => t.id));
          const newOnes = this.bag.exchange(tiles);
          player.addToRack(newOnes);
          player.incrementPass();
          emit('rackUpdate', { playerId: player.id, rack: player.rack });
          emit('tilesRemaining', { count: this.bag.remaining });
          emit('message', { text: `${player.name} échange des tuiles.`, type: 'info' });
        } else {
          this._aiPass(player);
        }
      } else {
        this._aiPass(player);
      }
      this._checkEndByPasses();
      if (this.state !== GAME_STATES.GAME_OVER) this._nextTurn();
      return;
    }

    // Construire les placements
    const placements = move.placements.map(p => ({
      x: p.x, y: p.y,
      id: p.tileId,
      letter: p.letter,
      value: player.rack.find(t => t.id === p.tileId)?.value ?? 0,
      isBlank: p.isBlank,
    }));

    const words = this.board.getWordsFormed(placements);
    this._applyMove(placements, words);
  }

  _aiPass(player) {
    player.incrementPass();
    emit('message', { text: `${player.name} passe son tour.`, type: 'info' });
  }

  _getAIAgent(level) {
    switch (level) {
      case AI_LEVELS.EASY:   return new AIEasy();
      case AI_LEVELS.HARD:   return new AIHard();
      default:               return new AIMedium();
    }
  }

  _checkEndByPasses() {
    const totalPasses = this.players.reduce((sum, p) => sum + p.consecutivePasses, 0);
    if (totalPasses >= MAX_CONSECUTIVE_PASSES) {
      this._endGame(null);
    }
  }

  _endGame(playerWentOut) {
    clearTimeout(this._aiTimer);

    // Calculer pénalités et bonus
    let bonus = 0;
    for (const p of this.players) {
      if (p === playerWentOut) continue;
      const penalty = this.scorer.rackPenalty(p.rack);
      p.score = Math.max(0, p.score - penalty);
      bonus  += penalty;
    }
    if (playerWentOut) {
      playerWentOut.score += bonus;
    }

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this._setState(GAME_STATES.GAME_OVER);
    SaveManager.deleteSave();
    emit('gameOver', { players: this._serializePlayers(), sorted: sorted.map(p => p.serialize()) });
  }

  /* ================================================================== */
  /* ÉTAT & SÉRIALISATION                                                 */
  /* ================================================================== */

  _setState(s) {
    this.state = s;
    emit('stateChange', { state: s });
  }

  _isHumanTurn() {
    return this.state === GAME_STATES.PLAYING && this._currentPlayer().isHuman;
  }

  _currentPlayer() {
    return this.players[this.turnIndex];
  }

  _serializePlayers() {
    return this.players.map(p => p.serialize());
  }

  _buildSave() {
    return {
      board:       this.board.serialize(),
      bag:         this.bag.serialize(),
      players:     this._serializePlayers(),
      turnIndex:   this.turnIndex,
      turnNumber:  this.turnNumber,
      isFirstTurn: this.isFirstTurn,
    };
  }

  _restoreFromSave(save) {
    this.board       = Board.deserialize(save.board);
    this.bag         = TileBag.deserialize(save.bag);
    this.players     = save.players.map(p => Player.deserialize(p));
    this.turnIndex   = save.turnIndex;
    this.turnNumber  = save.turnNumber;
    this.isFirstTurn = save.isFirstTurn;
  }
}
