import './style.css';
import { doc, getDoc } from 'firebase/firestore';
import {
  auth, db, onSesion, iniciarSesion, registrar, cerrarSesion,
  registrarVisita, obtenerPerfil, ranking, CATALOGO_LOGROS,
} from './apexora-core.js';

// ← Ajusta las rutas a donde viva cada página
const JUEGOS = [
  { nombre: 'Cartas Alfa', desc: 'Duelo de cartas en línea', url: '/TCG/' },
  { nombre: 'Álbum', desc: 'Colecciona y abre sobres', url: '/Album/' },
  { nombre: 'Sala de Desafíos', desc: 'Retos y puntos', url: '/Desafio/' },
  { nombre: 'Lore', desc: 'Historia y datos del universo', url: '/Lore/' },
];
const AVATARES = ['🦊', '🐺', '🦉', '🐉', '🦁', '🐙', '🦅', '🐢'];

const app = document.querySelector<HTMLDivElement>('#app')!;

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ENT[c]);

function msgErr(e: unknown): string {
  const c = String((e as { code?: string })?.code ?? '');
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'Usuario o clave incorrectos.';
  if (c.includes('email-already-in-use')) return 'Ese nombre de usuario ya está en uso.';
  if (c.includes('weak-password')) return 'La clave necesita al menos 6 caracteres.';
  if (c.includes('usuario-invalido')) return 'El usuario debe tener de 3 a 20 letras, números o guion bajo, sin espacios.';
  if (c.includes('operation-not-allowed')) return 'Activa Email/Contraseña en Firebase → Authentication.';
  if (c.includes('network')) return 'Sin conexión con Firebase.';
  return 'No se pudo completar. Inténtalo de nuevo.';
}

/* ---------- Acceso ---------- */
function vistaLogin(crear = false) {
  app.innerHTML = `
  <main class="acceso">
    <h1>Apexora</h1>
    <p class="sub">Una cuenta para todos los juegos.</p>
    <form id="f">
      <label>Usuario<input name="u" autocomplete="username" required minlength="3" maxlength="20"></label>
      <label>Clave<input name="c" type="password" autocomplete="${crear ? 'new-password' : 'current-password'}" required minlength="6"></label>
      ${crear ? `<fieldset><legend>Elige tu avatar</legend><div class="avatares">${AVATARES.map((a, i) =>
        `<label><input type="radio" name="a" value="${a}" ${i === 0 ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div></fieldset>` : ''}
      <p class="err" id="err" role="alert"></p>
      <button class="primario">${crear ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
    <button class="enlace" id="alt">${crear ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>
  </main>`;

  const f = app.querySelector<HTMLFormElement>('#f')!;
  const err = app.querySelector<HTMLElement>('#err')!;
  app.querySelector<HTMLButtonElement>('#alt')!.onclick = () => vistaLogin(!crear);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const d = new FormData(f), btn = f.querySelector('button')!;
    btn.disabled = true; err.textContent = '';
    try {
      if (crear) await registrar(String(d.get('u')), String(d.get('c')), String(d.get('a')));
      else await iniciarSesion(String(d.get('u')), String(d.get('c')));
    } catch (e) { err.textContent = msgErr(e); btn.disabled = false; }
  };
}

/* ---------- Panel ---------- */
async function vistaPanel() {
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  const uid = auth.currentUser!.uid;
  const [p, top, prof] = await Promise.all([
    obtenerPerfil(), ranking(5), getDoc(doc(db, 'apexora_profiles', uid)),
  ]);
  if (!p) { app.innerHTML = '<p class="cargando">No se pudo cargar tu perfil. Recarga la página.</p>'; return; }
  const avatar = prof.exists() ? prof.data().avatar : '🙂';

  const logros = Object.entries(CATALOGO_LOGROS as Record<string, any>).map(([id, l]) => {
    const ok = !!p.logros?.[id];
    const premio = [l.premio?.comun ? `+${l.premio.comun} azul` : '', l.premio?.rara ? `+${l.premio.rara} negra` : '']
      .filter(Boolean).join(' y ');
    return `<li class="logro ${ok ? 'ok' : ''}"><span class="ico">${l.icono}</span>
      <div><b>${esc(l.nombre)}</b><small>${esc(l.desc)}${premio ? ' · ' + premio : ''}</small></div></li>`;
  }).join('');

  app.innerHTML = `
  <header class="barra">
    <span class="quien"><span class="av">${esc(avatar)}</span>${esc(p.nombre)}</span>
    <button class="enlace" id="salir">Salir</button>
  </header>
  <main class="panel">
    <section class="esencias" aria-label="Tus esencias">
      <div class="esencia azul"><span class="orbe"></span><b>${p.fragmentos.comun}</b><small>Esencia azul</small></div>
      <div class="esencia negra"><span class="orbe"></span><b>${p.fragmentos.rara}</b><small>Esencia negra</small></div>
      <div class="racha"><b>${p.streak.current}</b><small>${p.streak.current === 1 ? 'día seguido' : 'días seguidos'}</small></div>
    </section>

    <section><h2>Juegos</h2>
      <div class="juegos">${JUEGOS.map((j) =>
        `<a class="juego" href="${esc(j.url)}"><b>${esc(j.nombre)}</b><small>${esc(j.desc)}</small></a>`).join('')}</div>
    </section>

    <div class="dos">
      <section><h2>Logros</h2><ul class="logros">${logros}</ul></section>
      <section><h2>Mejores rachas</h2><ol class="rank">${top.map((r: any) =>
        `<li><span>${esc(r.nombre)}</span><b>${r.streak?.best ?? 0}</b></li>`).join('')}</ol></section>
    </div>
  </main>`;
  app.querySelector<HTMLButtonElement>('#salir')!.onclick = () => cerrarSesion();
}

/* ---------- Arranque ---------- */
let ocupado = false;
onSesion(async (u: object | null) => {
  if (!u) { vistaLogin(); return; }
  if (ocupado) return;
  ocupado = true;
  try {
    await registrarVisita();
    const volver = new URLSearchParams(location.search).get('volver');
    if (volver && volver.startsWith(location.origin)) { location.href = volver; return; }
    await vistaPanel();
  } catch (e) {
  console.error(e);
  const x = e as { code?: string; message?: string };
  app.innerHTML = `<p class="cargando">No se pudo conectar.<br><small>${esc(x.code ?? x.message ?? e)}</small></p>
    <p class="cargando"><button class="enlace" id="salir2">Salir</button></p>`;
  document.querySelector<HTMLButtonElement>('#salir2')!.onclick = () => cerrarSesion();
}
  finally { ocupado = false; }
});
