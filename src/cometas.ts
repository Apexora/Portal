/* Cometas pequeños que caen en el cielo del fondo (detrás de las montañas y del contenido).
   Un solo <canvas> fijo; respeta prefers-reduced-motion y se pausa solo cuando la pestaña no se ve. */
type Cometa = { x: number; y: number; vx: number; vy: number; largo: number; r: number; col: string; a: number };

export function montarCometas() {
  if (document.querySelector('canvas.cometas')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'cometas'; c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);                       // antes de .paisaje → queda detrás de las montañas
  const g = c.getContext('2d'); if (!g) return;

  let w = 0, h = 0;
  const ajustar = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  ajustar();
  addEventListener('resize', ajustar);

  const COLORES = ['255,238,214', '255,238,214', '143,248,244', '243,201,160', '210,190,255'];
  const lista: Cometa[] = [];
  const nuevo = (): Cometa => {
    const vel = 240 + Math.random() * 260;            // px/s
    const ang = (104 + Math.random() * 14) * Math.PI / 180;   // cae hacia abajo-izquierda
    return {
      x: Math.random() * w * 1.25, y: -20 - Math.random() * 60,
      vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
      largo: 45 + Math.random() * 80, r: 0.9 + Math.random() * 0.9,
      col: COLORES[Math.floor(Math.random() * COLORES.length)], a: 0.55 + Math.random() * 0.4,
    };
  };

  let ultimo = performance.now(), proximo = 600;
  const paso = (t: number) => {
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
    proximo -= dt * 1000;
    if (proximo <= 0 && lista.length < 5) { lista.push(nuevo()); proximo = 1100 + Math.random() * 2600; }

    g.clearRect(0, 0, w, h);
    for (let i = lista.length - 1; i >= 0; i--) {
      const k = lista[i];
      k.x += k.vx * dt; k.y += k.vy * dt;
      const fin = h * 0.72;                              // se apagan antes de las montañas
      if (k.y > fin + k.largo || k.x < -k.largo) { lista.splice(i, 1); continue; }
      const alfa = k.a * Math.min(1, Math.max(0, (fin - k.y) / (h * 0.25)));
      const m = Math.hypot(k.vx, k.vy), tx = k.x - (k.vx / m) * k.largo, ty = k.y - (k.vy / m) * k.largo;
      const grad = g.createLinearGradient(k.x, k.y, tx, ty);
      grad.addColorStop(0, `rgba(${k.col},${alfa})`);
      grad.addColorStop(1, `rgba(${k.col},0)`);
      g.strokeStyle = grad; g.lineWidth = k.r * 1.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(tx, ty); g.stroke();
      const halo = g.createRadialGradient(k.x, k.y, 0, k.x, k.y, k.r * 5);
      halo.addColorStop(0, `rgba(${k.col},${alfa})`); halo.addColorStop(1, `rgba(${k.col},0)`);
      g.fillStyle = halo; g.beginPath(); g.arc(k.x, k.y, k.r * 5, 0, Math.PI * 2); g.fill();
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
