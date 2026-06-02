/* UI Manager - singleton */
const UI = {
  game: null,
  selectedCards: [],
  hintCards: [],
  _selectedIds: new Set(),

  init(game) {
    this.game = game;
    game.onUpdate = () => this.render();

    /* Setup option buttons */
    document.querySelectorAll('#player-count-options .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#player-count-options .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.querySelectorAll('#ai-difficulty-options .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ai-difficulty-options .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  showMenu() {
    if (this.game.aiTimer) { clearTimeout(this.game.aiTimer); this.game.aiTimer = null; }
    this.game.state = 'menu';
    this.selectedCards = [];
    this._selectedIds.clear();
    this.showScreen('screen-menu');
  },

  showSetup() {
    this.showScreen('screen-setup');
  },

  quickRestart() {
    this._selectedIds.clear();
    this.hintCards = [];
    this.game.quickRestart();
  },

  startGame() {
    const pcBtn = document.querySelector('#player-count-options .option-btn.active');
    const diffBtn = document.querySelector('#ai-difficulty-options .option-btn.active');
    const playerCount = parseInt(pcBtn ? pcBtn.dataset.value : '4');
    const difficulty = diffBtn ? diffBtn.dataset.value : 'normal';
    this.game.init(playerCount, difficulty);
    this.renderDiceScreen();
  },

  /* Dice screen */
  renderDiceScreen() {
    this.showScreen('screen-dice');
    const container = document.getElementById('dice-players');
    container.innerHTML = '';
    const names = ['\u4f60','\u670b\u53cb\u7532','\u670b\u53cb\u4e19','\u670b\u53cb\u4e01','\u670b\u53cb\u620a'];
    for (let i = 0; i < this.game.playerCount; i++) {
      const div = document.createElement('div');
      div.className = 'dice-player';
      div.id = `dice-p${i}`;
      div.innerHTML = `<div class="name">${names[i] || '?'}</div><div class="dice">?</div>`;
      container.appendChild(div);
    }
    const rollBtn = document.getElementById('dice-roll-btn');
    rollBtn.style.display = 'block';
    rollBtn.disabled = false;
    rollBtn.textContent = '\u6447\u9ab0\u5b50';
    document.getElementById('dice-result-msg').textContent = '';
  },

  rollDice() {
    const btn = document.getElementById('dice-roll-btn');
    btn.disabled = true;
    btn.textContent = '\u6447\u52a8\u4e2d...';

    /* Rolling animation */
    const diceEls = document.querySelectorAll('.dice-player .dice');
    document.querySelectorAll('.dice-player').forEach(el => el.classList.add('dice-rolling'));

    const interval = setInterval(() => {
      diceEls.forEach(el => { el.textContent = Math.floor(Math.random() * 6) + 1; });
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      document.querySelectorAll('.dice-player').forEach(el => el.classList.remove('dice-rolling'));
      const result = this.game.rollDice();
      const results = result.results;

      diceEls.forEach((el, i) => { el.textContent = results[i]; });

      document.querySelectorAll('.dice-player').forEach(el => el.classList.remove('dealer'));
      const dealerEl = document.getElementById(`dice-p${result.dealerIndex}`);
      if (dealerEl) dealerEl.classList.add('dealer');

      btn.style.display = 'none';
      const msg = document.getElementById('dice-result-msg');
      msg.textContent = `${this.game.players[result.dealerIndex].name} \u5f53\u9009\u4e3a\u5e84\u5bb6!`;

      setTimeout(() => {
        this.game.startFromDice();
      }, 1200);
    }, 1200);
  },

  /* Main render */
  render() {
    if (this.game.state === 'playing' || this.game.state === 'result') {
      this.showScreen('screen-game');
      this.renderGame();
    }
  },

  renderGame() {
    const g = this.game;
    document.getElementById('game-info').textContent = `\u56de\u5408 ${g.roundNumber}`;
    document.getElementById('deck-count').textContent = `\u5e95\u724c ${g.remainingDeck.length}`;

    this.renderAIPlayers();
    this.renderPlayArea();
    this.renderHumanHand();
    this.renderActions();
    this.renderMessage();
  },

  renderAIPlayers() {
    const area = document.getElementById('ai-area');
    area.innerHTML = '';
    for (let i = 1; i < this.game.players.length; i++) {
      const p = this.game.players[i];
      const div = document.createElement('div');
      div.className = `ai-player${this.game.currentPlayerIndex === i ? ' active' : ''}`;
      const backs = Array.from({length: Math.min(p.hand.length, 12)}, () => '<span class="card-back"></span>').join('');
      div.innerHTML = `<div class="name">${p.name}</div><div class="back-cards">${backs}</div><div class="count">${p.hand.length} \u5f20</div>`;
      area.appendChild(div);
    }
  },

  renderPlayArea() {
    const cardsEl = document.getElementById('play-cards');
    const statusEl = document.getElementById('play-status');

    if (!this.game.lastPlay) {
      cardsEl.innerHTML = '<div style="color:#666;font-size:14px">\u2191 \u65b0\u8f6e\u6b21\uff0c\u968f\u610f\u51fa\u724c</div>';
      statusEl.textContent = '';
      return;
    }

    const play = this.game.lastPlay.play;
    cardsEl.innerHTML = play.cards.map(c => this.createCardHTML(c, 'card-played')).join('');
    const player = this.game.players[this.game.lastPlay.playerIndex];
    const typeNames = {single:'\u5355\u5f20',pair:'\u5bf9\u5b50',straight:'\u987a\u5b50',consecutivePairs:'\u8fde\u5bf9',bomb:'\u70b8\u5f39',jokerBomb:'\u738b\u70b8'};
    statusEl.textContent = `${player.name} - ${typeNames[play.type]||''}`;
  },

  renderHumanHand() {
    const area = document.getElementById('human-cards');
    area.innerHTML = '';
    const p = this.game.players[0];
    if (!p) return;

    const isMyTurn = this.game.waitingForHuman && this.game.currentPlayerIndex === 0;
    const sorted = sortCards(p.hand);

    sorted.forEach(c => {
      const div = document.createElement('div');
      const isSelected = this._selectedIds.has(c.id);
      const isHint = this.hintCards.some(hc => hc.id === c.id);
      div.className = `card${isSelected ? ' selected' : ''}${isHint ? ' hint-card' : ''}${c.isWild ? ' wild' : ''}`;
      if (c.suitColor === 'red') div.classList.add('red');
      else div.classList.add('black');

      div.innerHTML = `<span class="rank">${c.displayRank}</span><span class="suit">${c.suitSymbol}</span>`;

      if (isMyTurn) {
        div.addEventListener('click', () => this.toggleCard(c));
      } else {
        div.style.cursor = 'default';
        div.style.opacity = '0.6';
      }

      area.appendChild(div);
    });
  },

  renderActions() {
    const isMyTurn = this.game.waitingForHuman && this.game.currentPlayerIndex === 0;
    const btnPlay = document.getElementById('btn-play');
    const btnPass = document.getElementById('btn-pass');
    const btnHint = document.getElementById('btn-hint');

    btnPlay.disabled = !isMyTurn || this._selectedIds.size === 0;
    btnPass.disabled = !isMyTurn;
    btnHint.style.display = isMyTurn ? 'inline-block' : 'none';

    if (!isMyTurn) {
      btnPlay.textContent = '\u51fa\u724c';
      btnPass.textContent = '\u8fc7\u724c';
    }
  },

  renderMessage() {
    const bar = document.getElementById('message-bar');
    const msgs = this.game.messages;
    if (msgs.length === 0) { bar.textContent = ''; return; }
    bar.textContent = msgs[msgs.length - 1];
  },

  createCardHTML(c, extraClass = '') {
    const colorClass = c.suitColor === 'red' ? 'red' : 'black';
    const wildClass = c.isWild ? ' wild' : '';
    return `<div class="card ${extraClass} ${colorClass}${wildClass}"><span class="rank">${c.displayRank}</span><span class="suit">${c.suitSymbol}</span></div>`;
  },

  /* Card selection */
  toggleCard(c) {
    if (this._selectedIds.has(c.id)) {
      this._selectedIds.delete(c.id);
    } else {
      this._selectedIds.add(c.id);
    }
    this.hintCards = [];
    this.renderHumanHand();
    this.renderActions();
  },

  clearSelection() {
    this._selectedIds.clear();
    this.hintCards = [];
  },

  /* Actions */
  playSelected() {
    if (this._selectedIds.size === 0) return;
    const p = this.game.players[0];
    const selected = p.hand.filter(c => this._selectedIds.has(c.id));

    if (selected.length !== this._selectedIds.size) {
      this.clearSelection();
      this.renderHumanHand();
      this.renderActions();
      return;
    }

    const ok = this.game.humanPlay(selected);
    if (ok) {
      this.clearSelection();
    } else {
      this.renderHumanHand();
      this.renderActions();
    }
  },

  pass() {
    this.clearSelection();
    this.game.humanPass();
  },

  showHint() {
    const hint = this.game.getHint();
    if (!hint) {
      const bar = document.getElementById('message-bar');
      bar.textContent = '\u26a0 \u6ca1\u6709\u53ef\u7528\u7684\u51fa\u724c\u7ec4\u5408';
      return;
    }
    this.hintCards = hint.cards;
    this._selectedIds.clear();
    for (const c of hint.cards) this._selectedIds.add(c.id);
    this.renderHumanHand();
    this.renderActions();
  },

  fullRestart() {
    this.selectedCards = [];
    this._selectedIds.clear();
    this.hintCards = [];
    this.game = new Game();
    this.game.onUpdate = () => this.render();
    this.showMenu();
  },

  /* Rules modal */
  showRules() {
    document.getElementById('modal-rules').classList.add('active');
  },

  hideRules() {
    document.getElementById('modal-rules').classList.remove('active');
  }
};

/* Initialize game on load */
function init() {
  const g = new Game();
  UI.init(g);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Result screen / Game over screen */
UI.render = function() {
  if (this.game.state === 'gameOver') {
    this.showScreen('screen-gameover');
    const result = this.game.calculateScores();
    const detail = document.getElementById('gameover-detail');
    detail.innerHTML = '';
    const sorted = result.loserScores.map(s => ({...s, cumulative: this.game.cumulativeScores[s.index]}));
    sorted.sort((a, b) => a.cumulative - b.cumulative);
    for (const s of sorted) {
      const div = document.createElement('div');
      div.className = 'score-row';
      div.innerHTML = `<span class="name">${s.name}</span><span class="score">${s.cumulative}\u5206 (-\u2060${s.score})</span>`;
      if (s.cumulative <= 0) div.style.color = '#ff4757';
      if (s.isHuman) div.classList.add('winner');
      detail.appendChild(div);
    }
    return;
  }
  if (this.game.state === 'result') {
    this.showScreen('screen-result');
    const result = this.game.calculateScores();
    document.getElementById('result-winner').innerHTML = `\uD83C\uDF89 <strong>${result.winnerName}</strong> \u83B7\u80DC!`;
    const scoresEl = document.getElementById('result-scores');
    scoresEl.innerHTML = `<div class="score-row"><span>\u603B\u70B8\u5F39: ${result.totalBombs}</span></div>`;
    for (const s of result.loserScores) {
      const div = document.createElement('div');
      div.className = 'score-row';
      div.innerHTML = `<span class="name">${s.name} (${s.hand}\u5F20)</span><span class="score">-${s.score}\u5206</span>`;
      if (s.isHuman) div.classList.add('winner');
      scoresEl.appendChild(div);
    }
    const cumuEl = document.createElement('div');
    cumuEl.className = 'score-row';
    cumuEl.style.cssText = 'border-top:1px solid #333;margin-top:6px;padding-top:6px;font-size:13px';
    cumuEl.innerHTML = `<span>\u5269\u4f59\u79ef\u5206</span><span>${result.loserScores.map(s => s.name + ': ' + result.cumulativeScores[s.index]).join(' | ')}</span>`;
    scoresEl.appendChild(cumuEl);
    return;
  }
  if (this.game.state === 'playing') {
    this.showScreen('screen-game');
    this.renderGame();
  }
};
