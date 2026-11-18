/* Pennant hero: a brass armillary sphere on a marble plinth, rendered with
   physically based materials. The story section drives it through window.PENNANT_STORY.p
   (0 to 1), which app.js updates from ScrollTrigger. */

import * as THREE from 'three';
import { RoomEnvironment } from '/vendor/RoomEnvironment.js';

const canvas = document.getElementById('orrery');
const story = (window.PENNANT_STORY = window.PENNANT_STORY || { p: 0 });

function fail() {
  document.documentElement.classList.add('no-webgl');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  fail();
}

if (renderer) build();

function build() {
  // start modest; frame() raises or lowers resolution based on how the machine copes
  const MAX_DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  let dpr = Math.min(MAX_DPR, 1.25);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  /* ---------- materials ---------- */

  const gilt = new THREE.MeshPhysicalMaterial({
    color: 0xd9b67c, metalness: 1, roughness: 0.24,
    clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1.25
  });
  const giltDark = new THREE.MeshPhysicalMaterial({
    color: 0xb08d57, metalness: 1, roughness: 0.38, envMapIntensity: 1.1
  });
  const lapis = new THREE.MeshPhysicalMaterial({
    color: 0x1d4384, metalness: 0.05, roughness: 0.32,
    clearcoat: 1, clearcoatRoughness: 0.06
  });
  const ink = new THREE.MeshPhysicalMaterial({
    color: 0x121212, metalness: 0.2, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.2
  });
  const marble = new THREE.MeshPhysicalMaterial({
    map: marbleTexture(), color: 0xe4ddd0, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12
  });

  /* ---------- geometry ---------- */

  const root = new THREE.Group();
  scene.add(root);

  const R = 1.25;          // meridian radius
  const TILT = THREE.MathUtils.degToRad(23.44);

  // plinth: a turned marble column base
  const profile = [
    [0.0, 0.0], [0.95, 0.0], [0.98, 0.04], [0.98, 0.12], [0.9, 0.16], [0.86, 0.2],
    [0.6, 0.26], [0.42, 0.34], [0.36, 0.42], [0.34, 0.62], [0.4, 0.68], [0.44, 0.72],
    [0.3, 0.78], [0.14, 0.82], [0.0, 0.82]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const plinth = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), marble);
  plinth.position.y = -R - 1.02;
  plinth.castShadow = plinth.receiveShadow = true;
  root.add(plinth);

  // gilt band on the plinth
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.022, 12, 72), gilt);
  band.rotation.x = Math.PI / 2;
  band.position.y = plinth.position.y + 0.72;
  root.add(band);

  // stem up to the cradle
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.36, 32), gilt);
  stem.position.y = -R - 0.06;
  stem.castShadow = true;
  root.add(stem);

  // cradle: a half ring under the meridian
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(R + 0.09, 0.03, 12, 80, Math.PI), giltDark);
  cradle.rotation.z = Math.PI;
  cradle.rotation.y = Math.PI / 2;
  cradle.castShadow = true;
  root.add(cradle);

  // horizon ring: wide and flat, fixed to the stand
  const horizon = new THREE.Mesh(new THREE.TorusGeometry(R + 0.2, 0.06, 16, 128), gilt);
  horizon.rotation.x = Math.PI / 2;
  horizon.scale.set(1, 1, 0.35);
  horizon.castShadow = true;
  root.add(horizon);

  // the moving armature
  const armature = new THREE.Group();
  root.add(armature);

  const meridian = new THREE.Mesh(new THREE.TorusGeometry(R, 0.042, 16, 140), gilt);
  meridian.castShadow = true;
  armature.add(meridian);

  // engraved ticks around the meridian
  const tickGeo = new THREE.BoxGeometry(0.012, 0.07, 0.09);
  const ticks = new THREE.InstancedMesh(tickGeo, giltDark, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const long = i % 5 === 0 ? 1.6 : 1;
    m4.compose(
      new THREE.Vector3(Math.cos(a) * (R + 0.055), Math.sin(a) * (R + 0.055), 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2),
      new THREE.Vector3(1, long, 1)
    );
    ticks.setMatrixAt(i, m4);
  }
  meridian.add(ticks);

  // polar axis, tilted inside the meridian
  const axisGroup = new THREE.Group();
  axisGroup.rotation.z = TILT;
  armature.add(axisGroup);

  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, R * 2 + 0.34, 24), gilt);
  axisGroup.add(axis);
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), gilt);
    fin.position.y = s * (R + 0.17);
    axisGroup.add(fin);
  }

  // the spinning cage
  const cage = new THREE.Group();
  axisGroup.add(cage);

  const parts = []; // { mesh, dir, spin }

  function ring(radius, tube, mat, setup, dir, spin) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 14, 120), mat);
    setup(m);
    m.castShadow = true;
    m.userData.base = { pos: m.position.clone(), rot: m.rotation.clone() };
    cage.add(m);
    parts.push({ mesh: m, dir: new THREE.Vector3(...dir), spin });
    return m;
  }

  // equator
  ring(R * 0.94, 0.03, gilt, m => { m.rotation.x = Math.PI / 2; }, [0, 0, 0], [0, 0, 0.6]);
  // tropics and polar circles
  const tropicY = Math.sin(TILT) * R * 0.94;
  const tropicR = Math.cos(TILT) * R * 0.94;
  ring(tropicR, 0.02, giltDark, m => { m.rotation.x = Math.PI / 2; m.position.y = tropicY; }, [0, 1.1, 0], [0, 0, 0.4]);
  ring(tropicR, 0.02, giltDark, m => { m.rotation.x = Math.PI / 2; m.position.y = -tropicY; }, [0, -1.1, 0], [0, 0, -0.4]);
  const polarY = Math.cos(TILT) * R * 0.94;
  const polarR = Math.sin(TILT) * R * 0.94;
  ring(polarR, 0.018, giltDark, m => { m.rotation.x = Math.PI / 2; m.position.y = polarY; }, [0, 1.6, 0], [0, 0, 1]);
  ring(polarR, 0.018, giltDark, m => { m.rotation.x = Math.PI / 2; m.position.y = -polarY; }, [0, -1.6, 0], [0, 0, -1]);
  // colures
  ring(R * 0.94, 0.026, gilt, m => {}, [0.9, 0, 0.4], [0.5, 0, 0]);
  ring(R * 0.94, 0.026, gilt, m => { m.rotation.y = Math.PI / 2; }, [-0.9, 0, -0.4], [-0.5, 0, 0]);
  // ecliptic: a wide enamelled band
  const ecl = ring(R * 0.94, 0.07, lapis, m => { m.rotation.x = Math.PI / 2 - TILT * 1.0; m.scale.set(1, 1, 0.32); }, [0.5, 0.6, 0.9], [0.4, 0.3, 0]);
  ecl.scale.set(1, 1, 0.32);

  // the earth: lapis enamel with a gilt equator line
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.34, 64, 40), lapis);
  earth.castShadow = true;
  cage.add(earth);
  const earthBand = new THREE.Mesh(new THREE.TorusGeometry(0.342, 0.008, 8, 96), gilt);
  earthBand.rotation.x = Math.PI / 2;
  earth.add(earthBand);

  /* ---------- light and ground ---------- */

  const key = new THREE.DirectionalLight(0xfff4e2, 2.4);
  key.position.set(1.5, 9, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb08d57, 1.1);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = plinth.position.y;
  ground.receiveShadow = true;
  root.add(ground);

  /* ---------- animation ---------- */

  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  let pointerX = 0, pointerY = 0;
  addEventListener('pointermove', e => {
    pointerX = (e.clientX / innerWidth) * 2 - 1;
    pointerY = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { p: 0, px: 0, py: 0, spin: 0 };
  let visible = true, last = performance.now();

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  renderer.shadowMap.autoUpdate = false;
  let frames = 0, slowSum = 0, sampleN = 0;

  function adapt(dtMs) {
    // after the first second, sample 45 frames and nudge resolution up or down
    if (frames < 60) return;
    slowSum += dtMs; sampleN++;
    if (sampleN < 45) return;
    const avg = slowSum / sampleN;
    slowSum = 0; sampleN = 0;
    let next = dpr;
    if (avg > 24) next = Math.max(0.75, dpr - 0.25);
    else if (avg < 14) next = Math.min(MAX_DPR, dpr + 0.25);
    if (next !== dpr) { dpr = next; renderer.setPixelRatio(dpr); resize(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dtMs = now - last;
    const dt = Math.min(0.05, dtMs / 1000);
    last = now;
    if (!visible || document.hidden) return;
    frames++;
    adapt(dtMs);
    // the shadow only needs refreshing every other frame
    if (frames % 2 === 0) renderer.shadowMap.needsUpdate = true;

    state.p = lerp(state.p, story.p || 0, 0.12);
    state.px = lerp(state.px, pointerX, 0.05);
    state.py = lerp(state.py, pointerY, 0.05);
    const p = state.p;
    const wide = innerWidth > 900;

    // exploded view in chapter I, close inspection in II, a fast turn in III
    const explode = bump(0.12, 0.26, 0.36, 0.48, p);
    const close = bump(0.44, 0.56, 0.66, 0.78, p);
    const turn = bump(0.66, 0.74, 0.86, 0.96, p);

    state.spin += dt * (reduce ? 0 : 0.18 + turn * 1.6);
    cage.rotation.y = state.spin;
    armature.rotation.y = state.spin * 0.12 + state.px * 0.25;

    for (const part of parts) {
      const b = part.mesh.userData.base;
      part.mesh.position.set(
        b.pos.x + part.dir.x * explode * 0.8,
        b.pos.y + part.dir.y * explode * 0.8,
        b.pos.z + part.dir.z * explode * 0.8
      );
      part.mesh.rotation.set(
        b.rot.x + part.spin[0] * explode * 1.4,
        b.rot.y + part.spin[1] * explode * 1.4,
        b.rot.z + part.spin[2] * explode * 1.4
      );
    }
    earth.scale.setScalar(1 + explode * 0.35);
    axisGroup.rotation.z = TILT + explode * 0.15;

    root.position.x = 0;
    root.position.y = 0.05;
    // push the object right of the headline by shifting the frustum, not the scene
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (wide) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    canvas.style.opacity = p > 0.94 ? String(1 - ss(0.95, 1, p)) : '';
    root.rotation.x = state.py * 0.06;

    const dist = lerp(wide ? 10.2 : 17, wide ? 7 : 13, close) + explode * 0.9;
    const orbit = -0.35 + p * 1.2 + state.px * 0.08;
    camera.position.set(Math.sin(orbit) * dist, 0.9 + close * 0.2 - state.py * 0.15, Math.cos(orbit) * dist);
    camera.lookAt(0, root.position.y - 0.45 + close * 0.3, 0);

    renderer.render(scene, camera);
  }
  // compile every shader before the first frame so the page does not hitch on reveal
  renderer.shadowMap.needsUpdate = true;
  const start = () => {
    requestAnimationFrame(t => {
      last = t;
      frame(t);
      requestAnimationFrame(() => document.documentElement.classList.add('webgl-ready'));
    });
  };
  (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).then(start, start);
}

/* Procedural marble: parchment ground with soft stone veins. */
function marbleTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#efe9de';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    g.beginPath();
    let x = rnd() * c.width, y = rnd() * c.height;
    g.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (rnd() - 0.3) * 180; y += (rnd() - 0.5) * 120;
      g.quadraticCurveTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 90, x, y);
    }
    g.strokeStyle = `rgba(139,134,124,${0.05 + rnd() * 0.18})`;
    g.lineWidth = 0.6 + rnd() * 2.6;
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
