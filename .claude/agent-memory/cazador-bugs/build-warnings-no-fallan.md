---
name: build-warnings-no-fallan
description: En LQC `npm run build` sale verde aunque el CSS de @theme esté roto — esbuild solo emite WARNING, así que hay que leer la salida completa, no el exit code
metadata:
  type: project
---

`npm run build` (`tsc -b && vite build`) termina con exit code 0 y `✓ built in Xs`
aunque `src/index.css` tenga CSS inválido dentro de `@theme`. esbuild reporta esos
problemas como `▲ [WARNING] ... [css-syntax-error]`, nunca como error.

**Why:** el `@theme` de `src/index.css` arrastra restos de la config vieja estilo
Tailwind 3 (paleta escrita con sintaxis de objeto anidado `--color-x: { 50: ...; }`).
Tailwind 4 espera custom properties planas (`--color-x-50: ...`). Con la sintaxis vieja
no se genera NINGUNA utilidad y nadie se entera, porque el build pasa. Esto ya pasó una
vez con la paleta `--color-lqc` (2026-07-22); si aparecen más tokens migrados a medias,
el síntoma va a ser idéntico.

**How to apply:**
- Al verificar cualquier fix de CSS, no te quedes con "el build pasó": grepeá la salida
  por `warning` / `css-syntax-error`. El objetivo es cero, no exit code 0.
- Un warning que dice `Expected identifier but found "<número>"` casi siempre apunta a
  un bloque de `@theme` con llaves anidadas.
- Para probar que un token de `@theme` genera utilidades de verdad sin tocar el marcado
  de los componentes: creá un archivo sonda temporal en `src/` (Tailwind 4 escanea el
  filesystem, no el grafo de imports), poné las clases candidatas en un `className`,
  buildeá, grepeá el CSS de `dist/assets/*.css`, y borrá la sonda. Tiene que compilar
  con TS porque `tsc -b` corre antes que vite.

Ver también [[theme-lqc-namespaces]].
