/* ============================================================
   LIVE SIMULATOR
   ============================================================ */
(function initSim() {
  let bankroll = 1000;
  let chipSize = 25;
  let currentBet = null;
  let stats = { hands: 0, p: 0, b: 0, t: 0, net: 0 };
  let recentHands = [];
  let variant = 'puntobanco';

  const bankrollEl = document.getElementById('bankroll');
  const simPlayer = document.getElementById('simPlayer');
  const simBanker = document.getElementById('simBanker');
  const simPlayerTotal = document.getElementById('simPlayerTotal');
  const simBankerTotal = document.getElementById('simBankerTotal');
  const simPlayerLabel = document.getElementById('simPlayerLabel');
  const simBankerLabel = document.getElementById('simBankerLabel');
  const simTitleEl = document.getElementById('simTitle');
  const simSubEl = document.getElementById('simSub');
  const simRulesBodyEl = document.getElementById('simRulesBody');
  const dealBtn = document.getElementById('dealBtn');
  const autoBtn = document.getElementById('autoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const simLog = document.getElementById('simLog');
  const simEl = document.querySelector('.sim');

  /* ---- Per-variant configuration ---- */
  const VARIANTS = {
    puntobanco: {
      title: 'Punto Banco <span style="color:var(--gold-bright); font-style: italic;">· Live</span>',
      sub: '8-deck shoe · Banker wins pay 0.95:1 · Tie pays 8:1',
      mark: '百家樂',
      playerLabel: 'Punto · Player',
      bankerLabel: 'Banco · Banker',
      rules: 'Two cards are dealt to Player and Banker. Cards 2–9 count face value, 10s and courts count zero, Aces count 1. Hand totals <strong>drop the tens digit</strong> (so 7 + 8 = 15 → 5). A third card may be drawn for either side following a fixed <em>tableau</em> the dealer handles for you. Closest to 9 wins.',
      stats: { p: 'Player Wins', b: 'Banker Wins', t: 'Ties' },
      bets: [
        { key: 'player', label: 'Player · 1:1',     payout: '1.00×', edge: 'edge 1.24%', chip: 'P' },
        { key: 'tie',    label: 'Tie · 8:1',        payout: '8.00×', edge: 'edge 14.36%', chip: 'T' },
        { key: 'banker', label: 'Banker · 0.95:1',  payout: '0.95×', edge: 'edge 1.06%', chip: 'B' },
      ],
    },
    mini: {
      title: 'Mini Baccarat <span style="color:var(--gold-bright); font-style: italic;">· Live</span>',
      sub: 'One dealer · Lower minimums · Same Punto Banco math · Faster tempo',
      mark: '迷你 · 百家樂',
      playerLabel: 'Punto · Player',
      bankerLabel: 'Banco · Banker',
      rules: 'Mechanically <strong>identical to Punto Banco</strong> — same drawing rules, same payouts (Banker 0.95:1, Player 1:1, Tie 8:1). What changes is the room: smaller table, single dealer, no card-squeeze ritual, and you never handle the cards. The pace is faster, which usually means more hands per hour for the same edge.',
      stats: { p: 'Player Wins', b: 'Banker Wins', t: 'Ties' },
      bets: [
        { key: 'player', label: 'Player · 1:1',     payout: '1.00×', edge: 'edge 1.24%', chip: 'P' },
        { key: 'tie',    label: 'Tie · 8:1',        payout: '8.00×', edge: 'edge 14.36%', chip: 'T' },
        { key: 'banker', label: 'Banker · 0.95:1',  payout: '0.95×', edge: 'edge 1.06%', chip: 'B' },
      ],
    },
    dragontiger: {
      title: 'Dragon Tiger <span style="color:var(--gold-bright); font-style: italic;">· Live</span>',
      sub: 'Single card each side · Higher rank wins · Aces low, Kings high',
      mark: '龍 · 虎',
      playerLabel: 'Dragon · 龍',
      bankerLabel: 'Tiger · 虎',
      rules: '<strong>One card</strong> to each side — Dragon and Tiger. Aces count low (1), Kings high (13). The <strong>higher card wins</strong> — no totals, no third cards, no drawing tableau. Bet Dragon, Tiger, or Tie. Dragon and Tiger pay 1:1; Tie pays 8:1, but on a tie <em>Dragon and Tiger bets lose</em>. Simplest game in the baccarat family.',
      stats: { p: 'Dragon Wins', b: 'Tiger Wins', t: 'Ties' },
      bets: [
        { key: 'dragon', label: 'Dragon · 1:1', payout: '1.00×', edge: 'edge 3.73%', chip: '龍' },
        { key: 'tie',    label: 'Tie · 8:1',    payout: '8.00×', edge: 'edge 32.77%', chip: 'T' },
        { key: 'tiger',  label: 'Tiger · 1:1',  payout: '1.00×', edge: 'edge 3.73%', chip: '虎' },
      ],
    },
  };

  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function updateBankroll() {
    bankrollEl.textContent = fmtMoney(bankroll);
    bankrollEl.className = 'sim-bankroll-value' + (bankroll < 1000 ? ' down' : bankroll > 1000 ? ' up' : '');
  }

  function updateStats() {
    document.getElementById('statHands').textContent = stats.hands;
    document.getElementById('statP').textContent = stats.p;
    document.getElementById('statB').textContent = stats.b;
    document.getElementById('statT').textContent = stats.t;
    const net = document.getElementById('statNet');
    net.textContent = fmtMoney(stats.net);
    net.className = 'sim-stat-value ' + (stats.net > 0 ? 'jade' : stats.net < 0 ? 'carmine' : '');
  }

  /* Chips */
  document.querySelectorAll('.chip-btn').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip-btn').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      chipSize = parseInt(c.dataset.chip, 10);
    });
  });

  /* Bet boxes */
  document.querySelectorAll('.bet-box').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.bet-box').forEach(x => x.classList.remove('selected', 'winner'));
      b.classList.add('selected');
      currentBet = b.dataset.bet;
      dealBtn.disabled = false;
    });
  });

  /* Full Punto Banco dealer logic */
  function makeShoe() {
    const ranks = ['A','2','3','4','5','6','7','8','9','T','J','Q','K'];
    const suits = ['S','H','D','C'];
    const deck = [];
    for (let d = 0; d < 8; d++) {
      for (const s of suits) for (const r of ranks) deck.push(r + s);
    }
    /* fisher-yates */
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  let shoe = makeShoe();

  function playCoup() {
    if (shoe.length < 10) shoe = makeShoe();
    const player = [shoe.pop(), shoe.pop()];
    const banker = [shoe.pop(), shoe.pop()];
    const pT = handTotal(player);
    const bT = handTotal(banker);

    /* Natural */
    if (pT >= 8 || bT >= 8) {
      return { player, banker, pT, bT, outcome: pT > bT ? 'player' : pT < bT ? 'banker' : 'tie' };
    }

    /* Player rule */
    let playerThird = null;
    if (pT <= 5) {
      playerThird = shoe.pop();
      player.push(playerThird);
    }

    /* Banker rule */
    const playerNewT = handTotal(player);
    let bankerDraws = false;
    if (playerThird === null) {
      /* Player stood — Banker draws on 0-5, stands on 6-7 */
      bankerDraws = bT <= 5;
    } else {
      const pThirdVal = cardValue(playerThird);
      if (bT <= 2) bankerDraws = true;
      else if (bT === 3) bankerDraws = pThirdVal !== 8;
      else if (bT === 4) bankerDraws = pThirdVal >= 2 && pThirdVal <= 7;
      else if (bT === 5) bankerDraws = pThirdVal >= 4 && pThirdVal <= 7;
      else if (bT === 6) bankerDraws = pThirdVal >= 6 && pThirdVal <= 7;
      /* bT === 7 always stands */
    }
    if (bankerDraws) banker.push(shoe.pop());

    const finalP = handTotal(player);
    const finalB = handTotal(banker);
    return {
      player, banker,
      pT: finalP, bT: finalB,
      outcome: finalP > finalB ? 'player' : finalP < finalB ? 'banker' : 'tie'
    };
  }

  /* Dragon Tiger: single card each side, higher rank wins.
     A=1 lowest, K=13 highest. Suits don't matter for outcome. */
  const RANK_DT = { 'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13 };
  function dtRank(card) { return RANK_DT[card[0]]; }
  function rankName(card) {
    const r = card[0];
    return r === 'T' ? '10' : r === 'A' ? 'A' : r === 'J' ? 'J' : r === 'Q' ? 'Q' : r === 'K' ? 'K' : r;
  }

  function playDragonTiger() {
    if (shoe.length < 4) shoe = makeShoe();
    const dragon = shoe.pop();
    const tiger = shoe.pop();
    const dR = dtRank(dragon);
    const tR = dtRank(tiger);
    return {
      player: [dragon],   /* reuse the player slot for Dragon */
      banker: [tiger],    /* reuse the banker slot for Tiger */
      pT: dR, bT: tR,
      outcome: dR > tR ? 'dragon' : dR < tR ? 'tiger' : 'tie',
      isDT: true,
    };
  }

  function addLog(line, cls = '') {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).slice(0, 8);
    const l = document.createElement('div');
    l.className = 'sim-log-line';
    l.innerHTML = `<span class="time">${time}</span><span class="${cls}">${line}</span>`;
    simLog.insertBefore(l, simLog.firstChild);
    while (simLog.children.length > 50) simLog.removeChild(simLog.lastChild);
  }

  function renderHand(el, cards, totalEl, label) {
    el.innerHTML = '';
    cards.forEach((c, i) => {
      setTimeout(() => {
        const card = buildCardEl(c, 54);
        card.classList.add('dealing');
        el.appendChild(card);
      }, i * 280);
    });
    setTimeout(() => {
      totalEl.textContent = handTotal(cards);
    }, cards.length * 280);
  }

  function dealHand() {
    if (!currentBet) return;
    if (bankroll < chipSize) {
      addLog('Insufficient bankroll for bet', 'loss');
      return;
    }

    /* Capture at deal time — currentBet/chipSize could drift if the user
       clicks other controls during card animation; the settle timeout
       and the explainer need the values that were actually wagered. */
    const betForHand = currentBet;
    const stakeForHand = chipSize;
    const bankrollBefore = bankroll;

    bankroll -= chipSize;
    updateBankroll();

    /* Play — dispatch on variant. */
    const result = variant === 'dragontiger' ? playDragonTiger() : playCoup();

    /* Render */
    simPlayer.innerHTML = '';
    simBanker.innerHTML = '';
    simPlayerTotal.textContent = '';
    simBankerTotal.textContent = '';

    renderHand(simPlayer, result.player, simPlayerTotal);
    renderHand(simBanker, result.banker, simBankerTotal);

    /* For Dragon Tiger the "total" displayed is the card rank, not the
       baccarat hand total — overwrite after renderHand sets it. */
    if (result.isDT) {
      setTimeout(() => {
        simPlayerTotal.textContent = result.pT;
        simBankerTotal.textContent = result.bT;
      }, result.player.length * 280);
    }

    const settleDelay = Math.max(result.player.length, result.banker.length) * 280 + 600;
    dealBtn.disabled = true;

    setTimeout(() => {
      stats.hands++;
      /* Stats slots p/b/t map to: dragon/tiger/tie in DT, player/banker/tie elsewhere. */
      const sKey =
        (result.outcome === 'player' || result.outcome === 'dragon') ? 'p'
        : (result.outcome === 'banker' || result.outcome === 'tiger') ? 'b'
        : 't';
      stats[sKey]++;

      /* Record outcome for the live Big Road — same p/b/t mapping. */
      roadOutcomes.push(sKey);
      if (roadOutcomes.length > MAX_ROAD_LEN) roadOutcomes.shift();
      renderSimRoad();

      document.querySelectorAll('.bet-box').forEach(b => b.classList.remove('winner'));
      const winnerBox = document.querySelector(`.bet-box[data-bet="${result.outcome}"]`);
      if (winnerBox) winnerBox.classList.add('winner');

      let delta = 0;
      let outcomeText = '';

      if (variant === 'dragontiger') {
        const dragonCard = rankName(result.player[0]);
        const tigerCard  = rankName(result.banker[0]);
        const cardLine   = `${dragonCard} vs ${tigerCard}`;
        const won = currentBet === result.outcome;

        if (won && result.outcome !== 'tie') {
          delta = chipSize * 2; /* 1:1 + stake back */
          const sideName = result.outcome === 'dragon' ? 'Dragon' : 'Tiger';
          outcomeText = `${sideName} wins · ${cardLine} · you +${fmtMoney(chipSize)}`;
          bankroll += delta;
          stats.net += chipSize;
          addLog(outcomeText, 'win');
        } else if (won && result.outcome === 'tie') {
          delta = chipSize + chipSize * 8; /* 8:1 */
          outcomeText = `TIE · ${cardLine} · you +${fmtMoney(chipSize * 8)}`;
          bankroll += delta;
          stats.net += chipSize * 8;
          addLog(outcomeText, 'win');
        } else {
          /* Loss — no push for Dragon/Tiger on a tie in this ruleset */
          stats.net -= chipSize;
          const sideName = result.outcome === 'dragon' ? 'Dragon' : result.outcome === 'tiger' ? 'Tiger' : 'TIE';
          outcomeText = `${sideName} · ${cardLine} · you -${fmtMoney(chipSize)}`;
          addLog(outcomeText, 'loss');
        }
      } else {
        /* Punto Banco / Mini Baccarat — same engine, same payouts. */
        if (currentBet === result.outcome) {
          if (result.outcome === 'player')      { delta = chipSize * 2;          outcomeText = `Player wins ${result.pT}–${result.bT} · you +${fmtMoney(chipSize)}`; }
          else if (result.outcome === 'banker') { delta = chipSize + chipSize * 0.95; outcomeText = `Banker wins ${result.bT}–${result.pT} · you +${fmtMoney(chipSize * 0.95)}`; }
          else                                  { delta = chipSize + chipSize * 8;    outcomeText = `TIE ${result.pT}–${result.bT} · you +${fmtMoney(chipSize * 8)}`; }
          bankroll += delta;
          stats.net += delta - chipSize;
          addLog(outcomeText, 'win');
        } else if (result.outcome === 'tie' && currentBet !== 'tie') {
          /* Push on tie when betting Player or Banker */
          bankroll += chipSize;
          outcomeText = `TIE ${result.pT}–${result.bT} · push, bet returned`;
          addLog(outcomeText, 'tie');
        } else {
          stats.net -= chipSize;
          if (result.outcome === 'player')      outcomeText = `Player wins ${result.pT}–${result.bT} · you -${fmtMoney(chipSize)}`;
          else if (result.outcome === 'banker') outcomeText = `Banker wins ${result.bT}–${result.pT} · you -${fmtMoney(chipSize)}`;
          else                                  outcomeText = `TIE ${result.pT}–${result.bT} · you -${fmtMoney(chipSize)}`;
          addLog(outcomeText, 'loss');
        }
      }

      updateBankroll();
      updateStats();
      dealBtn.disabled = false;

      /* First 2 hands: explain the result so a new player learns why they
         won or lost. After that the sim runs quietly. */
      if (explainsShown < 2) {
        let status;
        if (variant === 'dragontiger') {
          status = (betForHand === result.outcome) ? 'win' : 'loss';
        } else if (betForHand === result.outcome) {
          status = 'win';
        } else if (result.outcome === 'tie' && betForHand !== 'tie') {
          status = 'push';
        } else {
          status = 'loss';
        }
        showExplain(result, betForHand, stakeForHand, bankroll - bankrollBefore, status);
      }
    }, settleDelay);
  }

  dealBtn.addEventListener('click', dealHand);

  /* ============================================================
     LIVE BIG ROAD
     Rebuilt from roadOutcomes after every settle. Streaks stack
     top-to-bottom; a switch starts a new column. If a column fills
     6 rows the streak "turns right" (dragon tail) — the standard
     scoreboard behaviour players see in Macau rooms. Ties don't
     create cells; they accumulate as a corner mark on whatever the
     last non-tie cell is. */

  const simBigRoadEl = document.getElementById('simBigRoad');
  const simRoadsLegendP = document.getElementById('simRoadsLegendP');
  const simRoadsLegendB = document.getElementById('simRoadsLegendB');
  const BIG_ROAD_COLS = 24;
  const BIG_ROAD_ROWS = 6;
  const MAX_ROAD_LEN = 200;
  let roadOutcomes = [];

  function buildBigRoadCells(outcomes) {
    const occupied = {};                /* "c,r" -> index into cells */
    const cells = [];
    const key = (c, r) => c + ',' + r;

    let curCol = -1, curRow = -1, lastMain = null;
    let leadingTies = 0;

    for (const o of outcomes) {
      if (o === 't') {
        if (cells.length === 0) leadingTies++;
        else cells[cells.length - 1].ties = (cells[cells.length - 1].ties || 0) + 1;
        continue;
      }

      if (lastMain === null) {
        const cell = { col: 0, row: 0, type: o, ties: leadingTies };
        cells.push(cell);
        occupied[key(0, 0)] = cell;
        curCol = 0; curRow = 0;
        lastMain = o;
        continue;
      }

      if (o === lastMain) {
        /* Continue the streak: try one row down in the same column.
           If the next row is out of bounds or already occupied by an
           earlier dragon tail, slide right along the current row. */
        let nextCol = curCol;
        let nextRow = curRow + 1;
        if (nextRow >= BIG_ROAD_ROWS || occupied[key(nextCol, nextRow)]) {
          nextRow = curRow;
          nextCol = curCol + 1;
          while (occupied[key(nextCol, nextRow)]) nextCol++;
        }
        if (nextCol >= BIG_ROAD_COLS) continue; /* ran off the grid */
        const cell = { col: nextCol, row: nextRow, type: o, ties: 0 };
        cells.push(cell);
        occupied[key(nextCol, nextRow)] = cell;
        curCol = nextCol; curRow = nextRow;
      } else {
        /* Switch: start a new column after the current one. Skip any
           columns whose top row is already occupied by a prior tail. */
        let nextCol = curCol + 1;
        while (occupied[key(nextCol, 0)]) nextCol++;
        if (nextCol >= BIG_ROAD_COLS) continue;
        const cell = { col: nextCol, row: 0, type: o, ties: 0 };
        cells.push(cell);
        occupied[key(nextCol, 0)] = cell;
        curCol = nextCol; curRow = 0;
        lastMain = o;
      }
    }

    return cells;
  }

  function renderSimRoad() {
    if (!simBigRoadEl) return;
    if (!roadOutcomes.length) {
      simBigRoadEl.innerHTML = '<div class="sim-big-road-empty">No hands yet. Deal a few and your road fills in left-to-right.</div>';
      return;
    }

    /* If we have more cells than fit, drop oldest columns so the newest
       hands stay visible on the right edge. */
    let cells = buildBigRoadCells(roadOutcomes);
    if (cells.length) {
      const maxCol = Math.max(...cells.map(c => c.col));
      if (maxCol >= BIG_ROAD_COLS) {
        const shift = maxCol - BIG_ROAD_COLS + 1;
        cells = cells
          .map(c => ({ ...c, col: c.col - shift }))
          .filter(c => c.col >= 0);
      }
    }

    simBigRoadEl.innerHTML = cells.map(c => {
      const tie = c.ties ? '<span class="tie-mark" aria-label="tie"></span>' : '';
      return `<div class="road-cell ${c.type}" style="grid-column:${c.col + 1};grid-row:${c.row + 1};">${tie}</div>`;
    }).join('');
  }

  renderSimRoad();

  /* ============================================================
     HAND-RESULT EXPLAINER
     Fires after hands 1 and 2 settle. Pauses the auto-deal loop
     until the user dismisses it; no popup from hand 3 onward. */

  const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  function readableCard(code) {
    const rank = code[0] === 'T' ? '10' : code[0];
    const glyph = SUIT_GLYPH[code[1]] || '';
    const red = code[1] === 'H' || code[1] === 'D';
    return `<span class="sim-explain-cd${red ? ' red' : ''}">${rank}${glyph}</span>`;
  }

  const explainEl = document.getElementById('simExplain');
  const explainStepEl = document.getElementById('simExplainStep');
  const explainTitleEl = document.getElementById('simExplainTitle');
  const explainRecapEl = document.getElementById('simExplainRecap');
  const explainWhyEl = document.getElementById('simExplainWhy');
  const explainResultEl = document.getElementById('simExplainResult');
  const explainNoteEl = document.getElementById('simExplainNote');
  const explainNextBtn = document.getElementById('simExplainNext');
  const explainBackdrop = document.getElementById('simExplainBackdrop');

  let explainsShown = 0;
  let explainActive = false;

  function buildExplainText(result, bet, stake, delta, status) {
    const betName = (
      bet === 'player' ? 'Player' :
      bet === 'banker' ? 'Banker' :
      bet === 'dragon' ? 'Dragon' :
      bet === 'tiger'  ? 'Tiger'  :
      'Tie'
    );

    /* Dragon Tiger — single card each side. */
    if (result.isDT) {
      const dRank = RANK_DT[result.player[0][0]];
      const tRank = RANK_DT[result.banker[0][0]];
      const recap = `Dragon — ${readableCard(result.player[0])} (rank ${dRank})<br>Tiger — ${readableCard(result.banker[0])} (rank ${tRank})`;

      let title, why;
      if (result.outcome === 'tie') {
        title = `Tie · both cards rank ${dRank}`;
        why = 'Dragon and Tiger drew the same rank. On a tie, Dragon and Tiger bets <strong>lose</strong> — only the Tie bet collects (at 8:1).';
      } else {
        const winName = result.outcome === 'dragon' ? 'Dragon' : 'Tiger';
        const winR = result.outcome === 'dragon' ? dRank : tRank;
        const loseR = result.outcome === 'dragon' ? tRank : dRank;
        title = `${winName} wins · rank ${winR} beats ${loseR}`;
        why = `Higher card rank wins (A = 1 low, K = 13 high). ${winName} is higher, so ${winName} takes it.`;
      }

      let resultText;
      if (status === 'win') {
        resultText = `You bet <strong>${betName}</strong> — you win <strong class="jade">${fmtMoney(delta)}</strong>.`;
      } else {
        resultText = `You bet <strong>${betName}</strong> — <strong class="carmine">you lose ${fmtMoney(stake)}</strong>.`;
      }
      return { title, recap, why, resultText };
    }

    /* Punto Banco / Mini — totals with possible third cards. */
    const pT = result.pT;
    const bT = result.bT;
    const pSum = result.player.reduce((a, c) => a + cardValue(c), 0);
    const bSum = result.banker.reduce((a, c) => a + cardValue(c), 0);
    const pCards = result.player.map(readableCard).join(' + ');
    const bCards = result.banker.map(readableCard).join(' + ');
    const pLine = `Player — ${pCards} = ${pSum}${pSum >= 10 ? ' → ' + pT : ''}`;
    const bLine = `Banker — ${bCards} = ${bSum}${bSum >= 10 ? ' → ' + bT : ''}`;
    const recap = `${pLine}<br>${bLine}`;

    let title, why;
    if (result.outcome === 'tie') {
      title = `Tie · both at ${pT}`;
      why = `Both hands finished at ${pT}, so neither is closer to 9. Tie bets pay 8:1; Player and Banker bets <strong>push</strong> — your stake is returned.`;
    } else {
      const winName = result.outcome === 'player' ? 'Player' : 'Banker';
      const winT  = result.outcome === 'player' ? pT : bT;
      const loseT = result.outcome === 'player' ? bT : pT;
      title = `${winName} wins · ${winT} beats ${loseT}`;

      const natural = result.player.length === 2 && result.banker.length === 2 && (pT >= 8 || bT >= 8);
      if (natural) {
        why = `${winName}'s ${winT} is a <em>natural</em> (8 or 9 on the first two cards). A natural ends the coup immediately — no third card for either side.`;
      } else if (result.player.length === 3 || result.banker.length === 3) {
        const parts = [];
        if (result.player.length === 3) {
          const firstTwo = handTotal(result.player.slice(0, 2));
          parts.push(`Player drew a third card (${readableCard(result.player[2])}) — the two-card total was ${firstTwo}, and the rule is draw on 0–5.`);
        }
        if (result.banker.length === 3) {
          parts.push(`Banker drew a third card (${readableCard(result.banker[2])}) per the tableau.`);
        }
        parts.push(`Closest to 9 wins — ${winName} at ${winT}.`);
        why = parts.join(' ');
      } else {
        why = `Both hands stood on their first two cards (6 or 7 each side, no natural). ${winName}'s ${winT} is closer to 9.`;
      }
    }

    let resultText;
    if (status === 'win') {
      const payoutNote = bet === 'banker' ? ' (0.95:1 after the 5% commission)' : bet === 'tie' ? ' (8:1)' : ' (1:1)';
      resultText = `You bet <strong>${betName}</strong> — you win <strong class="jade">${fmtMoney(delta)}</strong>${payoutNote}.`;
    } else if (status === 'push') {
      resultText = `You bet <strong>${betName}</strong> — a tie pushes Player and Banker bets, so your <strong>${fmtMoney(stake)}</strong> is returned.`;
    } else {
      resultText = `You bet <strong>${betName}</strong> — <strong class="carmine">you lose ${fmtMoney(stake)}</strong>.`;
    }
    return { title, recap, why, resultText };
  }

  function showExplain(result, bet, stake, delta, status) {
    if (!explainEl) return;
    const txt = buildExplainText(result, bet, stake, delta, status);
    explainsShown += 1;
    explainStepEl.textContent = `Hand ${explainsShown} · why`;
    explainTitleEl.textContent = txt.title;
    explainRecapEl.innerHTML = txt.recap;
    explainWhyEl.innerHTML = txt.why;
    explainResultEl.innerHTML = txt.resultText;
    explainNoteEl.textContent = explainsShown < 2
      ? 'One more quick explainer, then it plays at full speed.'
      : 'Last one — from here on it plays without popups.';
    explainEl.removeAttribute('hidden');
    requestAnimationFrame(() => explainEl.classList.add('active'));
    explainActive = true;
  }

  function hideExplain() {
    if (!explainEl) return;
    explainEl.classList.remove('active');
    setTimeout(() => explainEl.setAttribute('hidden', ''), 260);
    explainActive = false;
  }

  if (explainNextBtn) explainNextBtn.addEventListener('click', hideExplain);
  if (explainBackdrop) explainBackdrop.addEventListener('click', hideExplain);

  /* Auto-deal */
  autoBtn.addEventListener('click', () => {
    if (!currentBet) {
      addLog('Pick a bet first (Player / Banker / Tie)', 'loss');
      return;
    }
    let count = 25;
    autoBtn.disabled = true;
    autoBtn.textContent = 'Running…';
    const tick = () => {
      if (count <= 0 || bankroll < chipSize) {
        autoBtn.disabled = false;
        autoBtn.textContent = 'Auto ×25';
        return;
      }
      /* Pause auto-progression while an explainer is visible — resume
         once the user clicks Continue (or the backdrop). */
      if (explainActive) {
        setTimeout(tick, 200);
        return;
      }
      dealHand();
      count--;
      setTimeout(tick, 1400);
    };
    tick();
  });

  function resetSim() {
    bankroll = 1000;
    stats = { hands: 0, p: 0, b: 0, t: 0, net: 0 };
    shoe = makeShoe();
    simPlayer.innerHTML = '';
    simBanker.innerHTML = '';
    simPlayerTotal.textContent = '';
    simBankerTotal.textContent = '';
    document.querySelectorAll('.bet-box').forEach(b => b.classList.remove('selected', 'winner'));
    currentBet = null;
    dealBtn.disabled = true;
    simLog.innerHTML = '<div class="sim-log-line"><span class="time">—</span><span>Shoe re-shuffled. Place a bet to begin.</span></div>';
    explainsShown = 0;
    hideExplain();
    roadOutcomes = [];
    renderSimRoad();
    updateBankroll();
    updateStats();
  }
  resetBtn.addEventListener('click', resetSim);

  /* ---- Variant switcher: rewires bet boxes, labels, rules, stats ---- */
  function applyVariant(v) {
    const cfg = VARIANTS[v];
    if (!cfg) return;
    variant = v;
    if (simEl) simEl.setAttribute('data-variant', v);

    /* Variant pill picker */
    document.querySelectorAll('.sim-variant').forEach(b => {
      const isActive = b.dataset.variant === v;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    /* Title / sub / rules / hand labels */
    if (simTitleEl)     simTitleEl.innerHTML = cfg.title;
    if (simSubEl)       simSubEl.textContent = cfg.sub;
    if (simRulesBodyEl) simRulesBodyEl.innerHTML = cfg.rules;
    if (simPlayerLabel) simPlayerLabel.textContent = cfg.playerLabel;
    if (simBankerLabel) simBankerLabel.textContent = cfg.bankerLabel;

    /* Felt printed mark at the top of the table */
    const markEl = document.querySelector('.sim-table-mark');
    if (markEl && cfg.mark) markEl.textContent = cfg.mark;

    /* Stats labels (Dragon Wins / Tiger Wins for DT, Player/Banker otherwise) */
    const statP = document.getElementById('statP')?.parentElement?.querySelector('.sim-stat-label');
    const statB = document.getElementById('statB')?.parentElement?.querySelector('.sim-stat-label');
    const statT = document.getElementById('statT')?.parentElement?.querySelector('.sim-stat-label');
    if (statP) statP.textContent = cfg.stats.p;
    if (statB) statB.textContent = cfg.stats.b;
    if (statT) statT.textContent = cfg.stats.t;

    /* Big-road legend — shows Player/Banker or Dragon/Tiger per variant. */
    if (simRoadsLegendP) simRoadsLegendP.textContent = v === 'dragontiger' ? 'Dragon' : 'Player';
    if (simRoadsLegendB) simRoadsLegendB.textContent = v === 'dragontiger' ? 'Tiger'  : 'Banker';

    /* Bet boxes — rewire data-bet keys + labels in place */
    const boxes = document.querySelectorAll('.sim-bets .bet-box');
    cfg.bets.forEach((b, i) => {
      const box = boxes[i];
      if (!box) return;
      box.dataset.bet = b.key;
      const labelEl = box.querySelector('.bet-label');
      const payoutEl = box.querySelector('.bet-payout');
      const edgeEl = box.querySelector('.bet-edge');
      const chipEl = box.querySelector('.bet-chip');
      if (labelEl)  labelEl.textContent = b.label;
      if (payoutEl) payoutEl.textContent = b.payout;
      if (edgeEl)   edgeEl.textContent = b.edge;
      if (chipEl)   chipEl.textContent = b.chip;
    });

    resetSim();
  }

  document.querySelectorAll('.sim-variant').forEach(btn => {
    btn.addEventListener('click', () => applyVariant(btn.dataset.variant));
  });

  updateBankroll();
  updateStats();

  /* ---- Public API for the strategy-demo guide --------------------------
     The demo drives the simulator without going through DOM clicks: it can
     set chip + bet + deal programmatically, and subscribe to the result of
     each hand via onSettle(callback). dealHand() emits a 'settle' event with
     the outcome, the chip size used, the resulting bankroll delta, and the
     current bankroll. */
  const settleListeners = [];
  function emitSettle(payload) {
    settleListeners.forEach(cb => { try { cb(payload); } catch (e) { console.error(e); } });
  }

  /* Capture the most recent outcome by intercepting addLog — its settle
     messages always start with 'Player wins', 'Banker wins', or 'TIE'. */
  let lastOutcome = null;
  const _addLogOriginal = addLog;
  // eslint-disable-next-line no-func-assign
  addLog = function(line, cls) {
    if (/^Player wins/.test(line))      lastOutcome = 'player';
    else if (/^Banker wins/.test(line)) lastOutcome = 'banker';
    else if (/^Dragon wins/.test(line)) lastOutcome = 'dragon';
    else if (/^Tiger wins/.test(line))  lastOutcome = 'tiger';
    else if (/^TIE/.test(line))         lastOutcome = 'tie';
    return _addLogOriginal(line, cls);
  };

  /* Wrapped deal: emits 'settle' once dealBtn re-enables (same tick the
     bankroll/stats update). 60 ms poll is plenty for ≤6 s deals. */
  const _dealHandOriginal = dealHand;
  function dealHandWrapped() {
    if (!currentBet || bankroll < chipSize) return;
    const before = bankroll;
    const stake = chipSize;
    const bet = currentBet;
    lastOutcome = null;
    _dealHandOriginal();
    const start = Date.now();
    const wait = setInterval(() => {
      if (!dealBtn.disabled || Date.now() - start > 6000) {
        clearInterval(wait);
        emitSettle({
          stake, bet, before,
          after: bankroll,
          delta: bankroll - before,
          outcome: lastOutcome,
        });
      }
    }, 60);
  }

  window.SimAPI = {
    setChip(amount) {
      const btn = document.querySelector(`.chip-btn[data-chip="${amount}"]`);
      if (btn) btn.click();
    },
    setBet(bet) {
      const box = document.querySelector(`.bet-box[data-bet="${bet}"]`);
      if (box) box.click();
    },
    deal() { dealHandWrapped(); },
    reset() { resetSim(); },
    onSettle(cb) {
      settleListeners.push(cb);
      return () => {
        const i = settleListeners.indexOf(cb);
        if (i >= 0) settleListeners.splice(i, 1);
      };
    },
    state() {
      return {
        bankroll, chipSize, currentBet,
        stats: { ...stats },
        isDealing: dealBtn.disabled,
      };
    },
    el: {
      betBox(bet) { return document.querySelector(`.bet-box[data-bet="${bet}"]`); },
      chipBtn(amount) { return document.querySelector(`.chip-btn[data-chip="${amount}"]`); },
      dealBtn() { return dealBtn; },
      bankroll() { return bankrollEl; },
      log() { return simLog; },
    },
  };
})();
