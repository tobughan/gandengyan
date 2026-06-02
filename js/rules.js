/* Card sorting utility */
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.isWild !== b.isWild) return a.isWild ? 1 : -1;
    if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
    return WILD_ORDER.indexOf(a.name) - WILD_ORDER.indexOf(b.name);
  });
}

/* Detect play type from a set of cards. Returns null if invalid. */
function detectPlay(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const sorted = sortCards(cards);
  const wilds = sorted.filter(c => c.isWild);
  const w = wilds.length;
  const normals = sorted.filter(c => !c.isWild);

  /* Joker bomb (exactly 大王+小王) - must check before wild-only rejection */
  if (n === 2 && sorted[0].name === 'BigJoker' && sorted[1].name === 'SmallJoker')
    return {type:'jokerBomb', bombLevel:2, length:2, cards:sorted};

  if (normals.length === 0) return null;

  /* Single */
  if (n === 1) return {type:'single', rank:sorted[0].rankValue, length:1, cards:sorted};

  /* Pair */
  if (n === 2) {
    if (w === 1) return {type:'pair', rank:normals[0].rankValue, length:2, cards:sorted};
    if (w === 0 && normals[0].rankValue === normals[1].rankValue)
      return {type:'pair', rank:normals[0].rankValue, length:2, cards:sorted};
    return null;
  }

  /* Bomb: all normals same rank + wilds */
  const nRanks = normals.map(c => c.rankValue);
  const uRanks = [...new Set(nRanks)];
  if (uRanks.length === 1 && n >= 3) {
    const bombLevel = n - 2;
    return {type:'bomb', rank:uRanks[0], bombLevel, size:n, length:n, cards:sorted};
  }

  /* Check straight */
  const straight = detectStraight(sorted);
  if (straight) return straight;

  /* Check consecutive pairs */
  if (n >= 4 && n % 2 === 0) {
    const cp = detectConsecutivePairs(sorted);
    if (cp) return cp;
  }

  return null;
}

function detectStraight(cards) {
  const wilds = cards.filter(c => c.isWild);
  const w = wilds.length;
  const normals = cards.filter(c => !c.isWild);
  const n = cards.length;
  if (n < 3) return null;
  const ranks = normals.map(c => c.rankValue).sort((a,b)=>a-b);
  const uRanks = [...new Set(ranks)];
  if (uRanks.length !== ranks.length) return null;

  const minR = uRanks[0], maxR = uRanks[uRanks.length-1];
  if (maxR - minR + 1 > n) return null;

  const minStart = Math.max(0, maxR - n + 1);
  const maxStart = Math.min(12 - n + 1, minR);
  if (minStart > maxStart) return null;

  const start = maxStart;
  const targetRanks = Array.from({length:n}, (_,i) => start + i);
  const missing = targetRanks.filter(r => !uRanks.includes(r));
  if (missing.length <= w)
    return {type:'straight', rank:start+n-1, length:n, start, cards};
  return null;
}

function detectConsecutivePairs(cards) {
  const wilds = cards.filter(c => c.isWild);
  const w = wilds.length;
  const normals = cards.filter(c => !c.isWild);
  const n = cards.length;
  if (n < 4 || n % 2 !== 0) return null;
  const pairCount = n / 2;

  const rankCounts = {};
  for (const c of normals) rankCounts[c.rankValue] = (rankCounts[c.rankValue]||0) + 1;
  for (const r in rankCounts) if (rankCounts[r] > 2) return null;

  for (let start = 0; start <= 12 - pairCount + 1; start++) {
    let needed = 0, ok = true;
    for (let i = 0; i < pairCount; i++) {
      const rv = start + i;
      const have = rankCounts[rv] || 0;
      const need = 2 - have;
      if (need < 0) { ok = false; break; }
      needed += need;
    }
    if (ok && needed <= w)
      return {type:'consecutivePairs', rank:start+pairCount-1, length:n, start, pairCount, cards};
  }
  return null;
}

/* Can newPlay beat lastPlay? */
function canBeat(newPlay, lastPlay) {
  if (!newPlay || !lastPlay) return false;

  /* Joker bomb beats everything (including other joker bombs via bombLevel comparison) */
  if (newPlay.type === 'jokerBomb' && lastPlay.type !== 'jokerBomb') return true;
  if (lastPlay.type === 'jokerBomb' && newPlay.type === 'jokerBomb')
    return newPlay.bombLevel > lastPlay.bombLevel;
  if (lastPlay.type === 'jokerBomb') return false;

  if (newPlay.type === 'bomb' && lastPlay.type === 'bomb') {
    if (newPlay.bombLevel > lastPlay.bombLevel) return true;
    if (newPlay.bombLevel === lastPlay.bombLevel && newPlay.rank > lastPlay.rank) return true;
    return false;
  }
  if (newPlay.type === 'bomb') return true;
  if (lastPlay.type === 'bomb' || lastPlay.type === 'jokerBomb') return false;

  if (newPlay.type !== lastPlay.type) return false;
  if (newPlay.length !== lastPlay.length) return false;

  /* 2 special - beats any non-2 card */
  if (newPlay.type === 'single' && newPlay.rank === 12 && lastPlay.rank !== 12) return true;
  if (newPlay.type === 'pair' && newPlay.rank === 12 && lastPlay.rank !== 12) return true;

  return newPlay.rank === lastPlay.rank + 1;
}

/* Check if playing a 2 as last card is forbidden (only single 2) */
function twoAsLastCardForbidden(hand, cardsToPlay) {
  if (hand.length !== cardsToPlay.length) return false;
  if (cardsToPlay.length === 1 && cardsToPlay[0].rankValue === 12) return true;
  return false;
}

/* Check if player must play a 2 first (hand has 2 cards, one is 2) */
function mustPlayTwoFirst(hand) {
  if (hand.length !== 2) return false;
  return hand.some(c => !c.isWild && c.rankValue === 12);
}

/* Generate all valid plays from a hand */
function getAllPlays(hand) {
  const results = [];
  const n = hand.length;
  if (n === 0) return results;

  const sorted = sortCards(hand);
  const wilds = sorted.filter(c => c.isWild);
  const w = wilds.length;
  const normals = sorted.filter(c => !c.isWild);

  /* Group normals by rank */
  const rankGroups = {};
  for (const c of normals) {
    if (!rankGroups[c.rankValue]) rankGroups[c.rankValue] = [];
    rankGroups[c.rankValue].push(c);
  }
  const rankVals = Object.keys(rankGroups).map(Number).sort((a,b)=>a-b);

  /* Joker bomb */
  const bj = sorted.find(c => c.name === 'BigJoker');
  const sj = sorted.find(c => c.name === 'SmallJoker');
  if (bj && sj) results.push({type:'jokerBomb', bombLevel:2, length:2, cards:[bj, sj]});

  /* Singles */
  for (const c of sorted) {
    if (c.isWild) continue;
    results.push({type:'single', rank:c.rankValue, length:1, cards:[c]});
  }
  /* Wild as single? No. Wilds can't be played alone. */

  /* Pairs */
  for (const rv of rankVals) {
    const g = rankGroups[rv];
    if (g.length >= 2) results.push({type:'pair', rank:rv, length:2, cards:g.slice(0,2)});
    if (g.length >= 1 && w >= 1) results.push({type:'pair', rank:rv, length:2, cards:[g[0], wilds[0]]});
  }

  /* Bombs */
  for (const rv of rankVals) {
    const g = rankGroups[rv];
    const have = g.length;
    for (let i = 3; i <= have + w; i++) {
      const wn = i - have;
      if (wn >= 0 && wn <= w && i >= 3) {
        const combo = [...g];
        for (let j = 0; j < wn; j++) combo.push(wilds[j]);
        results.push({type:'bomb', rank:rv, bombLevel:i-2, size:i, length:i, cards:combo});
      }
    }
  }

  /* Straights */
  const maxStraight = Math.min(13, n);
  for (let len = 3; len <= maxStraight; len++) {
    for (let start = 0; start <= 12 - len + 1; start++) {
      const target = Array.from({length:len}, (_,i) => start + i);
      const combo = [];
      let usedWilds = 0;
      let valid = true;
      const used = new Set();
      for (const tr of target) {
        if (rankGroups[tr]) {
          const avail = rankGroups[tr].filter(c => !used.has(c.id));
          if (avail.length > 0) {
            combo.push(avail[0]);
            used.add(avail[0].id);
          } else if (usedWilds < w) {
            combo.push(wilds[usedWilds++]);
          } else { valid = false; break; }
        } else if (usedWilds < w) {
          combo.push(wilds[usedWilds++]);
        } else { valid = false; break; }
      }
      if (valid && combo.length === len) {
        const dedup = [...new Set(combo.map(c=>c.id))];
        if (dedup.length === len)
          results.push({type:'straight', rank:start+len-1, length:len, start, cards:combo});
      }
    }
  }

  /* Consecutive pairs */
  const maxPairs = Math.min(6, Math.floor(n / 2));
  for (let pc = 2; pc <= maxPairs; pc++) {
    const len = pc * 2;
    for (let start = 0; start <= 12 - pc + 1; start++) {
      const combo = [];
      let usedWilds = 0;
      let valid = true;
      const used = new Set();
      for (let i = 0; i < pc; i++) {
        const rv = start + i;
        const g = rankGroups[rv] || [];
        const avail = g.filter(c => !used.has(c.id));
        const have = avail.length;
        if (have >= 2) { combo.push(avail[0], avail[1]); used.add(avail[0].id); used.add(avail[1].id); }
        else if (have === 1 && usedWilds < w) { combo.push(avail[0]); used.add(avail[0].id); combo.push(wilds[usedWilds++]); }
        else if (have === 0 && usedWilds + 2 <= w) { combo.push(wilds[usedWilds++], wilds[usedWilds++]); }
        else { valid = false; break; }
      }
      if (valid && combo.length === len) {
        const dedup = [...new Set(combo.map(c=>c.id))];
        if (dedup.length === len)
          results.push({type:'consecutivePairs', rank:start+pc-1, length:len, start, pairCount:pc, cards:combo});
      }
    }
  }

  /* Deduplicate by card set signature */
  return deduplicatePlays(results);
}

function deduplicatePlays(plays) {
  const seen = new Set();
  return plays.filter(p => {
    const sig = p.type + ':' + p.cards.map(c=>c.id).sort().join(',');
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
