/* apexora-hud · marcador de fragmentos + avisos + mini feed. Se pone UNA vez en cada página:
   <script type="module" src="https://apexora.github.io/Portal/apexora-hud.js"></script>
   Solo aparece si hay sesión Apexora. Posición ajustable desde el CSS de cada app (pon `auto` en los lados que no uses):
   :root { --apx-hud-top: 12px; --apx-hud-right: 12px; --apx-hud-bottom: auto; --apx-hud-left: auto; --apx-toast-top: 12px; } */
import { cristal } from "./apexora-cristales.js";
import { avisarLogros } from "./apexora-logros.js";
import { auth, CATALOGO_LOGROS, escucharFragmentos, escucharActividad, escucharPerfil, cargarAvatares, avatarHTML, describirActividad, NOMBRE_JUEGO, onSesion } from "./apexora-core.js";

const omitir = window.top !== window || /[?&]embed/.test(location.search) || window.__APX_HUD__;
if (!omitir) {
window.__APX_HUD__ = true;

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
let gsap = null;
try { gsap = (await import("https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm")).default; } catch { /* sin GSAP: queda sin animar */ }
const anima = !!gsap && !reducido;

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);

/* ---------- Estilos (van dentro del módulo para no tocar el CSS de cada app) ---------- */
const css = document.createElement("style");
css.textContent = `
.apx-hud {
  position: fixed;
  z-index: 2147482000;
  top: var(--apx-hud-top, calc(env(safe-area-inset-top, 0px) + 12px));
  right: auto;
  bottom: auto;
  left: 50%;
  transform: translateX(-50%);
  font: 500 .9rem/1.2 var(--apx-body, system-ui, sans-serif);
  color: var(--apx-cream, #f7ece0);
}
.apx-hud *{box-sizing:border-box}
.apx-hud__pill{all:unset;cursor:pointer;display:flex;align-items:center;gap:.7rem;padding:.42rem .8rem .42rem .55rem;border-radius:999px;position:relative;
  background:linear-gradient(160deg,rgba(255,255,255,.18),rgba(255,255,255,.06)),rgba(28,12,20,.62);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);
  border:1px solid rgba(255,255,255,.2);box-shadow:0 14px 30px -14px rgba(0,0,0,.7),inset 0 1px rgba(255,255,255,.22)}
.apx-hud__pill:focus-visible{outline:2px solid var(--apx-sand,#e3b488);outline-offset:3px}
.apx-hud__it{display:flex;align-items:center;gap:.38rem;position:relative}
.apx-hud__it b{font:400 1.05rem/1 var(--apx-display,Georgia,serif);font-variant-numeric:tabular-nums;min-width:1ch}
.apx-hud__cr{display:grid;place-items:center;width:1rem;height:1.35rem;flex:none}
.apx-hud__cr .cristal{width:100%;height:100%;overflow:visible}
.apx-hud__it.sinfalita .cristal{filter:drop-shadow(0 0 5px rgba(61,240,238,.8))}
.apx-hud__it.odita .cristal{filter:drop-shadow(0 0 .5px rgba(190,165,240,.95)) drop-shadow(0 0 7px rgba(150,110,210,.55))}
.apx-hud__it.racha .fl{font-size:1rem;line-height:1}
.apx-hud__me{display:grid;place-items:center;width:1.9rem;height:1.9rem;flex:none;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);font-size:1.05rem}
.apx-hud__me:empty{display:none}
.apx-hud .apx-av{width:100%;height:100%;object-fit:cover;display:block}
.apx-hud .apx-av--emoji{display:grid;place-items:center}
.apx-hud__sep{width:1px;height:1.1rem;background:rgba(255,255,255,.22)}
.apx-hud__panel{position:absolute;top:calc(100% + 10px);right:0;width:min(330px,calc(100vw - 24px));padding:.9rem .95rem;border-radius:20px;transform-origin:100% 0;
  background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05)),rgba(28,12,20,.82);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
  border:1px solid rgba(255,255,255,.2);box-shadow:0 30px 60px -24px rgba(0,0,0,.8)}
.apx-hud__panel[hidden]{display:none}
.apx-hud.arriba .apx-hud__panel{top:auto;bottom:calc(100% + 10px);transform-origin:100% 100%}
.apx-hud.izq .apx-hud__panel{right:auto;left:0;transform-origin:0 0}
.apx-hud.izq.arriba .apx-hud__panel{transform-origin:0 100%}
.apx-hud__panel h3{margin:0 0 .6rem;font:400 1.05rem/1 var(--apx-display,Georgia,serif);color:var(--apx-sand,#e3b488);letter-spacing:.03em}
.apx-hud__feed{list-style:none;margin:0;padding:0;display:grid;gap:.5rem;max-height:46vh;overflow:auto}
.apx-hud__feed li{display:flex;gap:.55rem;align-items:flex-start;font-size:.82rem;line-height:1.3}
.apx-hud__feed .av{overflow:hidden;display:grid;place-items:center;width:1.7rem;height:1.7rem;flex:none;border-radius:50%;background:rgba(255,255,255,.16);font-size:.95rem}
.apx-hud__feed small{display:block;opacity:.65;font-size:.72rem}
.apx-hud__more{display:inline-block;margin-top:.7rem;color:var(--apx-sand,#e3b488);font-size:.8rem;text-decoration:underline;text-underline-offset:3px}
.apx-hud__vacio{opacity:.7;font-size:.82rem}
.apx-hud__plus{position:absolute;left:50%;top:0;pointer-events:none;font:400 1.1rem/1 var(--apx-display,Georgia,serif);white-space:nowrap;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.apx-hud__plus.sinfalita{color:#8ff8f4}.apx-hud__plus.odita{color:#c3aef0}
.apx-hud__dot{position:fixed;width:7px;height:7px;border-radius:50%;pointer-events:none;z-index:2147482100}
.apx-toasts{position:fixed;z-index:2147482000;left:50%;transform:translateX(-50%);top:var(--apx-toast-top,calc(env(safe-area-inset-top,0px) + 12px));display:grid;gap:.5rem;justify-items:center;pointer-events:none;font:500 .85rem/1.25 var(--apx-body,system-ui,sans-serif)}
.apx-toast{padding:.55rem .85rem;border-radius:14px;color:#f7ece0;max-width:min(300px,calc(100vw - 24px));
  background:linear-gradient(160deg,rgba(255,255,255,.18),rgba(255,255,255,.06)),rgba(28,12,20,.78);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.2);box-shadow:0 18px 36px -18px rgba(0,0,0,.8)}
@media (prefers-reduced-motion:reduce){.apx-hud *,.apx-toast{transition:none!important;animation:none!important}}
`;
document.head.appendChild(css);

/* ---------- Estructura ---------- */
const hud = document.createElement("div");
hud.className = "apx-hud";
hud.hidden = true;
hud.innerHTML = `
  <button class="apx-hud__pill" type="button" aria-expanded="false" aria-label="Tu perfil, tus cristales y la actividad de los jugadores">
    <span class="apx-hud__me"></span>
    <span class="apx-hud__it sinfalita" title="Sinfalita"><i class="apx-hud__cr">${cristal("sinfalita")}</i><b data-k="comun">0</b></span>
    <span class="apx-hud__it odita" title="Odita"><i class="apx-hud__cr">${cristal("odita")}</i><b data-k="rara">0</b></span>
    <span class="apx-hud__sep"></span>
    <span class="apx-hud__it racha" title="Racha de días"><span class="fl">🔥</span><b data-k="racha">0</b></span>
  </button>
  <div class="apx-hud__panel" hidden>
    <h3>Actividad</h3>
    <ul class="apx-hud__feed"><li class="apx-hud__vacio">Cargando…</li></ul>
    <a class="apx-hud__more" href="/Portal/">Ver todo en el Portal</a>
  </div>`;
const toasts = document.createElement("div");
toasts.className = "apx-toasts";
toasts.setAttribute("aria-live", "polite");
document.body.append(hud, toasts);

const pill = hud.querySelector(".apx-hud__pill");
const panel = hud.querySelector(".apx-hud__panel");
const feed = hud.querySelector(".apx-hud__feed");
const el = { comun: hud.querySelector('[data-k="comun"]'), rara: hud.querySelector('[data-k="rara"]'), racha: hud.querySelector('[data-k="racha"]') };
const val = { comun: 0, rara: 0, racha: 0 };
const yo = hud.querySelector(".apx-hud__me");
let perfil = null;
const pintarYo = () => { if (perfil) { yo.innerHTML = avatarHTML(perfil.avatar); yo.title = perfil.name || ""; } };
const offPerfil = escucharPerfil((p) => { perfil = p; cargarAvatares().then(pintarYo); });

/* ---------- Efectos ---------- */
function contar(k, hasta) {
  const desde = val[k]; val[k] = hasta;
  if (!anima || desde === hasta) { el[k].textContent = hasta; return; }
  const o = { v: desde };
  gsap.to(o, { v: hasta, duration: Math.min(1.5, .45 + Math.abs(hasta - desde) * .025), ease: "power2.out", onUpdate: () => { el[k].textContent = Math.round(o.v); } });
}

function chispas(origen, color) {
  const r = origen.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 12; i++) {
    const d = document.createElement("i"); d.className = "apx-hud__dot"; d.style.cssText = `left:${cx}px;top:${cy}px;background:${color};box-shadow:0 0 8px ${color}`;
    document.body.appendChild(d);
    const a = Math.random() * Math.PI * 2, dist = 28 + Math.random() * 46;
    gsap.to(d, { x: Math.cos(a) * dist, y: Math.sin(a) * dist + 14, opacity: 0, scale: .2, duration: .7 + Math.random() * .4, ease: "power2.out", onComplete: () => d.remove() });
  }
}

function ganancia(k, n, silencio) {
  const item = el[k].closest(".apx-hud__it");
  const tipo = k === "comun" ? "sinfalita" : k === "rara" ? "odita" : "";
  if (!silencio) aviso(k === "racha" ? `🔥 Racha de ${n} ${n === 1 ? "día" : "días"}` : `+${n} ${k === "comun" ? "sinfalita" : "odita"}`);
  if (!anima) return;
  gsap.fromTo(item, { scale: 1 }, { scale: 1.28, duration: .18, yoyo: true, repeat: 1, ease: "power2.out" });
  if (tipo) {
    const p = document.createElement("span"); p.className = `apx-hud__plus ${tipo}`; p.textContent = `+${n}`; item.appendChild(p);
    gsap.fromTo(p, { y: 4, x: "-50%", opacity: 0 }, { y: 34, opacity: 1, duration: .35, ease: "back.out(2)" });
    gsap.to(p, { y: 52, opacity: 0, duration: .5, delay: 1, ease: "power1.in", onComplete: () => p.remove() });
    chispas(item.querySelector(".apx-hud__cr"), tipo === "sinfalita" ? "#3df0ee" : "#a98be0");
  }
}

function aviso(texto) {
  const t = document.createElement("div"); t.className = "apx-toast"; t.textContent = texto; toasts.appendChild(t);
  if (!anima) { setTimeout(() => t.remove(), 3200); return; }
  gsap.fromTo(t, { x: 40, opacity: 0, scale: .92 }, { x: 0, opacity: 1, scale: 1, duration: .45, ease: "back.out(1.6)" });
  gsap.to(t, { opacity: 0, y: -8, duration: .35, delay: 2.8, ease: "power1.in", onComplete: () => t.remove() });
}

/* ---------- Marcador en vivo ---------- */
const GUARDA = "apx-hud-ult";
const leerUlt = () => { try { return JSON.parse(localStorage.getItem(GUARDA) || "null"); } catch { return null; } };
let primera = true;
const offFrag = escucharFragmentos((d) => {
  const nuevo = { comun: d.fragmentos?.comun ?? 0, rara: d.fragmentos?.rara ?? 0, racha: d.streak?.current ?? 0 };
  // Logro desbloqueado → tarjeta al instante. Lo que el logro paga ya sale en la tarjeta: no se repite como "+n".
  const logrados = avisarLogros(auth.currentUser?.uid, d.logros, CATALOGO_LOGROS);
  const cubierto = { comun: 0, rara: 0 };
  for (const id of logrados) for (const k of ["comun", "rara"]) cubierto[k] += CATALOGO_LOGROS[id]?.premio?.[k] ?? 0;
  if (primera) {
    primera = false; hud.hidden = false;
    // Si venías de otra página, parte del último valor que viste: así las ganancias nuevas se notan.
    const ult = leerUlt();
    for (const k of ["comun", "rara", "racha"]) { val[k] = ult ? Math.min(ult[k] ?? 0, nuevo[k]) : nuevo[k]; el[k].textContent = val[k]; }
    if (anima) gsap.from(hud, { y: -26, opacity: 0, duration: .6, ease: "back.out(1.7)" });
    setTimeout(() => aplicar(nuevo, cubierto), 500);
  } else aplicar(nuevo, cubierto);
});
function aplicar(n, cubierto = {}) {
  for (const k of ["comun", "rara", "racha"]) {
    if (n[k] > val[k]) ganancia(k, n[k] - val[k], n[k] - val[k] <= (cubierto[k] ?? 0));
    if (n[k] !== val[k]) contar(k, n[k]);
  }
  try { localStorage.setItem(GUARDA, JSON.stringify(n)); } catch { /* ignorar */ }
}
onSesion((u) => { if (!u) { hud.hidden = true; offFrag(); offPerfil(); } });

/* ---------- Panel de actividad (solo escucha cuando lo abres) ---------- */
let offAct = null, abierto = false;
const hace = (ms) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
function pintar(evs) {
  feed.innerHTML = evs.length ? evs.slice(0, 8).map((e) => `<li><span class="av">${avatarHTML(e.avatar)}</span><div>${esc(describirActividad(e))}<small>${esc(NOMBRE_JUEGO[e.juego] || "Apexora")} · ${hace(e.ts?.toMillis?.() ?? Date.now())}</small></div></li>`).join("")
    : `<li class="apx-hud__vacio">Todavía no hay actividad.</li>`;
}
function alternar(abrir) {
  abierto = abrir; pill.setAttribute("aria-expanded", String(abrir));
  if (abrir) {
    const r = hud.getBoundingClientRect();
    hud.classList.toggle("arriba", r.top > innerHeight / 2);
    hud.classList.toggle("izq", r.left < innerWidth / 2);
    panel.hidden = false;
    if (!offAct) { offAct = () => {}; cargarAvatares().then(() => { offAct = escucharActividad(pintar, 8); }); }
    if (anima) gsap.fromTo(panel, { opacity: 0, scale: .9, y: -8 }, { opacity: 1, scale: 1, y: 0, duration: .35, ease: "back.out(1.5)" });
  } else if (anima) gsap.to(panel, { opacity: 0, scale: .94, duration: .2, onComplete: () => { panel.hidden = true; } });
  else panel.hidden = true;
}
pill.addEventListener("click", () => alternar(!abierto));
document.addEventListener("pointerdown", (e) => { if (abierto && !hud.contains(e.target)) alternar(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && abierto) { alternar(false); pill.focus(); } });
}
