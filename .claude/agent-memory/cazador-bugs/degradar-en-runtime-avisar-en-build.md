---
name: degradar-en-runtime-avisar-en-build
description: En LQC ningún módulo de src/ debe lanzar al evaluarse (no hay ErrorBoundary: un throw apaga el sitio entero) — el "fallar fuerte" va como console.warn en vite.config.ts
metadata:
  type: feedback
---

Config faltante o rota se maneja **degradando en runtime** (devolver `null`, mostrar el
mensaje genérico de error) y **avisando fuerte en el build** con un `console.warn` desde
`vite.config.ts`. Ningún módulo bajo `src/` debe lanzar al ser evaluado.

**Why:** históricamente `src/App.tsx` no tenía ErrorBoundary y un throw en tiempo de
módulo desmontaba el **root completo** (sitio a negro, header y footer incluidos).
**Actualización 2026-07-23:** ya existe `src/components/ErrorBoundary.tsx` (class con
`getDerivedStateFromError`) y `App.tsx` envuelve todo en él, así que hoy un throw en un
chunk lazy caería en el fallback "Algo salió mal" en vez de a negro. Pero el contrato de
`obtenerSupabase()` (nunca lanzar, degradar a `null`) **sigue vigente y se mantiene**:
mostrar el mensaje genérico con la página en pie es mejor UX que la pantalla de error, y
sus llamadores dependen de que no lance. `<Suspense>` sigue capturando solo promesas
pendientes, no errores. Ya me pasó al conectar Supabase
(2026-07-22): validé las `VITE_*` con un throw en `src/lib/supabase.ts`, el build salió
verde con 0 warnings y el bundle quedó con un throw incondicional hardcodeado. Lo cazó el
`revisor`. El chequeo tampoco puede ser un hard fail del build: `npm run build` es la
verificación obligatoria antes de cada commit y hoy **nadie tiene `.env` local**, así que
cortar el build rompería el flujo de trabajo entero.

**How to apply:**
- Un throw en tiempo de módulo falla en el navegador del usuario final, no en el pipeline:
  no sirve como validación. Si querés que alguien se entere, el lugar es `vite.config.ts`
  con `loadEnv` — está fuera de `src/`, así que no rompe el invariante de cero `console.*`.
- Prefijá el aviso propio (`[LQC] Aviso: …`) para poder distinguirlo de un warning real de
  Rollup/Vite al verificar la salida del build (ver [[build-warnings-no-fallan]]).
- Tipá las variables de entorno como `string | undefined` en `src/vite-env.d.ts`: tiparlas
  `string` a secas miente justo en el invariante que se rompe en producción. Con el guard,
  TypeScript estrecha solo — nada de `!` ni casts.
- Ojo con `ReturnType<typeof createClient>` de supabase-js: `createClient` es un `const` de
  tipo función genérica, así que `ReturnType` instancia `Database` con su restricción
  (`unknown`) y no con su default (`any`), y todo insert termina pidiendo `never[]`. Usá el
  tipo exportado `SupabaseClient`.
- Un guard de "variable presente" no alcanza para prometer que algo no lanza:
  `createClient` **valida la URL y lanza por su cuenta** (`'ejemplo.supabase.co'` sin
  esquema, una URL malformada, o `'   '`, que es truthy y pasa el guard). Si el comentario
  promete "nunca lanza", el `try/catch` tiene que estar. Un comentario que promete más de
  lo que el código garantiza es peor que no tenerlo: el próximo lo llama fuera de un `try`.
- Cuidado con escribir `console` seguido de punto **incluso dentro de un comentario** en
  `src/`: el invariante se verifica con `grep -rn "console\." src/` → 0 y un comentario lo
  rompe igual. Redactalo como "sin logs" o "salida por consola".
- **`@supabase/*@2.110.x` declara `engines.node >= 22`.** El builder estaba en
  `node:20-alpine` y `npm ci` escupía seis `npm warn EBADENGINE` (uno por subpaquete):
  fallo latente que un `engine-strict=true` o una API de Node 22 en la librería habrían
  convertido en deploy caído. Solo se veía corriendo `docker build`, no `npm run build`
  local. **Resuelto 2026-07-23:** builder a `node:22-alpine` y `nixpacks.toml` a
  `nodejs_22` en el mismo commit (las dos vías de deploy juntas, o divergen). Con Node 22
  el build da 0 warnings y los assets salen con hash idéntico al de Node 20.
