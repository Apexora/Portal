import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, runTransaction, updateDoc, increment,
  serverTimestamp, collection, query, orderBy, limit, getDocs, onSnapshot, addDoc, where, Timestamp, getCountFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsw466_wzsiLtbjw6FXZ1_O3HQ_AkVyU8",
  authDomain: "album-apexora.firebaseapp.com",
  projectId: "album-apexora",
  appId: "1:17231648284:web:20edb8477453f50473f1d9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const CATALOGO_LOGROS = {
  // Los logros dan solo Sinfalita (y poca). La Odita ya no sale de logros.
  // Portal
  primera_visita:       { nombre: "Primer paso",   desc: "Entraste a Apexora",              icono: "🌱", juego: "portal", premio: { comun: 5 } },
  racha_3:              { nombre: "Constante",     desc: "3 días seguidos",                 icono: "🔥", juego: "portal", premio: { comun: 10 } },
  racha_7:              { nombre: "Una semana",    desc: "7 días seguidos",                 icono: "⚡", juego: "portal", premio: { comun: 20 } },
  racha_30:             { nombre: "Leyenda viva",  desc: "30 días seguidos",                icono: "👑", juego: "portal", premio: { comun: 50 } },
  // Cartas Alfa
  tcg_primera_victoria: { nombre: "Primer duelo",  desc: "Gana una partida de Cartas Alfa", icono: "⚔️", juego: "tcg",    premio: { comun: 10 } },
  tcg_10_victorias:     { nombre: "Duelista",      desc: "10 victorias en Cartas Alfa",     icono: "🏆", juego: "tcg",    premio: { comun: 30 } },
  // Sala de Desafíos
  sala_primer_reto:     { nombre: "Desafiante",    desc: "Completa tu primer reto",         icono: "🎯", juego: "sala",   premio: { comun: 10 } },
  // Álbum
  album_primer_sobre:   { nombre: "Coleccionista", desc: "Abre tu primer sobre",            icono: "📖", juego: "album",  premio: { comun: 10 } },
};

/* Migración única: quita la Odita que los jugadores ya recibieron por logros (los premios de antes).
   Solo cuenta logros desbloqueados antes de CORTE_ODITA — pon aquí la fecha en que publiques este cambio.
   Si las rules de Firestore no dejan bajar fragmentos.rara, falla en silencio y se reintenta en la próxima visita. */
const CORTE_ODITA = Date.UTC(2026, 9, 18);
const ODITA_QUE_DABAN = { racha_7: 1, racha_30: 5, tcg_10_victorias: 1 };
async function quitarOditaDeLogros() {
  const marca = "apx-sinodita-" + (auth.currentUser?.uid ?? "");
  try { if (localStorage.getItem(marca) || sessionStorage.getItem(marca)) return; sessionStorage.setItem(marca, "1"); } catch { /* sin storage */ }
  try {
    const ref = refJugador();
    await runTransaction(db, async (tx) => {
      const x = (await tx.get(ref)).data();
      if (!x || x.migr?.sinOditaLogros) { try { localStorage.setItem(marca, "1"); } catch { /* */ } return; }
      let n = 0;
      for (const [id, o] of Object.entries(ODITA_QUE_DABAN)) {
        const f = x.logros?.[id]?.fecha;
        if (f && (f.toMillis?.() ?? 0) < CORTE_ODITA) n += o;
      }
      tx.update(ref, { "fragmentos.rara": Math.max(0, (x.fragmentos?.rara ?? 0) - n), "migr.sinOditaLogros": true });
    });
    try { localStorage.setItem(marca, "1"); } catch { /* */ }
  } catch { /* se reintenta en la próxima visita */ }
}

const DOMINIO = "@apexora-sala.app";
const COL = "apexora_players";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const ayer = (d) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
const aMail = (u) => {
  u = u.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) throw { code: "auth/usuario-invalido" };
  return u + DOMINIO;
};
const refJugador = () => doc(db, COL, auth.currentUser.uid);

/* ---------- Sesión ---------- */
export const onSesion = (cb) => onAuthStateChanged(auth, cb);
export const iniciarSesion = (u, c) => signInWithEmailAndPassword(auth, aMail(u), c);
export const cerrarSesion = () => signOut(auth);
export async function registrar(u, c, avatar = "🙂") {
  const cred = await createUserWithEmailAndPassword(auth, aMail(u), c);
  await setDoc(doc(db, "apexora_profiles", cred.user.uid),
    { name: u.trim(), avatar, login: cred.user.email, created: Date.now() });
  return cred;
}

/** Para las demás páginas: exige cuenta Apexora, si no manda al Portal. */
export function requerirUsuario(portal = "/Portal/") {
  return new Promise((res) => {
    const off = onAuthStateChanged(auth, async (u) => {
      off();
      if (u?.email?.endsWith(DOMINIO)) { await registrarVisita(); contarVisitaPagina(); iniciarPresencia(juegoDePagina()); res(u); }
      else location.href = portal + "?volver=" + encodeURIComponent(location.href);
    });
  });
}

/* ---------- Racha + creación del perfil ---------- */
export async function registrarVisita() {
  const u = auth.currentUser; if (!u) return null;
  const ref = doc(db, COL, u.uid), dia = hoy();
  const d = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) {
      const nuevo = {
        nombre: u.email.split("@")[0],
        streak: { current: 1, best: 1, lastDay: dia },
        logros: {}, fragmentos: { comun: 0, rara: 0 }, stats: {},
        cupo: { dia, comun: 0 },
        creado: serverTimestamp(), ts: serverTimestamp(), tn: serverTimestamp(),
      };
      tx.set(ref, nuevo); return nuevo;
    }
    const x = s.data(), st = x.streak;
    if (st.lastDay === dia) return x;
    const cur = st.lastDay === ayer(dia) ? st.current + 1 : 1;
    const streak = { current: cur, best: Math.max(st.best, cur), lastDay: dia };
    tx.update(ref, { streak });
    return { ...x, streak };
  });
  const r = d.streak.current;
  await quitarOditaDeLogros();
  await desbloquearLogro("primera_visita");
  if (r >= 3)  await desbloquearLogro("racha_3");
  if (r >= 7)  await desbloquearLogro("racha_7");
  if (r >= 30) await desbloquearLogro("racha_30");
  return d;
}

/* ---------- Logros (igual que el tuyo) ---------- */
export async function desbloquearLogro(id) {
  const def = CATALOGO_LOGROS[id]; if (!auth.currentUser || !def) return false;
  const ref = refJugador();
  const ok = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists() || s.data().logros?.[id]) return false;
    const upd = { [`logros.${id}`]: { fecha: serverTimestamp(), juego: def.juego } };
    for (const [tipo, n] of Object.entries(def.premio || {})) upd[`fragmentos.${tipo}`] = increment(n);
    tx.update(ref, upd);
    return true;
  });
  if (ok) registrarActividad(def.juego, "logro", { nombre: def.nombre, icono: def.icono });
  return ok;
}

/* ---------- Cristales ----------
   comun = Sinfalita, rara = Odita.
   premiar(): úsalo al terminar una partida. Máx 60 por premio y 300 por día;
   la rara solo puede salir una vez cada 6 h. Devuelve lo que realmente se dio. */
export async function premiar(comun, probRara = 0) {
  try {
    const ref = refJugador();
    return await runTransaction(db, async (tx) => {
      const x = (await tx.get(ref)).data(), dia = hoy();
      const previo = x.cupo?.dia === dia ? x.cupo.comun : 0;
      const gan = Math.max(0, Math.min(comun, 60, 300 - previo));
      const tnMs = x.tn?.toMillis?.() ?? 0;
      const rara = Date.now() - tnMs > 6 * 3600e3 + 5000 && Math.random() < probRara ? 1 : 0;
      if (!gan && !rara) return { comun: 0, rara: 0 };
      tx.update(ref, {
        "fragmentos.comun": x.fragmentos.comun + gan,
        "fragmentos.rara": x.fragmentos.rara + rara,
        cupo: { dia, comun: previo + gan },
        ts: serverTimestamp(),
        ...(rara ? { tn: serverTimestamp() } : {}),
      });
      return { comun: gan, rara };
    });
  } catch { return { comun: 0, rara: 0 }; }
}

export async function gastarFragmentos(tipo, n) {
  const ref = refJugador();
  return runTransaction(db, async (tx) => {
    const f = (await tx.get(ref)).data().fragmentos;
    if (f[tipo] < n) return false;
    tx.update(ref, { [`fragmentos.${tipo}`]: f[tipo] - n });
    return true;
  });
}

export const sumarStat = (juego, clave, n = 1) =>
  updateDoc(refJugador(), { [`stats.${juego}.${clave}`]: increment(n) });

export async function obtenerPerfil() {
  if (!auth.currentUser) return null;
  const s = await getDoc(refJugador());
  return s.exists() ? s.data() : null;
}
export async function ranking(n = 10) {
  const q = query(collection(db, COL), orderBy("streak.best", "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Enlaza esta cuenta Apexora con la identidad propia de un juego (p. ej. jugador del Álbum). */
export const vincular = (juego, id) =>
  updateDoc(refJugador(), { [`vinculos.${juego}`]: id });

/* ---------- Actividad de jugadores (feed del Portal) ----------
   Colección apexora_activity: un documento por evento. Solo se crean (las rules no permiten editar ni borrar).
   El texto se arma en el cliente con describirActividad(): nunca se guarda HTML. */
const COL_ACT = "apexora_activity";
let _yo = null;
async function quienSoy() {
  const u = auth.currentUser; if (!u) return null;
  if (_yo && _yo.uid === u.uid) return _yo;
  let nombre = u.email.split("@")[0], avatar = "🙂";
  try {
    const s = await getDoc(doc(db, "apexora_profiles", u.uid));
    if (s.exists()) { nombre = s.data().name || nombre; avatar = s.data().avatar || avatar; }
  } catch { /* se queda con lo básico */ }
  return (_yo = { uid: u.uid, nombre, avatar });
}

/** juego: "tcg" | "album" | "sala" | "portal"   tipo: "sobre" | "duelo" | "reto" | "logro"   datos: objeto chico (máx. 6 claves) */
export async function registrarActividad(juego, tipo, datos = {}) {
  try {
    const y = await quienSoy(); if (!y) return false;
    const limpio = {};
    for (const [k, v] of Object.entries(datos).slice(0, 6))
      limpio[k] = typeof v === "number" || typeof v === "boolean" ? v : String(v).slice(0, 40);
    await addDoc(collection(db, COL_ACT), {
      uid: y.uid, nombre: String(y.nombre).slice(0, 24), avatar: String(y.avatar).slice(0, 8),
      juego, tipo, datos: limpio, ts: serverTimestamp(),
    });
    return true;
  } catch { return false; }
}

export const NOMBRE_JUEGO = { tcg: "Cartas Alfa", album: "Álbum", sala: "Sala de Desafíos", portal: "Portal" };

/** Texto plano de un evento (el que lo pinte debe escaparlo). */
export function describirActividad(e) {
  const n = e.nombre || "Alguien", d = e.datos || {};
  switch (e.tipo) {
    case "sobre":  return `${n} abrió un sobre${d.sobre ? " " + d.sobre : ""}`;
    case "duelo":  return d.ia ? `${n} venció a la IA en Cartas Alfa`
                                : `${n} y ${d.rival || "un rival"} jugaron a Cartas Alfa y ganó ${n}`;
    case "reto":   return d.gano ? `${n} superó el reto «${d.modo}»` : `${n} intentó el reto «${d.modo}»`;
    case "logro":  return `${n} desbloqueó el logro «${d.nombre}» ${d.icono || ""}`.trim();
    default:       return `${n} anda por ${NOMBRE_JUEGO[e.juego] || "Apexora"}`;
  }
}

/** Escucha en vivo los últimos eventos de todos los jugadores. Devuelve la función para dejar de escuchar. */
export function escucharActividad(cb, n = 30) {
  const q = query(collection(db, COL_ACT), orderBy("ts", "desc"), limit(n));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

/** Escucha en vivo mis fragmentos y mi racha (el marcador). cb({ fragmentos, streak, ... }) */
export function escucharFragmentos(cb) {
  let off = () => {};
  const offAuth = onAuthStateChanged(auth, (u) => {
    off();
    if (u?.email?.endsWith(DOMINIO)) off = onSnapshot(doc(db, COL, u.uid), (s) => { if (s.exists()) cb(s.data()); }, () => {});
  });
  return () => { off(); offAuth(); };
}
const BASE_AV = import.meta.env.BASE_URL;   // "/Portal/"

/* ---------- Avatares de perfil ----------
   Las imágenes viven en /avatares (carpeta public del Portal). Al compilar se genera avatares.json con la lista.
   En el perfil se guarda solo el id (nombre del archivo sin extensión). Si el id no es una imagen (p. ej. un emoji
   de una cuenta vieja), se dibuja tal cual. Cualquier página puede usarlos:
     const { cargarAvatares, avatarHTML } = await import("https://apexora.github.io/Portal/apexora-core.js");
     await cargarAvatares();  el.innerHTML = avatarHTML(perfil.avatar);                                         */
const _escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _avs = null, _lista = [];
export function cargarAvatares() {
  return (_avs ||= fetch(BASE_AV + "avatares/avatares.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((l) => (_lista = Array.isArray(l) ? l : [])));
}
export const AVATARES_EMOJI = ["🦊", "🐺", "🦉", "🐉", "🦁", "🐙", "🦅", "🐢"];
/** Opciones para elegir: las imágenes subidas o, si todavía no hay ninguna, los emojis de siempre. */
export const opcionesAvatar = () => (_lista.length ? _lista : AVATARES_EMOJI.map((e) => ({ id: e, nombre: e })));
/** HTML del avatar (llama antes a `await cargarAvatares()`). `clase` se le pone a la <img> o al <span>. */
export function avatarHTML(id, clase = "apx-av") {
  const a = _lista.find((x) => x.id === id);
  if (a) return `<img class="${_escH(clase)}" src="${BASE_AV}avatares/${encodeURIComponent(a.archivo)}" alt="" loading="lazy" decoding="async">`;
  return `<span class="${_escH(clase)} apx-av--emoji">${_escH(id || "🙂")}</span>`;
}

/** Escucha en vivo mi perfil público (name, avatar). Devuelve la función para dejar de escuchar. */
export function escucharPerfil(cb) {
  let off = () => {};
  const offAuth = onAuthStateChanged(auth, (u) => {
    off();
    if (u?.email?.endsWith(DOMINIO)) off = onSnapshot(doc(db, "apexora_profiles", u.uid), (s) => { if (s.exists()) cb(s.data()); }, () => {});
  });
  return () => { off(); offAuth(); };
}
/** Cambia mi imagen de perfil (queda para todas las plataformas). */
export async function cambiarAvatar(id) {
  const u = auth.currentUser; if (!u) return false;
  await updateDoc(doc(db, "apexora_profiles", u.uid), { avatar: String(id).slice(0, 8) });
  _yo = null;
  return true;
}

/* ---------- Chat libre del Portal ----------
   Colección apexora_chat: un documento por mensaje (solo se crean; las rules no permiten editar ni borrar).
   El texto se guarda plano (máx. 200); quien lo pinte debe escaparlo. */
const COL_CHAT = "apexora_chat";
export async function enviarMensaje(texto) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t) return false;
  const y = await quienSoy(); if (!y) return false;
  await addDoc(collection(db, COL_CHAT), {
    uid: y.uid, nombre: String(y.nombre).slice(0, 24), avatar: String(y.avatar).slice(0, 8), texto: t, ts: serverTimestamp(),
  });
  return true;
}
/** cb(mensajes del más viejo al más nuevo) · cb(null) si falla (p. ej. rules sin publicar). */
export function escucharChat(cb, n = 50) {
  const q = query(collection(db, COL_CHAT), orderBy("ts", "desc"), limit(n));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()), () => cb(null));
}

/* ---------- Visitas por página y datos para la pantallita del Portal ----------
   Cada página que llame a requerirUsuario() suma 1 visita por sesión a stats.visitas.<juego> (según su ruta). */
const PAGINAS = { "/tcg/": "tcg", "/album/": "album", "/desafio/": "sala", "/lore/": "lore" };
const juegoDePagina = () => Object.entries(PAGINAS).find(([r]) => location.pathname.toLowerCase().startsWith(r))?.[1] ?? "portal";
async function contarVisitaPagina() {
  try {
    const ruta = location.pathname.toLowerCase();
    const j = Object.entries(PAGINAS).find(([r]) => ruta.startsWith(r))?.[1]; if (!j) return;
    const k = "apx-visita-" + j;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    await sumarStat("visitas", j);
  } catch { /* no es crítico */ }
}
/** Quién visita más una página: [{ uid, nombre, visitas }] */
export async function topVisitas(juego, n = 3) {
  const q = query(collection(db, COL), orderBy(`stats.visitas.${juego}`, "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ uid: d.id, nombre: d.data().nombre, visitas: d.data().stats?.visitas?.[juego] ?? 0 }));
}
/** Últimos eventos de todos los jugadores (una sola lectura) para armar rankings por juego. */
export async function actividadReciente(n = 300) {
  const q = query(collection(db, COL_ACT), orderBy("ts", "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** { uid: { name, avatar } } de perfiles públicos. */
export async function perfilesPublicos(uids) {
  const out = {};
  await Promise.all([...new Set(uids)].map(async (u) => {
    try { const s = await getDoc(doc(db, "apexora_profiles", u)); if (s.exists()) out[u] = { name: s.data().name, avatar: s.data().avatar }; } catch { /* sin perfil */ }
  }));
  return out;
}

/* ---------- Comunidad y competencia ---------- */
/** Ficha pública de un jugador (racha, logros, cristales, visitas). null si no se pudo leer. */
export async function perfilJugador(uid) {
  const [j, p] = await Promise.all([getDoc(doc(db, COL, uid)), getDoc(doc(db, "apexora_profiles", uid)).catch(() => null)]);
  if (!j.exists()) return null;
  const d = j.data(), pf = p && p.exists() ? p.data() : {};
  return { uid, nombre: pf.name || d.nombre || "Jugador", avatar: pf.avatar || "🙂",
    streak: d.streak ?? {}, logros: Object.keys(d.logros ?? {}), fragmentos: d.fragmentos ?? {}, stats: d.stats ?? {} };
}
/** Clasificación por un campo numérico de apexora_players (p. ej. "streak.best"). Solo valores > 0. */
export async function rankingPor(campo, n = 10) {
  const docs = (await getDocs(query(collection(db, COL), orderBy(campo, "desc"), limit(n)))).docs;
  const leer = (o) => campo.split(".").reduce((a, k) => a?.[k], o) ?? 0;
  return docs.map((d) => ({ uid: d.id, nombre: d.data().nombre, valor: leer(d.data()) })).filter((x) => x.valor > 0);
}
/** Puesto de alguien con `valor` en ese campo (1 = primero). */
export async function miPuesto(campo, valor) {
  const s = await getCountFromServer(query(collection(db, COL), where(campo, ">", valor)));
  return s.data().count + 1;
}

/* Presencia: cada ~90 s (con la pestaña visible) cada jugador renueva apexora_presence/{uid}. «En línea» = renovó hace < 3 min. */
const COL_PRES = "apexora_presence";
let _latido = 0;
export function iniciarPresencia(donde = "portal") {
  if (_latido) return;
  const latir = async () => {
    if (document.visibilityState !== "visible" || !auth.currentUser) return;
    try {
      const y = await quienSoy(); if (!y) return;
      await setDoc(doc(db, COL_PRES, y.uid), { nombre: String(y.nombre).slice(0, 24), avatar: String(y.avatar).slice(0, 8), donde: String(donde).slice(0, 8), ts: serverTimestamp() });
    } catch { /* no es crítico */ }
  };
  latir();
  _latido = setInterval(latir, 90000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") latir(); });
}
/** cb([{ uid, nombre, avatar, donde, ts }]) · cb(null) si falla. Filtra por ts en el cliente (los que dejan de latir caducan solos). */
export function escucharEnLinea(cb, minutos = 3) {
  const desde = Timestamp.fromMillis(Date.now() - minutos * 60000);
  const q = query(collection(db, COL_PRES), where("ts", ">", desde), orderBy("ts", "desc"), limit(30));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb(null));
}
