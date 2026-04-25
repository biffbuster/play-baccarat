/* ============================================================
   BACCARAT GUIDE — INTERACTION LAYER
   ============================================================ */

/* -------- Suit/Rank mapping + card factory -------- */
const SUIT_MAP = {
  'S': { glyph: '♠', color: 'black' },
  'H': { glyph: '♥', color: 'red'   },
  'D': { glyph: '♦', color: 'red'   },
  'C': { glyph: '♣', color: 'black' }
};

const RANK_TO_TEXT = { 'A': 'A', '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','T':'10','J':'J','Q':'Q','K':'K' };
const RANK_TO_VALUE = { 'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':0,'J':0,'Q':0,'K':0 };

function cardValue(card) { return RANK_TO_VALUE[card[0]]; }

function buildCardEl(code, width = 80, showValue = false) {
  /* code like "7H" or "TS" or "back" — art is rendered from poker/{code}.svg */
  const el = document.createElement('div');
  el.className = 'p-card svg';
  el.style.setProperty('--w', width + 'px');

  const src = code === 'back' ? 'poker/1B.svg' : `poker/${code}.svg`;
  const img = document.createElement('img');
  img.className = 'p-card-art';
  img.alt = code === 'back' ? 'card back' : code;
  img.draggable = false;
  img.src = src;
  el.appendChild(img);

  if (code === 'back') {
    el.classList.add('back');
  } else {
    el.classList.add(SUIT_MAP[code[1]].color);
    if (showValue) {
      const val = document.createElement('div');
      val.className = 'p-card-value';
      val.textContent = `val ${RANK_TO_VALUE[code[0]]}`;
      el.appendChild(val);
    }
  }
  return el;
}

function handTotal(cards) {
  const sum = cards.reduce((a, c) => a + cardValue(c), 0);
  return sum % 10;
}

/* -------- NAV: section highlight on scroll + click -------- */
const navItems = document.querySelectorAll('.nav-item, .brand[data-target]');
const topbarH = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--topbar-h').trim();
  return parseInt(v, 10) || 64;
};
navItems.forEach(n => {
  n.addEventListener('click', (e) => {
    const targetId = n.dataset.target;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - topbarH() - 8;
    window.scrollTo({ top, behavior: 'smooth' });
    /* Close any open dropdown + mobile menu on nav */
    document.querySelectorAll('.topnav-item.open').forEach(x => x.classList.remove('open'));
    document.querySelectorAll('.topnav-trigger[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
    document.getElementById('topnav')?.classList.remove('open');
    document.getElementById('topbarBurger')?.setAttribute('aria-expanded', 'false');
  });
});

/* -------- TOP NAV: dropdown + burger -------- */
document.querySelectorAll('.topnav-trigger').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = btn.closest('.topnav-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.topnav-item.open').forEach(x => {
      x.classList.remove('open');
      x.querySelector('.topnav-trigger')?.setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.topnav-item')) {
    document.querySelectorAll('.topnav-item.open').forEach(x => {
      x.classList.remove('open');
      x.querySelector('.topnav-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.topnav-item.open').forEach(x => {
      x.classList.remove('open');
      x.querySelector('.topnav-trigger')?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('topnav')?.classList.remove('open');
  }
});

const burger = document.getElementById('topbarBurger');
if (burger) {
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = document.getElementById('topnav');
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* Active section tracker */
const sections = [...document.querySelectorAll('.section, .hero')];
const dropdownNavItems = document.querySelectorAll('.topnav-dropdown .nav-item');
const navMap = new Map([...dropdownNavItems].map(n => [n.dataset.target, n]));

function updateNav() {
  let active = null;
  const scrollY = window.scrollY + topbarH() + 80;
  for (const s of sections) {
    if (s.offsetTop <= scrollY) active = s;
  }
  if (active) {
    dropdownNavItems.forEach(n => n.classList.remove('active'));
    const link = navMap.get(active.id);
    if (link) link.classList.add('active');
  }
}
window.addEventListener('scroll', updateNav, { passive: true });

/* -------- Theme swap -------- */
document.querySelectorAll('.theme-option').forEach(o => {
  o.addEventListener('click', () => {
    document.querySelectorAll('.theme-option').forEach(x => x.classList.remove('active'));
    o.classList.add('active');
    applyTheme(o.dataset.theme);
  });
});

function applyTheme(t) {
  const r = document.documentElement.style;
  if (t === 'lacquer') {
    r.setProperty('--bg-abyss', '#000000');
    r.setProperty('--bg-felt-deep', '#060606');
    r.setProperty('--bg-felt', '#0d0d0d');
    r.setProperty('--bg-felt-light', '#1a1a1a');
    r.setProperty('--gold', '#c9a961');
    r.setProperty('--gold-bright', '#e6c985');
    r.setProperty('--carmine', '#c1272d');
  } else if (t === 'lightgold') {
    /* Warm, gold-forward palette. Backgrounds lift off pure black into
       aged brass/parchment tones; primary gold is brighter and more
       saturated than Lacquer so the site reads unmistakably gold-toned. */
    r.setProperty('--bg-abyss', '#1e1808');
    r.setProperty('--bg-felt-deep', '#2a2310');
    r.setProperty('--bg-felt', '#36291a');
    r.setProperty('--bg-felt-light', '#403220');
    r.setProperty('--gold', '#e2c582');
    r.setProperty('--gold-bright', '#fbdfa0');
    r.setProperty('--carmine', '#c1272d');
  } else if (t === 'ivory') {
    r.setProperty('--bg-abyss', '#1a1612');
    r.setProperty('--bg-felt-deep', '#201a14');
    r.setProperty('--bg-felt', '#2c241a');
    r.setProperty('--bg-felt-light', '#3a3020');
    r.setProperty('--gold', '#d9ba72');
    r.setProperty('--gold-bright', '#f0d58e');
    r.setProperty('--carmine', '#c13e44');
  }
}

/* -------- Tabs (generic) -------- */
function wireTabs(containerId, onActivate) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tabs = container.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      /* siblings */
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      /* panels in same section */
      const section = container.closest('.section') || container.parentElement;
      section.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
      if (onActivate) onActivate(targetId);
    });
  });
}
wireTabs('value-tabs');
wireTabs('flow-tabs', (id) => dealFlow(id));

/* Delegated handler for the section-04 "↻ Replay" buttons. Replaces
   inline onclick="dealFlow(...)" so the page works under a strict CSP
   (no script-src 'unsafe-inline' needed). */
document.querySelectorAll('.tab-replay[data-replay]').forEach(btn => {
  btn.addEventListener('click', () => dealFlow(btn.dataset.replay));
});

/* -------- Flow section card deals -------- */
const flowDeals = {
  'flow-1': { player: ['7H', '5S'], banker: ['9C', '4D'], note: 'Player 12→2 · Banker 13→3' },
  'flow-2': { player: ['4S', '5H'], banker: ['2D', 'KC'], note: 'Natural 9 — hand ends' },
  'flow-3': { player: ['3H', 'AS', '6D'], banker: ['7C', 'QD'], note: 'Player drew on 4' },
  'flow-4': { player: ['2H', '3S', '8C'], banker: ['KS', '5D', '7H'], note: 'Banker drew on 5 vs 8 third' },
  'flow-5': { player: ['9D', '7C', '4S'], banker: ['AC', '6H', '9S'], note: 'Player 0, Banker 6 — Banker wins' },
};

function dealFlow(flowId) {
  const data = flowDeals[flowId];
  if (!data) return;
  const pEl = document.getElementById(flowId.replace('flow-', 'flow') + '-player');
  const bEl = document.getElementById(flowId.replace('flow-', 'flow') + '-banker');
  const pTotalEl = document.getElementById(flowId.replace('flow-', 'flow') + '-player-total');
  const bTotalEl = document.getElementById(flowId.replace('flow-', 'flow') + '-banker-total');
  if (!pEl || !bEl) return;

  pEl.innerHTML = '';
  bEl.innerHTML = '';
  if (pTotalEl) pTotalEl.innerHTML = `<span class="lbl">Total</span>—`;
  if (bTotalEl) bTotalEl.innerHTML = `<span class="lbl">Total</span>—`;

  let delay = 100;
  const sequence = [];
  /* alternating deal: P, B, P, B, then extras */
  const maxLen = Math.max(data.player.length, data.banker.length);
  for (let i = 0; i < maxLen; i++) {
    if (data.player[i]) sequence.push({ side: 'p', card: data.player[i], idx: i });
    if (data.banker[i]) sequence.push({ side: 'b', card: data.banker[i], idx: i });
  }

  sequence.forEach(step => {
    setTimeout(() => {
      const card = buildCardEl(step.card, 104, true);
      card.classList.add('dealing');
      (step.side === 'p' ? pEl : bEl).appendChild(card);

      /* update totals live */
      const pCards = data.player.slice(0, step.side === 'p' ? step.idx + 1 : Math.min(step.idx + 1, data.player.length));
      const bCards = data.banker.slice(0, step.side === 'b' ? step.idx + 1 : Math.min(step.idx + 1, data.banker.length));
      if (pTotalEl) pTotalEl.innerHTML = `<span class="lbl">Total</span>${handTotal(pCards)}`;
      if (bTotalEl) bTotalEl.innerHTML = `<span class="lbl">Total</span>${handTotal(bCards)}`;
    }, delay);
    delay += 550;
  });
}

/* auto-deal first flow on load */
setTimeout(() => dealFlow('flow-1'), 800);


/* initial nav highlight (runs once on load) */
updateNav();


/* -------- SHOE: deck-spread on scroll --------
   Stacked cards translate to their own --offset when the section enters
   viewport. Mirrors the Framer CardDeckSpread mechanic with a 90 ms stagger
   and cubic-bezier(0.25, 0.8, 0.25, 1) easing handled in CSS. */
(function initDeckSpread() {
  const deck = document.getElementById('deckSpread');
  if (!deck) return;
  const cards = [...deck.querySelectorAll('.deck-spread-card')];
  if (!cards.length) return;

  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  /* Match the CSS --overlap (per-card x-shift). 110 desktop / 70 mobile. */
  const o = isMobile ? 70 : 110;
  const totalSpan = (cards.length - 1) * o;

  cards.forEach((c, i) => {
    /* --offset = card's final x relative to row centre.
       --i drives the transition-delay stagger.
       --depth/--rot are the small staircase + tilt while stacked. */
    const offset = i * o - totalSpan / 2;
    c.style.setProperty('--offset', offset + 'px');
    c.style.setProperty('--i', i);
    c.style.setProperty('--depth', i);
    c.style.setProperty('--rot', ((i - (cards.length - 1) / 2) * 0.6).toFixed(2));
    c.style.zIndex = cards.length - i;
  });

  function spread() {
    /* Brief hold so the user sees the deck stacked before it deals out. */
    setTimeout(() => deck.classList.add('is-spread'), 250);
  }

  /* Only fire when the user has actually scrolled the deck well into view —
     no on-load shortcut, no early-trigger. The IntersectionObserver lifecycle
     still fires once on observe even if the section is already visible, but
     only when the threshold is actually met. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          spread();
          io.disconnect();
        }
      });
    }, { threshold: [0.5] });
    io.observe(deck);
  } else {
    /* Browsers without IO: wait for an actual scroll event before triggering. */
    const onScroll = () => {
      const rect = deck.getBoundingClientRect();
      const halfShown = rect.top + rect.height * 0.5 < window.innerHeight && rect.bottom > 0;
      if (halfShown) {
        spread();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();


/* Section 02 value cards now use a pure-CSS :hover enlarge — no scroll
   spotlight. The previous GSAP ScrollTrigger that cycled .is-active was
   removed in favour of full-strength static cards. */


/* -------- RSVP TOAST: close + click-to-scroll -------- */
const rsvpToast = document.getElementById('rsvpToast');
const rsvpToastClose = document.getElementById('rsvpToastClose');
if (rsvpToast) {
  try {
    if (localStorage.getItem('baccarat-rsvp-dismissed')) {
      rsvpToast.classList.add('dismissed');
    }
  } catch (e) { /* ignore */ }

  rsvpToast.addEventListener('click', (e) => {
    if (e.target === rsvpToastClose || rsvpToastClose?.contains(e.target)) return;
    const target = document.getElementById(rsvpToast.dataset.target || 'sec-sim');
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - topbarH() - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  rsvpToastClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    rsvpToast.classList.add('dismissed');
    try { localStorage.setItem('baccarat-rsvp-dismissed', '1'); } catch (err) {}
  });
}


/* -------- INTRO TOUR --------
   First-visit modal walking the user through the four sections that matter
   most. Pulses each target and scrolls into view. Dismissal is remembered
   in localStorage; "Replay tour" lives in the Settings dropdown. */
const tourSteps = [
  {
    title: "Welcome — quick tour?",
    body: "I'll point out the four sections that matter most. About 30 seconds. Hit Next to begin.",
    target: null
  },
  {
    title: "Start with the basics",
    body: "Three panels explaining what baccarat is, what you bet on, and how cards count. The whole game in three minutes.",
    target: 'sec-welcome'
  },
  {
    title: "Watch a hand play out",
    body: "A scroll-driven 3D walkthrough of one full Punto Banco hand. Camera slides through six keyframes — wide, dealer POV, top-down.",
    target: 'sec-table'
  },
  {
    title: "Bets & house edge",
    body: "There are three bets, and one is a trap. This is the single most useful page in the guide before you sit at a table.",
    target: 'sec-bets'
  },
  {
    title: "Try a hand",
    body: "Live simulator: real Punto Banco dealer logic, $1,000 bankroll, scrolling log. You're ready — go play.",
    target: 'sec-sim'
  }
];

const tourEl = document.getElementById('tour');
const tourBackdrop = document.getElementById('tourBackdrop');
const tourCardEl = document.getElementById('tourCard');
const tourTitle = document.getElementById('tourTitle');
const tourBody = document.getElementById('tourBody');
const tourStepNum = document.getElementById('tourStepNum');
const tourStepTotal = document.getElementById('tourStepTotal');
const tourBack = document.getElementById('tourBack');
const tourNext = document.getElementById('tourNext');
const tourSkip = document.getElementById('tourSkip');
const tourDots = document.getElementById('tourDots');

let tourIdx = 0;
let lastPulseTimer = null;

if (tourEl && tourStepTotal) {
  tourStepTotal.textContent = String(tourSteps.length);
  /* build dots once */
  tourSteps.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'tour-dot';
    tourDots.appendChild(d);
  });
}

function renderTourDots() {
  if (!tourDots) return;
  [...tourDots.children].forEach((d, i) => {
    d.classList.toggle('active', i === tourIdx);
    d.classList.toggle('done', i < tourIdx);
  });
}

function showTourStep(i) {
  if (!tourEl) return;
  tourIdx = i;
  const s = tourSteps[i];
  tourTitle.textContent = s.title;
  tourBody.textContent = s.body;
  tourStepNum.textContent = String(i + 1);
  tourBack.hidden = i === 0;
  tourNext.textContent = i === tourSteps.length - 1 ? 'Done' : 'Next →';
  renderTourDots();

  if (lastPulseTimer) clearTimeout(lastPulseTimer);
  if (s.target) {
    const el = document.getElementById(s.target);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - topbarH() - 16;
      window.scrollTo({ top, behavior: 'smooth' });
      el.classList.remove('tour-pulse');
      void el.offsetWidth; /* restart animation */
      el.classList.add('tour-pulse');
      lastPulseTimer = setTimeout(() => el.classList.remove('tour-pulse'), 1700);
    }
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function openTour() {
  if (!tourEl) return;
  tourEl.hidden = false;
  tourEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('tour-open');
  requestAnimationFrame(() => tourEl.classList.add('active'));
  showTourStep(0);
}

function closeTour() {
  if (!tourEl) return;
  tourEl.classList.remove('active');
  document.body.classList.remove('tour-open');
  setTimeout(() => {
    tourEl.hidden = true;
    tourEl.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.tour-pulse').forEach(el => el.classList.remove('tour-pulse'));
  }, 300);
  /* Intentionally NOT persisted — the floating "?" FAB is the persistent
     entry point, and the tour pops up again on every page load. */
}

tourSkip?.addEventListener('click', closeTour);
tourBack?.addEventListener('click', () => showTourStep(Math.max(0, tourIdx - 1)));
tourNext?.addEventListener('click', () => {
  if (tourIdx >= tourSteps.length - 1) closeTour();
  else showTourStep(tourIdx + 1);
});
tourBackdrop?.addEventListener('click', closeTour);

document.addEventListener('keydown', (e) => {
  if (tourEl?.hidden) return;
  if (e.key === 'Escape') closeTour();
  else if (e.key === 'ArrowRight') tourNext?.click();
  else if (e.key === 'ArrowLeft') tourBack?.click();
});

/* Floating help button + Replay-tour link in settings — both reopen the tour */
document.querySelectorAll('[data-action="replay-tour"], #helpFab').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.topnav-item.open').forEach(x => x.classList.remove('open'));
    openTour();
  });
});

/* Auto-show on every page load (refresh = popup again) */
setTimeout(openTour, 1400);


/* -------- WELCOME PANEL 1: bet spinner --------
   Slot-machine-style cycle through Player / Banker / Tie that decelerates
   and "lands" on a random one with a colour glow (jade / carmine / gold).
   Loops indefinitely. Pauses when the panel is off-screen so we don't burn
   cycles when no one is looking. */
(function initBetSpinner() {
  const container = document.querySelector('.welcome-bets');
  if (!container) return;
  const bets = [...container.querySelectorAll('.welcome-bet')];
  if (bets.length !== 3) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const winnerKeys = ['player', 'banker', 'tie'];
  let timer = null;
  let isVisible = true;
  let stopped = false;

  function clearAll() {
    bets.forEach(b => {
      b.classList.remove('is-spin-on');
      winnerKeys.forEach(k => b.classList.remove('is-winner-' + k));
    });
  }

  function runCycle() {
    if (stopped) return;
    container.classList.add('is-spinning');
    let i = Math.floor(Math.random() * bets.length);
    let delay = 60;
    let spins = 0;
    const fastSpins = 12 + Math.floor(Math.random() * 6); /* 12–17 */

    function tick() {
      if (stopped) return;
      clearAll();
      bets[i].classList.add('is-spin-on');
      const landedIdx = i;
      i = (i + 1) % bets.length;
      spins++;

      if (spins > fastSpins) delay += 55; /* decelerate */

      if (delay < 480) {
        timer = setTimeout(tick, delay);
      } else {
        /* Land on the most recently highlighted slot */
        clearAll();
        container.classList.remove('is-spinning');
        bets[landedIdx].classList.add('is-winner-' + winnerKeys[landedIdx]);
        timer = setTimeout(() => {
          clearAll();
          runCycle();
        }, 3200);
      }
    }
    tick();
  }

  /* Pause when off-screen so the loop is silent in the background. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        isVisible = e.isIntersecting;
        if (isVisible && !timer) runCycle();
        else if (!isVisible && timer) {
          stopped = true;
          clearTimeout(timer);
          timer = null;
          clearAll();
          container.classList.remove('is-spinning');
          /* Allow restart when it comes back */
          setTimeout(() => { stopped = false; }, 100);
        }
      });
    }, { threshold: 0.25 });
    io.observe(container);
  } else {
    runCycle();
  }
})();

/* ===== Betting-systems 3-card flip =====
   Click a difficulty front to anchor it; the other two cards flip to show
   the systems for that tier. Click the anchored card again to reset. */
(() => {
  const grid = document.getElementById('stratFlipGrid');
  if (!grid) return;

  const fronts = grid.querySelectorAll('.strat-face--front');

  function setActive(tier) {
    if (tier) grid.dataset.active = tier;
    else delete grid.dataset.active;

    grid.querySelectorAll('.strat-flip').forEach(card => {
      const isActive = !!tier && card.dataset.tier === tier;
      card.classList.toggle('is-active', isActive);
    });

    fronts.forEach(btn => {
      const isActive = !!tier && btn.dataset.tier === tier;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    grid.querySelectorAll('.strat-face--back').forEach(back => {
      const card = back.closest('.strat-flip');
      const visible = tier && card.dataset.tier !== tier && back.dataset.showWhen === tier;
      back.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  fronts.forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.dataset.tier;
      const current = grid.dataset.active || '';
      setActive(current === tier ? null : tier);
    });
  });
})();
