// Clasificación de gestos a partir de los 21 landmarks de MediaPipe Hands.
// Sin dependencias: se puede probar con datos sintéticos.

const WRIST = 0;

/**
 * @param {{x:number,y:number}[]} lm landmarks normalizados (0..1)
 * @param {number} aspect ancho/alto del video, para no deformar distancias
 * @returns {'open'|'victory'|'point'|'fist'|'pinch'|'unknown'}
 */
export function classify(lm, aspect = 1) {
  const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * aspect, lm[a].y - lm[b].y);
  // Un dedo está extendido si la punta está más lejos de la muñeca que su articulación PIP.
  const ext = (tip, pip) => d(WRIST, tip) > d(WRIST, pip) * 1.12;

  const index = ext(8, 6);
  const middle = ext(12, 10);
  const ring = ext(16, 14);
  const pinky = ext(20, 18);

  const palm = d(0, 9); // muñeca -> nudillo del corazón: escala de la mano
  const pinchClose = d(4, 8) < palm * 0.3;
  const othersOpen = (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);

  if (pinchClose && othersOpen >= 2) return 'pinch';
  if (index && middle && ring && pinky) return 'open';
  if (index && middle && !ring && !pinky) return 'victory';
  if (index && !middle && !ring && !pinky) return 'point';
  if (!index && !middle && !ring && !pinky) return 'fist';
  return 'unknown';
}

/**
 * Dirección en pantalla hacia la que apunta la mano (ya corregida por el espejo).
 * x: derecha positiva, y: abajo positiva. Normalizada.
 */
export function pointingDirection(lm, gesture, aspect = 1) {
  let bx, by, tx, ty;
  if (gesture === 'victory') {
    bx = (lm[5].x + lm[9].x) / 2;
    by = (lm[5].y + lm[9].y) / 2;
    tx = (lm[8].x + lm[12].x) / 2;
    ty = (lm[8].y + lm[12].y) / 2;
  } else {
    bx = lm[5].x; by = lm[5].y; tx = lm[8].x; ty = lm[8].y;
  }
  const dx = -(tx - bx) * aspect; // el video se muestra en espejo
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Filtro temporal: un gesto debe repetirse `need` cuadros seguidos para aceptarse
 * y la mano debe faltar `lostAfter` cuadros para darla por perdida.
 */
export class GestureFilter {
  constructor({ need = 3, lostAfter = 10 } = {}) {
    this.need = need;
    this.lostAfter = lostAfter;
    this.current = 'none';
    this.candidate = null;
    this.count = 0;
    this.missing = 0;
  }

  update(gesture) {
    if (gesture === null) {
      this.missing++;
      if (this.missing >= this.lostAfter) {
        this.current = 'none';
        this.candidate = null;
        this.count = 0;
      }
      return this.current;
    }
    this.missing = 0;
    if (gesture === 'unknown') return this.current; // mantiene el último gesto válido
    if (gesture === this.candidate) this.count++;
    else { this.candidate = gesture; this.count = 1; }
    if (this.count >= this.need) this.current = gesture;
    return this.current;
  }
}
