/* apexora-cristales · dibujo de los fragmentos.
   Sinfalita (comun)  = cristal cian brillante
   Odita     (rara)   = cristal negro
   Ambos son bipirámides IRREGULARES, como un mineral recién extraído: ápices descentrados,
   ecuador torcido, punta inferior astillada y facetas planas con distinta luz.
   cristal("sinfalita" | "odita") devuelve un <svg> (viewBox 48x64) listo para insertar. */

const FORMAS = {
  sinfalita: {
    // T = ápice superior · L,FL,FR,R = ecuador (izq, frente-izq, frente-der, der) · B1,B2 = punta inferior astillada
    p: { T: [27, 2], L: [6, 32], FL: [18, 42], FR: [33, 39], R: [43, 31], B1: [21, 60], B2: [25, 62] },
    rostro: ["#8ff8f4", "#dcfffd", "#35d6e2"],       // facetas de arriba (izq, frente, der)
    cuerpo: ["#12aabf", "#0b8ca7", "#06687f"],        // facetas de abajo (izq, frente, der)
    borde: "rgba(235,255,255,.7)",
    brillo: "#ffffff",
  },
  odita: {
    p: { T: [23, 5], L: [5, 35], FL: [15, 45], FR: [32, 43], R: [44, 32], B1: [19, 57], B2: [25, 60] },
    rostro: ["#2a2733", "#3e3950", "#1a1822"],
    cuerpo: ["#121018", "#0a090e", "#050407"],
    borde: "rgba(176,150,225,.4)",
    brillo: "#c8b6f2",
  },
};

const pts = (...v) => v.map((q) => q.join(",")).join(" ");

export function cristal(tipo) {
  const f = FORMAS[tipo] || FORMAS.sinfalita, P = f.p;
  const caras = [
    [P.T, P.L, P.FL, f.rostro[0]], [P.T, P.FL, P.FR, f.rostro[1]], [P.T, P.FR, P.R, f.rostro[2]],
    [P.L, P.FL, P.B1, f.cuerpo[0]], [P.FL, P.FR, P.B2, P.B1, f.cuerpo[1]], [P.FR, P.R, P.B2, f.cuerpo[2]],
  ].map((c) => `<polygon points="${pts(...c.slice(0, -1))}" fill="${c[c.length - 1]}"/>`).join("");
  // destello pequeño sobre la faceta frontal de arriba + una fractura fina en la de abajo
  const a = [(P.T[0] + P.FL[0]) / 2 + 1, (P.T[1] + P.FL[1]) / 2 + 4];
  const brillo = `<polygon class="br" points="${pts(a, [a[0] + 3.5, a[1] - 2.5], [a[0] + 5, a[1] + 2])}" fill="${f.brillo}" opacity=".75"/>`;
  const fractura = `<path d="M${P.FL[0] + 4} ${P.FL[1] + 3} L${P.B1[0] + 3} ${P.B1[1] - 6}" stroke="${f.borde}" stroke-width=".5" opacity=".6" fill="none"/>`;
  const contorno = `<polygon points="${pts(P.T, P.R, P.B2, P.B1, P.L)}" fill="none" stroke="${f.borde}" stroke-width=".9" stroke-linejoin="round"/>`;
  const aristas = `<path d="M${P.L} L${P.FL} L${P.FR} L${P.R} M${P.T} L${P.FL} M${P.T} L${P.FR}" stroke="${f.borde}" stroke-width=".6" stroke-linejoin="round" fill="none" opacity=".75"/>`;
  return `<svg class="cristal cristal--${tipo}" viewBox="0 0 48 64" aria-hidden="true" focusable="false">${caras}${fractura}${aristas}${contorno}${brillo}</svg>`;
}

export const NOMBRE_CRISTAL = { comun: "Sinfalita", rara: "Odita" };
