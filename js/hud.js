// Panel tipo terminal y etiqueta del agente.

export const STATE_INFO = {
  none:    { label: 'ESPERANDO',    status: 'inactivo',      note: '[esperando instrucción]' },
  idle:    { label: 'IDLE',         status: 'inactivo',      note: '[esperando instrucción]' },
  wave:    { label: 'SALUDANDO',    status: 'saludo',        note: '[handshake con el operador]' },
  walk:    { label: 'CAMINANDO',    status: 'navegando',     note: '[siguiendo vector de la mano]' },
  run:     { label: 'CORRIENDO',    status: 'navegando',     note: '[desplazamiento rápido]' },
  punch:   { label: 'CARGA PESADA', status: 'carga pesada',  note: '[procesando la tarea]' },
  jump:    { label: 'SALTANDO',     status: 'impulso',       note: '[salto ejecutado]' },
};

const HEAVY_LINES = [
  ['reconstruir embeddings (1.8M vectores)', '1.8M vectores en 2.2s'],
  ['deduplicar corpus (3.1M docs)', '3.1M docs en 1.4s'],
  ['entrenar época 12/40 (512 lotes)', '512 lotes en 5.2s'],
  ['compactar heap (1.8G)', '1.8G en 1.5s'],
  ['migrar memoria (96GB)', '96GB en 2.3s'],
];

export class Hud {
  constructor({ term, tag, fps, gesture }) {
    this.term = term;
    this.tag = tag;
    this.fpsEl = fps;
    this.gestureEl = gesture;
    this.lines = [];
    this.heavyTimer = 0;
    this.heavyIdx = 0;
    this.state = null;
    this.handOk = false;
    this.statusEl = term.querySelector('.status');
    this.logEl = term.querySelector('.log');
    this.headEl = term.querySelector('.head');
    this.tagState = tag.querySelector('.state');
    this.#renderHead();
  }

  print(text, cls = '') {
    this.lines.push({ text, cls });
    if (this.lines.length > 15) this.lines.shift();
    this.logEl.innerHTML = this.lines
      .map((l) => `<div class="${l.cls}"><i>$</i> ${l.text}</div>`)
      .join('') + '<div class="cur"><i>$</i> <b></b></div>';
  }

  setHand(ok) {
    if (ok === this.handOk) return;
    this.handOk = ok;
    this.#renderHead();
    this.print(ok ? 'mano detectada · rastreo activo' : 'mano perdida · agente en espera', ok ? 'ok' : 'warn');
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    const info = STATE_INFO[state] ?? STATE_INFO.idle;
    this.statusEl.innerHTML = `estado: <b>${info.status}</b> ${info.note}`;
    this.tagState.textContent = info.label;
    this.tag.dataset.state = state;
    this.print(`gesture_compiler → ${state} ... ok`, 'ok');
    this.heavyTimer = 0;
  }

  update(dt) {
    if (this.state !== 'punch') return;
    this.heavyTimer -= dt;
    if (this.heavyTimer > 0) return;
    this.heavyTimer = 0.9;
    const [task, done] = HEAVY_LINES[this.heavyIdx++ % HEAVY_LINES.length];
    this.print(`levantando: ${task}`);
    setTimeout(() => this.state === 'punch' && this.print(`listo · ${done}`, 'ok'), 450);
  }

  setFps(v) { this.fpsEl.textContent = `${v} FPS`; }
  setGesture(g) { this.gestureEl.textContent = g; }

  /** Posiciona la etiqueta sobre la cabeza (coordenadas 0..1 del escenario). */
  placeTag(p) {
    this.tag.style.left = `${p.x * 100}%`;
    this.tag.style.top = `${p.y * 100}%`;
  }

  #renderHead() {
    this.headEl.innerHTML =
      `<span>agent --watch</span><span class="${this.handOk ? 'ok' : 'warn'}">` +
      `${this.handOk ? '[ok] mano rastreada' : '[--] mano perdida'}</span>`;
  }
}
