/* ============================================================
   ODDS bars animate on scroll into view
   ============================================================ */
const oddsFills = document.querySelectorAll('.odds-fill');
const oddsObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      oddsFills.forEach(f => {
        f.style.width = f.dataset.width + '%';
      });
      oddsObs.disconnect();
    }
  });
}, { threshold: 0.4 });
if (oddsFills.length) oddsObs.observe(oddsFills[0]);

/* ============================================================
   ROADS : build sample scoreboards
   ============================================================ */
function buildRoad(elId, pattern, cols = 12, rows = 4) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  /* Build column-major from outcomes */
  const cells = Array.from({ length: cols * rows }, () => ({ type: 'empty' }));
  for (let i = 0; i < Math.min(pattern.length, cols * rows); i++) {
    cells[i] = { type: pattern[i] };
  }
  el.innerHTML = cells.map(c => {
    const t = c.type;
    const label = t === 'p' ? 'P' : t === 'b' ? 'B' : t === 't' ? 'T' : '';
    return `<div class="road-cell ${t}">${label}</div>`;
  }).join('');
}

/* Generate realistic-looking baccarat pattern (streaks + switches) */
function generatePattern(n) {
  const out = [];
  let last = Math.random() < 0.5 ? 'p' : 'b';
  let streakLen = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    /* 9% tie */
    if (Math.random() < 0.09) { out.push('t'); continue; }
    if (streakLen <= 0) {
      last = last === 'p' ? 'b' : 'p';
      streakLen = 1 + Math.floor(Math.random() * 4);
    }
    out.push(last);
    streakLen--;
  }
  return out;
}

const pattern = generatePattern(40);
buildRoad('bigRoad', pattern, 12, 4);
buildRoad('bigEye', pattern.map((_, i) => i % 3 === 0 ? 'b' : i % 5 === 0 ? 't' : 'p'), 12, 4);
buildRoad('smallRoad', pattern.map((_, i) => i % 2 === 0 ? 'p' : 'b').slice(0, 30), 12, 4);
buildRoad('cockroach', pattern.reverse(), 12, 4);

/* Roads filter — single-pane viewer. Pills swap which road grid + info
   pane is visible; only one of each is shown at a time. */
(function initRoadsFilter() {
  const stage = document.getElementById('roadsStage');
  if (!stage) return;
  const pills = stage.querySelectorAll('.road-pill');
  const panes = stage.querySelectorAll('.roads-pane');
  const infos = stage.querySelectorAll('.roads-info-pane');

  function activate(road) {
    pills.forEach(p => {
      const isActive = p.dataset.road === road;
      p.classList.toggle('active', isActive);
      p.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panes.forEach(p => p.classList.toggle('is-active', p.dataset.road === road));
    infos.forEach(i => i.classList.toggle('is-active', i.dataset.road === road));
  }

  pills.forEach(p => p.addEventListener('click', () => activate(p.dataset.road)));
})();

