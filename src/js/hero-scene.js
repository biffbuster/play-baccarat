/* ============================================================
   HERO: Three.js card-fall loop
   ============================================================ */
(function initHero() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050807, 8, 35);

  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 0, 0);

  /* Lights */
  const amb = new THREE.AmbientLight(0x3a2e1a, 0.35);
  scene.add(amb);
  const key = new THREE.PointLight(0xe6c985, 2.5, 30);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xc1272d, 1.2, 22);
  rim.position.set(6, 3, -4);
  scene.add(rim);

  /* Felt disk / table */
  const feltGeo = new THREE.CircleGeometry(12, 64);
  const feltMat = new THREE.MeshStandardMaterial({
    color: 0x0e1e18,
    roughness: 0.95,
    metalness: 0.0,
  });
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = -0.01;
  scene.add(felt);

  /* Gold inner border ring */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(9.4, 9.55, 64),
    new THREE.MeshBasicMaterial({ color: 0xc9a961, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  /* Build playing card mesh (canvas texture) */
  function makeCardTexture(rank, suit, colorHex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 360;
    const ctx = c.getContext('2d');
    /* background */
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#faf5e6');
    g.addColorStop(1, '#eaddbc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 360);
    /* border */
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 356);
    /* ranks */
    ctx.fillStyle = colorHex;
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText(rank, 16, 60);
    ctx.font = '36px serif';
    ctx.fillText(suit, 22, 98);
    /* center */
    ctx.textAlign = 'center';
    ctx.font = '140px serif';
    ctx.fillText(suit, 128, 220);
    /* bottom rotated */
    ctx.save();
    ctx.translate(256, 360);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText(rank, 16, 60);
    ctx.font = '36px serif';
    ctx.fillText(suit, 22, 98);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function makeCardBackTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 360;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 360);
    g.addColorStop(0, '#8a1c21');
    g.addColorStop(0.5, '#c1272d');
    g.addColorStop(1, '#8a1c21');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 360);
    /* filigree pattern */
    ctx.strokeStyle = 'rgba(201, 169, 97, 0.4)';
    ctx.lineWidth = 1;
    for (let i = -256; i < 512; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 360);
      ctx.stroke();
    }
    for (let i = -256; i < 512; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 256, 360);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c9a961';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 236, 340);
    ctx.fillStyle = '#c9a961';
    ctx.font = 'bold 140px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠', 128, 180);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  const backTex = makeCardBackTexture();

  function buildCard(rank, suit, colorHex) {
    const faceTex = makeCardTexture(rank, suit, colorHex);
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.45 }),  /* front */
      new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.45 }),  /* back  */
    ];
    const geo = new THREE.BoxGeometry(1.8, 0.03, 2.55);
    return new THREE.Mesh(geo, mats);
  }

  /* Scatter a bunch of cards around the table */
  const ranks = [['A','♠','#111'],['K','♥','#c1272d'],['Q','♦','#c1272d'],['J','♣','#111'],['9','♥','#c1272d'],['7','♠','#111']];
  const cards = [];
  for (let i = 0; i < 16; i++) {
    const r = ranks[i % ranks.length];
    const card = buildCard(r[0], r[1], r[2]);
    card.position.set(
      (Math.random() - 0.5) * 14,
      0.03 + (i * 0.04),
      (Math.random() - 0.5) * 8 - 1
    );
    card.rotation.y = Math.random() * Math.PI * 2;
    card.rotation.x = 0;
    card.userData.baseY = card.position.y;
    card.userData.driftSpeed = 0.2 + Math.random() * 0.3;
    card.userData.phase = Math.random() * Math.PI * 2;
    cards.push(card);
    scene.add(card);
  }

  /* Chip stack (simple cylinders, gold + red) */
  function chipStack(x, z, count, colorHex) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
    const ring = new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.3 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24),
        i % 3 === 2 ? ring : mat
      );
      m.position.y = 0.03 + i * 0.06;
      group.add(m);
    }
    group.position.set(x, 0, z);
    return group;
  }
  scene.add(chipStack(-4.5, -2, 8, 0xc1272d));
  scene.add(chipStack(4.5, -2, 6, 0xc9a961));
  scene.add(chipStack(-3.5, -3, 4, 0x1a1a1a));

  let t0 = performance.now();
  function loop() {
    const t = (performance.now() - t0) * 0.001;
    cards.forEach((c, i) => {
      c.rotation.y += 0.003 + i * 0.0001;
      c.position.y = c.userData.baseY + Math.sin(t * c.userData.driftSpeed + c.userData.phase) * 0.08;
    });
    camera.position.x = Math.sin(t * 0.15) * 1.2;
    camera.position.z = 14 + Math.cos(t * 0.1) * 1.2;
    camera.lookAt(0, 0.4, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);
  onResize();
})();

