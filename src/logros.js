/* apexora-logros · aviso de logro desbloqueado, EN EL INSTANTE.
   No depende de qué juego (ni de qué copia del núcleo) otorgó el logro: se mira el documento del jugador
   en vivo y, cuando aparece un logro que este navegador todavía no había visto, sale la tarjeta.
   Uso:  avisarLogros(uid, datos.logros, CATALOGO_LOGROS)  → devuelve los ids recién mostrados.
   - Solo avisa la pestaña visible (si hay varias abiertas no se "gasta" el aviso en una oculta).
   - En un navegador nuevo no lanza avisos por logros viejos: solo por los de los últimos 90 s. */
import { cristal } from "./cristales.js";

const KEY = (uid) => "apx-logros:" + uid;
const leer = (uid) => { try { const v = JSON.parse(localStorage.getItem(KEY(uid)) || "null"); return Array.isArray(v) ? v : null; } catch { return null; } };
const guardar = (uid, ids) => { try { localStorage.setItem(KEY(uid), JSON.stringify(ids)); } catch { /* ignorar */ } };
const ms = (f) => (f && f.toMillis ? f.toMillis() : Date.now());   // serverTimestamp pendiente = null → "ahora"
const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);

let ult = null, caja = null;

function estilos() {
  if (document.getElementById("apx-logro-css")) return;
  const s = document.createElement("style"); s.id = "apx-logro-css";
  s.textContent = `
.apx-logros{position:fixed;z-index:2147482500;left:50%;transform:translateX(-50%);display:grid;gap:.6rem;justify-items:center;pointer-events:none;
  top:calc(var(--apx-toast-top,calc(env(safe-area-inset-top,0px) + 12px)) + 54px);width:min(380px,calc(100vw - 24px))}
.apx-logro{pointer-events:auto;cursor:pointer;width:100%;display:grid;grid-template-columns:auto 1fr;gap:.2rem .85rem;align-items:center;padding:.8rem 1rem .8rem .85rem;border-radius:20px;color:#f7ece0;
  font:500 .85rem/1.3 var(--apx-body,system-ui,sans-serif);position:relative;overflow:hidden;
  background:linear-gradient(160deg,rgba(255,255,255,.2),rgba(255,255,255,.06)),rgba(34,14,24,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  border:1px solid rgba(227,180,136,.65);box-shadow:0 22px 44px -18px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.06) inset,0 0 34px -6px rgba(227,180,136,.5)}
.apx-logro::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);transform:translateX(-120%);animation:apx-logro-brillo 1.1s .35s ease-out forwards}
@keyframes apx-logro-brillo{to{transform:translateX(120%)}}
.apx-logro__ico{grid-row:span 3;display:grid;place-items:center;width:3rem;height:3rem;border-radius:50%;font-size:1.6rem;background:radial-gradient(circle at 35% 30%,rgba(227,180,136,.55),rgba(227,180,136,.12));border:1px solid rgba(227,180,136,.5)}
.apx-logro__eye{font:600 .64rem/1 var(--apx-body,system-ui,sans-serif);letter-spacing:.26em;text-transform:uppercase;color:var(--apx-sand,#e3b488)}
.apx-logro__nom{font:400 1.2rem/1.1 var(--apx-display,Georgia,serif);letter-spacing:.02em}
.apx-logro__desc{opacity:.78;font-size:.78rem}
.apx-logro__pr{display:flex;gap:.45rem;margin-top:.15rem}
.apx-logro__r{display:inline-flex;align-items:center;gap:.25rem;padding:.12rem .55rem .12rem .4rem;border-radius:999px;background:rgba(255,255,255,.1);font:600 .78rem/1 var(--apx-body,system-ui,sans-serif);font-variant-numeric:tabular-nums}
.apx-logro__r svg{width:.7rem;height:.95rem;overflow:visible}
.apx-logro__r.sinfalita svg{filter:drop-shadow(0 0 4px rgba(61,240,238,.8))}
.apx-logro__r.odita svg{filter:drop-shadow(0 0 .5px rgba(190,165,240,.95)) drop-shadow(0 0 5px rgba(150,110,210,.55))}
@media (prefers-reduced-motion:reduce){.apx-logro::after{display:none}}`;
  document.head.appendChild(s);
}

function mostrar(id, def) {
  estilos();
  if (!caja || !caja.isConnected) {
    caja = document.createElement("div"); caja.className = "apx-logros"; caja.setAttribute("role", "status"); caja.setAttribute("aria-live", "polite");
    document.body.appendChild(caja);
  }
  const p = (def && def.premio) || {};
  const premio = [p.comun ? `<span class="apx-logro__r sinfalita">+${p.comun} ${cristal("sinfalita")}</span>` : "", p.rara ? `<span class="apx-logro__r odita">+${p.rara} ${cristal("odita")}</span>` : ""].join("");
  const el = document.createElement("div"); el.className = "apx-logro"; el.dataset.id = id;
  el.innerHTML = `<span class="apx-logro__ico" aria-hidden="true">${esc((def && def.icono) || "🏅")}</span>
    <span class="apx-logro__eye">Logro desbloqueado</span>
    <b class="apx-logro__nom">${esc((def && def.nombre) || "Nuevo logro")}</b>
    <span class="apx-logro__desc">${esc((def && def.desc) || "")}</span>
    ${premio ? `<span class="apx-logro__pr" style="grid-column:2">${premio}</span>` : ""}`;
  caja.appendChild(el);
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const salir = () => {
    if (!el.isConnected) return;
    if (reducido || !el.animate) return el.remove();
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-14px) scale(.96)" }], { duration: 260, easing: "ease-in", fill: "forwards" }).onfinish = () => el.remove();
  };
  if (!reducido && el.animate) el.animate([{ opacity: 0, transform: "translateY(-30px) scale(.88)" }, { opacity: 1, transform: "translateY(4px) scale(1.03)", offset: .7 }, { opacity: 1, transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.9,.3,1)" });
  el.addEventListener("click", salir);
  setTimeout(salir, 6000);
}

function revisar() {
  if (!ult || document.visibilityState !== "visible") return [];
  const { uid, logros, catalogo } = ult;
  const ids = Object.keys(logros || {});
  const visto = leer(uid);
  const nuevos = ids.filter((id) => !(visto || []).includes(id) && (visto || Date.now() - ms(logros[id] && logros[id].fecha) < 90000));
  if (!visto || nuevos.length || visto.length !== ids.length) guardar(uid, ids);
  nuevos.forEach((id, i) => setTimeout(() => mostrar(id, catalogo && catalogo[id]), i * 900));
  return nuevos;
}

export function avisarLogros(uid, logros, catalogo) {
  if (!uid || !logros) return [];
  ult = { uid, logros, catalogo };
  return revisar();
}
document.addEventListener("visibilitychange", revisar);
