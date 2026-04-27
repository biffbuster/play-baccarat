/* ============================================================
   PAI GOW POKER — LIVE SIMULATOR
   ----------------------------------------------------------------
   Deals seven cards to the player and seven to the dealer. The
   player taps two cards to send them to the low hand; the rest
   become the high hand. Dealer sets the house way. Both pairs
   of hands are compared. Win both → win, win one → push,
   lose both → lose. Joker is semi-wild (Ace, or completes a
   straight / flush / straight flush).
   ============================================================ */
(function initPaiGowSim() {
  const dealBtn      = document.getElementById('pgDealBtn');
  const setBtn       = document.getElementById('pgSetBtn');
  const houseWayBtn  = document.getElementById('pgHouseWayBtn');
  const resetBtn     = document.getElementById('pgResetBtn');
  const youHigh      = document.getElementById('pgYouHigh');
  const youLow       = document.getElementById('pgYouLow');
  const dealerHigh   = document.getElementById('pgDealerHigh');
  const dealerLow    = document.getElementById('pgDealerLow');
  const bankrollEl   = document.getElementById('pgBankroll');
  const youStrength  = document.getElementById('pgYouStrength');
  const dealerStrength = document.getElementById('pgDealerStrength');
  const youStatus    = document.getElementById('pgYouStatus');
  const dealerStatus = document.getElementById('pgDealerStatus');
  const highSummary  = document.getElementById('pgHighSummary');
  const lowSummary   = document.getElementById('pgLowSummary');
  const hint         = document.getElementById('pgHint');
  const log          = document.getElementById('pgSimLog');
  const statHands    = document.getElementById('pgStatHands');
  const statW        = document.getElementById('pgStatW');
  const statP        = document.getElementById('pgStatP');
  const statL        = document.getElementById('pgStatL');
  const statNet      = document.getElementById('pgStatNet');
  const tableChip    = document.getElementById('pgTableChip');
  const tableChipAmt = document.getElementById('pgTableChipAmount');

  /* resultLine moved into status overlays — kept as a noop element so the
     rest of the code can write to it without crashing. */
  const resultLine = document.getElementById('pgResultLine') || { textContent: '', className: '' };

  if (!dealBtn || !youHigh) return; /* page doesn't have the sim — bail. */

  /* ----- Bankroll + bet selection ----- */
  let bankroll = 1000;
  let chipSize = 25;
  let currentBet = 0;
  let stats = { hands: 0, w: 0, p: 0, l: 0, net: 0 };

  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function updateBankroll() {
    bankrollEl.textContent = fmtMoney(bankroll);
  }
  function updateStats() {
    statHands.textContent = stats.hands;
    statW.textContent     = stats.w;
    statP.textContent     = stats.p;
    statL.textContent     = stats.l;
    statNet.textContent   = fmtMoney(stats.net);
    statNet.className = 'sim-stat-value ' + (stats.net > 0 ? 'jade' : stats.net < 0 ? 'carmine' : '');
  }
  function logLine(text) {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    const div = document.createElement('div');
    div.className = 'sim-log-line';
    div.innerHTML = `<span class="time">${t}</span><span>${text}</span>`;
    log.prepend(div);
    while (log.children.length > 40) log.removeChild(log.lastChild);
  }

  function showTableChip(amount) {
    if (!tableChip) return;
    tableChipAmt.textContent = '$' + amount;
    tableChip.hidden = false;
  }
  function hideTableChip() {
    if (!tableChip) return;
    tableChip.hidden = true;
  }

  document.querySelectorAll('[data-pg-bet]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pg-bet]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      chipSize = parseInt(btn.dataset.pgBet, 10);
      currentBet = chipSize;
      showTableChip(chipSize);
      if (state.phase === 'idle' || state.phase === 'settled') {
        state.phase = 'idle';
        dealBtn.disabled = (currentBet > bankroll);
        hint.textContent = `Bet $${chipSize}. Press "Deal Hand".`;
      } else {
        hint.textContent = `Bet for next hand: $${chipSize}.`;
      }
      walkAdvance('bet');
    });
  });

  /* ----- Card helpers ----- */
  /* Joker is "1J" (matches the SVG file in /poker). Treat as semi-wild. */
  const SUITS = ['S', 'H', 'D', 'C'];
  const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const RANK_VAL = Object.fromEntries(RANKS.map((r, i) => [r, i + 2])); /* 2..14 */
  const JOKER = 'JK';

  function buildDeck() {
    const d = [];
    SUITS.forEach(s => RANKS.forEach(r => d.push(r + s)));
    d.push(JOKER);
    return d;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function svgFor(card) {
    return card === JOKER ? 'poker/1J.png' : `poker/${card}.svg`;
  }
  function rankOf(card) { return card === JOKER ? 'A' : card[0]; }
  function suitOf(card) { return card === JOKER ? null : card[1]; }
  function isJoker(card) { return card === JOKER; }

  /* ----- Hand evaluation ------
     Categories (higher index beats lower):
       0 high  · 1 pair  · 2 two-pair · 3 trips · 4 straight ·
       5 flush · 6 full-house · 7 quads · 8 straight-flush ·
       9 royal-flush · 10 five-aces
     Score returned as [category, ...tiebreakers] suitable for lex compare.
  ----------------------------------------------------------------- */

  function compareScore(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const av = a[i] || 0, bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  /* Score a concrete 5-card hand WITHOUT considering wild expansion.
     Used after we have committed the joker to a specific value. */
  function scoreFive(cards) {
    /* cards may include "AS","AH" or "WA","WH" (wild assigned).
       For straight detection we use ranks; for flush detection we use suits.
       A wild assigned a suit must tag a suit. */
    const ranks = cards.map(c => RANK_VAL[c.r]);
    const suits = cards.map(c => c.s);
    ranks.sort((x, y) => y - x);

    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const groups = Object.entries(counts)
      .map(([r, n]) => [parseInt(r, 10), n])
      .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    const isFlush = suits.every(s => s && s === suits[0]);
    /* Straight: distinct ranks, max-min = 4. Wheel A2345 special-case. */
    let isStraight = false, straightHigh = 0;
    const uniqRanks = [...new Set(ranks)];
    if (uniqRanks.length === 5) {
      if (uniqRanks[0] - uniqRanks[4] === 4) {
        isStraight = true;
        straightHigh = uniqRanks[0];
      } else if (
        uniqRanks[0] === 14 && uniqRanks[1] === 5 &&
        uniqRanks[2] === 4 && uniqRanks[3] === 3 && uniqRanks[4] === 2
      ) {
        isStraight = true;
        straightHigh = 5; /* wheel — 5-high straight */
      }
    }

    if (isStraight && isFlush) {
      if (straightHigh === 14) return [9, 14]; /* royal */
      return [8, straightHigh];
    }
    if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
    if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
    if (isFlush) return [5, ...ranks];
    if (isStraight) return [4, straightHigh];
    if (groups[0][1] === 3) return [3, groups[0][0], ...ranks.filter(r => r !== groups[0][0])];
    if (groups[0][1] === 2 && groups[1][1] === 2) {
      const kicker = ranks.find(r => r !== groups[0][0] && r !== groups[1][0]);
      return [2, Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), kicker];
    }
    if (groups[0][1] === 2) {
      return [1, groups[0][0], ...ranks.filter(r => r !== groups[0][0])];
    }
    return [0, ...ranks];
  }

  /* Convert the deck-string cards into {r, s, isWild} objects for the evaluator. */
  function toEvalCards(stringCards) {
    return stringCards.map(c => {
      if (c === JOKER) return { r: 'A', s: null, isWild: true };
      return { r: c[0], s: c[1], isWild: false };
    });
  }

  /* Five Aces detection: joker + four natural Aces. */
  function isFiveAces(cards) {
    const aces = cards.filter(c => !isJoker(c) && c[0] === 'A').length;
    const j = cards.filter(c => isJoker(c)).length;
    return aces === 4 && j === 1;
  }

  /* Best 5-card score from the (up to) 5 cards, expanding the joker.
     For scoring only; returns the best [cat, ...kickers]. */
  function bestFiveScore(cards5) {
    if (isFiveAces(cards5)) return [10, 14];
    const evalCards = toEvalCards(cards5);
    const wildIdx = evalCards.findIndex(c => c.isWild);
    if (wildIdx === -1) {
      return scoreFive(evalCards);
    }
    /* Try the joker as every (rank, suit) combination; pick the max score. */
    let best = null;
    for (const r of RANKS) {
      for (const s of SUITS) {
        const trial = evalCards.slice();
        trial[wildIdx] = { r, s, isWild: false };
        const score = scoreFive(trial);
        if (!best || compareScore(score, best) > 0) best = score;
      }
    }
    /* But Pai Gow rule: if no flush/straight is made, joker MUST be Ace.
       To enforce that, separately compute "joker = best Ace assignment" and
       require either it's strictly better OR the wild trial produced a
       straight/flush/SF/RF. categories 4 (straight), 5 (flush), 8 (sf),
       9 (royal). Otherwise fall back to the Ace assignment. */
    if (best && best[0] >= 4 && best[0] !== 6 && best[0] !== 7 && best[0] !== 10) {
      return best;
    }
    /* fallback: joker = Ace of an arbitrary suit (suit doesn't matter when
       no flush is being formed). */
    const aceTrial = evalCards.slice();
    aceTrial[wildIdx] = { r: 'A', s: 'S', isWild: false };
    return scoreFive(aceTrial);
  }

  /* Score a 2-card low hand. Joker = Ace. */
  function bestTwoScore(cards2) {
    const ranks = cards2.map(c => isJoker(c) ? 14 : RANK_VAL[c[0]]).sort((a, b) => b - a);
    if (ranks[0] === ranks[1]) return [1, ranks[0]];
    return [0, ranks[0], ranks[1]];
  }

  /* Hand-name display helpers. */
  const RANK_NAME = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };
  function nameFiveScore(s) {
    const cat = s[0];
    if (cat === 10) return 'Five Aces';
    if (cat === 9)  return 'Royal Flush';
    if (cat === 8)  return `Straight Flush, ${RANK_NAME[s[1]]} high`;
    if (cat === 7)  return `Four ${RANK_NAME[s[1]]}s`;
    if (cat === 6)  return `Full House, ${RANK_NAME[s[1]]}s over ${RANK_NAME[s[2]]}s`;
    if (cat === 5)  return `Flush, ${RANK_NAME[s[1]]} high`;
    if (cat === 4)  return `Straight, ${RANK_NAME[s[1]]} high`;
    if (cat === 3)  return `Three ${RANK_NAME[s[1]]}s`;
    if (cat === 2)  return `Two Pair, ${RANK_NAME[s[1]]}s & ${RANK_NAME[s[2]]}s`;
    if (cat === 1)  return `Pair of ${RANK_NAME[s[1]]}s`;
    return `${RANK_NAME[s[1]]} high`;
  }
  function nameTwoScore(s) {
    if (s[0] === 1) return `Pair of ${RANK_NAME[s[1]]}s`;
    return `${RANK_NAME[s[1]]}-${RANK_NAME[s[2]]} high`;
  }

  /* ----- House way splitter ----- */
  /* Sort cards with joker treated as Ace. */
  function sortByRankDesc(cards) {
    return cards.slice().sort((a, b) => {
      const ra = isJoker(a) ? 14 : RANK_VAL[a[0]];
      const rb = isJoker(b) ? 14 : RANK_VAL[b[0]];
      return rb - ra;
    });
  }

  /* Find the best (5,2) split for a hand: try splits where the two-card
     hand is the strongest legal pair-or-two-singletons that the five-card
     hand still beats. Greedy/heuristic version, plays "house-way-ish":
       1. If five aces → AAAA in high, A + best other in low.
       2. Quads: keep quads in high if rank ≤ 7 (so dealer doesn't waste them);
          else split if Aces+ — for simplicity keep intact except Aces.
       3. Full house → trips high, pair low.
       4. Flush / straight / straight flush → keep intact, top 2 of remainder low.
       5. Trips → trips high (split if Aces) + top 2 in low.
       6. Two pair → split if top pair ≥ 7; else keep both high if Ace present.
       7. One pair → pair high, top 2 kickers low.
       8. High card → top in high, 2nd+3rd in low.
     Returns { high, low } where each is an array of card strings. */
  function houseWaySplit(seven) {
    const sorted = sortByRankDesc(seven);
    /* Score the full 7 to figure out structure. */
    /* Count rank groups (joker = A). */
    const counts = {};
    sorted.forEach(c => {
      const r = isJoker(c) ? 'A' : c[0];
      counts[r] = (counts[r] || []).concat(c);
    });
    const groups = Object.values(counts).sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      const av = isJoker(a[0]) ? 14 : RANK_VAL[a[0][0]];
      const bv = isJoker(b[0]) ? 14 : RANK_VAL[b[0][0]];
      return bv - av;
    });
    const sizes = groups.map(g => g.length).join('-'); /* e.g. "3-2-1-1", "2-2-1-1-1" */

    /* Try a structured split, then validate (high beats low). If invalid,
       fall back to the brute-force best-legal split below. */
    let candidate = null;

    if (isFiveAces(seven)) {
      /* Joker + 4 Aces. House way: keep all five aces high; the two
         non-aces form the low hand (which the dealer almost certainly
         beats — but the high hand is unbeatable, so it's a guaranteed
         push at worst, a win whenever the dealer loses the low). */
      const aces = sorted.filter(c => isJoker(c) || c[0] === 'A');
      const others = sorted.filter(c => !(isJoker(c) || c[0] === 'A'));
      candidate = { high: aces.slice(0, 5),
                    low:  others.slice(0, 2) };
    } else if (sizes.startsWith('4')) {
      /* Quads. House way: keep quads in high unless Aces or face cards. */
      const quad = groups[0];
      const quadVal = isJoker(quad[0]) ? 14 : RANK_VAL[quad[0][0]];
      if (quadVal >= 11) {
        /* Split quads — pair to low, pair to high. */
        const high = [quad[0], quad[1]];
        const low  = [quad[2], quad[3]];
        const rest = sorted.filter(c => !quad.includes(c)).slice(0, 3);
        candidate = { high: high.concat(rest), low };
      } else {
        const rest = sorted.filter(c => !quad.includes(c));
        candidate = { high: quad.slice().concat(rest[0]), low: rest.slice(1, 3) };
      }
    } else if (sizes.startsWith('3-3')) {
      /* Two trips → top trip's pair to low (use the lower trip as pair). */
      const high = groups[0].slice(0, 3);
      const low  = groups[1].slice(0, 2);
      const rest = sorted.filter(c => !high.includes(c) && !low.includes(c));
      candidate = { high: high.concat(rest.slice(0, 2)), low };
    } else if (sizes.startsWith('3-2-2')) {
      /* Full house + extra pair. Trips high, top pair low. */
      const trips = groups[0];
      const topPair = groups[1];
      const high = trips.concat(groups[2]);
      const low = topPair.slice(0, 2);
      candidate = { high, low };
    } else if (sizes.startsWith('3-2')) {
      /* Full house. Trips high, pair low. */
      const trips = groups[0];
      const pair = groups[1];
      const rest = sorted.filter(c => !trips.includes(c) && !pair.includes(c));
      candidate = { high: trips.concat(rest.slice(0, 2)), low: pair.slice(0, 2) };
    } else if (sizes.startsWith('3')) {
      /* Three of a kind. Aces split; otherwise trips stay. */
      const trips = groups[0];
      const tripVal = isJoker(trips[0]) ? 14 : RANK_VAL[trips[0][0]];
      const rest = sorted.filter(c => !trips.includes(c));
      if (tripVal === 14) {
        /* House way for trips of Aces: split — pair of Aces high (with the
           top three kickers), one Ace + next-best kicker low. */
        candidate = { high: [trips[0], trips[1], rest[0], rest[1], rest[2]],
                      low:  [trips[2], rest[3] || rest[0]] };
      } else {
        candidate = { high: trips.concat(rest.slice(0, 2)), low: rest.slice(2, 4) };
      }
    } else if (sizes.startsWith('2-2')) {
      /* Two pair. */
      const top = groups[0], bot = groups[1];
      const topVal = isJoker(top[0]) ? 14 : RANK_VAL[top[0][0]];
      const botVal = isJoker(bot[0]) ? 14 : RANK_VAL[bot[0][0]];
      const rest = sorted.filter(c => !top.includes(c) && !bot.includes(c));
      const hasAceKicker = rest.some(c => isJoker(c) || c[0] === 'A');
      /* Heuristic: split if top pair ≥ 7 OR top pair small but no Ace kicker. */
      if (topVal >= 7 || !hasAceKicker) {
        candidate = { high: top.concat(rest.slice(0, 3)), low: bot.slice(0, 2) };
      } else {
        candidate = { high: top.concat(bot, rest[0]), low: rest.slice(1, 3) };
      }
      /* If top pair ≥ J, force split. */
      if (topVal >= 11) {
        candidate = { high: top.concat(rest.slice(0, 3)), low: bot.slice(0, 2) };
      }
    } else if (sizes.startsWith('2')) {
      /* One pair. Pair high, top 2 kickers low. */
      const pair = groups[0];
      const rest = sorted.filter(c => !pair.includes(c));
      candidate = { high: pair.concat(rest.slice(0, 3)), low: rest.slice(3, 5) };
    } else {
      /* No pair. Top high, 2nd + 3rd low (then 4th-7th fill out high). */
      candidate = { high: [sorted[0], sorted[3], sorted[4], sorted[5], sorted[6]],
                    low:  [sorted[1], sorted[2]] };
    }

    /* Validate: high must beat low. If somehow invalid, fall back to best
       legal brute force (shouldn't happen with the heuristics above except
       in edge cases). */
    if (candidate && isLegalSplit(candidate.high, candidate.low)) {
      return candidate;
    }
    return bruteForceLegalSplit(seven);
  }

  function isLegalSplit(high5, low2) {
    return compareScore(bestFiveScore(high5), bestFiveScoreFromTwo(low2)) >= 0;
  }
  /* For the legality check we need both hands scored on the same scale. We
     score the 2-card hand as if it were a 5-card hand padded with two
     impossible "blanks" — but easier: compare a 5-card score against a
     pseudo-score derived from the 2-card score. A 2-card hand is at most
     a pair (cat 1). So if the 5-card cat ≥ 2 it's automatically legal.
     If both are pair, compare ranks. If 5-card is high card (cat 0), the
     pair-vs-high-card comparison is also fine because pair > high card.
     We coerce: build a synthetic 5-card score from the 2-card score. */
  function bestFiveScoreFromTwo(low2) {
    const s = bestTwoScore(low2);
    if (s[0] === 1) return [1, s[1], 0, 0, 0]; /* pair, no kickers tracked */
    return [0, s[1], s[2], 0, 0, 0];
  }

  function bruteForceLegalSplit(seven) {
    /* Enumerate every C(7,2)=21 subset for the low hand, keep ones where
       the high hand outranks the low, return the one with the strongest
       high hand. Only used as a safety net. */
    let best = null;
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const low = [seven[i], seven[j]];
        const high = seven.filter((_, k) => k !== i && k !== j);
        if (isLegalSplit(high, low)) {
          const hs = bestFiveScore(high);
          if (!best || compareScore(hs, best.score) > 0) best = { high, low, score: hs };
        }
      }
    }
    if (best) return { high: best.high, low: best.low };
    /* Should never get here: every 7-card hand has at least one legal split
       (e.g., put the two lowest singletons in the low hand). */
    return { high: seven.slice(0, 5), low: seven.slice(5, 7) };
  }

  /* ----- State machine ----- */
  const state = {
    phase: 'idle',     /* idle | dealt | settled */
    deck: [],
    yourCards: [],     /* 7 strings */
    yourLow: [],       /* the 2 in the low hand (subset of yourCards) */
    selectedCard: null,/* card string currently selected for swap, or null */
    dealerCards: [],
    dealerHigh: [],
    dealerLow:  [],
  };

  function setHint(text) { hint.textContent = text; }

  /* Build a single card element. `selectable` cards can be tapped to swap
     between high/low rows; non-selectable (dealer) cards are inert. */
  function makeCardEl(card, selectable) {
    const el = document.createElement('div');
    el.className = 'pg-card';
    el.dataset.card = card;
    if (selectable && state.selectedCard === card) el.classList.add('is-selected');
    const img = document.createElement('img');
    img.src = svgFor(card);
    img.alt = card;
    img.draggable = false;
    el.appendChild(img);
    if (selectable) {
      el.addEventListener('click', () => onPlayerCardClick(card));
    }
    return el;
  }

  /* Render a list of cards into a slot-zone container. Each card occupies
     one cell of the CSS grid (5 cols for HIGH, 2 cols for LOW). */
  function renderHand(container, cards, opts = {}) {
    container.innerHTML = '';
    cards.forEach(c => container.appendChild(makeCardEl(c, !!opts.selectable)));
  }

  /* Click-to-swap mechanic. The 7 cards are always split 5-HIGH / 2-LOW;
     tapping a card "selects" it (gold halo). Tapping a card in the
     opposite row swaps the two; tapping the same card or another in the
     same row just changes the selection. The split is always full so the
     painted slots stay populated. */
  function onPlayerCardClick(card) {
    if (state.phase !== 'dealt') return;
    if (state.selectedCard === card) {
      state.selectedCard = null;
    } else if (state.selectedCard === null) {
      state.selectedCard = card;
    } else {
      const selectedInLow = state.yourLow.includes(state.selectedCard);
      const newInLow      = state.yourLow.includes(card);
      if (selectedInLow !== newInLow) {
        /* Opposite rows — perform the swap. */
        if (selectedInLow) {
          /* Selected was in LOW; new card is in HIGH. Swap positions. */
          const idx = state.yourLow.indexOf(state.selectedCard);
          state.yourLow[idx] = card;
        } else {
          /* Selected was in HIGH; new card is in LOW. */
          const idx = state.yourLow.indexOf(card);
          state.yourLow[idx] = state.selectedCard;
        }
        state.selectedCard = null;
        walkAdvance('set-low');
      } else {
        /* Same row — just move selection. */
        state.selectedCard = card;
      }
    }
    renderPlayerHands();
    updatePlayerSummary();
  }

  function renderPlayerHands() {
    const highCards = state.yourCards.filter(c => !state.yourLow.includes(c));
    const lowCards  = state.yourLow.slice();
    renderHand(youHigh, highCards, { selectable: true });
    renderHand(youLow,  lowCards,  { selectable: true });
  }

  function updatePlayerSummary() {
    const high = state.yourCards.filter(c => !state.yourLow.includes(c));
    const low  = state.yourLow;
    if (high.length === 5) {
      highSummary.textContent = nameFiveScore(bestFiveScore(high));
    } else {
      highSummary.textContent = `${high.length}/5`;
    }
    if (low.length === 2) {
      lowSummary.textContent = nameTwoScore(bestTwoScore(low));
    } else {
      lowSummary.textContent = `${low.length}/2`;
    }
    const ready = (low.length === 2);
    setBtn.disabled = !ready;
    if (ready) {
      const legal = isLegalSplit(high, low);
      if (!legal) {
        setHint('⚠ Foul: your low hand outranks your high. Pick a different low hand or "Set the house way".');
        setBtn.disabled = true;
      } else {
        setHint('Looks good. Press "Set hand" to compare against the dealer.');
      }
    } else if (state.phase === 'dealt') {
      setHint(`Tap two cards to send to your low hand (${low.length}/2 selected).`);
    }
  }

  function newDeal() {
    if (currentBet <= 0 || currentBet > bankroll) {
      setHint('Pick a bet amount first.');
      return;
    }
    state.deck = shuffle(buildDeck());
    state.yourCards = state.deck.splice(0, 7);
    state.dealerCards = state.deck.splice(0, 7);
    /* Sort player's hand high-to-low so they can read it. */
    state.yourCards = sortByRankDesc(state.yourCards);
    /* Seed with the house-way split so all 7 painted slots fill on deal.
       The user can then tap any two cards to swap between high and low. */
    const seed = houseWaySplit(state.yourCards);
    state.yourLow = seed.low.slice();
    state.selectedCard = null;
    state.dealerHigh = [];
    state.dealerLow = [];
    state.phase = 'dealt';

    renderPlayerHands();
    renderHand(dealerHigh, []);
    renderHand(dealerLow,  []);
    dealerStrength.textContent = '—';
    youStrength.textContent = '—';
    youStatus.textContent = 'Tap to swap · or use House Way';
    dealerStatus.textContent = 'Awaiting your set';

    dealBtn.disabled = true;
    setBtn.disabled = true;
    houseWayBtn.disabled = false;
    updatePlayerSummary();
    logLine(`Dealt: bet $${currentBet}.`);
    walkAdvance('deal');
  }

  function setHouseWay() {
    if (state.phase !== 'dealt') return;
    const split = houseWaySplit(state.yourCards);
    state.yourLow = split.low.slice();
    state.selectedCard = null;
    renderPlayerHands();
    updatePlayerSummary();
    setHint('House way set. Press "Set hand" to compare.');
    walkAdvance('set-low');
  }

  function settleHand() {
    if (state.phase !== 'dealt') return;
    const playerHigh = state.yourCards.filter(c => !state.yourLow.includes(c));
    const playerLow  = state.yourLow.slice();
    if (!isLegalSplit(playerHigh, playerLow)) {
      setHint('⚠ Cannot set: low hand outranks high. Adjust your selection.');
      return;
    }
    /* Dealer's split. */
    const dealerSplit = houseWaySplit(state.dealerCards);
    state.dealerHigh = dealerSplit.high;
    state.dealerLow  = dealerSplit.low;

    renderHand(dealerHigh, state.dealerHigh);
    renderHand(dealerLow,  state.dealerLow);

    const phs = bestFiveScore(playerHigh);
    const pls = bestTwoScore(playerLow);
    const dhs = bestFiveScore(state.dealerHigh);
    const dls = bestTwoScore(state.dealerLow);

    youStrength.textContent    = `${nameFiveScore(phs)} · ${nameTwoScore(pls)}`;
    dealerStrength.textContent = `${nameFiveScore(dhs)} · ${nameTwoScore(dls)}`;
    dealerStatus.textContent = 'Revealed';
    youStatus.textContent    = 'Compared';

    /* Compare. Tie ("copy") goes to the dealer per Pai Gow rule. */
    const highCmp = compareScore(phs, dhs);  /* >0 player wins, =0 dealer (copy), <0 dealer */
    const lowCmp  = compareScore(pls, dls);
    const playerWinsHigh = highCmp > 0;
    const playerWinsLow  = lowCmp  > 0;

    let resultText = '';
    let netDelta = 0;
    if (playerWinsHigh && playerWinsLow) {
      const win = Math.round(currentBet * 0.95);
      netDelta = win;
      bankroll += win;
      stats.w++; stats.net += win;
      resultText = `Win both. +${fmtMoney(win)} (after 5% commission).`;
      youStatus.textContent = '✓ Won both';
      dealerStatus.textContent = 'Lost both';
    } else if (!playerWinsHigh && !playerWinsLow) {
      netDelta = -currentBet;
      bankroll -= currentBet;
      stats.l++; stats.net -= currentBet;
      resultText = `Lose both. -${fmtMoney(currentBet)}.`;
      youStatus.textContent = '✗ Lost both';
      dealerStatus.textContent = 'Won both';
    } else {
      stats.p++;
      resultText = 'Push. One won, one lost. Bet returned.';
      youStatus.textContent = '· Push';
      dealerStatus.textContent = '· Push';
    }
    stats.hands++;
    updateBankroll();
    updateStats();
    logLine(`${nameFiveScore(phs)} vs ${nameFiveScore(dhs)} · ${resultText}`);

    state.phase = 'settled';
    setBtn.disabled = true;
    houseWayBtn.disabled = true;
    dealBtn.disabled = (currentBet <= 0 || currentBet > bankroll);
    setHint('Hand settled. Press "Deal Hand" to play again.');

    /* Hand the result to the walkthrough + explainer hooks. */
    walkAdvance('settle');
    maybeShowExplain({
      playerHigh, playerLow,
      dealerHigh: state.dealerHigh, dealerLow: state.dealerLow,
      phs, pls, dhs, dls,
      playerWinsHigh, playerWinsLow,
      copyHigh: highCmp === 0,
      copyLow:  lowCmp === 0,
      stake: currentBet,
      delta: netDelta,
      resultText
    });
  }

  function reset() {
    bankroll = 1000;
    stats = { hands: 0, w: 0, p: 0, l: 0, net: 0 };
    currentBet = 0;
    state.phase = 'idle';
    state.yourCards = state.dealerCards = state.yourLow = [];
    state.dealerHigh = state.dealerLow = [];
    state.selectedCard = null;
    document.querySelectorAll('[data-pg-bet]').forEach(b => b.classList.remove('selected'));
    hideTableChip();
    renderHand(youHigh, []);
    renderHand(youLow,  []);
    renderHand(dealerHigh, []);
    renderHand(dealerLow,  []);
    youStrength.textContent = dealerStrength.textContent = '—';
    youStatus.textContent = 'Place a bet to deal';
    dealerStatus.textContent = 'Awaiting deal';
    highSummary.textContent = lowSummary.textContent = '—';
    setBtn.disabled = true;
    houseWayBtn.disabled = true;
    dealBtn.disabled = true;
    setHint('Pick a bet amount, then press "Deal Hand".');
    updateBankroll();
    updateStats();
  }

  dealBtn.addEventListener('click', newDeal);
  houseWayBtn.addEventListener('click', setHouseWay);
  setBtn.addEventListener('click', settleHand);
  resetBtn.addEventListener('click', reset);

  /* ================================================================
     WALKTHROUGH COACH
     ----------------------------------------------------------------
     Floating step card that watches the simulator and advances when
     the user does the right thing. Runs once on first load (the
     intro pops up after a short delay) and any time the help "?"
     fab is clicked. Each step pulses a target element so it's clear
     what the user should look at next.
     ================================================================ */
  const walkEl       = document.getElementById('pgWalk');
  const walkStep     = document.getElementById('pgWalkStep');
  const walkTotal    = document.getElementById('pgWalkTotal');
  const walkBar      = document.getElementById('pgWalkBar');
  const walkTitle    = document.getElementById('pgWalkTitle');
  const walkBody     = document.getElementById('pgWalkBody');
  const walkNext     = document.getElementById('pgWalkNext');
  const walkSkip     = document.getElementById('pgWalkSkip');
  const walkHint     = document.getElementById('pgWalkHint');
  /* Golden CTA below the sim — primary trigger for the live walkthrough.
     The bottom-left "?" fab is reserved for the page-level intro tour
     (handled in interactions.js, same pattern as baccarat). */
  const walkTrigger  = document.getElementById('pgWalkTrigger');

  /* Each step lists the UI target to highlight, the body copy, and what
     advances it: 'next' means the user has to click Next; 'event' means
     it auto-advances when the named event fires (dispatched from inside
     the simulator hooks above). */
  const walkSteps = [
    {
      id: 'intro',
      target: '.sim',
      title: 'Quick walkthrough · <em>your first hand</em>',
      body: 'I\'ll walk you through one full hand of Pai Gow Poker — bet, deal, set, settle. Hit <strong>Next</strong> to start, or skip if you\'d rather poke around.',
      advance: 'next',
      hint: 'Five short steps · about 60 seconds.'
    },
    {
      id: 'bet',
      target: '.pg-controls .sim-chip-row',
      title: 'Step 1 · <em>Pick a stake</em>',
      body: 'Tap a chip — <strong>$5, $25, $100, or $500</strong> — to set your wager. Pai Gow has only one bet per hand, no Player/Banker/Tie split.',
      advance: 'event',
      event: 'bet',
      hint: 'Tap any chip in the action pill below the table.'
    },
    {
      id: 'deal',
      target: '#pgDealBtn',
      title: 'Step 2 · <em>Deal seven cards</em>',
      body: 'Press <strong>Deal Hand</strong>. You\'ll get seven cards face-up, sorted high-to-low so they\'re easy to read. The dealer also gets seven, but they stay hidden until you\'ve set your hand.',
      advance: 'event',
      event: 'deal',
      hint: 'Press the gold "Deal Hand" button.'
    },
    {
      id: 'set-low',
      target: '#pgYouHigh',
      title: 'Step 3 · <em>Adjust the split</em>',
      body: 'Cards are pre-split the <em>house way</em>. Tap a card to <strong>select</strong> it (gold halo), then tap a card in the other row to <strong>swap</strong> them. Or just hit Next to keep the default.',
      advance: 'next',
      hint: 'Tap to swap any HIGH card with any LOW card.'
    },
    {
      id: 'check-split',
      target: '#pgYouLow',
      title: 'Step 4 · <em>Check the split</em>',
      body: 'The summary panel below the table shows what each hand actually <strong>ranks as</strong>. <em>Your high hand must outrank your low.</em> If "Set hand" is greyed out, your low is too strong — swap again.',
      advance: 'next',
      hint: 'Read the summaries. Click Next when you\'re ready to settle.'
    },
    {
      id: 'settle',
      target: '#pgSetBtn',
      title: 'Step 5 · <em>Settle the hand</em>',
      body: 'Press <strong>Set hand</strong>. The dealer reveals their seven cards, splits them the house way, and we compare both pairs of hands. I\'ll pop a quick explainer afterwards so you can see exactly why you won, lost, or pushed.',
      advance: 'event',
      event: 'settle',
      hint: 'Press "Set hand" to compare against the dealer.'
    }
  ];

  let walkIdx = -1;
  let walkActive = false;
  let lastTargetEl = null;

  function clearWalkTarget() {
    if (lastTargetEl) {
      lastTargetEl.classList.remove('pg-walk-target');
      lastTargetEl = null;
    }
  }
  function setWalkTarget(selector) {
    clearWalkTarget();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('pg-walk-target');
    lastTargetEl = el;
  }

  function renderWalkStep() {
    if (!walkEl) return;
    const s = walkSteps[walkIdx];
    if (!s) return;
    walkStep.textContent = String(walkIdx + 1);
    walkTotal.textContent = String(walkSteps.length);
    walkBar.style.width = ((walkIdx + 1) / walkSteps.length * 100) + '%';
    walkTitle.innerHTML = s.title;
    walkBody.innerHTML = s.body;
    walkHint.textContent = s.hint || '';
    if (s.advance === 'next') {
      walkNext.hidden = false;
      walkNext.disabled = false;
      walkNext.textContent = (walkIdx === walkSteps.length - 1) ? 'Done' : 'Next →';
    } else {
      walkNext.hidden = true;
    }
    setWalkTarget(s.target);
    if (s.target) {
      const el = document.querySelector(s.target);
      if (el && !isInViewport(el)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
  function isInViewport(el) {
    const r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= window.innerHeight - 20;
  }

  function openWalk() {
    if (!walkEl) return;
    walkActive = true;
    walkIdx = 0;
    walkEl.removeAttribute('hidden');
    requestAnimationFrame(() => walkEl.classList.add('active'));
    renderWalkStep();
  }
  function closeWalk() {
    if (!walkEl) return;
    walkActive = false;
    walkEl.classList.remove('active');
    setTimeout(() => walkEl.setAttribute('hidden', ''), 300);
    clearWalkTarget();
  }
  function walkAdvance(eventName) {
    if (!walkActive) return;
    const s = walkSteps[walkIdx];
    if (!s || s.advance !== 'event' || s.event !== eventName) return;
    if (walkIdx >= walkSteps.length - 1) {
      closeWalk();
      return;
    }
    walkIdx += 1;
    renderWalkStep();
  }
  function walkNextClick() {
    if (!walkActive) return;
    if (walkIdx >= walkSteps.length - 1) {
      closeWalk();
      return;
    }
    walkIdx += 1;
    renderWalkStep();
  }

  walkNext?.addEventListener('click', walkNextClick);
  walkSkip?.addEventListener('click', closeWalk);
  walkTrigger?.addEventListener('click', () => {
    /* Reset the simulator state so the steps line up with what the user
       actually sees. Then start the walkthrough. */
    reset();
    document.querySelector('#sec-sim')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(openWalk, 350);
  });

  /* Note: no auto-open. The first-visit page-level intro tour
     (interactions.js openTour) handles "what is this site?". The
     in-game live walkthrough is opt-in via the golden CTA below the
     simulator and the bottom-left "?" fab — kept that way to avoid
     two modals fighting on first load. */

  /* ================================================================
     OUTCOME EXPLAINER
     ----------------------------------------------------------------
     Pops up after the first 1–2 settled hands with a side-by-side
     recap of both hand comparisons and a plain-English "why".
     Pauses subsequent dealing? — no, the simulator deals on click,
     so the explainer just sits there until dismissed.
     ================================================================ */
  const explainEl       = document.getElementById('pgExplain');
  const explainStepEl   = document.getElementById('pgExplainStep');
  const explainTitleEl  = document.getElementById('pgExplainTitle');
  const explainPairEl   = document.getElementById('pgExplainPair');
  const explainWhyEl    = document.getElementById('pgExplainWhy');
  const explainResultEl = document.getElementById('pgExplainResult');
  const explainNoteEl   = document.getElementById('pgExplainNote');
  const explainNextBtn  = document.getElementById('pgExplainNext');
  const explainBackdrop = document.getElementById('pgExplainBackdrop');

  let explainsShown = 0;

  function buildExplainText(o) {
    /* Headline. */
    let title;
    if (o.playerWinsHigh && o.playerWinsLow) {
      title = 'You win both hands';
    } else if (!o.playerWinsHigh && !o.playerWinsLow) {
      title = 'Dealer wins both hands';
    } else {
      title = 'Push — one each';
    }

    /* Per-hand verdict rows. */
    function verdictRow(label, you, them, youWins, copy) {
      let cls, text;
      if (copy) { cls = 'lose'; text = 'copy → dealer'; }
      else if (youWins) { cls = 'win'; text = 'you win'; }
      else { cls = 'lose'; text = 'dealer wins'; }
      return `
        <div>
          <span class="lbl">${label}</span>
          <div class="row"><span>You</span><strong>${you}</strong></div>
          <div class="row"><span>Dealer</span><strong>${them}</strong></div>
          <div class="row ${cls}"><span>Verdict</span><strong>${text}</strong></div>
        </div>`;
    }
    const pair =
      verdictRow('High · 5 cards', nameFiveScore(o.phs), nameFiveScore(o.dhs), o.playerWinsHigh, o.copyHigh) +
      verdictRow('Low · 2 cards',  nameTwoScore(o.pls),  nameTwoScore(o.dls),  o.playerWinsLow,  o.copyLow);

    /* Why. */
    let why;
    if (o.playerWinsHigh && o.playerWinsLow) {
      why = 'You beat the dealer on <strong>both</strong> hands — that\'s the only outcome that pays. About <em>28% of hands</em> end this way.';
    } else if (!o.playerWinsHigh && !o.playerWinsLow) {
      const copyNote = (o.copyHigh || o.copyLow)
        ? ' One of your hands tied the dealer exactly — that\'s a <em>copy</em>, and copies always go to the dealer.'
        : '';
      why = 'Dealer beat you on both hands, so the bet is collected.' + copyNote + ' About <em>30% of hands</em> end this way.';
    } else {
      why = 'You won one hand and lost the other — that\'s a <strong>push</strong>. Your bet is returned and nothing changes hands. About <em>40% of hands</em> end this way, which is why a single chip lasts so long at a Pai Gow table.';
    }

    /* Result line + payout note. */
    let resultText;
    if (o.delta > 0) {
      resultText = `You bet <strong>${fmtMoney(o.stake)}</strong> · win <strong class="jade">${fmtMoney(o.delta)}</strong> (1:1 minus the standard 5% commission).`;
    } else if (o.delta < 0) {
      resultText = `You bet <strong>${fmtMoney(o.stake)}</strong> · <strong class="carmine">lose ${fmtMoney(-o.delta)}</strong>.`;
    } else {
      resultText = `You bet <strong>${fmtMoney(o.stake)}</strong> · <strong>push</strong>, your stake is returned.`;
    }

    return { title, pair, why, resultText };
  }

  function maybeShowExplain(outcome) {
    if (!explainEl) return;
    if (explainsShown >= 2) return; /* only the first two */
    const txt = buildExplainText(outcome);
    explainsShown += 1;
    explainStepEl.textContent = `Hand ${explainsShown} · why`;
    explainTitleEl.textContent = txt.title;
    explainPairEl.innerHTML = txt.pair;
    explainWhyEl.innerHTML = txt.why;
    explainResultEl.innerHTML = txt.resultText;
    explainNoteEl.textContent = explainsShown < 2
      ? 'One more quick explainer, then it plays at full speed.'
      : 'Last one — from here on it plays without popups.';
    explainEl.removeAttribute('hidden');
    requestAnimationFrame(() => explainEl.classList.add('active'));
  }
  function hideExplain() {
    if (!explainEl) return;
    explainEl.classList.remove('active');
    setTimeout(() => explainEl.setAttribute('hidden', ''), 260);
  }
  explainNextBtn?.addEventListener('click', hideExplain);
  explainBackdrop?.addEventListener('click', hideExplain);

  /* Boot. */
  reset();
})();
