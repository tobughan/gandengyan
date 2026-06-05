/* Game state machine */

class Game {
  constructor() {
    this.reset();
  }

  reset() {
    if (this.aiTimer) { clearTimeout(this.aiTimer); }
    this.state = 'menu';
    this.lastWinnerIndex = -1;
    this.playerCount = 4;
    this.aiDifficulty = 'normal';
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.lastPlay = null;
    this.roundLeader = -1;
    this.passCount = 0;
    this.remainingDeck = [];
    this.totalBombs = 0;
    this.roundNumber = 0;
    this.waitingForHuman = false;
    this.aiTimer = null;
    this.playerPlayCounts = [];
    this.messages = [];
    this.cumulativeScores = [200, 200, 200, 200, 200];
    /* onUpdate is set by UI.init and must survive reset */
  }

  init(playerCount, difficulty) {
    this.reset();
    this.playerCount = playerCount;
    this.aiDifficulty = difficulty;
    this.state = 'dice';
    this.dealerIndex = -1;
    if (this.onUpdate) this.onUpdate();
  }

  /* ---- Dice phase ---- */
  rollDice() {
    const results = [];
    for (let i = 0; i < this.playerCount; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }
    const maxVal = Math.max(...results);
    /* If tie, re-roll among tied players */
    const tied = results.map((v,i) => v === maxVal ? i : -1).filter(i => i >= 0);
    if (tied.length > 1) {
      /* Simple: pick first tied player as dealer */
      this.dealerIndex = tied[0];
    } else {
      this.dealerIndex = results.indexOf(maxVal);
    }

    this.players = [];
    const humanNames = ['\u4f60'];
    const aiNames = ['\u670b\u53cb\u7532','\u670b\u53cb\u4e19','\u670b\u53cb\u4e01','\u670b\u53cb\u620a'];
    let aiIdx = 0;
    for (let i = 0; i < this.playerCount; i++) {
      const isHuman = i === 0;
      this.players.push({
        name: isHuman ? humanNames[0] : aiNames[aiIdx++],
        hand: [],
        isHuman,
        isDealer: i === this.dealerIndex,
        difficulty: isHuman ? null : this.aiDifficulty,
        diceResult: results[i]
      });
    }

    return {results, dealerIndex: this.dealerIndex};
  }

  startFromDice() {
    this.state = 'playing';
    this.dealCards();
    this.roundNumber = 1;
    this.playerPlayCounts = new Array(this.playerCount).fill(0);

    /* First round: dealer plays first */
    this.currentPlayerIndex = this.dealerIndex;
    this.lastPlay = null;
    this.passCount = 0;
    this.roundLeader = this.dealerIndex;

    this.addMessage(`\u5e84\u5bb6: ${this.players[this.dealerIndex].name} \u5148\u51fa\u724c`);

    if (this.onUpdate) this.onUpdate();
    this.processTurn();
  }

  dealCards() {
    const deck = new Deck();
    deck.shuffle();
    const result = deck.deal(this.playerCount, this.dealerIndex);
    for (let i = 0; i < this.playerCount; i++) {
      this.players[i].hand = result.hands[i];
    }
    this.remainingDeck = result.remaining;
  }

  /* ---- Turn processing ---- */
  processTurn() {
    if (this.state !== 'playing') return;
    if (this.aiTimer) { clearTimeout(this.aiTimer); this.aiTimer = null; }

    const player = this.players[this.currentPlayerIndex];
    this.waitingForHuman = player.isHuman;

    if (this.onUpdate) this.onUpdate();

    if (!player.isHuman) {
      this.aiTimer = setTimeout(() => this.processAITurn(), 600);
    }
  }

  processAITurn() {
    if (this.state !== 'playing') return;
    const player = this.players[this.currentPlayerIndex];
    const ai = createAIPlayer(player.name, player.difficulty);
    const isNewRound = !this.lastPlay;
    const play = ai.choosePlay(player.hand, this.lastPlay, isNewRound);

    if (play) {
      this.executePlay(this.currentPlayerIndex, play);
    } else {
      this.executePass(this.currentPlayerIndex);
    }
  }

  /* ---- Human actions ---- */
  humanPlay(cards) {
    if (!this.waitingForHuman) return false;
    const play = detectPlay(cards);
    if (!play) { this.addMessage('\u267b \u975e\u6cd5\u724c\u578b'); if(this.onUpdate)this.onUpdate(); return false; }

    /* New round - any valid play is fine */
    if (!this.lastPlay) {
      if (twoAsLastCardForbidden(this.players[0].hand, cards)) {
        this.addMessage('\u267b 2\u4e0d\u53ef\u4f5c\u4e3a\u6700\u540e\u4e00\u624b\u724c'); if(this.onUpdate)this.onUpdate(); return false;
      }
      this.executePlay(0, play);
      return true;
    }

    if (!canBeat(play, this.lastPlay.play)) {
      this.addMessage('\u267b \u65e0\u6cd5\u63a5\u724c\uff0c\u9700\u8981\u76f8\u540c\u724c\u578b+\u5927 1 \u70b9'); if(this.onUpdate)this.onUpdate(); return false;
    }

    if (twoAsLastCardForbidden(this.players[0].hand, cards)) {
      this.addMessage('\u267b 2\u4e0d\u53ef\u4f5c\u4e3a\u6700\u540e\u4e00\u624b\u724c'); if(this.onUpdate)this.onUpdate(); return false;
    }

    this.executePlay(0, play);
    return true;
  }

  humanPass() {
    if (!this.waitingForHuman) return;
    this.executePass(0);
  }

  /* ---- Execute actions ---- */
  executePlay(playerIndex, play) {
    const player = this.players[playerIndex];
    const cards = play.cards;

    /* Remove cards from hand */
    for (const c of cards) {
      const idx = player.hand.findIndex(hc => hc.id === c.id);
      if (idx !== -1) player.hand.splice(idx, 1);
    }

    const typeNames = {
      single:'\u5355\u5f20', pair:'\u5bf9\u5b50', straight:'\u987a\u5b50',
      consecutivePairs:'\u8fde\u5bf9', bomb:'\u70b8\u5f39', jokerBomb:'\u738b\u70b8'
    };
    this.addMessage(`${player.name} \u51fa: ${typeNames[play.type]||''} [${cards.map(c=>c.displayName).join(' ')}]`);

    if (player.hand.length === 1) this.addMessage(`\u26a0 ${player.name} \u62a5\u5355\uff01`);

    this.lastPlay = { playerIndex, play };
    this.passCount = 0;
    this.roundLeader = playerIndex;
    this.playerPlayCounts[playerIndex]++;

    if (play.type === 'bomb') this.totalBombs += play.bombLevel;
    else if (play.type === 'jokerBomb') this.totalBombs += play.bombLevel;

    if (this.onUpdate) this.onUpdate();

    /* Check win */
    if (player.hand.length === 0) {
      this.deductRoundScores();
      if (this.cumulativeScores.some(s => s <= 0)) {
        this.state = 'gameOver';
      } else {
        this.state = 'result';
      }
      this.lastWinnerIndex = playerIndex;
      if (this.onUpdate) this.onUpdate();
      return;
    }

    this.nextPlayer();
    this.processTurn();
  }

  executePass(playerIndex) {
    const player = this.players[playerIndex];
    this.addMessage(`${player.name} \u8fc7\u724c`);
    this.passCount++;

    if (this.onUpdate) this.onUpdate();

    if (this.passCount >= this.players.length - 1) {
      this.endRound();
    } else {
      this.nextPlayer();
      this.processTurn();
    }
  }

  endRound() {
    const winner = this.players[this.roundLeader];
    this.addMessage(`--- ${winner.name} \u8d62\u5f97\u6b64\u8f6e ---`);

    /* All players draw 1 card in order starting from round leader */
    if (this.remainingDeck.length > 0) {
      for (let i = 0; i < this.players.length; i++) {
        if (this.remainingDeck.length === 0) break;
        const idx = (this.roundLeader + i) % this.players.length;
        const drawn = this.remainingDeck.pop();
        this.players[idx].hand.push(drawn);
        this.addMessage(`${this.players[idx].name} \u6478\u724c: ${drawn.displayName}`);
      }
    } else {
      this.addMessage('\u5e95\u724c\u5df2\u8017\u5c3d\uff0c\u8fdb\u5165\u786c\u6253\u9636\u6bb5');
    }

    /* Start new round from winner */
    this.currentPlayerIndex = this.roundLeader;
    this.lastPlay = null;
    this.passCount = 0;
    this.roundNumber++;
    this.addMessage(`\u7b2c ${this.roundNumber} \u8f6e \u5f00\u59cb`);

    if (this.onUpdate) this.onUpdate();
    this.processTurn();
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  /* ---- Hint system ---- */
  getHint() {
    if (this.state !== 'playing' || !this.waitingForHuman) return null;
    const human = this.players[0];
    const isNewRound = !this.lastPlay;
    const allPlays = getAllPlays(human.hand);
    let candidates;

    if (isNewRound) {
      candidates = allPlays.filter(p => {
        if (twoAsLastCardForbidden(human.hand, p.cards) && p.cards.length === human.hand.length) return false;
        return true;
      });
    } else {
      candidates = allPlays.filter(p => canBeat(p, this.lastPlay.play));
      candidates = candidates.filter(p => {
        if (twoAsLastCardForbidden(human.hand, p.cards) && p.cards.length === human.hand.length) return false;
        return true;
      });
    }

    if (candidates.length === 0) return null;
    /* Suggest smallest play */
    candidates.sort((a, b) => {
      if (a.type === 'bomb' && b.type !== 'bomb') return 1;
      if (b.type === 'bomb' && a.type !== 'bomb') return -1;
      return a.rank - b.rank;
    });
    return candidates[0];
  }

  /* ---- Scoring ---- */
  calculateScores() {
    const winner = this.players.find(p => p.hand.length === 0);
    const loserScores = [];

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.hand.length === 0) continue;

      let score;
      /* 关状态: dealer只出1次牌 / 闲家一张未出 */
      if (p.isDealer && this.playerPlayCounts[i] <= 1)
        score = 20 + 10 * this.totalBombs;
      else if (!p.isDealer && this.playerPlayCounts[i] === 0)
        score = 20 + 10 * this.totalBombs;
      else
        score = p.hand.length * (1 + this.totalBombs);

      loserScores.push({name: p.name, score, isHuman: p.isHuman, hand: p.hand.length, index: i});
    }

    const winnerName = winner ? winner.name : '';
    return {winnerName, loserScores, totalBombs: this.totalBombs, cumulativeScores: [...this.cumulativeScores]};
  }

  deductRoundScores() {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.hand.length === 0) continue;
      let score;
      if (p.isDealer && this.playerPlayCounts[i] <= 1)
        score = 20 + 10 * this.totalBombs;
      else if (!p.isDealer && this.playerPlayCounts[i] === 0)
        score = 20 + 10 * this.totalBombs;
      else
        score = p.hand.length * (1 + this.totalBombs);
      this.cumulativeScores[i] -= score;
    }
  }

  /* ---- Quick restart (skip setup + dice, previous winner is dealer) ---- */
  quickRestart() {
    if (this.aiTimer) { clearTimeout(this.aiTimer); this.aiTimer = null; }
    const prevPlayerCount = this.playerCount;
    const prevDifficulty = this.aiDifficulty;
    const winnerIdx = this.lastWinnerIndex >= 0 ? this.lastWinnerIndex : 0;

    this.state = 'playing';
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.lastPlay = null;
    this.roundLeader = -1;
    this.passCount = 0;
    this.remainingDeck = [];
    this.totalBombs = 0;
    this.roundNumber = 0;
    this.waitingForHuman = false;
    this.playerPlayCounts = [];
    this.messages = [];

    const aiNames = ['\u670b\u53cb\u7532','\u670b\u53cb\u4e19','\u670b\u53cb\u4e01','\u670b\u53cb\u620a'];
    let aiIdx = 0;
    for (let i = 0; i < prevPlayerCount; i++) {
      const isHuman = i === 0;
      this.players.push({
        name: isHuman ? '\u4f60' : aiNames[aiIdx++],
        hand: [],
        isHuman,
        isDealer: i === winnerIdx,
        difficulty: isHuman ? null : prevDifficulty,
        diceResult: 0
      });
    }

    this.dealerIndex = winnerIdx;
    this.dealCards();
    this.roundNumber = 1;
    this.playerPlayCounts = new Array(prevPlayerCount).fill(0);
    this.currentPlayerIndex = winnerIdx;
    this.lastPlay = null;
    this.passCount = 0;
    this.roundLeader = winnerIdx;

    this.addMessage(`\u5e84\u5bb6: ${this.players[winnerIdx].name} \u5148\u51fa\u724c (\u4e0a\u5c40\u8d62\u5bb6\u5750\u5e84)`);
    if (this.onUpdate) this.onUpdate();
    this.processTurn();
  }

  /* ---- Utilities ---- */
  addMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > 50) this.messages.shift();
  }

  getCurrentPlayDesc() {
    if (!this.lastPlay) return '\u65b0\u8f6e\u6b21\uff0c\u968f\u610f\u51fa\u724c';
    const p = this.players[this.lastPlay.playerIndex];
    const play = this.lastPlay.play;
    return `${p.name}: ${cardsToDesc(play.cards)}`;
  }

  getStatus() {
    if (this.state === 'playing') {
      const p = this.players[this.currentPlayerIndex];
      return `${p.name} \u7684\u56de\u5408`;
    }
    return '';
  }
}

function cardsToDesc(cards) {
  return cards.map(c => c.displayName).join(' ');
}
