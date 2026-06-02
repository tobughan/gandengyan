/* AI Player logic */

class AIPlayer {
  constructor(name, difficulty) {
    this.name = name;
    this.difficulty = difficulty;
  }

  /* Main decision method */
  choosePlay(hand, lastPlay, isNewRound) {
    const validPlays = getAllPlays(hand);
    let candidates;

    /* lastPlay is stored as {playerIndex, play} - extract the play object */
    const lastPlayObj = lastPlay ? lastPlay.play : null;

    if (isNewRound || !lastPlay) {
      candidates = validPlays;
    } else {
      candidates = validPlays.filter(p => canBeat(p, lastPlayObj));
    }

    /* Filter out plays that use 2 as last card */
    candidates = candidates.filter(p => {
      if (!twoAsLastCardForbidden(hand, p.cards)) return true;
      return p.cards.length < hand.length;
    });

    if (candidates.length === 0) return null;

    switch (this.difficulty) {
      case 'easy': return this.easyChoice(candidates);
      case 'normal': return this.normalChoice(candidates, hand);
      case 'hard': return this.hardChoice(candidates, hand, lastPlay);
      default: return this.normalChoice(candidates, hand);
    }
  }

  /* Easy: random valid play */
  easyChoice(candidates) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* Normal: play smallest cards first, save 2s and bombs */
  normalChoice(candidates, hand) {
    /* Sort: prefer non-bomb, non-2, smallest rank first */
    const scored = candidates.map(p => {
      let score = p.rank;
      if (p.type === 'bomb' || p.type === 'jokerBomb') score += 20;
      if (p.type === 'single' && p.rank === 12) score += 15;
      if (p.type === 'pair' && p.rank === 12) score += 15;
      /* Prefer playing wild cards */
      if (p.cards.some(c => c.isWild)) score -= 3;
      /* Prefer longer plays to reduce hand size */
      score -= p.length * 0.5;
      return {play: p, score};
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].play;
  }

  /* Hard: strategic play with card counting */
  hardChoice(candidates, hand, lastPlay) {
    const handSize = hand.length;
    const isLastRound = this.estimateLastRound(hand);

    /* If only 2 cards left and one is a 2, must play 2 first */
    if (mustPlayTwoFirst(hand)) {
      const twoPlay = candidates.find(p =>
        p.type !== 'bomb' && p.type !== 'jokerBomb' &&
        p.cards.some(c => !c.isWild && c.rankValue === 12)
      );
      if (twoPlay) return twoPlay;
    }

    const scored = candidates.map(p => {
      let score = p.rank * 2;

      /* Favor bombing when opponent has few cards */
      if (lastPlay && (p.type === 'bomb' || p.type === 'jokerBomb')) {
        score -= 5;
        if (handSize <= 3) score -= 10; /* Finish with bomb */
      }

      /* Avoid playing 2 unnecessarily */
      if (p.type === 'single' && p.rank === 12 && handSize > 2) score += 10;
      if (p.type === 'pair' && p.rank === 12 && handSize > 2) score += 10;

      /* Prefer playing medium-low cards first in early game (hand > 5) */
      if (handSize > 5 && p.rank <= 6 && p.rank >= 1) score -= 5;

      /* Save wilds for bombs near endgame */
      if (handSize <= 4 && p.cards.some(c => c.isWild) && p.type !== 'bomb') score += 8;

      /* Finish game when possible */
      if (p.cards.length === handSize) score = -100;

      /* Beat with minimum required cards */
      if (lastPlay && p.length > lastPlay.length && p.type !== 'bomb') score += 5;

      return {play: p, score};
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0].play;
  }

  estimateLastRound(hand) {
    return hand.length <= 3;
  }
}

/* Factory */
function createAIPlayer(name, difficulty) {
  return new AIPlayer(name, difficulty);
}
