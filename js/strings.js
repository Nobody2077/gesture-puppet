// Hilos de marioneta: curvas desde las yemas de la mano hacia las articulaciones del personaje.

const TIPS = [4, 8, 12, 16, 20]; // pulgar, índice, corazón, anular, meñique
const REST = { x: 0.03, y: 0.97 }; // donde cuelgan los hilos si no hay mano

export class Strings {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.anchors = TIPS.map(() => ({ ...REST }));
    this.alpha = 0;
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
  }

  /**
   * @param {{x:number,y:number}[]|null} tips posiciones (0..1, ya en espejo) de las 5 yemas, o null
   * @param {{x:number,y:number}[]} targets 5 puntos (0..1) del personaje
   * @param {{x:number,y:number}|null} wrist muñeca (0..1, en espejo) o null
   */
  draw(tips, targets, wrist, dt) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const k = 1 - Math.exp(-dt * (tips ? 22 : 5));
    this.anchors.forEach((a, i) => {
      const goal = tips ? tips[i] : REST;
      a.x += (goal.x - a.x) * k;
      a.y += (goal.y - a.y) * k;
    });
    this.alpha += ((tips ? 1 : 0.55) - this.alpha) * (1 - Math.exp(-dt * 6));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,170,60,0.9)';
    ctx.shadowBlur = 10 * this.dpr;

    this.anchors.forEach((a, i) => {
      const t = targets[i];
      if (!t) return;
      const ax = a.x * W, ay = a.y * H, tx = t.x * W, ty = t.y * H;
      // el hilo cuelga un poco, como una cuerda real
      const sag = Math.min(0.12 * H, Math.hypot(tx - ax, ty - ay) * 0.18);
      const cx = (ax + tx) / 2;
      const cy = (ay + ty) / 2 + sag;

      for (let strand = 0; strand < 3; strand++) { // 3 hebras finas por hilo
        const off = (strand - 1) * 3 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cx + off, cy + off * 0.6, tx, ty);
        ctx.strokeStyle = `rgba(255, ${170 + strand * 25}, ${60 + strand * 20}, ${this.alpha * (strand === 1 ? 0.95 : 0.55)})`;
        ctx.lineWidth = (strand === 1 ? 1.6 : 1) * this.dpr;
        ctx.stroke();
      }
    });
    ctx.restore();

    // puntos blancos en las yemas y la muñeca (solo con mano real)
    if (tips) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 8 * this.dpr;
      ctx.fillStyle = '#fff';
      const dots = wrist ? [...tips, wrist] : tips;
      for (const p of dots) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 4.2 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
