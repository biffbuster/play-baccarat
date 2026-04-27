/* ============================================================
   STAGE: Scroll-driven 3D Pai Gow Poker table simulation
   Structurally identical to stage-scene.js — same table, same
   lighting and camera infrastructure — but the card script
   walks through a Pai Gow Poker hand: 7 cards each, split into
   a 5-card high hand and a 2-card low hand.
   ============================================================ */
(function initStagePaiGow() {
  const canvas = document.getElementById('stageCanvas');
  const stage = document.getElementById('stage');
  const panel = document.getElementById('stagePanel');
  const stepEl = document.getElementById('stageStep');
  const titleEl = document.getElementById('stageTitle');
  const bodyEl = document.getElementById('stageBody');
  const bar = document.getElementById('stageBar');
  if (!canvas || !stage) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050807, 12, 40);

  const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xb09060, 0.45));

  const keyLight = new THREE.SpotLight(0xf4e2b5, 2.6, 60, Math.PI / 3, 0.6, 1);
  keyLight.position.set(0, 18, 6);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.32);
  fillLight.position.set(-4, 6, 8);
  scene.add(fillLight);

  const rim1 = new THREE.PointLight(0xc1272d, 0.9, 25);
  rim1.position.set(-10, 4, -4);
  scene.add(rim1);

  const rim2 = new THREE.PointLight(0x4a9d7f, 0.6, 25);
  rim2.position.set(10, 4, 4);
  scene.add(rim2);

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderer.render(scene, camera);
    });
  }

  /* TABLE — same model as the baccarat scene */
  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  const TABLE_SCALE = 7;
  const TABLE_TOP_NATIVE = 1.04;
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
  const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];

  function tuneMaterial(mat) {
    if (!mat) return;
    TEX_SLOTS.forEach((slot) => {
      const t = mat[slot];
      if (!t) return;
      t.anisotropy = MAX_ANISO;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
    });
    if (mat.normalScale) mat.normalScale.set(0.55, 0.55);
    mat.needsUpdate = true;
  }

  /* Pai Gow felt — replaces the baked "BACCARAT" wordmark on the table top.
     The GLB has two materials, one for the body (wood/rim) and one named
     `VCAP_BaccaratTable_Design_MAT` for the felt design only. We swap that
     material's baseColor (.map) and emissiveMap with our PAI GOW felt PNG,
     preserving every other material setting (transparency, normal map,
     roughness, etc.) so the lighting reads identically. */
  const feltLoader = new THREE.TextureLoader();
  const paiGowFeltTex = feltLoader.load('media/pai-gow-felt.png', () => scheduleRender());
  paiGowFeltTex.encoding = THREE.sRGBEncoding;
  paiGowFeltTex.flipY = false; /* glTF texture convention */
  paiGowFeltTex.anisotropy = MAX_ANISO;
  paiGowFeltTex.minFilter = THREE.LinearMipmapLinearFilter;
  paiGowFeltTex.magFilter = THREE.LinearFilter;
  /* The GLB's design-mesh UVs map the texture horizontally mirrored — the
     baked baccarat felt was authored for that convention. We flip the
     sample direction so the new felt can be designed normally (text reads
     left-to-right in the source PNG and on the rendered table). */
  paiGowFeltTex.wrapS = THREE.RepeatWrapping;
  paiGowFeltTex.repeat.x = -1;
  paiGowFeltTex.offset.x = 1;

  function swapDesignMaterial(mat) {
    if (!mat || mat.name !== 'VCAP_BaccaratTable_Design_MAT') return;
    if (mat.map)         mat.map.dispose?.();
    if (mat.emissiveMap) mat.emissiveMap.dispose?.();
    mat.map = paiGowFeltTex;
    if ('emissiveMap' in mat) mat.emissiveMap = paiGowFeltTex;
    mat.transparent = true;
    mat.needsUpdate = true;
  }

  const gltfLoader = new THREE.GLTFLoader();
  gltfLoader.load('baccarat_table.web.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(TABLE_SCALE);
    model.position.y = -TABLE_TOP_NATIVE * TABLE_SCALE;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (Array.isArray(o.material)) {
          o.material.forEach(tuneMaterial);
          o.material.forEach(swapDesignMaterial);
        } else {
          tuneMaterial(o.material);
          swapDesignMaterial(o.material);
        }
      }
    });
    tableGroup.add(model);
    scheduleRender();
  });

  /* Two seats facing each other across the table — Player at +z (south,
     near camera), Dealer at -z (north, far side). One wager-spot ring on
     the player side; Pai Gow has a single bet per hand. */
  function makeCircle(x, z, radius, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.05, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.008, z);
    tableGroup.add(ring);
    return ring;
  }
  makeCircle(-2.2, 3.4, 0.6, 0x4a9d7f);  /* player wager spot (matches chip) */

  function makeLabel(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    plane.rotation.x = -Math.PI / 2;
    return plane;
  }
  /* Player label sits at the south edge in front of their HIGH row,
     reading upright to the camera. */
  const labP = makeLabel('PLAYER', '#6dd0a8');
  labP.position.set(0, 0.009, 4.0);
  tableGroup.add(labP);

  /* Dealer label sits at the north edge — rotated 180° on the felt so it
     reads upright from the dealer's POV (looking back across the table). */
  const labD = makeLabel('DEALER', '#e04349');
  labD.position.set(0, 0.009, -4.0);
  labD.rotation.z = Math.PI;
  tableGroup.add(labD);

  /* === Cards in 3D — same SVG-to-canvas-texture pipeline === */
  const SUIT_GLYPH_TO_LETTER = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
  const CARD_TEX_RES = 1024;

  function svgToCardTexture(svgUrl) {
    const c = document.createElement('canvas');
    c.width = CARD_TEX_RES;
    c.height = Math.round(CARD_TEX_RES * 1.4);
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.encoding = THREE.sRGBEncoding;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      tex.needsUpdate = true;
      scheduleRender();
    };
    img.src = svgUrl;
    return tex;
  }

  const cardTexCache = new Map();
  function getCardTexture(code) {
    if (!cardTexCache.has(code)) {
      const ext = (code === '1J') ? 'png' : 'svg';
      cardTexCache.set(code, svgToCardTexture(`poker/${code}.${ext}`));
    }
    return cardTexCache.get(code);
  }

  const stageBackTex = svgToCardTexture('poker/1B.svg');

  function buildStageCard(rank, suitGlyph) {
    const code = (rank === 'JOKER') ? '1J' : rank + (SUIT_GLYPH_TO_LETTER[suitGlyph] || 'S');
    const faceTex = getCardTexture(code);
    const materialSide = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
    const mats = [
      materialSide, materialSide,
      new THREE.MeshStandardMaterial({
        map: faceTex,
        emissive: 0xffffff,
        emissiveMap: faceTex,
        emissiveIntensity: 0.28,
        roughness: 0.5,
      }),
      new THREE.MeshStandardMaterial({ map: stageBackTex, roughness: 0.5 }),
      materialSide, materialSide,
    ];
    /* Slightly smaller cards so 7 fit comfortably across each seat. */
    const geo = new THREE.BoxGeometry(0.55, 0.02, 0.78);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    return mesh;
  }

  /* Layout — player and dealer sit ACROSS the table from each other (real
     game). Camera looks from +z toward -z, so:
       Player side  — south, +z (closer to camera)
       Dealer side  — north, -z (across the table from player)
     Within each side, the 5-card HIGH hand sits at the back (further from
     the middle pot) and the 2-card LOW hand sits in front, closer to the
     centre — the standard Pai Gow display order. Both hands centre on
     x = 0 and span ±1.4 horizontally. */
  const PLAYER_HIGH_Z = 2.7;   /* player's high — closest to camera */
  const PLAYER_LOW_Z  = 1.6;   /* player's low — toward the middle */
  const DEALER_HIGH_Z = -2.7;  /* dealer's high — far end of table */
  const DEALER_LOW_Z  = -1.6;  /* dealer's low — toward the middle */
  const HIGH_GAP = 0.7;        /* horizontal spacing between high-row cards */
  const LOW_GAP  = 0.78;

  /* Player's hand: A♠ K♥ Q♣ 9♦ 9♠ 4♥ 2♣ — split high = A 9 9 4 2, low = K Q */
  const playerScript = [
    { rank: '9', suit: '♦', row: 'high', i: 0, total: 5 },
    { rank: '9', suit: '♠', row: 'high', i: 1, total: 5 },
    { rank: 'A', suit: '♠', row: 'high', i: 2, total: 5 },
    { rank: '4', suit: '♥', row: 'high', i: 3, total: 5 },
    { rank: '2', suit: '♣', row: 'high', i: 4, total: 5 },
    { rank: 'K', suit: '♥', row: 'low',  i: 0, total: 2 },
    { rank: 'Q', suit: '♣', row: 'low',  i: 1, total: 2 },
  ];
  /* Dealer's hand: J♦ J♣ 8♥ 7♠ 6♦ 3♣ 2♥ — high = J J 8 6 3, low = 7 2 */
  const dealerScript = [
    { rank: 'J', suit: '♦', row: 'high', i: 0, total: 5 },
    { rank: 'J', suit: '♣', row: 'high', i: 1, total: 5 },
    { rank: '8', suit: '♥', row: 'high', i: 2, total: 5 },
    { rank: '6', suit: '♦', row: 'high', i: 3, total: 5 },
    { rank: '3', suit: '♣', row: 'high', i: 4, total: 5 },
    { rank: '7', suit: '♠', row: 'low',  i: 0, total: 2 },
    { rank: '2', suit: '♥', row: 'low',  i: 1, total: 2 },
  ];

  function endPosFor(side, row, i, total) {
    const gap = (row === 'high') ? HIGH_GAP : LOW_GAP;
    const x = (i - (total - 1) / 2) * gap;
    let z;
    if (side === 'player') z = (row === 'high') ? PLAYER_HIGH_Z : PLAYER_LOW_Z;
    else                   z = (row === 'high') ? DEALER_HIGH_Z : DEALER_LOW_Z;
    return new THREE.Vector3(x, 0.04, z);
  }

  function makeStageCards(script, side) {
    /* Dealer's cards face away from the player (toward the dealer) — give
       them a 180° yaw so they look upright from the dealer's POV.
       Player's cards stay at yaw 0 so they look upright from the camera. */
    const yaw = (side === 'dealer') ? Math.PI : 0;
    return script.map((s) => {
      const card = buildStageCard(s.rank, s.suit);
      card.position.set(0, 8, -6);
      card.rotation.set(-Math.PI, 0, 0);
      card.visible = false;
      card.userData.startPos = new THREE.Vector3(0, 8, -6);
      card.userData.endPos   = endPosFor(side, s.row, s.i, s.total);
      card.userData.side     = side;
      card.userData.row      = s.row;
      card.userData.endYaw   = yaw;
      scene.add(card);
      return card;
    });
  }
  const playerCards = makeStageCards(playerScript, 'player');
  const dealerCards = makeStageCards(dealerScript, 'dealer');

  /* Chip stack on the player's wager spot. */
  function makeChip(bodyColor, stripeColor, height) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.05 });
    const stripe = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.4, metalness: 0.05 });
    for (let i = 0; i < height; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.07, 32),
        i % 3 === 2 ? stripe : body
      );
      m.position.y = 0.035 + i * 0.07;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
  const stageChip = makeChip(0xc1272d, 0xf5f0e0, 5);
  /* Player's wager spot — in front of the player's low hand, slightly off
     to one side so it doesn't crowd the cards. */
  stageChip.position.set(-2.2, 0.01, 3.4);
  stageChip.visible = false;
  scene.add(stageChip);

  /* Camera path keyframes (6 steps) — original tuning. Card positions
     changed (player ↔ dealer across the table) but the camera arc stays
     the same as designed. */
  const camKeys = [
    /* 0 — far wide */                  { pos: [0, 13, 18], look: [0, 0, 0] },
    /* 1 — mid hover */                 { pos: [0, 11, 14], look: [0, 0, 1] },
    /* 2 — focus player set */          { pos: [-5, 8, 11], look: [-2.6, 0, 2.2] },
    /* 3 — focus dealer reveal */       { pos: [ 5, 8, 11], look: [ 2.6, 0, 2.2] },
    /* 4 — top-down split */            { pos: [0, 14, 5],  look: [0, 0, 2.0] },
    /* 5 — wide showdown / settle */    { pos: [0, 12, 17], look: [0, 0, 1] },
  ];

  /*
    Step plan:
      0 — wager only, no cards
      1 — 7 cards dealt to each seat (face up). We reveal player first then dealer.
          Reveal counts ramp from (0,0) to (7,7) across this step.
      2 — focus on player set (cards stay; camera moves close)
      3 — focus on dealer reveal (same cards, camera moves)
      4 — top-down view emphasising the 5+2 split layout
      5 — settle: wide angle, all cards visible
  */
  const steps = [
    {
      title: 'Place your wager',
      body: 'A single bet, posted before the deal. <strong>One wager per hand</strong> — no Player/Banker/Tie split. The chip in front of the rail is your action for the round.',
      camIdx: 0, revealPlayer: 0, revealDealer: 0, showChip: true
    },
    {
      title: 'Seven cards each',
      body: 'The dealer deals <strong>seven cards to you</strong>, then seven to themselves. Joker included — 53 cards total. In this stage we lay them face-up so the split is readable.',
      camIdx: 1, revealPlayer: 7, revealDealer: 7, showChip: true
    },
    {
      title: 'You set the hand',
      body: 'You arrange your seven cards: <strong>five behind</strong> form the high hand, <strong>two in front</strong> form the low. The high hand <em>must outrank</em> the low or your bet is fouled.',
      camIdx: 2, revealPlayer: 7, revealDealer: 7, showChip: true
    },
    {
      title: 'Dealer reveals',
      body: 'Dealer flips their seven and sets them the <em>house way</em> — same five-and-two split, no choice involved. Same hand, same split, every time.',
      camIdx: 3, revealPlayer: 7, revealDealer: 7, showChip: true
    },
    {
      title: 'Compare both hands',
      body: 'Top-down: your 5+2 vs the dealer\'s 5+2. Player has <strong>9-9 high · K-Q low</strong>. Dealer has <strong>J-J high · 7-2 low</strong>. Player loses high, wins low — that\'s a <em>push</em>.',
      camIdx: 4, revealPlayer: 7, revealDealer: 7, showChip: true
    },
    {
      title: 'Settle · push',
      body: 'One hand each side. Bet is returned. About <strong>40% of Pai Gow Poker hands</strong> end this way — which is why a single chip can last all afternoon.',
      camIdx: 5, revealPlayer: 7, revealDealer: 7, showChip: true
    }
  ];

  const tmpVec = new THREE.Vector3();
  function readScrollProgress() {
    const rect = stage.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / total));
  }

  function applyReveal(cards, revealFloat) {
    cards.forEach((card, i) => {
      if (i < Math.floor(revealFloat)) {
        card.visible = true;
        card.position.copy(card.userData.endPos);
        card.rotation.set(0, card.userData.endYaw, 0);
      } else if (i === Math.floor(revealFloat)) {
        const f = revealFloat - Math.floor(revealFloat);
        if (f > 0.01) {
          card.visible = true;
          const sp = card.userData.startPos;
          const ep = card.userData.endPos;
          const arc = Math.sin(f * Math.PI) * 1.5;
          card.position.set(
            sp.x + (ep.x - sp.x) * f,
            sp.y + (ep.y - sp.y) * f + arc,
            sp.z + (ep.z - sp.z) * f
          );
          card.rotation.x = -Math.PI + Math.PI * f;
          card.rotation.y = card.userData.endYaw * f;
        } else {
          card.visible = false;
        }
      } else {
        card.visible = false;
      }
    });
  }

  function update(progress) {
    const p = (typeof progress === 'number') ? progress : readScrollProgress();
    if (bar) bar.style.width = (p * 100) + '%';

    const stepFloat = p * (steps.length - 1);
    const stepIdx = Math.min(steps.length - 1, Math.floor(stepFloat));
    const stepFrac = stepFloat - stepIdx;
    const nextIdx = Math.min(stepIdx + 1, steps.length - 1);

    const a = camKeys[steps[stepIdx].camIdx];
    const b = camKeys[steps[nextIdx].camIdx];
    camera.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * stepFrac,
      a.pos[1] + (b.pos[1] - a.pos[1]) * stepFrac,
      a.pos[2] + (b.pos[2] - a.pos[2]) * stepFrac
    );
    tmpVec.set(
      a.look[0] + (b.look[0] - a.look[0]) * stepFrac,
      a.look[1] + (b.look[1] - a.look[1]) * stepFrac,
      a.look[2] + (b.look[2] - a.look[2]) * stepFrac
    );
    camera.lookAt(tmpVec);

    /* Player and dealer reveal independently so the deal looks alternating. */
    const revP  = steps[stepIdx].revealPlayer;
    const revPN = steps[nextIdx].revealPlayer;
    const revD  = steps[stepIdx].revealDealer;
    const revDN = steps[nextIdx].revealDealer;
    const revPF = revP + (revPN - revP) * stepFrac;
    const revDF = revD + (revDN - revD) * stepFrac;
    applyReveal(playerCards, revPF);
    applyReveal(dealerCards, revDF);

    stageChip.visible = steps[stepIdx].showChip && p > 0.02;

    if (stepIdx !== update.lastStep) {
      update.lastStep = stepIdx;
      if (update.outTimer) clearTimeout(update.outTimer);
      if (update.inTimer)  clearTimeout(update.inTimer);

      const positions = ['right', 'top', 'left', 'right', 'top', 'right'];
      const nextPos = positions[stepIdx];

      panel.classList.add('transit');
      panel.classList.remove('visible');

      update.outTimer = setTimeout(() => {
        const s = steps[stepIdx];
        stepEl.textContent = `Step ${String(stepIdx + 1).padStart(2,'0')} of 06`;
        titleEl.textContent = s.title;
        bodyEl.innerHTML = s.body;
        panel.dataset.pos = nextPos;
        panel.classList.remove('transit');
        void panel.offsetWidth;
        update.inTimer = setTimeout(() => {
          if (update.lastStep === stepIdx) panel.classList.add('visible');
        }, 30);
      }, 280);
    }

    const stageRect = stage.getBoundingClientRect();
    const winH = window.innerHeight;
    const inRange = stageRect.top < winH * 0.5 && stageRect.bottom > winH * 0.5;
    if (!inRange) {
      panel.classList.remove('visible');
      panel.classList.remove('transit');
    }

    renderer.render(scene, camera);
  }
  update.lastStep = -1;

  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    update();
  }
  window.addEventListener('resize', onResize);
  onResize();
  update();

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => update(self.progress),
    });
  } else {
    window.addEventListener('scroll', () => update(), { passive: true });
  }

  let rafId = 0;
  function tick() {
    update();
    rafId = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !rafId) rafId = requestAnimationFrame(tick);
        else if (!e.isIntersecting && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      });
    }, { threshold: 0 });
    io.observe(stage);
  } else {
    rafId = requestAnimationFrame(tick);
  }
})();
