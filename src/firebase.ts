import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  type User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAsw466_wzsiLtbjw6FXZ1_O3HQ_AkVyU8",
  authDomain: "album-apexora.firebaseapp.com",
  projectId: "album-apexora",
  appId: "1:17231648284:web:20edb8477453f50473f1d9"
};

export const isConfigured = true;
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const PORTAL = '/Portal/';            // ← ajusta a la ruta real de tu Portal
const DOM = '@apexora-sala.app';
const mail = (n: string) => n.trim().toLowerCase().replace(/\s+/g, '') + DOM;

// Día en hora Argentina (UTC-3); debe coincidir con las rules
function diaAR() {
  const d = new Date(Date.now() - 3 * 3600e3);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** Exige cuenta Apexora; si no hay sesión, manda al Portal y vuelve al terminar. */
export function requerirUsuario(): Promise<User> {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, async u => {
      off();
      if (u?.email?.endsWith(DOM)) { await asegurarBilletera(u.uid); resolve(u); }
      else location.href = PORTAL + '?volver=' + encodeURIComponent(location.href);
    });
  });
}
export const ensureUser = requerirUsuario;   // compatibilidad con el código actual

// ---------- Billetera de esencias ----------
const wRef = (uid: string) => doc(db, 'apexora_wallet', uid);

export async function asegurarBilletera(uid: string) {
  const s = await getDoc(wRef(uid));
  if (!s.exists()) await setDoc(wRef(uid), {
    azul: 0, negra: 0, hoy: 0, dia: diaAR(), ts: serverTimestamp(), tn: serverTimestamp()
  });
}
export async function leerBilletera(uid: string) {
  const d = (await getDoc(wRef(uid))).data();
  return { azul: d?.azul ?? 0, negra: d?.negra ?? 0 };
}



/** Da esencias al terminar una partida. Respeta los topes de las rules. */
export async function premiar(uid: string, azul: number, probNegra = 0) {
  try {
    const d = (await getDoc(wRef(uid))).data()!;
    const hoyPrevio = d.dia === diaAR() ? d.hoy : 0;
    const gan = Math.max(0, Math.min(azul, 60, 300 - hoyPrevio));
    const cooldownOk = Date.now() - d.tn.toMillis() > 6 * 3600e3 + 5000;
    const negra = cooldownOk && Math.random() < probNegra ? 1 : 0;
    await updateDoc(wRef(uid), {
      azul: d.azul + gan, negra: d.negra + negra,
      hoy: hoyPrevio + gan, dia: diaAR(),
      ts: serverTimestamp(), tn: negra ? serverTimestamp() : d.tn,
    });
    return { azul: gan, negra };
  } catch { return { azul: 0, negra: 0 }; }
}

export function netErr(e: unknown): string {
  const x = e as { code?: string; message?: string }, c = String(x?.code ?? '');
  if (c.includes('permission-denied')) return 'Firebase rechazó la operación (¿sala llena, ya empezada, sesión inválida o reglas sin publicar?).';
  if (c.includes('unavailable') || c.includes('network')) return 'Sin conexión con Firebase.';
  return x?.message ?? 'Error de conexión';
}

export async function registrar(nombre: string, clave: string, avatar: string) {
  const { user } = await createUserWithEmailAndPassword(auth, mail(nombre), clave);
  await setDoc(doc(db, 'apexora_profiles', user.uid),
    { name: nombre.trim(), avatar, login: user.email, created: Date.now() });
  await asegurarBilletera(user.uid);
}
export const entrar = (n: string, c: string) => signInWithEmailAndPassword(auth, mail(n), c);
export const salir = () => signOut(auth);
