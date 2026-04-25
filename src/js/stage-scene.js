/* ============================================================
   STAGE: Scroll-driven 3D baccarat table simulation
   ============================================================ */
(function initStage() {
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
  /* PBR-friendly output: sRGB encoding so baseColor textures aren't gamma-doubled,
     plus filmic tone mapping for a cinematic roll-off on the lacquered table.
     Exposure pulled below 1.0 so the felt sits in a darker mid-tone and the
     bright card faces read clearly against it. */
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050807, 12, 40);

  const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);

  /* LIGHTS — ambient + wide key spot keep the felt visible from every camera
     angle. Intensities tuned down from the original so the table doesn't
     blow out the card-face textures sitting on it; coloured rims still add
     atmosphere without lifting the mid-tones. */
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

  /* Render queue — async assets (GLB + SVG card textures) need to trigger a
     repaint when they finish, since the main loop only ticks on scroll. */
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderer.render(scene, camera);
    });
  }

  /* TABLE — loaded from baccarat_table.web.glb */
  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  /*
    GLB authored at ~2.54m × 1.46m (bbox X: ±1.27, Z: ±0.73, Y: 0→1.04).
    Scale to roughly fill the camera frame at the wide/top-down keyframes,
    and shift down so the table top sits at y≈0 — cards land at y=0.04.
  */
  /* Bigger table so it dominates every camera frame. Was 4.5; bump to 7. */
  const TABLE_SCALE = 7;
  const TABLE_TOP_NATIVE = 1.04;
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
  const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];

  /* Apply trilinear filtering + max anisotropy to every texture on a material.
     This is the fix for moiré/banding on the felt when the camera tilts. */
  function tuneMaterial(mat) {
    if (!mat) return;
    TEX_SLOTS.forEach((slot) => {
      const t = mat[slot];
      if (!t) return;
      t.anisotropy = MAX_ANISO;
      t.minFilter = THREE.LinearMipmapLinearFilter; /* trilinear */
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
    });
    /* Soften the normal map — the original is high-frequency and shimmers
       at distance. 0.55 is enough to keep felt grain without aliasing. */
    if (mat.normalScale) mat.normalScale.set(0.55, 0.55);
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
        if (Array.isArray(o.material)) o.material.forEach(tuneMaterial);
        else tuneMaterial(o.material);
      }
    });
    tableGroup.add(model);
    scheduleRender();
  });

  /* Betting circles — Player (left), Tie (center), Banker (right) */
  function makeCircle(x, z, radius, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.05, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.008, z);
    tableGroup.add(ring);
    return ring;
  }
  const circP = makeCircle(-2.8, 2.0, 0.9, 0x4a9d7f);
  const circT = makeCircle(0, 2.2, 0.7, 0xc9a961);
  const circB = makeCircle(2.8, 2.0, 0.9, 0xc1272d);

  /* label text via canvas textures */
  function makeLabel(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 48px Georgia, serif';
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
  const labP = makeLabel('PLAYER', '#6dd0a8');
  labP.position.set(-2.8, 0.009, 2.0);
  tableGroup.add(labP);

  const labT = makeLabel('TIE 8:1', '#e6c985');
  labT.position.set(0, 0.009, 2.2);
  labT.scale.setScalar(0.75);
  tableGroup.add(labT);

  const labB = makeLabel('BANKER', '#e04349');
  labB.position.set(2.8, 0.009, 2.0);
  tableGroup.add(labB);

  /* === Cards in 3D — textures rasterized from poker/{code}.svg === */
  const SUIT_GLYPH_TO_LETTER = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
  const CARD_TEX_RES = 1024; /* 5:7 → 1024 × 1432 */

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
      cardTexCache.set(code, svgToCardTexture(`poker/${code}.svg`));
    }
    return cardTexCache.get(code);
  }

  const stageBackTex = svgToCardTexture('poker/1B.svg');

  function buildStageCard(rank, suitGlyph) {
    const code = rank + (SUIT_GLYPH_TO_LETTER[suitGlyph] || 'S');
    const faceTex = getCardTexture(code);
    const materialSide = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
    /* BoxGeometry material slots: 0:+x 1:-x 2:+y 3:-y 4:+z 5:-z.
       Card is laid flat, so the visible faces are +y (top/face) and -y (bottom/back),
       not +z/-z which are the thin 0.02-unit edges. */
    /* Face uses its own texture as a subtle emissive so the pips/ranks stay
       readable after we pulled overall scene brightness down. Keep emissive
       intensity low — too high and the card looks like a fluorescent sticker. */
    const mats = [
      materialSide,                                                            // +x edge
      materialSide,                                                            // -x edge
      new THREE.MeshStandardMaterial({
        map: faceTex,
        emissive: 0xffffff,
        emissiveMap: faceTex,
        emissiveIntensity: 0.28,
        roughness: 0.5,
      }),                                                                      // +y face
      new THREE.MeshStandardMaterial({ map: stageBackTex, roughness: 0.5 }),   // -y back
      materialSide,                                                            // +z edge
      materialSide,                                                            // -z edge
    ];
    /* Card box sized in metres-ish (5:7 ratio): 0.7 wide × 0.99 deep —
       fits inside a betting circle of radius 0.9. */
    const geo = new THREE.BoxGeometry(0.7, 0.02, 0.99);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    return mesh;
  }

  /* The script for the stage: 6 cards fan out at the Player and Banker spots.
     Player spot is at world (x=-2.8, z=2.0); Banker spot at (x=2.8, z=2.0).
     Each side gets three cards offset along x with a slight yaw fan. */
  const PLAYER_X = -2.8, BANKER_X = 2.8, SPOT_Z = 2.0;
  const script = [
    { rank: '7', suit: '♥', side: 'player', pos: [PLAYER_X - 0.5, SPOT_Z], yaw:  0.22 },
    { rank: 'K', suit: '♠', side: 'banker', pos: [BANKER_X - 0.5, SPOT_Z], yaw:  0.22 },
    { rank: '5', suit: '♦', side: 'player', pos: [PLAYER_X,       SPOT_Z], yaw:  0     },
    { rank: '4', suit: '♣', side: 'banker', pos: [BANKER_X,       SPOT_Z], yaw:  0     },
    { rank: '2', suit: '♥', side: 'player', pos: [PLAYER_X + 0.5, SPOT_Z], yaw: -0.22 }, /* player 3rd */
    { rank: 'A', suit: '♠', side: 'banker', pos: [BANKER_X + 0.5, SPOT_Z], yaw: -0.22 }, /* banker 3rd */
  ];

  const stageCards = script.map(s => {
    const card = buildStageCard(s.rank, s.suit);
    /* hidden initially, falling from above */
    card.position.set(0, 8, -6);
    card.rotation.set(-Math.PI, 0, 0);
    card.visible = false;
    card.userData.startPos = new THREE.Vector3(0, 8, -6);
    card.userData.endPos = new THREE.Vector3(s.pos[0], 0.04, s.pos[1]);
    card.userData.side = s.side;
    card.userData.endYaw = s.yaw;
    scene.add(card);
    return card;
  });

  /* Chip stack — classic casino-red $5 chip with white edge band stripe.
     Each chip is a stubby cylinder; every third chip is the white-band variant
     for visual rhythm. */
  function makeChip(bodyColor, stripeColor, height) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.05 });
    const stripe = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.4, metalness: 0.05 });
    for (let i = 0; i < height; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.07, 32),
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
  stageChip.position.set(-2.8, 0.01, 2.0);
  stageChip.visible = false;
  scene.add(stageChip);

  /* Camera path keyframes (6 steps) */
  /* Camera keyframes — pulled closer to match TABLE_SCALE 7. The table is
     ~17.8 m wide × 10.2 m deep; cameras stay 11–18 units back so the felt
     fills the frame from every angle. */
  const camKeys = [
    /* 0 — far wide */     { pos: [0, 13, 18], look: [0, 0, 0] },
    /* 1 — mid hover */    { pos: [0, 10, 14], look: [0, 0, 0] },
    /* 2 — dealer POV */   { pos: [0,  8, 10], look: [0, 0, -0.5] },
    /* 3 — left bias */    { pos: [-5, 7,  9], look: [-1, 0, 0] },
    /* 4 — right bias */   { pos: [ 5, 7,  9], look: [1, 0, 0] },
    /* 5 — top-down */     { pos: [0, 16,  5], look: [0, 0, 0] },
  ];

  const steps = [
    {
      title: 'Place your wager',
      body: 'Three bets: <strong>Punto</strong> (Player), <strong>Banco</strong> (Banker), or <strong>Egalité</strong> (Tie). You pick which <em>hand</em> wins — Player and Banker are just labels, not sides you play.',
      camIdx: 0, revealCards: 0, showChip: true
    },
    {
      title: 'First deal — two to each',
      body: 'The dealer burns the top card, then deals <strong>Player first</strong>: two cards to Player, two cards to Banker, all face-up in Punto Banco.',
      camIdx: 1, revealCards: 4, showChip: true
    },
    {
      title: 'Totals are compared',
      body: 'Player shows <strong>7 + 5 = 12 → 2</strong>. Banker shows <strong>K + 4 = 0 + 4 = 4</strong>. No natural (neither 8 nor 9), so the tableau continues.',
      camIdx: 2, revealCards: 4, showChip: true
    },
    {
      title: 'Player draws on 0–5',
      body: 'Player\'s total is 2 — below 6 — so the tableau forces a draw. A <strong>2</strong> comes out. Player is now at <strong>4</strong>.',
      camIdx: 3, revealCards: 5, showChip: true
    },
    {
      title: 'Banker reacts to Player\'s third',
      body: 'Banker has 4; Player\'s third card was a 2 — the tableau says Banker draws. Banker gets an <strong>Ace (1)</strong>. Banker total: <strong>5</strong>.',
      camIdx: 4, revealCards: 6, showChip: true
    },
    {
      title: 'Banker wins · 5 beats 4',
      body: 'Banker (5) beats Player (4). Banker bets pay <strong>0.95:1</strong> after the 5% commission; Player and Tie bets lose.',
      camIdx: 5, revealCards: 6, showChip: true
    }
  ];

  /* Compute stage scroll progress & render. Driven by GSAP ScrollTrigger
     (scrub: 1) — progress is fed in from the trigger callback. The fallback
     reads the rect directly so the very first render still works before
     ScrollTrigger has a chance to fire. */
  const tmpVec = new THREE.Vector3();
  function readScrollProgress() {
    const rect = stage.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / total));
  }
  function update(progress) {
    const p = (typeof progress === 'number') ? progress : readScrollProgress();

    if (bar) bar.style.width = (p * 100) + '%';

    /* Determine which step we're on (0..5) */
    const stepFloat = p * (steps.length - 1);
    const stepIdx = Math.min(steps.length - 1, Math.floor(stepFloat));
    const stepFrac = stepFloat - stepIdx;
    const nextIdx = Math.min(stepIdx + 1, steps.length - 1);

    /* Camera: interpolate between keys */
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

    /* Reveal cards per cumulative step */
    const reveal = steps[stepIdx].revealCards;
    const revealNext = steps[nextIdx].revealCards;
    const revealFloat = reveal + (revealNext - reveal) * stepFrac;
    stageCards.forEach((card, i) => {
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
          /* arc into place */
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

    /* Chip */
    stageChip.visible = steps[stepIdx].showChip && p > 0.02;

    /* Overlay panel — orbit through anchor positions per step
       (right → top → left → bottom → right → top). Each transition fades
       out, swaps content + data-pos, then fades back in. Timeouts stored
       on update.* so a fast scroll cancels in-flight transitions cleanly. */
    if (stepIdx !== update.lastStep) {
      update.lastStep = stepIdx;
      if (update.outTimer) clearTimeout(update.outTimer);
      if (update.inTimer)  clearTimeout(update.inTimer);

      const positions = ['right', 'top', 'left', 'bottom', 'right', 'top'];
      const nextPos = positions[stepIdx];

      panel.classList.add('transit');
      panel.classList.remove('visible');

      update.outTimer = setTimeout(() => {
        const s = steps[stepIdx];
        stepEl.textContent = `Step ${String(stepIdx + 1).padStart(2,'0')} of 06`;
        titleEl.textContent = s.title;
        bodyEl.innerHTML = s.body;
        panel.dataset.pos = nextPos; /* glide to new anchor */
        panel.classList.remove('transit');
        void panel.offsetWidth; /* reflow before re-adding visible */
        update.inTimer = setTimeout(() => {
          if (update.lastStep === stepIdx) panel.classList.add('visible');
        }, 30);
      }, 280);
    }

    /* Hide the panel when out of the sticky range. Don't re-add visible
       here — the step-transition handler owns that, so the fade-out can
       complete without being cancelled. */
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

  /* GSAP ScrollTrigger drives camera angle changes through the 6 keyframes.
     scrub: 1 smooths the progression so fast scrolls don't snap the camera. */
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
    /* Fallback to native scroll if GSAP failed to load. */
    window.addEventListener('scroll', () => update(), { passive: true });
  }

  /* Continuous animation loop while .stage is in view — guarantees the
     canvas keeps drawing even after async loads finish (GLB textures, SVG
     card faces). Pauses off-screen to save GPU. */
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

