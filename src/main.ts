import './style.css';
import { doc, getDoc } from 'firebase/firestore';
import {
  auth, db, onSesion, iniciarSesion, registrar, cerrarSesion,
  registrarVisita, obtenerPerfil, ranking, CATALOGO_LOGROS,
  escucharActividad, escucharFragmentos, describirActividad, NOMBRE_JUEGO,
} from './apexora-core.js';
import './fase1.css';
import { animarPanel, montarAurora, contar, luzDeFoco, entrarEvento, entrarLista, viajar, limpiar } from './fx';

// ← Ajusta las rutas a donde viva cada página
const ICONOS: Record<string, string> = {
  tcg: '<rect x="4.5" y="5" width="10" height="14" rx="2" transform="rotate(-10 9.5 12)"/><rect x="9.5" y="5" width="10" height="14" rx="2" transform="rotate(9 14.5 12)"/>',
  album: '<path d="M3.5 6C6 4.4 9.5 4.4 12 6c2.5-1.6 6-1.6 8.5 0v13c-2.5-1.6-6-1.6-8.5 0-2.5-1.6-6-1.6-8.5 0Z"/><path d="M12 6v13"/>',
  sala: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  lore: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
};
const JUEGOS = [
  { id: 'tcg', nombre: 'Cartas Alfa', desc: 'Duelo de cartas en línea', url: '/TCG/' },
  { id: 'album', nombre: 'Álbum', desc: 'Colecciona y abre sobres', url: '/Album/' },
  { id: 'sala', nombre: 'Sala de Desafíos', desc: 'Retos y puntos', url: '/Desafio/' },
  { id: 'lore', nombre: 'Lore', desc: 'Historia y datos del universo', url: '/Lore/' },
];
const CLIMA: Record<string, [string, string]> = {   // [color alto, color bajo] de cada mundo (los mismos de apexora-ui.css)
  tcg: ['#d56e6f', '#b10821'], album: ['#e3b488', '#a99441'], sala: ['#5fd0c8', '#069494'], lore: ['#a9c4a7', '#759773'],
};
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
    <section class="heroe">
      <span class="apx-eyebrow">Bienvenido de vuelta</span>
      <h1>${esc(p.nombre)}</h1>
    </section>
    <section class="esencias" aria-label="Tus esencias">
      <div class="esencia azul"><span class="orbe"></span><b>${p.fragmentos.comun}</b><small>Esencia azul</small></div>
      <div class="esencia negra"><span class="orbe"></span><b>${p.fragmentos.rara}</b><small>Esencia negra</small></div>
      <div class="racha"><b>${p.streak.current}</b><small>${p.streak.current === 1 ? 'día seguido' : 'días seguidos'}</small></div>
    </section>

    <section><h2>Elige un mundo</h2>
      <div class="rejilla">${JUEGOS.map((j) =>
        `<div class="hexw"><a class="hex m-${j.id}" href="${esc(j.url)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[j.id]}</svg><b>${esc(j.nombre)}</b><small>${esc(j.desc)}</small><i>Entrar</i></a></div>`).join('')}</div>
    </section>

    <section class="actividad apx-spot" aria-label="Actividad de los jugadores">
      <div class="act-cab">
        <h2>Actividad</h2>
        <div class="filtros" role="group" aria-label="Filtrar por mundo">
          <button class="chip on" data-f="todo">Todo</button>
          <button class="chip" data-f="tcg">Cartas</button>
          <button class="chip" data-f="album">Álbum</button>
          <button class="chip" data-f="sala">Desafíos</button>
        </div>
      </div>
      <ul class="feed" id="feed"><li class="vacio">Cargando actividad…</li></ul>
    </section>

    <div class="dos">
      <section class="apx-spot"><h2>Logros</h2><ul class="logros">${logros}</ul></section>
      <section class="apx-spot"><h2>Mejores rachas</h2><ol class="rank">${top.map((r: any) =>
        `<li><span>${esc(r.nombre)}</span><b>${r.streak?.best ?? 0}</b></li>`).join('')}</ol></section>
    </div>
  </main>`;
  app.querySelector<HTMLButtonElement>('#salir')!.onclick = () => { detener(); cerrarSesion(); };
  montarAurora();
  animarPanel(app);
  luzDeFoco(app);
  contar(app.querySelector('.esencia.azul b'), p.fragmentos.comun);
  contar(app.querySelector('.esencia.negra b'), p.fragmentos.rara);
  contar(app.querySelector('.racha b'), p.streak.current);

  // Transición al entrar a un mundo
  app.querySelectorAll<HTMLAnchorElement>('a.hex').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const id = [...a.classList].find((c) => c.startsWith('m-'))!.slice(2);
      const [hi, lo] = CLIMA[id] ?? ['#e3b488', '#b64e6f'];
      viajar(a.href, a.querySelector('b')!.textContent ?? '', hi, lo, e.clientX, e.clientY);
    });
  });

  // Marcador en vivo: si ganas esencias jugando en otra pestaña, aquí suben solas
  const act = { comun: p.fragmentos.comun, rara: p.fragmentos.rara, racha: p.streak.current };
  offFrag = escucharFragmentos((d: any) => {
    const n = { comun: d.fragmentos?.comun ?? 0, rara: d.fragmentos?.rara ?? 0, racha: d.streak?.current ?? 0 };
    if (n.comun !== act.comun) contar(app.querySelector('.esencia.azul b'), n.comun, act.comun);
    if (n.rara !== act.rara) contar(app.querySelector('.esencia.negra b'), n.rara, act.rara);
    if (n.racha !== act.racha) contar(app.querySelector('.racha b'), n.racha, act.racha);
    Object.assign(act, n);
  });

  iniciarFeed();
}

/* ---------- Feed de actividad ---------- */
let offFrag: (() => void) | null = null;
let offAct: (() => void) | null = null;
let reloj = 0;
let filtro = 'todo';
const vistos = new Set<string>();
let primeraCarga = true;

const tms = (e: any): number => e.ts?.toMillis?.() ?? Date.now();
function hace(ms: number): string {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
}
function itemFeed(e: any): string {
  const j = String(e.juego ?? 'portal');
  return `<li data-id="${esc(e.id)}" data-j="${esc(j)}">
    <span class="av">${esc(e.avatar ?? '🙂')}</span>
    <div class="tx">${esc(describirActividad(e))}<small><span class="tag t-${esc(j)}">${esc((NOMBRE_JUEGO as Record<string, string>)[j] ?? 'Apexora')}</span> <time data-ms="${tms(e)}">${hace(tms(e))}</time></small></div>
  </li>`;
}
function aplicarFiltro() {
  document.querySelectorAll<HTMLLIElement>('#feed li[data-j]').forEach((li) => {
    li.hidden = !(filtro === 'todo' || li.dataset.j === filtro);
  });
}
function iniciarFeed() {
  detenerFeed();
  const ul = document.querySelector<HTMLUListElement>('#feed')!;
  document.querySelectorAll<HTMLButtonElement>('.filtros .chip').forEach((b) => {
    b.onclick = () => {
      filtro = b.dataset.f!;
      document.querySelectorAll('.filtros .chip').forEach((x) => x.classList.toggle('on', x === b));
      aplicarFiltro();
    };
  });
  offAct = escucharActividad((evs: any[]) => {
    if (!evs.length) { ul.innerHTML = '<li class="vacio">Todavía no hay actividad. ¡Sé el primero!</li>'; return; }
    if (primeraCarga) {
      ul.innerHTML = evs.map(itemFeed).join('');
      evs.forEach((e) => vistos.add(e.id));
      entrarLista([...ul.children] as HTMLElement[]);
      primeraCarga = false;
    } else {
      // Solo se insertan los eventos nuevos (con animación); los demás no se tocan
      ul.querySelector('.vacio')?.remove();
      [...evs].reverse().filter((e) => !vistos.has(e.id)).forEach((e) => {
        vistos.add(e.id);
        ul.insertAdjacentHTML('afterbegin', itemFeed(e));
        entrarEvento(ul.firstElementChild as HTMLElement);
      });
      while (ul.children.length > 40) ul.lastElementChild!.remove();
    }
    aplicarFiltro();
  }, 30);
  reloj = window.setInterval(() => {
    document.querySelectorAll<HTMLElement>('#feed time[data-ms]').forEach((t) => { t.textContent = hace(Number(t.dataset.ms)); });
  }, 30000);
}
function detenerFeed() {
  offAct?.(); offAct = null; clearInterval(reloj);
  vistos.clear(); primeraCarga = true;
}
function detener() { detenerFeed(); offFrag?.(); offFrag = null; limpiar(); }

/* ---------- Arranque ---------- */
let ocupado = false;
onSesion(async (u: object | null) => {
  if (!u || !(u as { email?: string | null }).email?.endsWith('@apexora-sala.app')) { detener(); vistaLogin(); return; }
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
