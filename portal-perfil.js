import { onSesion, iniciarSesion, registrar, cerrarSesion, registrarVisita,
  obtenerPerfil, ranking, CATALOGO_LOGROS } from "./apexora-core.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const MSG = {
  "auth/invalid-credential": "Usuario o contraseña incorrectos",
  "auth/email-already-in-use": "Ese usuario ya existe",
  "auth/weak-password": "La contraseña necesita 6 caracteres o más",
  "auth/usuario-invalido": "Usuario: 3 a 20 letras, números o _",
};

const st = document.createElement("style");
st.textContent = `
#apx-btn{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:100;font-family:var(--titulo);letter-spacing:.06em;font-size:1.05rem;color:#fff;background:rgba(10,18,45,.7);border:1px solid rgba(241,246,240,.5);border-radius:999px;padding:.45em 1.1em;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#apx-btn:hover{background:#F22F52;border-color:#F22F52}
#apx-fondo{position:fixed;inset:0;z-index:101;display:none;align-items:center;justify-content:center;background:rgba(10,18,45,.6);backdrop-filter:blur(6px);padding:16px}
#apx-fondo.on{display:flex}
#apx-card{width:min(440px,100%);max-height:88vh;overflow:auto;background:#F1F6F0;color:#1B2A63;border-radius:18px;padding:22px;font-family:var(--texto);font-weight:700;font-size:1.05rem;box-shadow:0 20px 60px rgba(0,0,0,.4)}
#apx-card h3{font-family:var(--titulo);font-weight:400;font-size:1.6rem;letter-spacing:.04em;margin-bottom:.6em}
#apx-card h4{font-family:var(--titulo);font-weight:400;margin:1.1em 0 .4em;color:#4764B7;letter-spacing:.05em}
#apx-card input{width:100%;font:inherit;padding:.6em .8em;margin-bottom:.6em;border:1.5px solid #4764B7;border-radius:10px;background:#fff;color:#1B2A63}
#apx-card .p{width:100%;font-family:var(--titulo);font-size:1.1rem;letter-spacing:.08em;color:#fff;background:#F22F52;border:0;border-radius:999px;padding:.6em;cursor:pointer}
#apx-card .l{background:none;border:0;color:#4764B7;font:inherit;text-decoration:underline;cursor:pointer;margin-top:.8em}
#apx-card .e{color:#F22F52;min-height:1.3em;margin-top:.5em}
.apx-fila{display:flex;gap:10px}
.apx-chip{flex:1;background:#fff;border-radius:12px;padding:.6em;text-align:center}
.apx-chip b{display:block;font-size:1.5rem}
.apx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.apx-l{background:#fff;border-radius:12px;padding:.6em;text-align:center;opacity:.35;filter:grayscale(1);font-size:.9rem}
.apx-l.ok{opacity:1;filter:none;outline:2px solid #49C3E5}
.apx-l span{display:block;font-size:1.6rem}
.apx-rk{display:flex;justify-content:space-between;padding:.3em .6em;border-radius:8px}
.apx-rk.yo{background:#49C3E5;color:#fff}
`;
document.head.appendChild(st);

const btn = document.createElement("button"); btn.id = "apx-btn"; btn.textContent = "Entrar";
const fondo = document.createElement("div"); fondo.id = "apx-fondo";
const card = document.createElement("div"); card.id = "apx-card";
fondo.appendChild(card); document.body.append(btn, fondo);

let user = null, modo = "entrar";

btn.onclick = () => { fondo.classList.add("on"); pintar(); };
fondo.addEventListener("click", (e) => { if (e.target === fondo) fondo.classList.remove("on"); });

card.addEventListener("click", (e) => {
  const a = e.target.dataset.a;
  if (a === "modo") { modo = modo === "entrar" ? "crear" : "entrar"; pintar(); }
  if (a === "salir") { cerrarSesion(); fondo.classList.remove("on"); }
});
card.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    if (modo === "crear") await registrar(f.get("u"), f.get("c"));
    else await iniciarSesion(f.get("u"), f.get("c"));
  } catch (x) { pintar(MSG[x.code] || "No se pudo. Probá de nuevo."); }
});

async function pintar(err = "") {
  if (!user) {
    const crear = modo === "crear";
    card.innerHTML = `<h3>${crear ? "Crear cuenta" : "Entrar a Apexora"}</h3>
      <form><input name="u" placeholder="Usuario" autocomplete="username" maxlength="20" required>
      <input name="c" type="password" placeholder="Contraseña (6 o más)" minlength="6" autocomplete="${crear ? "new-password" : "current-password"}" required>
      <button class="p">${crear ? "Crear cuenta" : "Entrar"}</button></form>
      <p class="e">${esc(err)}</p>
      <button class="l" data-a="modo">${crear ? "Ya tengo cuenta" : "Crear una cuenta nueva"}</button>`;
    return;
  }
  card.innerHTML = "<p>Cargando…</p>";
  const [p, top] = await Promise.all([obtenerPerfil(), ranking()]);
  if (!p) { card.innerHTML = "<p>Sin datos todavía.</p>"; return; }
  const logros = Object.entries(CATALOGO_LOGROS)
    .sort((a, b) => !!p.logros[b[0]] - !!p.logros[a[0]])
    .map(([id, l]) => `<div class="apx-l ${p.logros[id] ? "ok" : ""}"><span>${l.icono}</span>${esc(l.nombre)}<br><small>${esc(l.desc)}</small></div>`).join("");
  const rk = top.map((j, i) => `<div class="apx-rk ${j.nombre === p.nombre ? "yo" : ""}"><span>${i + 1}. ${esc(j.nombre)}</span><span>🔥 ${j.streak.best}</span></div>`).join("");
  card.innerHTML = `<h3>${esc(p.nombre)}</h3>
    <div class="apx-fila">
      <div class="apx-chip"><b>🔥 ${p.streak.current}</b>racha (mejor: ${p.streak.best})</div>
      <div class="apx-chip"><b>🔹 ${p.fragmentos.comun}</b>comunes</div>
      <div class="apx-chip"><b>💎 ${p.fragmentos.rara}</b>raros</div>
    </div>
    <h4>Logros</h4><div class="apx-grid">${logros}</div>
    <h4>Mejores rachas</h4>${rk}
    <button class="l" data-a="salir">Cerrar sesión</button>`;
}

onSesion(async (u) => {
  user = u;
  if (!u) { btn.textContent = "Entrar"; if (fondo.classList.contains("on")) pintar(); return; }
  btn.textContent = "…";
  const d = await registrarVisita();
  btn.textContent = d ? `🔥 ${d.streak.current}` : "Perfil";
  if (fondo.classList.contains("on")) pintar();
});