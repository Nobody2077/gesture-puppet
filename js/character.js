import * as THREE from 'three';
import { FBXLoader } from '../vendor/three/examples/jsm/loaders/FBXLoader.js';

const CLIP_FILES = {
  idle: 'assets/idle.fbx',
  wave: 'assets/wave.fbx',
  walk: 'assets/walk.fbx',
  run: 'assets/run.fbx',
  jump: 'assets/jump.fbx',
  punch: 'assets/punch.fbx',
};

const FADE = 0.25; // segundos de transición entre animaciones
const SPEED = { walk: 1.1, run: 2.8 }; // unidades de mundo por segundo
const BOUNDS = { xMin: -3.2, xMax: 3.2, zMin: -4.5, zMax: 1.6 };

export class Character {
  constructor() {
    this.group = new THREE.Group();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.state = 'idle';
    this.desired = 'idle';
    this.jumping = false;
    this.yaw = 0;
    this.targetYaw = 0;
    this.bones = {};
  }

  async load(onProgress = () => {}) {
    const loader = new FBXLoader();
    const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

    onProgress('modelo');
    const model = await load('assets/character.fbx');
    model.scale.setScalar(0.01); // Mixamo exporta en centímetros
    this.#applyLook(model);
    this.model = model;
    this.group.add(model);
    this.mixer = new THREE.AnimationMixer(model);

    for (const [name, url] of Object.entries(CLIP_FILES)) {
      onProgress(name);
      const fbx = await load(url);
      const clip = fbx.animations[0];
      if (!clip) throw new Error(`El archivo ${url} no contiene animación`);
      clip.name = name;
      this.#stripRootMotion(clip);
      const action = this.mixer.clipAction(clip);
      if (name === 'jump') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[name] = action;
    }

    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.actions.jump) {
        this.jumping = false;
        this.#play(this.desired);
      }
    });

    this.#collectBones();
    this.#play('idle');
  }

  /** Estado deseado según el gesto (se aplica de inmediato salvo durante un salto). */
  setDesired(state) {
    this.desired = state;
    if (!this.jumping && state !== this.state) this.#play(state);
  }

  jump() {
    if (this.jumping || !this.actions.jump) return;
    this.jumping = true;
    this.#play('jump');
  }

  /**
   * @param {number} dt segundos
   * @param {{x:number,y:number}|null} dir dirección en pantalla (x derecha, y abajo)
   */
  update(dt, dir) {
    if (!this.mixer) return;
    this.mixer.update(dt);

    const moving = !this.jumping && (this.state === 'walk' || this.state === 'run');
    if (moving && dir) this.targetYaw = Math.atan2(dir.x, dir.y);
    else if (!moving && !this.jumping) this.targetYaw = 0; // mira a la cámara en reposo

    // giro suave por el camino más corto
    let diff = this.targetYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * (moving ? 9 : 4));
    this.group.rotation.y = this.yaw;

    if (moving) {
      const v = SPEED[this.state] ?? 0;
      const p = this.group.position;
      p.x = THREE.MathUtils.clamp(p.x + Math.sin(this.yaw) * v * dt, BOUNDS.xMin, BOUNDS.xMax);
      p.z = THREE.MathUtils.clamp(p.z + Math.cos(this.yaw) * v * dt, BOUNDS.zMin, BOUNDS.zMax);
    }
  }

  /** Posición mundial de un hueso (head, handL, handR, footL, footR). */
  boneWorld(key, out = new THREE.Vector3()) {
    const b = this.bones[key];
    return b ? b.getWorldPosition(out) : out.copy(this.group.position);
  }

  // ---------------------------------------------------------------- privado

  #play(name) {
    const next = this.actions[name];
    if (!next) return;
    const prev = this.actions[this.state];
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
    next.play();
    this.state = name;
  }

  /** Quita el desplazamiento horizontal del hip para que el movimiento lo controle el código. */
  #stripRootMotion(clip) {
    for (const track of clip.tracks) {
      if (!/Hips\.position$/.test(track.name)) continue;
      const v = track.values;
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }

  #applyLook(model) {
    const body = new THREE.MeshStandardMaterial({
      color: 0x7a86ff, metalness: 0.55, roughness: 0.32,
      emissive: 0x1a2a7a, emissiveIntensity: 0.55,
    });
    const joints = new THREE.MeshStandardMaterial({
      color: 0x1b2036, metalness: 0.8, roughness: 0.4,
      emissive: 0x00c8ff, emissiveIntensity: 0.25,
    });
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.material = /joint/i.test(o.name) ? joints : body;
    });
  }

  #collectBones() {
    const find = (re) => {
      let found = null;
      this.model.traverse((o) => { if (!found && o.isBone && re.test(o.name)) found = o; });
      return found;
    };
    this.bones = {
      head: find(/Head$/),
      handL: find(/LeftHand$/),
      handR: find(/RightHand$/),
      footL: find(/LeftFoot$/),
      footR: find(/RightFoot$/),
    };
  }
}
