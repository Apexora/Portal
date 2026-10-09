import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, runTransaction, updateDoc, increment,
  serverTimestamp, collection, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 👇 Pegá aquí la config de tu proyecto (la misma que ya usan tus páginas)
const firebaseConfig = { /* apiKey, authDomain, projectId, ... */ };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ---------- Catálogo de logros (editable sin migrar nada) ----------
   premio: fragmentos que se entregan al desbloquear.
   Tipos: "comun" (fácil de conseguir) y "rara" (exclusivo, difícil). */
export const CATALOGO_LOGROS = {
  primera_visita: { nombre: "Primer paso",   desc: "Entraste a Apexora",        icono: "🌱", juego: "portal", premio: { comun: 10 } },
  racha_3:        { nombre: "Constante",     desc: "3 días seguidos",           icono: "🔥", juego: "portal", premio: { comun: 20 } },
  racha_7:        { nombre: "Una semana",    desc: "7 días seguidos",           icono: "⚡", juego: "portal", premio: { comun: 50, rara: 1 } },
  racha_30:       { nombre: "Leyenda viva",  desc: "30 días seguidos",          icono: "👑", juego: "portal", premio: { comun: 200, rara: 5 } },
  // Sumá los de Álbum, TCG y Desafío con el mismo formato.
};

/* ---------- Utilidades ---------- */
const DOMINIO = "@apexora.app";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); // YYYY-MM-DD
const ayer = (d) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
const aMail = (u) => {
  u = u.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) throw { code: "auth/usuario-invalido" };
  return u + DOMINIO;
};
const refJugador = () => doc(db, "players", auth.currentUser.uid);

/* ---------- Sesión ---------- */
export const onSesion = (cb) => onAuthStateChanged(auth, cb);
export const iniciarSesion = (u, c) => signInWithEmailAndPassword(auth, aMail(u), c);
export const registrar = (u, c) => createUserWithEmailAndPassword(auth, aMail(u), c);
export const cerrarSesion = () => signOut(auth);

/* ---------- Racha + creación del perfil ---------- */
export async function registrarVisita() {
  const u = auth.currentUser; if (!u) return null;
  const ref = doc(db, "players", u.uid), dia = hoy();
  const d = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) {
      const nuevo = {
        nombre: u.email.split("@")[0],
        streak: { current: 1, best: 1, lastDay: dia },
        logros: {}, fragmentos: { comun: 0, rara: 0 }, stats: {},
        creado: serverTimestamp(),
      };
      tx.set(ref, nuevo); return nuevo;
    }
    const x = s.data(), st = x.streak;
    if (st.lastDay === dia) return x;                       // ya contó hoy
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

/* ---------- Logros ---------- */
export async function desbloquearLogro(id) {
  const def = CATALOGO_LOGROS[id]; if (!auth.currentUser || !def) return false;
  const ref = refJugador();
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists() || s.data().logros?.[id]) return false;  // ya lo tenía
    const upd = { [`logros.${id}`]: { fecha: serverTimestamp(), juego: def.juego } };
    for (const [tipo, n] of Object.entries(def.premio || {})) upd[`fragmentos.${tipo}`] = increment(n);
    tx.update(ref, upd);
    return true;
  });
}

/* ---------- Fragmentos (tipo: "comun" | "rara") ---------- */
export const sumarFragmentos = (tipo, n) =>
  updateDoc(refJugador(), { [`fragmentos.${tipo}`]: increment(n) });

export async function gastarFragmentos(tipo, n) {
  const ref = refJugador();
  return runTransaction(db, async (tx) => {
    const f = (await tx.get(ref)).data().fragmentos;
    if (f[tipo] < n) return false;
    tx.update(ref, { [`fragmentos.${tipo}`]: f[tipo] - n });
    return true;
  });
}

/* ---------- Stats por juego: sumarStat("tcg","victorias") ---------- */
export const sumarStat = (juego, clave, n = 1) =>
  updateDoc(refJugador(), { [`stats.${juego}.${clave}`]: increment(n) });

/* ---------- Lecturas ---------- */
export async function obtenerPerfil() {
  if (!auth.currentUser) return null;
  const s = await getDoc(refJugador());
  return s.exists() ? s.data() : null;
}
export async function ranking(n = 10) {
  const q = query(collection(db, "players"), orderBy("streak.best", "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ uid: d.id, ...d.data() }));
}