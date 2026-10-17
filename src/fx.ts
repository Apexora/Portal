import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const sinMov = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let ctx: gsap.Context | null = null;
const limpiezas: Array<() => void> = [];

/* ---------- Utilidades ---------- */
/** Cuenta de `desde` a `hasta` en el texto del elemento. */
export function contar(el: HTMLElement | null, hasta: number, desde = 0) {
  if (!el) return;
  if (sinMov() || desde === hasta) { el.textContent = String(hasta); return; }
  const o = { v: desde };
  gsap.to(o, { v: hasta, duration: Math.min(1.6, 0.5 + Math.abs(hasta - desde) * 0.02), ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
}

/** Parte un título en letras para animarlas; deja aria-label para lectores de pantalla. */
function partirLetras(el: HTMLElement): HTMLElement[] {
  const txt = el.textContent ?? '';
  el.setAttribute('aria-label', txt);
  el.innerHTML = [...txt].map((c) => (c === ' ' ? ' ' : `<span class="ltr" aria-hidden="true">${c}</span>`)).join('');
  return [...el.querySelectorAll<HTMLElement>('.ltr')];
}

/* ---------- Fondo vivo (aurora) ---------- */
export function montarAurora() {
  if (document.querySelector('.aurora')) return;
  const a = document.createElement('div');
  a.className = 'aurora'; a.setAttribute('aria-hidden', 'true');
  a.innerHTML = '<i></i><i></i><i></i>';
  document.querySelector('.paisaje')?.after(a);
}

/* ---------- Entrada del panel + efectos continuos ---------- */
export function animarPanel(root: HTMLElement) {
  limpiar();
  if (sinMov()) return;
  ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const h1 = root.querySelector<HTMLElement>('.heroe h1');
    const letras = h1 ? partirLetras(h1) : [];

    tl.from('.barra', { y: -40, opacity: 0, duration: 0.6 })
      .from('.heroe .apx-eyebrow', { y: 14, opacity: 0, letterSpacing: '.6em', duration: 0.8 }, '-=0.3')
      .from(letras, { yPercent: 110, rotate: 6, opacity: 0, filter: 'blur(8px)', duration: 0.8, stagger: 0.045, clearProps: 'filter,transform' }, '-=0.5')
      .from('.esencias > div', { y: 40, opacity: 0, scale: 0.92, duration: 0.7, stagger: 0.1 }, '-=0.4')
      .from('.hexw', { scale: 0.4, rotate: -14, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'elastic.out(1,.6)', transformOrigin: '50% 50%', clearProps: 'transform' }, '-=0.3');

    // Aparecen al hacer scroll
    gsap.utils.toArray<HTMLElement>('.dos > section, .actividad, .chat').forEach((s) => {
      gsap.from(s, { y: 50, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
    });
    gsap.utils.toArray<HTMLElement>('.logro').forEach((l, i) => {
      gsap.from(l, { x: -24, opacity: 0, duration: 0.5, delay: (i % 8) * 0.04, scrollTrigger: { trigger: l, start: 'top 95%', once: true } });
    });

    // Parallax suave de las montañas con el mouse
    const caps = gsap.utils.toArray<SVGPathElement>('.paisaje svg path');
    const movs = caps.map((c, i) => ({ x: gsap.quickTo(c, 'x', { duration: 1.2, ease: 'power3.out' }), k: (i + 1) * 7 }));
    const mueve = (e: PointerEvent) => { const nx = e.clientX / innerWidth - 0.5; movs.forEach((m) => m.x(-nx * m.k)); };
    addEventListener('pointermove', mueve);
    limpiezas.push(() => removeEventListener('pointermove', mueve));
  }, root);

  inclinarHex(root);
  luzDeFoco(root);
}

/** Los hexágonos se inclinan en 3D hacia el cursor. */
function inclinarHex(root: HTMLElement) {
  if (!matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll<HTMLElement>('.hexw').forEach((w) => {
    const h = w.querySelector<HTMLElement>('.hex')!;
    const rx = gsap.quickTo(h, 'rotationX', { duration: 0.4, ease: 'power2.out' });
    const ry = gsap.quickTo(h, 'rotationY', { duration: 0.4, ease: 'power2.out' });
    const mv = (e: PointerEvent) => {
      const r = w.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 22);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 22);
    };
    const sale = () => { rx(0); ry(0); };
    w.addEventListener('pointermove', mv); w.addEventListener('pointerleave', sale);
    limpiezas.push(() => { w.removeEventListener('pointermove', mv); w.removeEventListener('pointerleave', sale); });
  });
}

/** Foco de luz que sigue al cursor sobre las tarjetas (estilo Aceternity "spotlight"). */
export function luzDeFoco(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.apx-spot').forEach((c) => {
    if (c.dataset.spot) return; c.dataset.spot = '1';
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/** Entrada de un evento nuevo del feed (cae desde arriba y destella). */
export function entrarEvento(li: HTMLElement) {
  if (sinMov()) return;
  gsap.fromTo(li, { height: 0, opacity: 0, y: -16 }, { height: 'auto', opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'height,transform' });
  gsap.fromTo(li, { backgroundColor: 'rgba(227,180,136,.35)' }, { backgroundColor: 'rgba(227,180,136,0)', duration: 1.8, ease: 'power1.out' });
}
/** Entrada escalonada de la lista completa la primera vez. */
export function entrarLista(items: HTMLElement[]) {
  if (sinMov() || !items.length) return;
  gsap.from(items, { y: 18, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'transform,opacity' });
}

/** Transición de página: un iris del color del mundo se abre desde el clic y luego navega. */
export function viajar(url: string, nombre: string, hi: string, lo: string, x: number, y: number) {
  if (sinMov()) { location.href = url; return; }
  const v = document.createElement('div');
  v.className = 'viaje';
  v.style.cssText = `background:radial-gradient(110% 80% at 50% 100%,${lo},#12080c 70%);--hi:${hi}`;
  v.innerHTML = `<span>${nombre}</span>`;
  document.body.appendChild(v);
  gsap.set(v, { clipPath: `circle(0% at ${x}px ${y}px)` });
  gsap.timeline({ onComplete: () => { location.href = url; } })
    .to(v, { clipPath: `circle(150% at ${x}px ${y}px)`, duration: 0.75, ease: 'power3.in' })
    .from(v.firstElementChild, { scale: 0.7, opacity: 0, letterSpacing: '.4em', duration: 0.5, ease: 'power3.out' }, '-=0.3')
    .to({}, { duration: 0.25 });
}

export function limpiar() {
  limpiezas.splice(0).forEach((f) => f());
  ctx?.revert(); ctx = null;
  ScrollTrigger.getAll().forEach((t) => t.kill());
}
