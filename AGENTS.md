# LQC — League Querétaro Championship

Sitio web público de la **League Querétaro Championship (LQC)**, la liga de esports
de **Revolution505** en Querétaro. Es un sitio **estático de presentación**: torneos,
galería, información de la liga y contacto. **No hay backend propio** y el contenido **público** del sitio vive en los
componentes: sus páginas no leen ninguna base.

Dos cosas tocan Supabase:
- El **formulario público de `/registro`** hace un **INSERT anónimo** en la tabla
  `inscripciones`. No lee nada y no necesita sesión.
- El **panel de administración (`/admin`)**, detrás de login, **lee** esa tabla con
  un **SELECT autenticado** (agrupa las inscripciones por equipo). Tiene sesión de
  usuario; los admins se crean a mano en Supabase, no hay alta pública.

(El sitio además pide fuentes a Google Fonts desde `index.html`, pero eso no manda
datos de nadie.)

La RLS de `inscripciones`: **INSERT permitido para anónimos** (el registro público)
y **SELECT solo para usuarios autenticados** (el panel) — **nunca SELECT anónimo**.
Es lo acordado con quien administra el proyecto de Supabase. **No está en el repo,
pero se verificó de punta a punta en producción el 2026-07-23** (un INSERT anónimo
real llegó a la tabla). Si algún día un INSERT o un SELECT falla por permisos, ese
es el primer lugar donde mirar, no el código.

## Stack

- **React 19** + **TypeScript** (strict) + **Vite 7**
- **Tailwind CSS 4** vía `@tailwindcss/vite` — el tema se define con `@theme` en
  `src/index.css`, **no** hay `tailwind.config.js`
- **react-router-dom 7** — rutas declaradas en `src/App.tsx`
- `lucide-react` (iconos), `react-lazy-load-image-component` (galería)
- **`@supabase/supabase-js`** — INSERT anónimo del formulario de `/registro` y el
  login + SELECT autenticado del panel de `/admin`
- **Infra:** Docker + nginx (`Dockerfile`, `nginx.conf`) y `nixpacks.toml`

## Estructura

```
src/
  App.tsx                  rutas (<Route>) + fallback de carga + 404
  main.tsx                 entrypoint
  index.css                tema Tailwind (@theme), tokens y utilidades
  vite-env.d.ts            tipos de las variables de entorno (VITE_*)
  components/layout/
    Header.tsx             navegación (arreglo navItems) + menú móvil
    Footer.tsx
  lib/
    supabase.ts            cliente de Supabase (perezoso; devuelve null sin credenciales)
  pages/                   Home · Torneos · Galeria · Acerca · Contacto · Registro
    admin/                 panel protegido: Login · RutaProtegida · Panel · ListaInscripciones
public/                    assets, galeria/, images/, sponsors/, LOGO-COPA.ico
```

Las páginas se cargan con `lazy()` + `<Suspense>`. Cada página es un archivo
autocontenido con su markup y sus clases de Tailwind inline.

## Sistema de diseño (NO negociable)

- **Paleta azul/negro.** Azul principal `#0066ff`, acento cian `#00d4ff`, fondo
  `#0a0a0f`. La escala vive en `index.css` como tokens planos
  `--color-lqc-50` … `--color-lqc-900`, más `--color-lqc-accent` y
  `--color-lqc-metal`. En el markup conviven las clases `lqc-*` (superficies de
  marca: acento, CTA, tarjetas) y las `blue-*` de Tailwind para el resto.
- **REGLA "sin morado": nada de clases `purple-*`.** Es la regla de color central
  del proyecto. Ya no queda morado heredado (ver más abajo): `grep -rn "purple" src/`
  debe seguir dando **0 resultados**.
- **Tipografía:** títulos con `--font-heading` (**Orbitron**), cuerpo con
  `--font-sans` (**Inter**).
- **Sombras:** usar los tokens `--shadow-lqc`, `--shadow-lqc-lg`, `--shadow-lqc-xl`.
  No inventar sombras nuevas.
- **Todos los textos de la UI van en español**, con acentos correctos.
- **Mobile-first**, con breakpoints `md` y `lg`.
- Preferir clases de Tailwind inline; CSS suelto solo para tokens en `index.css`.

## Morado heredado — ya migrado

**No queda morado en el sitio.** Las 25 ocurrencias de `purple-*` que había en 6
archivos (`App.tsx`, `Home`, `Torneos`, `Acerca`, `Contacto`, `Galeria`) se
migraron a azul/cian el 2026-07-22. La verificación es
`grep -rn "purple" src/` → **0 resultados**.

Convenciones que dejó esa migración, a respetar en páginas nuevas:

- **Gradiente canónico de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
- **CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400` y `shadow-blue-900/30`. Rampa dentro de
  la escala `lqc` (#003d99 → #0066ff): salto de luminancia visible y ~4.8:1 con
  texto blanco. **No terminar en `lqc-accent`** (#00d4ff da 1.8:1 con blanco).
  Si el CTA es un `<a>` y no un `<button>`, agregarle `text-white`: la regla base
  `a { color: #66a3ff }` de `index.css` no da contraste sobre azul.
- **Tarjetas oscuras de CTA:** `from-blue-950/30 to-lqc-900/20`.
- Al necesitar cian, usar el token `lqc-accent` — nunca `cyan-*` ni un morado.

## Reglas de trabajo

1. **`npm run build` debe pasar sin errores de TypeScript antes de cualquier commit.**
   El script es `tsc -b && vite build`: si los tipos fallan, el build entero se corta.
   Ojo: que el build pase **no** garantiza que el formulario funcione — ver
   "Variables de entorno" más abajo.
2. Al **agregar o renombrar una página** hay que tocar **dos** lugares: la `<Route>`
   en `src/App.tsx` **y** el arreglo `navItems` en `src/components/layout/Header.tsx`.
   Olvidar el segundo es el error más fácil de cometer acá. El nav tiene hoy
   **6 ítems** (Inicio, Torneos, Galería, Acerca, Contacto, Registro).
3. **No inventar contenido** (fechas, resultados, nombres de torneos, patrocinadores).
   Si falta un dato, marcarlo como pendiente y preguntar.
4. Rama de trabajo: `main`. Remoto: `github.com/ChristianJair27/LQC`.
5. Fix mínimo: no refactorizar de más ni tocar lo no relacionado.

## Cómo trabajar en este proyecto

- **Medí el alcance real antes de actuar.** Antes de delegar o cambiar algo,
  contá las ocurrencias con `grep`. **No confíes en los conteos escritos en la
  documentación**: este archivo decía "17 ocurrencias" de `purple-*` y el conteo
  real era **25**. La doc envejece; el código no miente.
- **Cambios mínimos, un propósito por vez.** Nada de refactors oportunistas
  mientras arreglás otra cosa.
- **Después de cada cambio, verificá con `npm run build`**: debe terminar con
  **0 warnings y 0 errores**. Un warning nuevo es un fallo, no ruido. La regla
  es sobre `npm run build`: `docker build` emite 2 warnings esperados de
  BuildKit (`SecretsUsedInArgOrEnv`) que **no** hay que silenciar — ver
  "Variables de entorno".
- **Verificación independiente.** El reporte de un agente no alcanza como prueba.
  Confirmá por tu cuenta con `grep`, con el build y **leyendo el diff**.
- **Pasá los cambios visibles por el agente `revisor`** antes de commitear.
- **Un commit por propósito.** Nunca mezcles un fix de infraestructura con
  cambios de UI.
- **Mantené este archivo al día.** Si cambia un conteo o un canon de diseño,
  actualizalo **en el mismo commit** que introduce el cambio.

## Trampas conocidas (técnicas)

- **`@theme` solo acepta custom properties planas.** Los tokens van como
  `--color-lqc-500: #0066ff;`, uno por línea — **nunca** con sintaxis de objeto
  anidada entre llaves. Esa forma no es CSS válido: no compila, no genera
  utilidades y la paleta queda inerte mientras el build parece funcionar.
- **Tailwind 4 escanea todo el repo**, incluida `.claude/agent-memory/`. Los
  nombres de clase escritos **en prosa** (notas, documentación) se detectan como
  uso real y se cuelan al CSS de producción. Por eso `src/index.css` tiene
  `@source not "../.claude";` y `@source not "../*.md";` — **mantenelos**.
- **La regla base `a { color: #66a3ff }`** de `index.css` pisa el color de
  cualquier enlace. Todo `<a>` que funcione como CTA necesita `text-white`
  explícito o el contraste falla (llega a bajar a ~1.9:1). Los `<button>` no
  tienen el problema: la regla base ya les da `color: white`.
- **La regla base aplica un gradiente a todo `<button>`**, y las utilidades de
  Tailwind solo pisan `background-color`, **no `background-image`**. Un botón
  secundario con `bg-black/50` igual se pinta con el gradiente completo y termina
  viéndose **más vívido que el CTA primario**. Los secundarios necesitan `bg-none`.
- **Canon del CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400`.
- **Canon del gradiente de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
- **Un build verde puede salir con el formulario muerto.** Si faltan las
  variables de entorno de Supabase, `npm run build` **pasa igual** (0 errores,
  0 warnings) y el sitio se ve perfecto, pero `/registro` no guarda nada: el
  cliente devuelve `null` y el formulario muestra su error genérico. La única
  señal es el aviso `[LQC] Aviso: faltan variables de entorno …` que imprime
  `vite.config.ts`. **No lo pases por alto.** Detalle: sin credenciales Rollup
  elimina `supabase-js` entero como código muerto, así que ese build tampoco
  sirve para probar la ruta real (el chunk de `/registro` pasa de ~238 kB a
  ~25 kB).

## Variables de entorno

Un build **funcional** necesita las dos variables documentadas en `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — la clave **anon/publishable**, nunca la
  `service_role`: toda variable `VITE_*` se empaqueta en el bundle del navegador.

Se inyectan en **tiempo de build**, así que cambiarlas exige rebuildear. No hay
`.env` en el repo (está en `.gitignore`); copiá `.env.example` como `.env`.

**En Docker** van como build args (el `Dockerfile` las declara con `ARG` + `ENV`
en la etapa `builder`; Vite las lee de `process.env` vía `loadEnv`, sin que haga
falta generar un `.env`):

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=tu-clave-anon \
  -t lqc-web .
```

Si se omiten, la imagen se construye igual y sale con el formulario muerto: el
aviso `[LQC]` en el log del build es la única señal. BuildKit avisa
`SecretsUsedInArgOrEnv` por el nombre `*_KEY`: es un falso positivo esperado
—la anon key es pública por diseño— y **no se silencia a propósito**, porque esa
misma regla es la que avisaría si alguien pusiera la `service_role`.

`.dockerignore` deja fuera `.env` y `.env.*` (también `.env.example`, que el
build no necesita), además de `node_modules`, `dist` y `.git`.

**En nixpacks** (la otra vía de deploy) no hay nada que declarar en
`nixpacks.toml`: alcanza con configurar las dos variables en el entorno de
**build** de la plataforma, porque `loadEnv` las toma de `process.env`. Si la
plataforma solo las inyecta en runtime, no sirven: este es un sitio estático y
para cuando corre nginx el bundle ya está compilado. Nunca hardcodearlas en
`nixpacks.toml`: quedarían commiteadas.

**Verificado (2026-07-23):** las variables ya están configuradas en el deploy y
se confirmó un **registro real de punta a punta** — una inscripción anónima desde
producción llegó a la tabla `inscripciones`. Por eso `/registro` ya es una página
normal del nav (está en `navItems`).

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # tsc -b && vite build  ← la verificación obligatoria
npm run lint      # eslint
npm run preview   # sirve el build de producción
```

## Equipo de agentes

Definidos en `.claude/agents/`:

- **cazador-bugs** — depuración: causa raíz, fix mínimo, verificación con build.
- **ui-diseno** — UI, layout, responsive y estilo, con el sistema de diseño de arriba.
- **contenido** — copy y textos en español.
- **revisor** — revisión de código de solo lectura, antes de commitear.
