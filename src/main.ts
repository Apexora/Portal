import './style.css';
import { doc, getDoc } from 'firebase/firestore';
import {
  auth, db, onSesion, iniciarSesion, registrar, cerrarSesion,
  registrarVisita, obtenerPerfil, CATALOGO_LOGROS,
  escucharActividad, escucharFragmentos, describirActividad, NOMBRE_JUEGO,
  cargarAvatares, avatarHTML, opcionesAvatar, cambiarAvatar, enviarMensaje, escucharChat,
  topVisitas, actividadReciente, perfilesPublicos,
  perfilJugador, rankingPor, miPuesto, iniciarPresencia, escucharEnLinea,
} from './apexora-core.js';
import './fase1.css';
import './perfil-chat.css';
import { montarCometas } from './cometas';
import { cristal, NOMBRE_CRISTAL } from './cristales.js';
import { avisarLogros } from './logros.js';
import { animarPanel, montarAurora, contar, luzDeFoco, entrarEvento, entrarLista, viajar, limpiar } from './fx';

// ← Ajusta las rutas a donde viva cada página
const ICONOS: Record<string, string> = {
  tcg: '<rect x="4.5" y="5" width="10" height="14" rx="2" transform="rotate(-10 9.5 12)"/><rect x="9.5" y="5" width="10" height="14" rx="2" transform="rotate(9 14.5 12)"/>',
  album: '<path d="M3.5 6C6 4.4 9.5 4.4 12 6c2.5-1.6 6-1.6 8.5 0v13c-2.5-1.6-6-1.6-8.5 0-2.5-1.6-6-1.6-8.5 0Z"/><path d="M12 6v13"/>',
  sala: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  arena: '<path d="M5 4l7 7M19 4l-7 7M4 20l6-6M20 20l-6-6M3.5 5.5L5 4l1.5 1.5M17.5 5.5L19 4l1.5 1.5"/><circle cx="12" cy="12" r="2"/>',
  lore: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
};
const JUEGOS = [
  { id: 'tcg', nombre: 'Cartas Alfa', desc: 'Duelo de cartas en línea', url: '/TCG/' },
  { id: 'album', nombre: 'Álbum', desc: 'Colecciona y abre sobres', url: '/Album/' },
  { id: 'sala', nombre: 'Sala de Desafíos', desc: 'Retos y puntos', url: '/Desafio/' },
  { id: 'arena', nombre: 'Arena', desc: 'Combates por turnos 3 contra 3', url: '/Arena/' },
  { id: 'lore', nombre: 'Lore', desc: 'Historia y datos del universo', url: '/Lore/' },
];
const CLIMA: Record<string, [string, string]> = {   // [color alto, color bajo] de cada mundo (los mismos de apexora-ui.css)
  tcg: ['#d56e6f', '#b10821'], album: ['#e3b488', '#a99441'], sala: ['#5fd0c8', '#069494'], arena: ['#6f9bf0', '#2556d9'], lore: ['#a9c4a7', '#759773'],
};
const EMOJIS = ['😀', '😂', '😍', '🥳', '😎', '🤔', '😭', '😡', '👍', '👏', '🔥', '💜', '✨', '🎉', '⚔️', '🃏'];

const app = document.querySelector<HTMLDivElement>('#app')!;
montarCometas();

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

/* ---------- Rango (según logros desbloqueados) ---------- */
const RANGOS: [string, string][] = [['🌱', 'Novato'], ['⚔️', 'Aprendiz'], ['🛡️', 'Veterano'], ['🔮', 'Maestro'], ['👑', 'Leyenda']];
function rango(n: number): string {
  const total = Object.keys(CATALOGO_LOGROS).length || 1, r = n / total;
  const [ico, nom] = RANGOS[r >= 1 ? 4 : r >= 0.75 ? 3 : r >= 0.5 ? 2 : r >= 0.25 ? 1 : 0];
  return `${ico} ${nom}`;
}

/* ---------- Perfil estilo Netflix ---------- */
function rejillaAvatar(sel: string): string {
  return `<div class="av-rejilla" role="radiogroup">${opcionesAvatar().map((a: { id: string; nombre?: string }, i: number) =>
    `<label class="av-op" title="${esc(a.nombre ?? '')}"><input type="radio" name="a" value="${esc(a.id)}" ${a.id === sel || (!sel && i === 0) ? 'checked' : ''}><span class="av-tile">${avatarHTML(a.id, 'av-img')}</span></label>`).join('')}</div>`;
}
async function datosPerfil() {
  await cargarAvatares();
  const s = await getDoc(doc(db, 'apexora_profiles', auth.currentUser!.uid));
  const d = s.exists() ? s.data() : {};
  return { nombre: String(d.name ?? auth.currentUser!.email!.split('@')[0]), avatar: String(d.avatar ?? '🙂') };
}
/** «¿Quién juega?»: una vez por sesión, antes del panel. */
function vistaQuien(nombre: string, avatar: string) {
  detener();
  app.innerHTML = `<main class="quien-juega">
    <h1>¿Quién juega?</h1>
    <div class="perfiles"><button class="perfil" id="entrar"><span class="av-tile grande">${avatarHTML(avatar, 'av-img')}</span><b>${esc(nombre)}</b></button></div>
    <button class="btn-ghost" id="editar">✏️ Editar perfil</button>
  </main>`;
  app.querySelector<HTMLButtonElement>('#entrar')!.onclick = () => { vistaPanel(); };
  app.querySelector<HTMLButtonElement>('#editar')!.onclick = () => vistaEditar(nombre, avatar, (a) => vistaQuien(nombre, a));
}
function vistaEditar(nombre: string, avatar: string, volver: (a: string) => void) {
  detener();
  app.innerHTML = `<main class="quien-juega editar">
    <span class="apx-eyebrow">Editar perfil</span>
    <h1>Elige tu imagen</h1>
    <p class="sub">${esc(nombre)} · se verá en todas las plataformas de Apexora</p>
    <form id="fa">${rejillaAvatar(avatar)}
      <p class="err" id="erra" role="alert"></p>
      <div class="acciones"><button class="primario">Guardar</button><button type="button" class="btn-ghost" id="cancelar">Cancelar</button></div>
    </form></main>`;
  const f = app.querySelector<HTMLFormElement>('#fa')!;
  app.querySelector<HTMLButtonElement>('#cancelar')!.onclick = () => volver(avatar);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const nuevo = String(new FormData(f).get('a') ?? avatar), btn = f.querySelector<HTMLButtonElement>('.primario')!;
    if (nuevo === avatar) { volver(avatar); return; }
    btn.disabled = true;
    try { await cambiarAvatar(nuevo); volver(nuevo); }
    catch { app.querySelector<HTMLElement>('#erra')!.textContent = 'No se pudo guardar. Revisa que las reglas de Firebase permitan editar tu perfil.'; btn.disabled = false; }
  };
}

/* ---------- Acceso ---------- */
async function vistaLogin(crear = false) {
  if (crear) await cargarAvatares();
  app.innerHTML = `
  <main class="acceso">
    <h1>Apexora</h1>
    <p class="sub">Una cuenta para todos los juegos.</p>
    <form id="f">
      <label>Usuario<input name="u" autocomplete="username" required minlength="3" maxlength="20"></label>
      <label>Clave<input name="c" type="password" autocomplete="${crear ? 'new-password' : 'current-password'}" required minlength="6"></label>
      ${crear ? `<fieldset><legend>Elige tu imagen de perfil</legend>${rejillaAvatar('')}</fieldset>` : ''}
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
  const [p, prof] = await Promise.all([
    obtenerPerfil(), getDoc(doc(db, 'apexora_profiles', uid)),
  ]);
  if (!p) { app.innerHTML = '<p class="cargando">No se pudo cargar tu perfil. Recarga la página.</p>'; return; }
  const avatar = prof.exists() ? prof.data().avatar : '🙂';
  await cargarAvatares();

  const logros = Object.entries(CATALOGO_LOGROS as Record<string, any>).map(([id, l]) => {
    const ok = !!p.logros?.[id];
    const premio = [l.premio?.comun ? `+${l.premio.comun} sinfalita` : '', l.premio?.rara ? `+${l.premio.rara} odita` : '']
      .filter(Boolean).join(' y ');
    return `<li class="logro ${ok ? 'ok' : ''}" data-logro="${esc(id)}"><span class="ico">${l.icono}</span>
      <div><b>${esc(l.nombre)}</b><small>${esc(l.desc)}${premio ? ' · ' + premio : ''}</small></div></li>`;
  }).join('');

  app.innerHTML = `
  <header class="barra">
    <span class="quien"><button class="av av-btn" id="miperfil" title="Editar perfil" aria-label="Editar perfil">${avatarHTML(avatar, 'av-img')}</button>${esc(p.nombre)}</span>
    <button class="enlace" id="salir">Salir</button>
  </header>
  <main class="panel">
    <section class="heroe">
      <span class="apx-eyebrow">Bienvenido de vuelta</span>
      <h1>${esc(p.nombre)}</h1>
      <p class="rango" title="Tu rango sube al desbloquear logros">${rango(Object.keys(p.logros ?? {}).length)} · ${Object.keys(p.logros ?? {}).length}/${Object.keys(CATALOGO_LOGROS).length} logros</p>
      <div class="enlinea" id="enlinea" hidden></div>
    </section>
    <section class="esencias" aria-label="Tus cristales">
      <div class="esencia sinfalita">${cristal('sinfalita')}<b>${p.fragmentos.comun}</b><small>${NOMBRE_CRISTAL.comun}</small></div>
      <div class="esencia odita">${cristal('odita')}<b>${p.fragmentos.rara}</b><small>${NOMBRE_CRISTAL.rara}</small></div>
      <div class="racha"><b>${p.streak.current}</b><small>${p.streak.current === 1 ? 'día seguido' : 'días seguidos'}</small></div>
    </section>

    <section class="mundos"><h2>Elige un mundo</h2>
      <div class="rejilla">${JUEGOS.map((j) =>
        `<div class="hexw" data-j="${j.id}"><a class="hex m-${j.id}" href="${esc(j.url)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[j.id]}</svg><b>${esc(j.nombre)}</b><small>${esc(j.desc)}</small><i>Entrar</i></a></div>`).join('')}</div>
    </section>

    <div class="izq">
    <section class="chat apx-spot" aria-label="Chat libre de los jugadores">
      <div class="chat-cab"><h2>Chat libre 💬</h2><span class="vivo">● en vivo</span></div>
      <ul class="chat-msgs" id="chat" aria-live="polite"><li class="vacio">Cargando mensajes…</li></ul>
      <div class="chat-emojis" role="group" aria-label="Emojis">${EMOJIS.map((e) => `<button type="button" class="emo" data-e="${e}" aria-label="Emoji ${e}">${e}</button>`).join('')}</div>
      <form class="chat-form" id="chatf" autocomplete="off">
        <input name="m" maxlength="200" placeholder="Deja un mensaje a los demás jugadores… 😄" aria-label="Mensaje">
        <button class="primario">Enviar</button>
      </form>
      <p class="err" id="chaterr" role="alert"></p>
    </section>

    <section class="actividad apx-spot" aria-label="Actividad de los jugadores">
      <div class="act-cab">
        <h2>Actividad</h2>
        <div class="filtros" role="group" aria-label="Filtrar por mundo">
          <button class="chip on" data-f="todo">Todo</button>
          <button class="chip" data-f="tcg">Cartas</button>
          <button class="chip" data-f="album">Álbum</button>
          <button class="chip" data-f="sala">Desafíos</button>
          <button class="chip" data-f="arena">Arena</button>
        </div>
      </div>
      <ul class="feed" id="feed"><li class="vacio">Cargando actividad…</li></ul>
    </section>
    </div>

    <div class="dos">
      <section class="apx-spot"><h2>Logros</h2><ul class="logros">${logros}</ul></section>
      <section class="apx-spot clasif"><h2>Clasificación</h2>
        <div class="tabs" role="group" aria-label="Tipo de clasificación">
          <button class="chip on" data-r="rachas">🔥 Rachas</button><button class="chip" data-r="cristales">💎 Cristales</button><button class="chip" data-r="actividad">⚡ Actividad</button>
        </div>
        <ol class="rank2" id="rank"><li class="vacio">Cargando…</li></ol>
        <p class="tupuesto" id="tupuesto"></p>
      </section>
    </div>
  </main>`;
  app.querySelector<HTMLButtonElement>('#salir')!.onclick = () => { detener(); cerrarSesion(); };
  app.querySelector<HTMLButtonElement>('#miperfil')!.onclick = () => vistaEditar(p.nombre, avatar, () => { vistaPanel(); });
  iniciarChat(uid, p.nombre);
  iniciarRank(uid, p);
  iniciarEnLinea();
  iniciarPresencia('portal');
  montarAurora();
  animarPanel(app);
  luzDeFoco(app);
  contar(app.querySelector('.esencia.sinfalita b'), p.fragmentos.comun);
  contar(app.querySelector('.esencia.odita b'), p.fragmentos.rara);
  contar(app.querySelector('.racha b'), p.streak.current);

  activarMini(app);

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

  // Marcador en vivo: si ganas cristales jugando en otra pestaña, aquí suben solas
  const act = { comun: p.fragmentos.comun, rara: p.fragmentos.rara, racha: p.streak.current };
  offFrag = escucharFragmentos((d: any) => {
    const n = { comun: d.fragmentos?.comun ?? 0, rara: d.fragmentos?.rara ?? 0, racha: d.streak?.current ?? 0 };
    if (n.comun !== act.comun) contar(app.querySelector('.esencia.sinfalita b'), n.comun, act.comun);
    if (n.rara !== act.rara) contar(app.querySelector('.esencia.odita b'), n.rara, act.rara);
    if (n.racha !== act.racha) contar(app.querySelector('.racha b'), n.racha, act.racha);
    Object.assign(act, n);
    if (d.logros) {
      avisarLogros(uid, d.logros, CATALOGO_LOGROS);
      Object.keys(d.logros).forEach((id) => app.querySelector(`[data-logro="${id}"]`)?.classList.add('ok'));
    }
  });

  avisarLogros(uid, p.logros, CATALOGO_LOGROS);   // p.ej. "Primer paso" / rachas, que se otorgan justo al entrar
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
    <button class="av jug" data-uid="${esc(e.uid ?? '')}" title="Ver jugador" aria-label="Ver jugador ${esc(e.nombre ?? '')}">${avatarHTML(e.avatar ?? '🙂', 'av-img')}</button>
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
    document.querySelectorAll<HTMLElement>('#feed time[data-ms], #chat time[data-ms]').forEach((t) => { t.textContent = hace(Number(t.dataset.ms)); });
  }, 30000);
}
function detenerFeed() {
  offAct?.(); offAct = null; clearInterval(reloj);
  vistos.clear(); primeraCarga = true;
}

/* ---------- Pantallita al pasar el mouse por un mundo ---------- */
type Fila = { uid: string; nombre: string; avatar: string; n: number };
type DatosMini = { t: number; mejores: Fila[]; visitas: Fila[] };
const cacheMini: Record<string, DatosMini> = {};
let actCache: { t: number; evs: any[] } | null = null;
async function actividadCache(): Promise<any[]> {
  if (!actCache || Date.now() - actCache.t > 60000) actCache = { t: Date.now(), evs: await actividadReciente(300) };
  return actCache.evs;
}
const MEJOR: Record<string, [string, string]> = {   // [título, qué se cuenta]
  tcg: ['Más victorias', 'victorias'], sala: ['Más retos superados', 'retos'], album: ['Más sobres abiertos', 'sobres'], arena: ['Más victorias', 'victorias'],
};
async function datosMini(id: string): Promise<DatosMini> {
  const c = cacheMini[id]; if (c && Date.now() - c.t < 60000) return c;
  const mejores: Fila[] = [];
  if (MEJOR[id]) {
    const cuenta = new Map<string, Fila>();
    const evs = await actividadCache().catch(() => [] as any[]);
    for (const e of evs) {
      const d = e.datos ?? {};
      if (e.juego !== id) continue;
      const vale = (id === 'tcg' && e.tipo === 'duelo') || (id === 'sala' && e.tipo === 'reto' && d.gano) || (id === 'album' && e.tipo === 'sobre') || (id === 'arena' && (e.tipo === 'duelo' || e.tipo === 'aventura'));
      if (!vale) continue;
      const f = cuenta.get(e.uid) ?? { uid: e.uid, nombre: String(e.nombre ?? 'Alguien'), avatar: String(e.avatar ?? '🙂'), n: 0 };
      f.n++; cuenta.set(e.uid, f);
    }
    mejores.push(...[...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 3));
  }
  let visitas: Fila[] = [];
  try {
    const v = await topVisitas(id, 3);
    const pf = (await perfilesPublicos(v.map((x: any) => x.uid))) as Record<string, { name?: string; avatar?: string }>;
    visitas = v.filter((x: any) => x.visitas > 0).map((x: any) => ({
      uid: x.uid, nombre: String(pf[x.uid]?.name ?? x.nombre ?? 'Alguien'), avatar: String(pf[x.uid]?.avatar ?? '🙂'), n: x.visitas }));
  } catch { /* sin permiso o sin índice: se muestra vacío */ }
  return (cacheMini[id] = { t: Date.now(), mejores, visitas });
}
const filasMini = (fs: Fila[]) => fs.length
  ? `<ol>${fs.map((f) => `<li><span class="av">${avatarHTML(f.avatar, 'av-img')}</span><span class="nm">${esc(f.nombre)}</span><b>${f.n}</b></li>`).join('')}</ol>`
  : '<p class="mini-vacio">Aún nadie. ¡Sé el primero! ✨</p>';

let mini: HTMLDivElement | null = null;
let miniId = '';
let miniTimer = 0;
function ocultarMini() { clearTimeout(miniTimer); miniId = ''; if (mini) { mini.classList.remove('on'); mini.hidden = true; } }
function posicionarMini(w: HTMLElement) {
  if (!mini) return;
  const r = w.getBoundingClientRect(), rej = (w.closest('.rejilla') ?? w).getBoundingClientRect();
  const ancho = mini.offsetWidth, alto = mini.offsetHeight;
  const izq = r.left + r.width / 2 < rej.left + rej.width / 2;     // se abre hacia afuera del panal, sin tapar otros mundos
  let x = izq ? rej.left - ancho - 10 : rej.right + 10;
  if (x < 8) x = rej.right + 10;
  if (x + ancho > innerWidth - 8) x = rej.left - ancho - 10;
  x = Math.min(Math.max(8, x), innerWidth - ancho - 8);
  const y = Math.min(Math.max(8, r.top + r.height / 2 - alto / 2), innerHeight - alto - 8);
  mini.style.left = `${x}px`; mini.style.top = `${y}px`;
}
async function mostrarMini(w: HTMLElement) {
  const id = w.dataset.j!, j = JUEGOS.find((x) => x.id === id)!;
  if (!mini) { mini = document.createElement('div'); mini.className = 'mini'; mini.setAttribute('role', 'tooltip'); document.body.appendChild(mini); }
  miniId = id;
  const cab = `<div class="mini-cab"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[id]}</svg><b>${esc(j.nombre)}</b></div>`;
  mini.innerHTML = cab + '<p class="mini-vacio">Cargando…</p>';
  mini.hidden = false; posicionarMini(w); requestAnimationFrame(() => mini?.classList.add('on'));
  const d = await datosMini(id).catch(() => null);
  if (!mini || miniId !== id) return;
  mini.innerHTML = cab
    + (MEJOR[id] ? `<h4>🏆 ${MEJOR[id][0]}</h4>${filasMini(d?.mejores ?? [])}` : '')
    + `<h4>👣 Visitan más esta página</h4>${filasMini(d?.visitas ?? [])}`
    + (MEJOR[id] ? '<small>Según la actividad reciente</small>' : '');
  posicionarMini(w);
}
function activarMini(raiz: HTMLElement) {
  raiz.querySelectorAll<HTMLElement>('.hexw[data-j]').forEach((w) => {
    w.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || innerWidth < 760) return;
      clearTimeout(miniTimer); miniTimer = window.setTimeout(() => { void mostrarMini(w); }, 180);
    });
    w.addEventListener('pointerleave', ocultarMini);
    w.addEventListener('focusin', () => { if (innerWidth >= 760) void mostrarMini(w); });
    w.addEventListener('focusout', ocultarMini);
    w.addEventListener('click', ocultarMini);
  });
}

/* ---------- Silenciar jugadores (solo en este navegador) ---------- */
const leerSil = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem('apx-silenciados') || '[]')); } catch { return new Set(); } };
const guardarSil = (c: Set<string>) => { try { localStorage.setItem('apx-silenciados', JSON.stringify([...c])); } catch { /* sin storage */ } };

/* ---------- Chat libre ---------- */
let offChat: (() => void) | null = null;
let ultimoMsg = 0;
let msgsChat: any[] = [];
let yoChat = { uid: '', nombre: '' };
let sinLeer = 0;
const TITULO = document.title;
document.addEventListener('visibilitychange', () => { if (!document.hidden) { sinLeer = 0; document.title = TITULO; } });

function itemChat(m: any, uid: string, nombre: string): string {
  const limpio = nombre.replace(/[^\w]/g, '');
  const dirigido = !!limpio && m.uid !== uid && new RegExp(`@${limpio}(?!\\w)`, 'i').test(String(m.texto ?? ''));
  const txt = esc(m.texto ?? '').replace(/@(\w{2,20})/g, (x: string, n: string) => `<span class="men ${n.toLowerCase() === limpio.toLowerCase() ? 'yo' : ''}">${x}</span>`);
  return `<li class="msg ${m.uid === uid ? 'mio' : ''} ${dirigido ? 'mencion' : ''}"><button class="av jug" data-uid="${esc(m.uid ?? '')}" title="Ver jugador" aria-label="Ver jugador ${esc(m.nombre ?? '')}">${avatarHTML(m.avatar ?? '🙂', 'av-img')}</button>
    <div class="bub"><div class="quien-msg"><b>${esc(m.nombre ?? 'Alguien')}</b><time data-ms="${tms(m)}">${hace(tms(m))}</time></div><p>${txt}</p></div></li>`;
}
function pintarChat(primera = false) {
  const ul = document.querySelector<HTMLUListElement>('#chat'); if (!ul) return;
  const sil = leerSil();
  const ms = msgsChat.filter((m) => !sil.has(m.uid));
  const abajo = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 90;
  ul.innerHTML = ms.length ? ms.map((m) => itemChat(m, yoChat.uid, yoChat.nombre)).join('') : '<li class="vacio">Aún no hay mensajes. ¡Escribe el primero! 👋</li>';
  if (abajo || primera) ul.scrollTop = ul.scrollHeight;
}
function iniciarChat(uid: string, nombre: string) {
  offChat?.(); offChat = null;
  yoChat = { uid, nombre };
  const ul = document.querySelector<HTMLUListElement>('#chat')!;
  const f = document.querySelector<HTMLFormElement>('#chatf')!;
  const inp = f.querySelector<HTMLInputElement>('input')!;
  const err = document.querySelector<HTMLElement>('#chaterr')!;
  let primera = true;
  const vistosChat = new Set<string>();
  offChat = escucharChat((ms: any[] | null) => {
    if (!ms) { ul.innerHTML = '<li class="vacio">No se pudo cargar el chat. ¿Están publicadas las reglas de Firebase?</li>'; return; }
    const sil = leerSil();
    const nuevos = ms.filter((m) => !vistosChat.has(m.id) && m.uid !== uid && !sil.has(m.uid)).length;
    ms.forEach((m) => vistosChat.add(m.id));
    msgsChat = ms;
    pintarChat(primera);
    if (!primera && nuevos && document.hidden) { sinLeer += nuevos; document.title = `(${sinLeer}) ${TITULO}`; }
    primera = false;
  }, 50);
  document.querySelectorAll<HTMLButtonElement>('.chat-emojis .emo').forEach((b) => {
    b.onclick = () => {
      const e = b.dataset.e!;
      if (inp.value.length + e.length > 200) return;
      const i = inp.selectionStart ?? inp.value.length;
      inp.setRangeText(e, i, inp.selectionEnd ?? i, 'end');
      inp.focus();
    };
  });
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const t = inp.value.trim(); if (!t) return;
    if (Date.now() - ultimoMsg < 2500) { err.textContent = 'Espera un momento antes de enviar otro mensaje 🙂'; return; }
    err.textContent = ''; ultimoMsg = Date.now(); inp.value = '';
    try { await enviarMensaje(t); }
    catch { err.textContent = 'No se pudo enviar el mensaje. Inténtalo de nuevo.'; inp.value = t; ultimoMsg = 0; }
  };
}

/* ---------- En línea ahora ---------- */
let offLinea: (() => void) | null = null;
let relojLinea = 0;
function iniciarEnLinea() {
  offLinea?.(); clearInterval(relojLinea);
  const caja = document.querySelector<HTMLElement>('#enlinea')!;
  let lista: any[] = [];
  const pintar = () => {
    const vivos = lista.filter((x) => Date.now() - tms(x) < 3 * 60000);
    if (!vivos.length) { caja.hidden = true; return; }
    caja.hidden = false;
    const ver = vivos.slice(0, 10);
    caja.innerHTML = `<span class="pto" aria-hidden="true"></span><b>${vivos.length} en línea</b>
      <span class="en-avs">${ver.map((x) => `<button class="av jug" data-uid="${esc(x.uid)}" title="${esc(x.nombre ?? '')} · ${esc((NOMBRE_JUEGO as Record<string, string>)[x.donde] ?? 'Apexora')}" aria-label="Ver jugador ${esc(x.nombre ?? '')}">${avatarHTML(x.avatar ?? '🙂', 'av-img')}</button>`).join('')}</span>
      ${vivos.length > ver.length ? `<small>+${vivos.length - ver.length}</small>` : ''}`;
  };
  offLinea = escucharEnLinea((l: any[] | null) => { lista = l ?? []; pintar(); });
  relojLinea = window.setInterval(pintar, 30000);
}

/* ---------- Clasificación ---------- */
type RankPerfil = { streak?: { best?: number }; fragmentos?: { comun?: number } };
const CAMPO: Record<string, string> = { rachas: 'streak.best', cristales: 'fragmentos.comun' };
const UNIDAD: Record<string, string> = { rachas: '🔥', cristales: '💎', actividad: 'pts' };
const MEDALLA = ['🥇', '🥈', '🥉'];
const cacheRank: Record<string, { t: number; filas: Fila[] }> = {};
async function filasRank(tipo: string): Promise<Fila[]> {
  const c = cacheRank[tipo]; if (c && Date.now() - c.t < 45000) return c.filas;
  let filas: Fila[];
  if (tipo === 'actividad') {
    const cuenta = new Map<string, Fila>();
    for (const e of await actividadCache()) {
      const d = e.datos ?? {};
      const pts = e.tipo === 'duelo' ? 3 : e.tipo === 'reto' ? (d.gano ? 2 : 0) : e.tipo === 'sobre' ? 1 : 0;
      if (!pts) continue;
      const f = cuenta.get(e.uid) ?? { uid: e.uid, nombre: String(e.nombre ?? 'Alguien'), avatar: String(e.avatar ?? '🙂'), n: 0 };
      f.n += pts; cuenta.set(e.uid, f);
    }
    filas = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  } else {
    const r = await rankingPor(CAMPO[tipo], 10);
    const pf = (await perfilesPublicos(r.map((x: any) => x.uid))) as Record<string, { name?: string; avatar?: string }>;
    filas = r.map((x: any) => ({ uid: x.uid, nombre: String(pf[x.uid]?.name ?? x.nombre ?? 'Alguien'), avatar: String(pf[x.uid]?.avatar ?? '🙂'), n: x.valor }));
  }
  cacheRank[tipo] = { t: Date.now(), filas };
  return filas;
}
let tipoRank = 'rachas';
async function pintarRank(uid: string, p: RankPerfil) {
  const ol = document.querySelector<HTMLOListElement>('#rank'), pie = document.querySelector<HTMLElement>('#tupuesto');
  if (!ol || !pie) return;
  const tipo = tipoRank;
  let filas: Fila[] = [];
  try { filas = await filasRank(tipo); } catch { if (tipo === tipoRank) ol.innerHTML = '<li class="vacio">No se pudo cargar la clasificación.</li>'; return; }
  if (tipo !== tipoRank) return;                               // cambió de pestaña mientras cargaba
  ol.innerHTML = filas.length ? filas.map((f, i) => `<li class="${f.uid === uid ? 'yo' : ''}">
      <span class="pos">${MEDALLA[i] ?? i + 1}</span>
      <button class="fila jug" data-uid="${esc(f.uid)}"><span class="av">${avatarHTML(f.avatar, 'av-img')}</span><span class="nm">${esc(f.nombre)}</span></button>
      <b>${f.n} <small>${UNIDAD[tipo]}</small></b></li>`).join('') : '<li class="vacio">Aún no hay datos. ¡Sé el primero! ✨</li>';
  const i = filas.findIndex((f) => f.uid === uid);
  if (tipo === 'actividad') { pie.textContent = i >= 0 ? `Vas #${i + 1} · victoria en Cartas 3 pts, reto superado 2, sobre 1` : 'Gana partidas, supera retos y abre sobres para entrar · victoria 3 pts, reto 2, sobre 1'; return; }
  if (i >= 0) { pie.textContent = `Tu puesto: #${i + 1}`; return; }
  const mio = tipo === 'rachas' ? p.streak?.best ?? 0 : p.fragmentos?.comun ?? 0;
  pie.textContent = '';
  try { const n = await miPuesto(CAMPO[tipo], mio); if (tipo === tipoRank) pie.textContent = `Tu puesto: #${n}`; } catch { /* sin permiso para contar */ }
}
function iniciarRank(uid: string, p: RankPerfil) {
  tipoRank = 'rachas';
  document.querySelectorAll<HTMLButtonElement>('.tabs .chip').forEach((b) => {
    b.onclick = () => {
      tipoRank = b.dataset.r!;
      document.querySelectorAll('.tabs .chip').forEach((x) => x.classList.toggle('on', x === b));
      void pintarRank(uid, p);
    };
  });
  void pintarRank(uid, p);
}

/* ---------- Tarjeta de jugador ---------- */
let tarjeta: HTMLDialogElement | null = null;
async function abrirTarjeta(uid: string) {
  if (!tarjeta) {
    tarjeta = document.createElement('dialog'); tarjeta.className = 'tj';
    tarjeta.addEventListener('click', (e) => { if (e.target === tarjeta) tarjeta!.close(); });
    document.body.appendChild(tarjeta);
  }
  const t = tarjeta;
  t.innerHTML = '<button class="x" aria-label="Cerrar">✕</button><p class="mini-vacio">Cargando jugador…</p>';
  t.querySelector<HTMLButtonElement>('.x')!.onclick = () => t.close();
  if (!t.open) t.showModal();
  const j = await perfilJugador(uid).catch(() => null);
  if (!t.open) return;
  if (!j) { t.innerHTML = '<button class="x" aria-label="Cerrar">✕</button><p class="mini-vacio">No se pudo cargar este jugador.</p>'; t.querySelector<HTMLButtonElement>('.x')!.onclick = () => t.close(); return; }
  await cargarAvatares();
  const yo = uid === auth.currentUser?.uid, sil = leerSil().has(uid);
  const ids = j.logros as string[], cat = CATALOGO_LOGROS as Record<string, any>;
  const vis = Object.entries((j.stats?.visitas ?? {}) as Record<string, number>).filter(([, n]) => n > 0)
    .map(([k, n]) => `${esc((NOMBRE_JUEGO as Record<string, string>)[k] ?? k)} ${n}`).join(' · ');
  t.innerHTML = `<button class="x" aria-label="Cerrar">✕</button>
    <div class="tj-cab"><span class="av-tile grande">${avatarHTML(j.avatar, 'av-img')}</span><h3>${esc(j.nombre)}${yo ? ' <small>(tú)</small>' : ''}</h3><p class="rango">${rango(ids.length)}</p></div>
    <dl class="tj-dat">
      <div><dt>Racha</dt><dd>${j.streak.current ?? 0} 🔥</dd></div><div><dt>Mejor racha</dt><dd>${j.streak.best ?? 0}</dd></div>
      <div><dt>Logros</dt><dd>${ids.length}/${Object.keys(cat).length}</dd></div><div><dt>Sinfalita</dt><dd>${j.fragmentos.comun ?? 0}</dd></div>
    </dl>
    <div class="tj-logros">${ids.map((id) => `<span title="${esc(cat[id]?.nombre ?? id)}">${esc(cat[id]?.icono ?? '🏅')}</span>`).join('') || '<small>Todavía sin logros</small>'}</div>
    ${vis ? `<p class="tj-vis">Visitas: ${vis}</p>` : ''}
    ${yo ? '' : `<div class="acciones"><button class="primario" id="tj-men">Mencionar en el chat</button><button class="btn-ghost" id="tj-sil">${sil ? 'Dejar de silenciar' : 'Silenciar en el chat'}</button></div>`}`;
  t.querySelector<HTMLButtonElement>('.x')!.onclick = () => t.close();
  t.querySelector<HTMLButtonElement>('#tj-men')?.addEventListener('click', () => {
    const inp = document.querySelector<HTMLInputElement>('#chatf input');
    t.close();
    if (!inp) return;
    const m = `@${String(j.nombre).replace(/[^\w]/g, '')} `;
    if (inp.value.length + m.length <= 200) inp.value += m;
    inp.focus();
  });
  t.querySelector<HTMLButtonElement>('#tj-sil')?.addEventListener('click', () => {
    const c = leerSil(); if (c.has(uid)) c.delete(uid); else c.add(uid);
    guardarSil(c); t.close(); pintarChat();
  });
}
app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-uid]');
  if (el?.dataset.uid && auth.currentUser) void abrirTarjeta(el.dataset.uid);
});

function detener() { ocultarMini(); tarjeta?.close(); offLinea?.(); offLinea = null; clearInterval(relojLinea); detenerFeed(); offFrag?.(); offFrag = null; offChat?.(); offChat = null; limpiar(); }

/* ---------- Arranque ---------- */
let ocupado = false;
onSesion(async (u: object | null) => {
  if (!u || !(u as { email?: string | null }).email?.endsWith('@apexora-sala.app')) { detener(); try { sessionStorage.removeItem('apx-quien'); } catch { /* */ } vistaLogin(); return; }
  if (ocupado) return;
  ocupado = true;
  try {
    await registrarVisita();
    const volver = new URLSearchParams(location.search).get('volver');
    if (volver && volver.startsWith(location.origin)) { location.href = volver; return; }
    const { nombre, avatar } = await datosPerfil();
    let visto = false;
    try { visto = !!sessionStorage.getItem('apx-quien'); sessionStorage.setItem('apx-quien', '1'); } catch { /* sin storage */ }
    if (visto) await vistaPanel(); else vistaQuien(nombre, avatar);
  } catch (e) {
  console.error(e);
  const x = e as { code?: string; message?: string };
  app.innerHTML = `<p class="cargando">No se pudo conectar.<br><small>${esc(x.code ?? x.message ?? e)}</small></p>
    <p class="cargando"><button class="enlace" id="salir2">Salir</button></p>`;
  document.querySelector<HTMLButtonElement>('#salir2')!.onclick = () => cerrarSesion();
}
  finally { ocupado = false; }
});
