class Card {
  constructor(suit, rank, name) {
    this.suit = suit;
    this.rank = rank;
    this.name = name || rank;
    this.rankValue = RANK_VALUES[rank];
    this.isWild = WILD_NAMES.includes(this.name);
    this.displayRank = this.isWild ? WILD_DISPLAY[this.name] : rank;
    const suitInfo = suit ? SUITS.find(s => s.name === suit) : null;
    this.suitSymbol = suitInfo ? suitInfo.symbol : '';
    this.suitColor = suitInfo ? suitInfo.color : 'black';
  }
  get id(){return `${this.suit||'wild'}_${this.rank}_${this.name}`}
  get displayName(){return this.isWild ? this.displayRank : `${this.rank}${this.suitSymbol}`}
}

class Deck {
  constructor() { this.cards = []; this.init(); }
  init() {
    this.cards = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        this.cards.push(new Card(suit.name, rank));
    this.cards.push(new Card(null, 'SmallJoker', 'SmallJoker'));
    this.cards.push(new Card(null, 'BigJoker', 'BigJoker'));
    this.cards.push(new Card(null, 'Tingyong', 'Tingyong'));
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  deal(playerCount, dealerIndex) {
    const hands = Array.from({length: playerCount}, () => []);
    let idx = 0;
    for (let i = 0; i < HAND_SIZE_DEALER; i++) hands[dealerIndex].push(this.cards[idx++]);
    for (let p = 0; p < playerCount; p++) {
      if (p === dealerIndex) continue;
      for (let i = 0; i < HAND_SIZE_PLAYER; i++) hands[p].push(this.cards[idx++]);
    }
    return {hands, remaining: this.cards.slice(idx)};
  }
}
