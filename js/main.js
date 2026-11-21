import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';
import { Character } from './character.js';
import { Strings } from './strings.js';
import { Hud } from './hud.js';
import { classify, pointingDirection, GestureFilter } from './gestures.js';

// ------------------------------------------------------------------ DOM
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const video = $('cam');
const glCanvas = $('gl');
const fxCanvas = $('fx');
const legend = $('legend');

const hud = new Hud({ term: $('term'), tag: $('tag'), fps: $('fps'), gesture: $('gesture') });
const strings = new Strings(fxCanvas);

const GESTURE_NAME = {
  none: 'sin mano', open: 'palma abierta', victory: 'índice + corazón',
  point: 'índice', fist: 'puño', pinch: 'pinza',
};
const GESTURE_TO_STATE = { none: 'idle', open: 'wave', victory: 'walk', point: 'run', fist: 'punch', pinch: 'idle' };

// ------------------------------------------------------------------ escena 3D
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 50);
camera.position.set(0, 1.45, 6.4);
camera.lookAt(0, 0.95, 0);

scene.add(new THREE.HemisphereLight(0xa9b8ff, 0x141a30, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(2.5, 4, 3.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x5ee7ff, 3.0);
rim.position.set(-3, 2.5, -3);
scene.add(rim);

const character = new Character();
scene.add(character.group);

// Anillos holográficos bajo los pies
const ringMat = (opacity) => new THREE.MeshBasicMaterial({
  color: 0x5ee7ff, transparent: true, opacity, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const ringA = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.62, 64), ringMat(0.9));
const ringB = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.865, 64), ringMat(0.35));
const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), ringMat(0.08));
for (const m of [ringA, ringB, disc]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.01; character.group.add(m); }
// los anillos no deben girar con el personaje
const ringsFixYaw = () => { for (const m of [ringA, ringB, disc]) m.rotation.z = -character.group.rotation.y; };

// ------------------------------------------------------------------ tamaño
const sizeObserver = new ResizeObserver(() => {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  strings.resize(w, h, Math.min(window.devicePixelRatio, 2));
});
sizeObserver.observe(stage);

// ------------------------------------------------------------------ entrada
let mode = 'none'; // 'cam' | 'kb' | 'none'
let landmarker = null;
let lastVideoTime = -1;
let videoAspect = 16 / 9;

const filter = new GestureFilter({ need: 3, lostAfter: 10 });
let gesture = 'none';
let prevGesture = 'none';
let dir = { x: 1, y: 0 };
let handTips = null;   // [{x,y}] x5 en coords de escenario (espejo)
let handWrist = null;
let smooth = null;     // landmarks suavizados

function applyGesture(g) {
  gesture = g;
  hud.setGesture(GESTURE_NAME[g] ?? g);
  hud.setHand(g !== 'none');
  if (g === 'pinch' && prevGesture !== 'pinch') character.jump();
  character.setDesired(GESTURE_TO_STATE[g] ?? 'idle');
  prevGesture = g;
}

function onHandResult(result) {
  const lm = result?.landmarks?.[0];
  if (!lm) {
    handTips = handWrist = null;
    smooth = null;
    applyGesture(filter.update(null));
    return;
  }
  // suavizado exponencial para dibujo y dirección (el clasificador usa datos crudos)
  if (!smooth) smooth = lm.map((p) => ({ x: p.x, y: p.y }));
  else lm.forEach((p, i) => { smooth[i].x += (p.x - smooth[i].x) * 0.55; smooth[i].y += (p.y - smooth[i].y) * 0.55; });

  const raw = classify(lm, videoAspect);
  const g = filter.update(raw);
  if (g === 'victory' || g === 'point') dir = pointingDirection(smooth, g, videoAspect);

  handTips = [4, 8, 12, 16, 20].map((i) => ({ x: 1 - smooth[i].x, y: smooth[i].y }));
  handWrist = { x: 1 - smooth[0].x, y: smooth[0].y };
  applyGesture(g);
}

// ---- teclado (modo de prueba / sin cámara)
const KEY_GESTURE = { '0': 'none', '1': 'open', '2': 'victory', '3': 'point', '4': 'fist', '5': 'pinch' };
const KEY_DIR = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') legend.classList.toggle('hidden');
  if (mode !== 'kb') return;
  if (e.key in KEY_GESTURE) { applyGesture(KEY_GESTURE[e.key]); }
  if (e.key in KEY_DIR) { dir = KEY_DIR[e.key]; }
});

/** Mano ficticia para que los hilos se vean también en modo teclado. */
function fakeHand(t) {
  if (gesture === 'none') { handTips = handWrist = null; return; }
  const cx = 0.62, cy = 0.74;
  handWrist = { x: cx, y: cy + 0.12 };
  handTips = [-0.09, -0.035, 0, 0.035, 0.07].map((dx, i) => ({
    x: cx + dx + Math.sin(t * 1.3 + i) * 0.004,
    y: cy - (i === 0 ? 0.02 : 0.1) + Math.cos(t * 1.1 + i) * 0.004,
  }));
}

// ------------------------------------------------------------------ cámara y MediaPipe
const MODEL_URLS = [
  'assets/hand_landmarker.task', // copia local opcional (modo sin internet)
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
];

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks('vendor/mediapipe/wasm');
  let lastError;
  for (const url of MODEL_URLS) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: url, delegate },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
      } catch (err) { lastError = err; }
    }
  }
  throw lastError ?? new Error('No se pudo crear el detector de manos');
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  videoAspect = video.videoWidth / video.videoHeight;
  stage.style.setProperty('--arn', videoAspect.toFixed(4));
}

// ------------------------------------------------------------------ bucle
const tmp = new THREE.Vector3();
const toStage = (v3) => {
  tmp.copy(v3).project(camera);
  return { x: (tmp.x + 1) / 2, y: (1 - tmp.y) / 2 };
};

let last = performance.now();
let frames = 0;
let fpsClock = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode === 'cam' && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    onHandResult(landmarker.detectForVideo(video, now));
  }
  if (mode === 'kb') fakeHand(now / 1000);

  character.update(dt, dir);
  ringsFixYaw();
  hud.setState(character.jumping ? 'jump' : character.state);
  hud.update(dt);

  // hilos hacia cabeza, manos y pies
  const targets = ['handR', 'head', 'handL', 'footL', 'footR'].map((k) => toStage(character.boneWorld(k)));
  strings.draw(handTips, targets, handWrist, dt);

  // etiqueta sobre la cabeza
  const head = toStage(character.boneWorld('head'));
  hud.placeTag({ x: head.x, y: head.y - 0.02 });

  renderer.render(scene, camera);

  frames++;
  fpsClock += dt;
  if (fpsClock >= 0.5) { hud.setFps(Math.round(frames / fpsClock)); frames = 0; fpsClock = 0; }
}

// ------------------------------------------------------------------ arranque
const loadmsg = $('loadmsg');
const loadbar = $('loadbar');
const errEl = $('err');
const startEl = $('start');
const btnCam = $('btnCam');
const btnKb = $('btnKb');

hud.setState('idle');
hud.setHand(false);
hud.print('agente JVS-01 · inicializando');
requestAnimationFrame(frame);

const steps = ['modelo', 'idle', 'wave', 'walk', 'run', 'jump', 'punch'];
try {
  await character.load((name) => {
    const i = steps.indexOf(name);
    loadmsg.textContent = `Cargando ${name}…`;
    loadbar.style.width = `${Math.round((i / steps.length) * 100)}%`;
  });
  loadbar.style.width = '100%';
  loadmsg.textContent = 'Listo. Elige cómo controlar al agente.';
  hud.print('modelo y 6 animaciones cargados', 'ok');
  btnCam.disabled = false;
  btnKb.disabled = false;
} catch (err) {
  console.error(err);
  loadmsg.textContent = 'No se pudo cargar el modelo.';
  errEl.textContent = `${err.message}. ¿Abriste la página con un servidor local (iniciar.bat) y están los archivos en assets/?`;
}

btnKb.addEventListener('click', () => {
  mode = 'kb';
  startEl.classList.add('gone');
  hud.print('modo teclado · usa 0‑5 y las flechas');
});

btnCam.addEventListener('click', async () => {
  btnCam.disabled = btnKb.disabled = true;
  errEl.textContent = '';
  try {
    loadmsg.textContent = 'Solicitando cámara…';
    await startCamera();
    loadmsg.textContent = 'Cargando detector de manos…';
    landmarker = await createLandmarker();
    mode = 'cam';
    startEl.classList.add('gone');
    hud.print('cámara activa · muestra tu mano', 'ok');
  } catch (err) {
    console.error(err);
    errEl.textContent = `Error: ${err.message ?? err}`;
    loadmsg.textContent = 'Puedes reintentar o usar el teclado.';
    btnCam.disabled = btnKb.disabled = false;
  }
});

window.__app = { character, get mode() { return mode; }, get gesture() { return gesture; } };
