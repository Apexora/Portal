/* Portal Apexora · login + perfil + tablas (módulo; index.html ya lo carga al final) */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, getDocs, collection }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ⚠ PEGÁ ACÁ EL MISMO firebaseConfig QUE USAN LAS OTRAS PÁGINAS (mismo apiKey = misma sesión compartida) */
const firebaseConfig = {
  apiKey: "AIzaSyAsw466_wzsiLtbjw6FXZ1_O3HQ_AkVyU8",
  authDomain: "album-apexora.firebaseapp.com",
  projectId: "album-apexora",
  appId: "1:17231648284:web:20edb8477453f50473f1d9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DOMAIN = '@apexora-sala.app';
const AVATARS = ['🦊', '🐺', '🦉', '🐲', '🦅', '🐻', '🦁', '🐙'];
const isPerfil = u => !!(u && u.email && u.email.endsWith(DOMAIN));
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dayIdx = () => { const n = new Date(); return Math.floor((n.getTime() - n.getTimezoneOffset() * 60000) / 86400000); };
const pretty = k => k.replace(/[_-]+/g, ' ');
const ERR = {
  'auth/invalid-credential': 'Contraseña incorrecta',
  'auth/wrong-password': 'Contraseña incorrecta',
  'auth/email-already-in-use': 'Ese nombre ya está en uso',
  'auth/weak-password': 'Mínimo 6 caracteres',
  'auth/too-many-requests': 'Demasiados intentos, esperá un momento',
  'auth/network-request-failed': 'Sin conexión'
};
const msg = e => ERR[e.code] || ('Error: ' + (e.code || e.message));

/* ---------- DOM helper (todo con textContent: los nombres los escribe cualquiera) ---------- */
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else e.setAttribute(n, v);
  }
  k.flat().filter(c => c != null && c !== false).forEach(c => e.append(c));
  return e;
};

/* ---------- estilos ---------- */
document.head.append(h('style', {}, `
.pf-chip{position:fixed;z-index:30;top:calc(14px + env(safe-area-inset-top,0px));right:16px;display:flex;align-items:center;gap:.5em;
  font-family:var(--titulo);font-size:1.05rem;letter-spacing:.05em;color:#fff;background:rgba(10,18,45,.7);border:1px solid rgba(241,246,240,.5);
  border-radius:999px;padding:.4em 1em;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pf-chip:hover{background:var(--rosa);border-color:var(--rosa)}
.pf-chip b{font-weight:400;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-chip i{font-style:normal;font-family:var(--texto);font-weight:700}
.pf-ov{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(10,18,45,.72);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pf-ov.on{display:flex}
.pf-card{position:relative;width:min(560px,100%);max-height:calc(100% - 16px);overflow:auto;background:var(--noche);color:var(--hielo);
  border:1px solid rgba(241,246,240,.25);border-radius:18px;padding:22px 20px;font-family:var(--texto);font-size:1.15rem;font-weight:600}
.pf-card h3{font-family:var(--titulo);font-weight:400;font-size:1.7rem;letter-spacing:.05em;text-align:center;margin-bottom:.6em}
.pf-x{position:absolute;top:10px;right:12px;background:none;border:0;color:var(--hielo);font-size:1.5rem;cursor:pointer;line-height:1}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:12px}
.pf-btn,.pf-pick{font:inherit;color:var(--hielo);background:rgba(241,246,240,.08);border:1px solid rgba(241,246,240,.3);border-radius:12px;padding:.6em .8em;cursor:pointer}
.pf-btn:hover,.pf-pick:hover{background:rgba(241,246,240,.18)}
.pf-pick{display:flex;flex-direction:column;align-items:center;gap:.2em}
.pf-pick .av,.pf-chip .av{font-size:1.6rem;line-height:1}
.pf-chip .av{font-size:1.2rem}
.pf-main{background:var(--rosa);border-color:var(--rosa);font-family:var(--titulo);letter-spacing:.06em;width:100%;margin-top:6px}
.pf-main:disabled{opacity:.55;cursor:wait}
.pf-in{width:100%;font:inherit;color:var(--noche);background:var(--hielo);border:0;border-radius:10px;padding:.6em .8em;margin:4px 0 10px}
.pf-err{color:#ffb4a8;text-align:center;min-height:1.4em;margin:.3em 0}
.pf-link{display:block;margin:10px auto 0;background:none;border:0;color:var(--cielo);font:inherit;cursor:pointer;text-decoration:underline}
.pf-avs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.pf-avs button{font-size:1.5rem;background:rgba(241,246,240,.08);border:2px solid transparent;border-radius:10px;padding:.1em .3em;cursor:pointer}
.pf-avs button.on{border-color:var(--naranja)}
.pf-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:14px}
.pf-tabs button{font-family:var(--titulo);letter-spacing:.05em;font-size:1rem;color:var(--hielo);background:none;border:1px solid rgba(241,246,240,.3);border-radius:999px;padding:.3em .9em;cursor:pointer}
.pf-tabs button.on{background:var(--hielo);color:var(--noche)}
.pf-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.pf-stat{background:rgba(241,246,240,.08);border-radius:12px;padding:.7em;text-align:center}
.pf-stat b{display:block;font-family:var(--titulo);font-weight:400;font-size:2rem}
.pf-stat small{font-size:.95rem;opacity:.85}
.pf-tw{overflow-x:auto}
.pf-card table{width:100%;border-collapse:collapse;font-size:1rem}
.pf-card th,.pf-card td{text-align:left;padding:.4em .5em;border-bottom:1px solid rgba(241,246,240,.15);vertical-align:top}
.pf-card th{font-family:var(--titulo);font-weight:400;letter-spacing:.04em;opacity:.8}
.pf-card tr.me td{background:rgba(249,91,69,.22)}
.pf-chips em{display:inline-block;font-style:normal;font-size:.85rem;background:rgba(73,195,229,.22);border-radius:999px;padding:.05em .6em;margin:0 4px 4px 0}
.pf-note{text-align:center;font-size:.9rem;opacity:.7;margin-top:8px}
`));

/* ---------- estado ---------- */
let me = null, prof = null, pd = null;          // usuario, perfil público, doc players/{uid}
let view = 'auto', mode = 'pick', picked = null, tab = 'cuenta', err = '', busy = false, registering = false;
let profiles = null, board = null, boardT = 0, newAv = AVATARS[0];

/* ---------- shell ---------- */
const chip = h('button', { class: 'pf-chip', onclick: () => openM() });
const card = h('div', { class: 'pf-card', role: 'dialog', 'aria-modal': 'true' });
const ov = h('div', { class: 'pf-ov' }, card);
document.body.append(chip, ov);
ov.addEventListener('click', e => { if (e.target === ov) closeM(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeM(); });

function openM(v) {
  ov.classList.add('on'); err = ''; view = v || 'auto';
  if (view === 'rank') { tab = tab === 'cuenta' ? 'rachas' : tab; loadBoard(); }
  else if (!me) { mode = 'pick'; picked = null; if (!profiles) loadProfiles(); }
  paint();
}
function closeM() { ov.classList.remove('on'); }

function paintChip() {
  chip.replaceChildren();
  if (me && prof) chip.append(h('span', { class: 'av' }, prof.avatar || '🙂'), h('b', {}, prof.name), pd && pd.streak ? h('i', {}, '🔥 ' + (pd.streak.current || 0)) : null);
  else chip.append('Entrar');
}

/* ---------- vistas ---------- */
function paint() {
  card.replaceChildren(h('button', { class: 'pf-x', 'aria-label': 'Cerrar', onclick: closeM }, '×'));
  card.append(view === 'rank' ? viewRank() : me ? viewAccount() : viewLogin());
}

function viewLogin() {
  const box = h('div');
  if (mode === 'pick') {
    box.append(h('h3', {}, '¿Quién juega?'));
    if (!profiles) box.append(h('p', { class: 'pf-note' }, 'Cargando perfiles…'));
    else box.append(h('div', { class: 'pf-grid' }, profiles.map(p =>
      h('button', { class: 'pf-pick', onclick: () => { picked = p; mode = 'pass'; err = ''; paint(); } },
        h('span', { class: 'av' }, p.avatar || '🙂'), h('span', {}, p.name)))));
    box.append(h('button', { class: 'pf-btn pf-main', onclick: () => { mode = 'new'; err = ''; paint(); } }, '+ Nuevo perfil'));
  } else if (mode === 'pass') {
    const pw = h('input', { class: 'pf-in', type: 'password', placeholder: 'Contraseña', autocomplete: 'current-password' });
    const go = () => login(picked, pw.value);
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    box.append(h('h3', {}, (picked.avatar || '🙂') + ' ' + picked.name), pw,
      h('button', { class: 'pf-btn pf-main', disabled: busy ? '' : null, onclick: go }, busy ? 'Entrando…' : 'Entrar'),
      h('button', { class: 'pf-link', onclick: () => { mode = 'pick'; err = ''; paint(); } }, 'Cambiar de perfil'));
    setTimeout(() => pw.focus(), 30);
  } else {
    const nm = h('input', { class: 'pf-in', placeholder: 'Nombre (2 a 24 letras)', maxlength: '24', autocomplete: 'username' });
    const pw = h('input', { class: 'pf-in', type: 'password', placeholder: 'Contraseña (mín. 6)', autocomplete: 'new-password' });
    const avs = h('div', { class: 'pf-avs' }, AVATARS.map(a => h('button', {
      type: 'button', class: a === newAv ? 'on' : '',
      onclick: e => { newAv = a; avs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); }
    }, a)));
    box.append(h('h3', {}, 'Nuevo perfil'), nm, avs, pw,
      h('button', { class: 'pf-btn pf-main', disabled: busy ? '' : null, onclick: () => register(nm.value, newAv, pw.value) }, busy ? 'Creando…' : 'Crear y entrar'),
      h('button', { class: 'pf-link', onclick: () => { mode = 'pick'; err = ''; paint(); } }, 'Volver'));
  }
  box.append(h('div', { class: 'pf-err' }, err));
  return box;
}

function viewAccount() {
  const tabs = h('div', { class: 'pf-tabs' }, [['cuenta', 'Cuenta'], ['logros', 'Logros'], ['rachas', 'Rachas']].map(([k, t]) =>
    h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; paint(); if (k !== 'cuenta') loadBoard(); } }, t)));
  const body = h('div');
  if (tab === 'cuenta') {
    const st = (pd && pd.streak) || {}, fr = (pd && pd.fragmentos) || {};
    body.append(
      h('div', { class: 'pf-stats' },
        stat('🔥 ' + (st.current || 0), 'Racha actual'), stat(st.best || st.current || 0, 'Mejor racha'),
        stat(fr.comun || 0, 'Fragmentos comunes'), stat(fr.rara || 0, 'Fragmentos raros')),
      h('button', { class: 'pf-link', onclick: () => signOut(auth) }, 'Salir'));
  } else body.append(rankBody());
  return h('div', {}, h('h3', {}, (prof.avatar || '🙂') + ' ' + prof.name), tabs, body, h('div', { class: 'pf-err' }, err));
}
function rankBody() {
  if (!board) return h('p', { class: 'pf-note' }, err || 'Cargando…');
  if (tab === 'logros') {
    const rows = board.map(p => ({ p, k: Object.keys(p.logros || {}) })).sort((a, b) => b.k.length - a.k.length || a.p.nombre.localeCompare(b.p.nombre));
    return h('div', {}, table(['Jugador', '#', 'Logros'], rows.map(r => ({ me: me && r.p.id === me.uid,
      c: [r.p.nombre, String(r.k.length), h('span', { class: 'pf-chips' }, r.k.map(k => h('em', {}, pretty(k))))] }))),
      h('p', { class: 'pf-note' }, 'Vista temporal'));
  }
  const rows = board.slice().sort((a, b) => (b.streak.current || 0) - (a.streak.current || 0) || (b.streak.best || 0) - (a.streak.best || 0));
  return table(['#', 'Jugador', '🔥 Actual', 'Mejor'], rows.map((p, i) => ({ me: me && p.id === me.uid,
    c: [String(i + 1), p.nombre, String(p.streak.current || 0), String(p.streak.best || p.streak.current || 0)] })));
}
function viewRank() {
  const t = h('div', { class: 'pf-tabs' }, [['rachas', '🔥 Rachas'], ['logros', 'Logros']].map(([k, l]) =>
    h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; paint(); } }, l)));
  return h('div', {}, h('h3', {}, 'Rankings'), t, rankBody(),
    h('button', { class: 'pf-link', onclick: () => { view = 'auto'; mode = 'pick'; err = ''; if (!me && !profiles) loadProfiles(); paint(); } }, me ? 'Mi cuenta' : 'Entrar con mi perfil'));
}
const stat = (n, l) => h('div', { class: 'pf-stat' }, h('b', {}, String(n)), h('small', {}, l));
const table = (head, rows) => h('div', { class: 'pf-tw' }, h('table', {},
  h('thead', {}, h('tr', {}, head.map(t => h('th', {}, t)))),
  h('tbody', {}, rows.map(r => h('tr', { class: r.me ? 'me' : '' }, r.c.map(c => h('td', {}, c)))))));

/* ---------- datos ---------- */
async function loadProfiles() {
  try {
    const s = await getDocs(collection(db, 'apexora_profiles'));
    profiles = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.name && p.login).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) { profiles = []; err = 'No se pudieron cargar los perfiles'; }
  if (ov.classList.contains('on') && !me) paint();
}

async function loadBoard() {
  if (!board || Date.now() - boardT > 60000) {
    try {
      const s = await getDocs(collection(db, 'players'));
      // la colección también tiene los docs del álbum: solo entran los que tienen nombre + streak{}
      board = s.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => typeof p.nombre === 'string' && p.streak && typeof p.streak === 'object');
      boardT = Date.now();
    } catch (e) { err = 'No se pudo cargar el ranking'; console.warn(e); }
  }
  paint();
}

/* sesión: crea players/{uid} si falta y sube la racha una vez por día */
async function sync(u) {
  me = isPerfil(u) ? u : null;            // los anónimos de otras páginas cuentan como "sin login"
  if (!me) { prof = pd = null; board = null; paintChip(); if (ov.classList.contains('on')) paint(); return; }
  try {
    const ps = await getDoc(doc(db, 'apexora_profiles', me.uid));
    prof = ps.exists() ? ps.data() : { name: me.email.split('@')[0], avatar: '🙂' };
    const ref = doc(db, 'players', me.uid), s = await getDoc(ref), today = dayIdx();
    if (!s.exists()) {
      pd = { nombre: prof.name, streak: { current: 1, best: 1, lastDay: today }, fragmentos: { comun: 0, rara: 0 }, logros: {} };
      await setDoc(ref, pd);
    } else {
      pd = s.data();
      const st = pd.streak || {};
      if ((st.lastDay || 0) < today) {
        const cur = st.lastDay === today - 1 ? (st.current || 0) + 1 : 1, best = Math.max(st.best || 0, cur);
        await updateDoc(ref, { 'streak.current': cur, 'streak.best': best, 'streak.lastDay': today });
        pd.streak = { ...st, current: cur, best, lastDay: today };
      }
    }
  } catch (e) { console.warn('sync', e); err = 'No se pudo sincronizar tu progreso'; }
  paintChip();
  if (ov.classList.contains('on')) { tab = 'cuenta'; paint(); }
}
onAuthStateChanged(auth, u => { if (!registering) sync(u); });

/* ---------- acciones ---------- */
async function login(p, pw) {
  if (!pw) { err = 'Escribí la contraseña'; return paint(); }
  busy = true; err = ''; paint();
  try { await signInWithEmailAndPassword(auth, p.login, pw); closeM(); } catch (e) { err = msg(e); }
  busy = false; if (ov.classList.contains('on')) paint();
}

async function register(name, avatar, pw) {
  name = name.trim().replace(/\s+/g, ' ');
  const email = slug(name) + DOMAIN;
  if (name.length < 2 || name.length > 24 || slug(name).length < 2) { err = 'Nombre de 2 a 24 caracteres'; return paint(); }
  busy = true; err = ''; registering = true; paint();
  try {
    const c = await createUserWithEmailAndPassword(auth, email, pw);
    await setDoc(doc(db, 'apexora_profiles', c.user.uid), { name, avatar, login: email, created: Date.now() });
    profiles = null;
    registering = false; busy = false;
    await sync(auth.currentUser); closeM();
  } catch (e) { err = msg(e); registering = false; busy = false; paint(); }
}

/* ---------- compuerta: sin login no se entra a ninguna de las 4 páginas ---------- */
document.querySelectorAll('.panel').forEach(a => a.addEventListener('click', e => {
  if (!me) { e.preventDefault(); openM(); }
}));
// al apretar "Comenzar" sin sesión, pedir el login apenas arranca el menú
document.getElementById('go')?.addEventListener('click', () => setTimeout(() => { if (!me) openM(); }, 1300));

const hero = document.getElementById('hero');
if (hero) hero.append(
  h('style', {}, `.pf-rank{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(6% + 4.6rem + env(safe-area-inset-bottom,0px));z-index:3;
    font-family:var(--titulo);font-size:1.05rem;letter-spacing:.12em;color:#fff;background:rgba(10,18,45,.5);border:1px solid rgba(255,255,255,.6);
    border-radius:999px;padding:.5em 1.6em;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
    .pf-rank:hover{background:var(--hielo);color:var(--rosa)}`),
  h('button', { class: 'pf-rank', onclick: () => openM('rank') }, 'Rankings'));
paintChip();
