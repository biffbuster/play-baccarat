/* ============================================================
   STRATEGY DEMO
   ----------------------------------------------------------------
   An interactive walkthrough that drives the live simulator through
   a betting strategy (Flat, Martingale, or Paroli), pausing after
   each hand to explain what just happened. The first time each
   outcome (win / loss / tie) appears in a session, we attach a
   reasoning paragraph; subsequent hits get a shorter recap.
   Refresh the page to reset which outcomes have been explained.
   ============================================================ */
(function initStrategyDemo() {
  if (!window.SimAPI) return;

  const overlay      = document.getElementById('stratDemo');
  const card         = document.getElementById('stratDemoCard');
  const trigger      = document.getElementById('stratDemoTrigger');
  const closeBtn     = document.getElementById('stratDemoClose');
  const titleEl      = document.getElementById('stratDemoTitle');
  const bodyEl       = document.getElementById('stratDemoBody');
  const stepEl       = document.getElementById('stratDemoStep');
  const stratEl      = document.getElementById('stratDemoStrategy');
  const picker       = document.getElementById('stratDemoPicker');
  const controls     = document.getElementById('stratDemoControls');
  const switchBtn    = document.getElementById('stratDemoSwitch');
  const pauseBtn     = document.getElementById('stratDemoPause');
  const nextBtn      = document.getElementById('stratDemoNext');

  if (!overlay || !card) return;

  /* ------------- Strategy table ------------- */
  /* Each strategy returns the next bet and stake given the current state. */
  const STRATEGIES = {
    flat: {
      label: 'Flat · Banker',
      side: 'banker',
      base: 25,
      maxHands: 8,
      next(state) {
        return { bet: 'banker', stake: 25 };
      },
      explain() {
        return "Flat means the same wager, same side, every hand. There's no progression to chase a streak. The bet you're placing is $25 on Banker because Banker's house edge (1.06%) is the lowest of the three.";
      },
    },
    martingale: {
      label: 'Martingale · Banker',
      side: 'banker',
      base: 25,
      maxHands: 8,
      next(state) {
        /* After a loss double the bet; after a win or push reset to base. */
        const last = state.lastResult;
        if (!last) return { bet: 'banker', stake: 25 };
        if (last.outcome === 'tie') return { bet: 'banker', stake: state.lastStake };
        if (last.delta < 0) return { bet: 'banker', stake: Math.min(state.lastStake * 2, 1000) };
        return { bet: 'banker', stake: 25 };
      },
      explain() {
        return "Martingale doubles your stake after each loss, hoping the eventual win recovers everything plus one base unit. The catch: a 7-loss streak (1 in 128) takes you from $25 to $3,200. Casinos cap bets and players run out of money — that's why this 'system' has bankrupted gamblers for 300 years.";
      },
    },
    paroli: {
      label: 'Paroli · Player',
      side: 'player',
      base: 25,
      maxHands: 10,
      next(state) {
        const last = state.lastResult;
        if (!last) return { bet: 'player', stake: 25 };
        if (last.outcome === 'tie') return { bet: 'player', stake: state.lastStake };
        const winsInRow = state.winStreak || 0;
        if (last.delta > 0) {
          if (winsInRow >= 3) return { bet: 'player', stake: 25 };
          return { bet: 'player', stake: state.lastStake * 2 };
        }
        return { bet: 'player', stake: 25 };
      },
      explain() {
        return "Paroli is the reverse of Martingale: double after each win, reset after a loss or three wins in a row. Max loss per cycle is one unit; max win is seven units. It rides hot streaks without risking ruin — the trade-off is that those streaks have to actually happen.";
      },
    },
  };

  /* ------------- Outcome reasoning (per-page-load Set) ------------- */
  /* "Explain reasoning for each outcome at least once per browser, refresh
     resets it." We use a plain in-memory Set — refresh recreates it. */
  const explained = new Set();
  function outcomeExplanation(outcome) {
    switch (outcome) {
      case 'player':
        return "**Player won.** The Player hand totalled higher (or hit a natural 8/9 first). Player wins pay 1:1 — exactly your stake. No commission. House edge on Player is 1.24% over time, which mostly comes from the fact that Banker draws less often when it's behind.";
      case 'banker':
        return "**Banker won.** Banker won this coup, which happens slightly more than Player (≈ 45.86% of non-tie hands) because Banker draws second and reacts to Player's third card. Banker pays 0.95:1 — the casino takes a 5% commission on wins, which is exactly why it has the lowest house edge (1.06%).";
      case 'tie':
        return "**Tie.** Both hands ended at the same total. If you didn't bet Tie, your stake is returned (a push). If you did bet Tie, you collected 8:1 — but Tie hits only ≈ 9.5% of the time and the math gives it a brutal 14.36% house edge. That's why the guide called it the trap bet.";
      default:
        return null;
    }
  }
  function shortRecap(outcome) {
    switch (outcome) {
      case 'player': return "Player won (pays 1:1, no commission).";
      case 'banker': return "Banker won (pays 0.95:1 after the 5% commission).";
      case 'tie':    return "Tie — your bet is returned unless you wagered on Tie.";
      default: return '';
    }
  }

  /* ------------- Reasoning per-hand within a strategy ------------- */
  function strategyReaction(strategyKey, lastResult, nextStake) {
    if (!lastResult) return '';
    if (strategyKey === 'flat') {
      return ` Flat strategy doesn't react — the next bet is still $${nextStake} on Banker.`;
    }
    if (strategyKey === 'martingale') {
      if (lastResult.outcome === 'tie') return ' Tie pushes — the bet stays the same on the next hand.';
      if (lastResult.delta < 0) return ` Martingale doubles after a loss — next bet is $${nextStake}.`;
      return ` Martingale resets after a win — back to base $${nextStake}.`;
    }
    if (strategyKey === 'paroli') {
      if (lastResult.outcome === 'tie') return ' Tie pushes — the streak counter holds and the stake repeats.';
      if (lastResult.delta > 0) return ` Paroli doubles after a win — riding the streak with $${nextStake}.`;
      return ' Paroli resets after a loss — back to $25 base.';
    }
    return '';
  }

  /* ------------- State ------------- */
  let state = {
    strategyKey: null,
    handsPlayed: 0,
    lastResult: null,
    lastStake: 25,
    winStreak: 0,
    paused: true,
    awaitingNext: false,
    unsubscribe: null,
  };

  /* ------------- Highlight helpers ------------- */
  /* Brief flash on an element — used for "look here right now" moments. */
  function pulse(el, durationMs = 1400) {
    if (!el) return;
    el.classList.remove('demo-pulse');
    void el.offsetWidth;
    el.classList.add('demo-pulse');
    setTimeout(() => el.classList.remove('demo-pulse'), durationMs);
  }

  /* Persistent gold-glow ring around the element the demo is currently
     explaining. Only one target at a time — replaces the previous. */
  let currentTarget = null;
  function setTarget(el) {
    if (currentTarget && currentTarget !== el) {
      currentTarget.classList.remove('demo-target');
    }
    currentTarget = el || null;
    if (el) el.classList.add('demo-target');
  }
  function clearTarget() {
    if (currentTarget) currentTarget.classList.remove('demo-target');
    currentTarget = null;
  }

  /* ------------- UI ------------- */
  function renderTextHTML(text) {
    /* Simple **bold** support so explanations can emphasise. */
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function setPanel({ title, body, step, strategy, showPicker, showControls, nextLabel }) {
    if (title !== undefined)    titleEl.textContent = title;
    if (body !== undefined)     bodyEl.innerHTML = renderTextHTML(body);
    if (step !== undefined)     stepEl.textContent = step;
    if (strategy !== undefined) stratEl.textContent = strategy;
    if (showPicker !== undefined)   picker.hidden = !showPicker;
    if (showControls !== undefined) controls.hidden = !showControls;
    if (nextLabel !== undefined)    nextBtn.textContent = nextLabel;
  }

  function openOverlay() {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('active'));
    document.body.classList.add('strat-demo-open');
    showStrategyPicker();
  }

  function closeOverlay() {
    overlay.classList.remove('active');
    document.body.classList.remove('strat-demo-open');
    setTimeout(() => {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }, 280);
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
    state.strategyKey = null;
    state.paused = true;
    clearTarget();
  }

  function showStrategyPicker() {
    state.strategyKey = null;
    state.handsPlayed = 0;
    state.lastResult = null;
    state.lastStake = 25;
    state.winStreak = 0;
    state.paused = true;
    state.awaitingNext = false;
    clearTarget();
    setPanel({
      title: "Pick a strategy to demo",
      body: "I'll auto-bet for you and explain each outcome the first time it happens. Refresh the page to clear the explanation cache and see them again.",
      step: '—',
      strategy: 'Pick a strategy',
      showPicker: true,
      showControls: false,
    });
  }

  function startStrategy(key) {
    const strat = STRATEGIES[key];
    if (!strat) return;
    state.strategyKey = key;
    state.handsPlayed = 0;
    state.lastResult = null;
    state.lastStake = strat.base;
    state.winStreak = 0;
    state.paused = false;
    state.awaitingNext = false;

    /* Clean slate so bankroll math is honest. */
    window.SimAPI.reset();

    setPanel({
      title: strat.label,
      body: strat.explain() + " I'll start in a moment — hit Pause any time.",
      step: `0 / ${strat.maxHands}`,
      strategy: strat.label,
      showPicker: false,
      showControls: true,
      nextLabel: 'Continue →',
    });

    /* Subscribe to settle events. */
    if (state.unsubscribe) state.unsubscribe();
    state.unsubscribe = window.SimAPI.onSettle(handleSettle);

    /* Step 1: place the first bet after a moment. */
    setTimeout(placeAndDeal, 1100);
  }

  function placeAndDeal() {
    if (state.paused || !state.strategyKey) return;
    const strat = STRATEGIES[state.strategyKey];
    const next = strat.next(state);
    state.lastStake = next.stake;

    const chipEl = window.SimAPI.el.chipBtn(closestChip(next.stake));
    const betEl  = window.SimAPI.el.betBox(next.bet);

    /* Phase 1: highlight the chip selection (where the stake comes from) */
    setTarget(chipEl);
    pulse(chipEl);
    window.SimAPI.setChip(closestChip(next.stake));

    setPanel({
      title: `Hand ${state.handsPlayed + 1} — picking the $${next.stake} chip`,
      body: explainBetReason(state.strategyKey, state, next),
      step: `${state.handsPlayed + 1} / ${strat.maxHands}`,
      nextLabel: 'Pause / advance',
    });

    /* Phase 2: ~700 ms later, move target to the wager box */
    setTimeout(() => {
      if (state.paused) return;
      setTarget(betEl);
      pulse(betEl);
      window.SimAPI.setBet(next.bet);
      setPanel({
        title: `Placing $${next.stake} on ${capitalize(next.bet)}`,
        body: explainBetReason(state.strategyKey, state, next),
      });
    }, 750);

    /* Phase 3: ~1.6 s in, move target to Deal Hand and trigger the deal */
    setTimeout(() => {
      if (state.paused) return;
      const dealEl = window.SimAPI.el.dealBtn();
      setTarget(dealEl);
      pulse(dealEl);
      setPanel({
        title: `Dealing the hand…`,
      });
      window.SimAPI.deal();
    }, 1700);
  }

  function handleSettle(payload) {
    if (!state.strategyKey) return;
    state.handsPlayed += 1;
    state.lastResult = payload;
    if (payload.outcome === 'player' || payload.outcome === 'banker' ||
        payload.outcome === 'dragon' || payload.outcome === 'tiger') {
      const won = payload.delta > 0;
      state.winStreak = won ? state.winStreak + 1 : 0;
    }

    /* Move the persistent target onto the winning bet circle so the user
       can see WHERE the result landed. */
    const winnerEl = window.SimAPI.el.betBox(payload.outcome);
    if (winnerEl) {
      setTarget(winnerEl);
      pulse(winnerEl);
    }

    /* Build the explanation: outcome reasoning (first time only) + how
       the chosen strategy reacts to it. */
    const strat = STRATEGIES[state.strategyKey];
    const wonLabel = payload.delta > 0 ? `won $${Math.abs(Math.round(payload.delta - payload.stake))}`
                   : payload.delta < 0 ? `lost $${Math.abs(Math.round(payload.delta))}`
                   : `pushed`;

    let body = '';
    if (!explained.has(payload.outcome)) {
      explained.add(payload.outcome);
      const exp = outcomeExplanation(payload.outcome);
      if (exp) body += exp + ' ';
    } else {
      body += shortRecap(payload.outcome) + ' ';
    }
    body += `You ${wonLabel} on this hand. Bankroll: $${Math.round(payload.after).toLocaleString()}.`;

    /* Preview the next reaction so the user knows what's coming. */
    const finished = state.handsPlayed >= strat.maxHands;
    if (!finished) {
      const next = strat.next(state);
      body += strategyReaction(state.strategyKey, payload, next.stake);
    }

    setPanel({
      title: `Hand ${state.handsPlayed} — ${outcomeWord(payload)}`,
      body,
      step: `${state.handsPlayed} / ${strat.maxHands}`,
      nextLabel: finished ? 'Done' : 'Continue →',
    });

    state.awaitingNext = true;

    /* If still running and not paused, auto-advance after 2.6 s — gives
       the user time to read but keeps momentum. */
    if (!finished) {
      setTimeout(() => {
        if (!state.paused && state.awaitingNext && state.strategyKey) {
          state.awaitingNext = false;
          placeAndDeal();
        }
      }, 2600);
    } else {
      finishStrategy();
    }
  }

  function finishStrategy() {
    const strat = STRATEGIES[state.strategyKey];
    const finalBankroll = window.SimAPI.state().bankroll;
    const net = finalBankroll - 1000;
    const verdict = net > 0 ? `up $${net}`
                  : net < 0 ? `down $${Math.abs(net)}`
                  : `flat — back to $1,000`;
    setPanel({
      title: `${strat.label} — ${strat.maxHands} hands done`,
      body: `Net result: ${verdict}. One trial proves nothing — the math only shows up over thousands of hands. **The house edge wins eventually**, regardless of which strategy you pick. Try another to see how they feel.`,
      nextLabel: 'Restart',
    });
    state.awaitingNext = true;
  }

  function explainBetReason(key, state, next) {
    if (state.handsPlayed === 0) {
      if (key === 'flat')       return `Opening hand — flat on Banker for $${next.stake}. Banker has the lowest house edge (1.06%), so a flat-Banker grind is the closest thing to "playing the math."`;
      if (key === 'martingale') return `Opening hand — Martingale starts at the base unit ($${next.stake} on Banker). Watch how it scales after a loss.`;
      if (key === 'paroli')     return `Opening hand — Paroli starts at base on Player ($${next.stake}). After every win, the next bet doubles. After three wins in a row or any loss, it resets.`;
    }
    /* Subsequent hands — strategy reaction */
    const last = state.lastResult;
    if (key === 'flat')       return `Same bet again: $${next.stake} on Banker. Flat means flat.`;
    if (key === 'martingale') {
      if (!last || last.delta >= 0) return `After a win or push, Martingale resets to base — $${next.stake} on Banker.`;
      return `Doubling after the last loss — now $${next.stake} on Banker. The bet recovers every previous loss in this streak plus one unit if it hits.`;
    }
    if (key === 'paroli') {
      if (!last) return `Base bet on Player.`;
      if (last.delta > 0) return `Last hand won — doubling to $${next.stake} on Player. We'll ride this up to three wins, then reset.`;
      return `Last hand didn't win — back to $${next.stake} on Player.`;
    }
    return '';
  }

  function closestChip(stake) {
    const chips = [5, 25, 100, 500];
    return chips.reduce((best, c) => Math.abs(c - stake) < Math.abs(best - stake) ? c : best, chips[0]);
  }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function outcomeWord(p) {
    if (p.outcome === 'tie') return 'tie';
    return p.delta > 0 ? 'win' : 'loss';
  }

  /* ------------- Wiring ------------- */
  trigger?.addEventListener('click', openOverlay);
  closeBtn?.addEventListener('click', closeOverlay);
  switchBtn?.addEventListener('click', () => {
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
    state.paused = true;
    showStrategyPicker();
  });

  picker?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-strategy]');
    if (!btn) return;
    startStrategy(btn.dataset.strategy);
  });

  pauseBtn?.addEventListener('click', () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
    if (!state.paused && state.awaitingNext) {
      state.awaitingNext = false;
      placeAndDeal();
    }
  });

  nextBtn?.addEventListener('click', () => {
    /* If we're showing the "done" screen, restart the strategy. */
    const strat = state.strategyKey && STRATEGIES[state.strategyKey];
    if (strat && state.handsPlayed >= strat.maxHands) {
      startStrategy(state.strategyKey);
      return;
    }
    /* Otherwise advance immediately. */
    if (state.awaitingNext) {
      state.awaitingNext = false;
      placeAndDeal();
    }
  });

  /* Esc closes the demo. Click on backdrop also closes. */
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') closeOverlay();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
})();
