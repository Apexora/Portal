import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, runTransaction, updateDoc, increment,
  serverTimestamp, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsw466_wzsiLtbjw6FXZ1_O3HQ_AkVyU8",
  authDomain: "album-apexora.firebaseapp.com",
  projectId: "album-apexora",
  appId: "1:17231648284:web:20edb8477453f50473f1d9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const CATALOGO_LOGROS = { tcg_primera_victoria: { nombre: "Primer duelo",  desc: "Gana una partida de Cartas Alfa", icono: "⚔️", juego: "tcg",   premio: { comun: 25 } },
tcg_10_victorias:     { nombre: "Duelista",      desc: "10 victorias en Cartas Alfa",     icono: "🏆", juego: "tcg",   premio: { comun: 100, rara: 1 } },
sala_primer_reto:     { nombre: "Desafiante",    desc: "Completa tu primer reto",         icono: "🎯", juego: "sala",  premio: { comun: 25 } },
album_primer_sobre:   { nombre: "Coleccionista", desc: "Abre tu primer sobre",            icono: "📖", juego: "album", premio: { comun: 25 } }, };

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
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists() || s.data().logros?.[id]) return false;
    const upd = { [`logros.${id}`]: { fecha: serverTimestamp(), juego: def.juego } };
    for (const [tipo, n] of Object.entries(def.premio || {})) upd[`fragmentos.${tipo}`] = increment(n);
    tx.update(ref, upd);
    return true;
  });
}

/* ---------- Esencias ----------
   comun = azul, rara = negra.
   premiar(): úsalo al terminar una partida. Máx 60 por premio y 300 por día;
   la rara solo puede salir una vez cada 6 h. Devuelve lo que realmente se dio. */
export async function premiar(comun, probRara = 0) {
  const ref = refJugador();
  try {
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
