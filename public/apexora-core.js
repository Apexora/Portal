/* apexora-core · UNA cuenta para todo Apexora. Esencia azul = fragmentos.comun · esencia negra = fragmentos.rara */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction, updateDoc, increment,
  serverTimestamp, collection, query, orderBy, limit, getDocs, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
  // Portal
  primera_visita:       { nombre: "Primer paso",   desc: "Entraste a Apexora",              icono: "🌱", juego: "portal", premio: { comun: 10 } },
  racha_3:              { nombre: "Constante",     desc: "3 días seguidos",                 icono: "🔥", juego: "portal", premio: { comun: 20 } },
  racha_7:              { nombre: "Una semana",    desc: "7 días seguidos",                 icono: "⚡", juego: "portal", premio: { comun: 50, rara: 1 } },
  racha_30:             { nombre: "Leyenda viva",  desc: "30 días seguidos",                icono: "👑", juego: "portal", premio: { comun: 200, rara: 5 } },
  // Cartas Alfa
  tcg_primera_victoria: { nombre: "Primer duelo",  desc: "Gana una partida de Cartas Alfa", icono: "⚔️", juego: "tcg",    premio: { comun: 25 } },
  tcg_10_victorias:     { nombre: "Duelista",      desc: "10 victorias en Cartas Alfa",     icono: "🏆", juego: "tcg",    premio: { comun: 100, rara: 1 } },
  // Sala de Desafíos
  sala_primer_reto:     { nombre: "Desafiante",    desc: "Completa tu primer reto",         icono: "🎯", juego: "sala",   premio: { comun: 25 } },
  // Álbum
  album_primer_sobre:   { nombre: "Coleccionista", desc: "Abre tu primer sobre",            icono: "📖", juego: "album",  premio: { comun: 25 } },
};

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
      if (u?.email?.endsWith(DOMINIO)) { await registrarVisita(); res(u); }
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

/* ---------- Esencias ----------
   comun = azul, rara = negra.
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
