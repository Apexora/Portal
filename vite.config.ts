import { defineConfig } from 'vite';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, parse } from 'node:path';

const EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** Lee public/avatares y genera avatares.json (la lista que usan el Portal y el HUD de todas las páginas). */
function avatares() {
  const dir = resolve(process.cwd(), 'public/avatares');
  const generar = () => {
    mkdirSync(dir, { recursive: true });
    const lista = readdirSync(dir)
      .filter((f) => EXT.test(f))
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
      .flatMap((f) => {
        const id = parse(f).name;
        if (!/^[\w-]{1,8}$/.test(id)) {
          console.warn(`[avatares] "${f}" se omite: el nombre (sin extensión) debe tener de 1 a 8 letras, números, _ o -`);
          return [];
        }
        return [{ id, archivo: f, nombre: id.replace(/[-_]+/g, ' ') }];
      });
    writeFileSync(resolve(dir, 'avatares.json'), JSON.stringify(lista, null, 2) + '\n');
  };
  return { name: 'apexora-avatares', buildStart: generar };
}

export default defineConfig({
  base: '/Portal/',
  plugins: [avatares()],
});
